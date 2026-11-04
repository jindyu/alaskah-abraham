import * as THREE from 'three';
import { PAL } from '../world/palette';
import { VoxelBuilder } from '../world/voxel';
import type { Collision } from '../world/collision';
import { DEFAULT_APPEARANCE, colorOf, type Appearance } from './appearance';

const T = 1 / 16;

/** 부위 하나를 피벗 그룹으로 만든다. 피벗 원점 = 관절 위치 */
function part(fn: (b: VoxelBuilder) => void, seed: number): THREE.Group {
  const b = new VoxelBuilder(seed, false);
  b.defaultJitter = 0;
  fn(b);
  return b.build(true, true);
}

export function blobShadow(radius: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 12),
    new THREE.MeshBasicMaterial({ color: 0x17120e, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  m.renderOrder = 1;
  return m;
}

/** 실루엣 무리: 사람(플레이어·식구)과 짐승(짐승·양). 무리별로 따로 켜고 끈다 */
export type SilhouetteGroup = 'person' | 'animal';

/** 고스트 재질은 (무리, 색)마다 하나를 모든 메시가 공유 → 재질 하나의 visible 로 한 번에 켜고 끔 */
const ghostMats = new Map<string, THREE.MeshBasicMaterial>();
const ghostList: { group: SilhouetteGroup; mat: THREE.MeshBasicMaterial }[] = []; // 프레임마다 도는 목록 (Map 반복자 할당 회피)
const silhouetteOn: Record<SilhouetteGroup, boolean> = { person: true, animal: true };

/**
 * 가려짐 실루엣을 무리별로 켜고 끈다. 재질의 visible 만 바꾸므로 프레임마다 불러도 할당이 없다
 * (컷신·원경·방주 우리 안에서는 낮은 난간·돌담에 일부만 가려진 발치가 보라색 얼룩이 되므로 끔)
 */
export function setSilhouettes(person: boolean, animal: boolean) {
  silhouetteOn.person = person;
  silhouetteOn.animal = animal;
  for (let i = 0; i < ghostList.length; i++) ghostList[i].mat.visible = silhouetteOn[ghostList[i].group];
}

/** 실루엣을 켤 조건: 컷신·원경 카메라에서는 전부 끄고, 방주 안 우리 칸의 짐승도 끈다 */
export function silhouetteRule(cutRunning: boolean, vista: boolean, where: string): { person: boolean; animal: boolean } {
  const off = cutRunning || vista;
  return { person: !off, animal: !off && where !== 'ark' };
}

/**
 * 가려짐 실루엣: 캐릭터가 나무/지붕 뒤에 있을 때 윤곽을 비쳐 보이게 한다.
 * 본체는 스텐실 1을 쓰고, 고스트는 깊이 테스트가 반대(GreaterDepth)이며 스텐실≠1인 곳에만 그려
 * 자기 몸끼리 겹친 부분에는 나타나지 않는다.
 */
export function addOccludedSilhouette(root: THREE.Object3D, color = 0x3c2c58, group: SilhouetteGroup = 'person') {
  const key = `${group}:${color}`;
  let ghostMat = ghostMats.get(key);
  if (!ghostMat) {
    ghostMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.45, depthWrite: false, depthFunc: THREE.GreaterDepth,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
    });
    ghostMat.visible = silhouetteOn[group];
    ghostMats.set(key, ghostMat);
    ghostList.push({ group, mat: ghostMat });
  }
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if (o instanceof THREE.Mesh && !(o.material instanceof THREE.MeshBasicMaterial)) meshes.push(o); });
  for (const m of meshes) {
    const mat = (m.material as THREE.Material).clone();
    Object.assign(mat, {
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    });
    m.material = mat;
    m.renderOrder = 10;
    const g = new THREE.Mesh(m.geometry, ghostMat);
    g.renderOrder = 11;
    g.castShadow = false;
    m.add(g);
  }
}

/** 머리 모양 4가지. 원점 = 목, 머리 상자는 y 0~0.44, x ±0.25, z ±0.22 */
function hair(b: VoxelBuilder, style: number, c: number, hi: number) {
  // 공통: 앞머리 + 앞 구레나룻
  b.box(-0.06, 0.27, 0.222, 0.34, 0.06, 0.03, c);
  for (const sx of [-1, 1]) b.box(sx * 0.21, 0.19, 0.222, 0.08, 0.14, 0.02, c);
  if (style === 1) {
    // 곱슬머리: 정수리와 옆에 몽글몽글한 덩이
    b.box(0, 0.38, -0.02, 0.52, 0.1, 0.47, c);
    for (const [x, z] of [[-0.18, 0.12], [0, 0.14], [0.18, 0.12], [-0.2, -0.08], [0.02, -0.06], [0.2, -0.1], [-0.08, -0.2], [0.12, -0.2]])
      b.box(x, 0.44, z, 0.16, 0.1, 0.16, (x + z) > 0 ? hi : c);
    b.box(0, 0.0, -0.24, 0.56, 0.42, 0.08, c);
    for (const sx of [-1, 1]) {
      b.box(sx * 0.27, 0.08, -0.12, 0.06, 0.36, 0.22, c);
      b.box(sx * 0.27, 0.3, 0.03, 0.06, 0.12, 0.12, c);
    }
    return;
  }
  // 짧은/묶은/긴 머리 공통 정수리와 뒷머리
  b.box(0, 0.38, -0.02, 0.54, 0.12, 0.49, c);
  b.box(0.06, 0.5, -0.04, 0.34, 0.05, 0.3, hi); // 정수리 윤기
  b.box(0, 0.04, -0.235, 0.54, 0.38, 0.06, c);
  // 옆머리는 뒤쪽 절반만 → 옆모습에서 얼굴 옆면과 귀가 보임
  for (const sx of [-1, 1]) {
    b.box(sx * 0.262, 0.1, -0.13, 0.04, 0.32, 0.2, c);
    b.box(sx * 0.262, 0.28, 0.02, 0.04, 0.1, 0.12, c);
  }
  if (style === 2) {
    // 묶은 머리: 뒤통수에서 늘어진 꽁지 + 끈
    b.box(0, 0.14, -0.3, 0.16, 0.2, 0.1, c);
    b.box(0, -0.2, -0.32, 0.13, 0.34, 0.1, c);
    b.box(0, 0.1, -0.31, 0.18, 0.05, 0.12, PAL.fabric.saffron);
  } else if (style === 3) {
    // 긴 머리: 뒤로 어깨 아래까지, 옆으로도 길게
    b.box(0, -0.34, -0.23, 0.56, 0.4, 0.08, c);
    for (const sx of [-1, 1]) b.box(sx * 0.265, -0.2, -0.08, 0.05, 0.34, 0.26, c);
  }
}

export interface MoveInput { x: number; z: number; run: boolean }

/**
 * 노아 가족의 한 사람. 외형(Appearance)으로 복셀 모델을 만들고, 바꾸면 다시 짓는다.
 * 관절(피벗 그룹)은 그대로 두고 안의 메시만 교체하므로 애니메이션 코드는 외형과 무관하다.
 * 정면(+z)을 보고 만들고, 이동 방향으로 부드럽게 회전한다.
 */
/** 서서 하는 일 동작 (방주 터의 식구들): 망치질·톱질·설계도 보기·가리키기·널 나르기·길이 재기·땀 닦기 */
export type WorkPose = 'hammer' | 'saw' | 'study' | 'point' | 'carry' | 'measure' | 'wipe' | 'caulk';
export const WORK_POSES: readonly WorkPose[] = ['hammer', 'saw', 'study', 'point', 'carry', 'measure', 'wipe', 'caulk'];
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const HELD_TOOLS: ReadonlySet<string> = new Set(['hoe', 'jar', 'sickle', 'axe', 'rake']);

/** 손에 든 도구 모양. 원점 = 오른쪽 어깨, 손은 (0, -0.4, 0.02) — 팔을 앞으로 들면 도구가 앞으로 뻗음 */
function heldToolModel(b: VoxelBuilder, id: string) {
  switch (id) {
    case 'axe':
      b.box(0, -0.5, 0.03, 0.05, 0.4, 0.05, PAL.wood[3]);
      b.box(0, -0.3, 0.1, 0.05, 0.16, 0.18, PAL.stone[1]);
      b.box(0, -0.3, 0.2, 0.03, 0.18, 0.04, PAL.stone[4]);
      break;
    case 'hoe':
      b.box(0, -0.6, 0.03, 0.05, 0.55, 0.05, PAL.wood[3]);
      b.box(0, -0.88, 0.1, 0.05, 0.05, 0.18, PAL.stone[1]);
      b.box(0, -0.9, 0.18, 0.04, 0.05, 0.05, PAL.stone[3]);
      break;
    case 'sickle':
      b.box(0, -0.47, 0.03, 0.05, 0.2, 0.05, PAL.wood[3]);
      b.box(0, -0.6, 0.08, 0.02, 0.04, 0.14, PAL.stone[3]);
      b.box(0, -0.58, 0.17, 0.02, 0.05, 0.06, PAL.stone[4]);
      break;
    case 'jar':
      // 손잡이를 쥐고 늘어뜨린 물통
      b.box(0, -0.42, 0.02, 0.2, 0.025, 0.025, PAL.stone[3], { jitter: 0 });
      b.box(0, -0.55, 0.02, 0.19, 0.14, 0.19, PAL.wood[3]);
      b.box(0, -0.5, 0.02, 0.21, 0.025, 0.21, PAL.stone[3], { jitter: 0 });
      b.box(0, -0.62, 0.02, 0.17, 0.02, 0.17, PAL.wood[1]);
      break;
    case 'rake':
      b.box(0, -0.62, 0.03, 0.05, 0.55, 0.05, PAL.wood[3]);
      b.box(0, -0.9, 0.06, 0.26, 0.03, 0.05, PAL.wood[2]);
      for (const sx of [-0.1, -0.03, 0.04, 0.11]) b.box(sx, -0.95, 0.06, 0.025, 0.07, 0.025, PAL.wood[1]);
      break;
  }
}

export class Player {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  /** 카메라 쪽으로 살짝 기울여 얼굴이 더 보이게 하는 부모 (빌보드 린) */
  private readonly lean = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly eyes = new THREE.Group();
  readonly radius = 0.28;
  facing = 0;
  /** 커스터마이징 화면에서 천천히 도는 턴테이블 모드 */
  turntable = false;
  /** 걷는 속도 배율 (NPC는 느긋하게) */
  speedMul = 1;
  private phase = 0;
  /** 발이 땅에 닿은 횟수 (걷기 반주기마다 1) — 발소리를 걸음 동작에 맞춤 */
  get stepIndex() { return Math.floor(this.phase / Math.PI); }
  private moveBlend = 0;
  private time = 0;
  private nextBlink = 2.5;
  /** 이번 프레임에 실제로 움직였는지 (동료 양이 참고) */
  moving = false;
  /** 서서 하는 일 동작 (null 이면 평소 자세). 움직이기 시작하면 저절로 풀림 */
  private pose: WorkPose | null = null;
  private poseBlend = 0;
  /** 손에 든 도구 (오른손). 도구가 아니거나 null 이면 맨손 */
  private heldId: string | null = null;
  private actionAge = 1;
  private actionTool: string | null = null;
  /** 행동 판정과 분리된 짧은 시각 동작. 재입력은 마지막 한 동작으로 합친다. */
  playAction() { this.actionAge = 0; this.actionTool = this.heldId; }
  private heldTool = new THREE.Group();
  private heldBlend = 0;
  /** 손에 들 도구를 바꿈 (hoe·jar·sickle·axe·rake). 다른 것은 맨손 */
  setHeld(id: string | null) {
    const next = id && HELD_TOOLS.has(id) ? id : null;
    if (next === this.heldId) return;
    this.heldId = next;
    this.rebuildHeld();
  }
  private rebuildHeld() {
    for (const c of [...this.heldTool.children]) { this.heldTool.remove(c); c.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); }
    this.heldTool.parent?.remove(this.heldTool);
    if (!this.heldId) return;
    this.heldTool.add(part((b) => heldToolModel(b, this.heldId!), 70));
    // 손(0, -0.4, 0.02)을 중심으로 키움: 작은 복셀 도구가 멀리서도 보이게
    const k = 1.4;
    this.heldTool.scale.setScalar(k);
    this.heldTool.position.set(0, -0.4 * (1 - k), 0.02 * (1 - k));
    this.armR.add(this.heldTool);
  }
  private hammer = new THREE.Group();
  private saw = new THREE.Group();
  private plank = new THREE.Group();
  private brush = new THREE.Group();
  setPose(p: WorkPose | null) {
    if (this.pose === p) return;
    this.pose = p;
    this.hammer.visible = p === 'hammer';
    this.saw.visible = p === 'saw';
    this.plank.visible = p === 'carry';
    this.brush.visible = p === 'caulk';
  }
  /** 손에 드는 연장·널: 외형을 다시 지을 때마다 팔·몸에 새로 붙임 (보일 때만 켬) */
  private buildTools() {
    for (const g of [this.hammer, this.saw, this.plank, this.brush]) {
      g.parent?.remove(g);
      for (const c of [...g.children]) { g.remove(c); c.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); }
    }
    this.hammer.add(part((b) => {
      // 원점 = 손. 팔 방향(아래, -y)으로 자루, 끝에 쇠망치 머리
      b.box(0, -0.52, 0.02, 0.05, 0.3, 0.05, PAL.wood[3]);
      b.box(0, -0.7, 0.02, 0.18, 0.1, 0.1, PAL.stone[1]);
      b.box(0, -0.7, 0.02, 0.19, 0.03, 0.11, PAL.stone[3]);
    }, 61));
    this.saw.add(part((b) => {
      b.box(0, -0.45, 0.02, 0.05, 0.1, 0.07, PAL.wood[3]);
      b.box(0, -0.72, 0.02, 0.02, 0.5, 0.13, PAL.stone[3]);
      b.box(0, -0.96, 0.02, 0.03, 0.02, 0.13, PAL.stone[1]);
    }, 62));
    this.plank.add(part((b) => {
      b.box(0, 0, 0, 0.16, 0.06, 0.95, PAL.wood[4]);
      b.box(0, 0.035, 0, 0.12, 0.01, 0.93, PAL.wood[3], { jitter: 0.02 });
    }, 63));
    this.plank.position.set(0, 0.5, 0.42);
    this.brush.add(part(b => {
      b.box(0, -.62, .02, .045, .28, .045, PAL.wood[3]);
      b.box(0, -.76, .02, .18, .09, .07, 0x30251c);
    }, 64));
    this.hammer.visible = this.saw.visible = this.plank.visible = this.brush.visible = false;
    this.armR.add(this.hammer, this.saw, this.brush);
    this.body.add(this.plank);
    this.hammer.visible = this.pose === 'hammer'; this.saw.visible = this.pose === 'saw'; this.plank.visible = this.pose === 'carry';
    this.brush.visible = this.pose === 'caulk';
    this.rebuildHeld();
  }

  constructor(app: Appearance = DEFAULT_APPEARANCE) {
    this.legL.position.set(-0.12, 0.44, 0);
    this.legR.position.set(0.12, 0.44, 0);
    this.armL.position.set(-0.33, 0.84, 0);
    this.armR.position.set(0.33, 0.84, 0);
    this.head.position.set(0, 0.88, 0);
    this.eyes.position.set(0, 0.2, 0.225);
    this.body.add(this.torso, this.legL, this.legR, this.armL, this.armR, this.head);
    this.lean.add(this.body);
    this.lean.rotation.x = -0.35;
    this.lean.scale.setScalar(1.12);
    this.root.add(this.lean, blobShadow(0.32));
    this.setAppearance(app);
  }

  /** 외형을 바꿔 모델을 다시 지음 */
  setAppearance(app: Appearance) {
    for (const g of [this.torso, this.legL, this.legR, this.armL, this.armR, this.head, this.eyes]) {
      for (const c of [...g.children]) {
        if (c === this.eyes) continue;
        g.remove(c);
        c.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      }
    }
    const tunic = colorOf('tunic', app.tunic);
    const tunicDark = new THREE.Color(tunic).multiplyScalar(0.72).getHex();
    const stripe = colorOf('stripe', app.stripe);
    const skin = colorOf('skin', app.skin);
    const skinDark = new THREE.Color(skin).multiplyScalar(0.85).getHex();
    const hairC = colorOf('hairColor', app.hairColor);
    // 윤기: 흰색을 섞으면 회색 모자처럼 보여서, 같은 색조를 밝게만 함
    const hairHi = new THREE.Color(hairC).multiplyScalar(1.45).getHex();
    const band = PAL.fabric.indigo, cloth = PAL.fabric.cream;
    const mantle = app.mantle > 0 ? colorOf('mantle', app.mantle) : null;
    const mantleDark = mantle !== null ? new THREE.Color(mantle).multiplyScalar(0.8).getHex() : 0;

    const leg = (s: number) => part((b) => {
      // 원점 = 엉덩이 관절(y 0.44). 아래로 뻗음
      b.box(0, -0.44, 0.02, 0.19, 0.07, 0.25, PAL.wood[1]); // 샌들
      b.box(0, -0.37, 0, 0.17, 0.26, 0.17, skin);
      b.box(0, -0.3, 0.0, 0.18, T, 0.18, PAL.wood[2]); // 발목 끈
      b.box(0, -0.12, 0, 0.18, 0.12, 0.18, tunicDark);
    }, 11 + s);
    this.legL.add(leg(0)); this.legR.add(leg(1));

    this.torso.add(part((b) => {
      // 치마단
      b.box(0, 0.3, 0, 0.56, 0.25, 0.42, tunic);
      b.box(0, 0.3, 0, 0.58, T, 0.44, tunicDark);
      // 몸통
      b.box(0, 0.55, 0, 0.5, 0.32, 0.36, tunic);
      // 클라비(세로 줄무늬) 앞뒤
      for (const sx of [-0.12, 0.12]) {
        b.box(sx, 0.34, 0.215, T, 0.52, T, stripe);
        b.box(sx, 0.34, -0.215, T, 0.52, T, stripe);
      }
      // 허리띠 + 늘어진 끝
      b.box(0, 0.58, 0, 0.53, 0.07, 0.39, PAL.wood[2]);
      b.box(0.16, 0.44, 0.2, 0.07, 0.14, T, PAL.wood[2]);
      // 목 둘레
      b.box(0, 0.86, 0, 0.3, 0.04, 0.24, tunicDark);
      b.box(0, 0.86, 0.02, 0.2, 0.045, 0.2, skinDark);
      // 겉옷: 등판 + 어깨 + 앞자락 두 줄 (클라비가 가운데로 보이게 앞은 트임)
      if (mantle !== null) {
        b.box(0, 0.3, -0.22, 0.58, 0.58, 0.05, mantle);
        b.box(0, 0.8, -0.02, 0.6, 0.08, 0.44, mantle);
        for (const sx of [-1, 1]) {
          b.box(sx * 0.27, 0.3, 0, 0.05, 0.56, 0.4, mantle);
          b.box(sx * 0.22, 0.3, 0.2, 0.08, 0.56, 0.05, mantleDark);
        }
      }
    }, 21));

    const arm = (s: number) => part((b) => {
      // 원점 = 어깨
      b.box(0, -0.22, 0, 0.16, 0.24, 0.18, mantle ?? tunic);
      b.box(0, -0.22, 0, 0.17, T, 0.19, mantle !== null ? mantleDark : stripe);
      b.box(0, -0.38, 0, 0.13, 0.16, 0.14, skin);
      b.box(0, -0.42, 0.01, 0.14, 0.06, 0.15, skinDark);
    }, 31 + s);
    this.armL.add(arm(0)); this.armR.add(arm(1));

    this.head.add(part((b) => {
      // 원점 = 목
      b.box(0, 0, 0, 0.5, 0.44, 0.44, skin);
      // 볼 홍조, 코, 귀
      for (const sx of [-1, 1]) {
        b.box(sx * 0.17, 0.1, 0.222, 0.07, 0.04, T, PAL.fabric.rose);
        b.box(sx * 0.258, 0.1, -0.01, 0.04, 0.1, 0.08, skinDark);
      }
      b.box(0, 0.14, 0.23, 0.06, 0.05, 0.03, skinDark);
      hair(b, app.hair, hairC, hairHi);
      if (app.beard === 1) {
        // 턱을 감싸는 짧은 수염 (입 자리는 비움)
        b.box(0, -0.02, 0.2, 0.44, 0.1, 0.07, hairC);
        for (const sx of [-1, 1]) b.box(sx * 0.2, -0.02, 0.06, 0.06, 0.2, 0.22, hairC);
        b.box(0, 0.06, 0.232, 0.14, 0.03, 0.02, hairC);
      }
      if (app.head === 1) {
        // 남색 머리띠 + 뒤로 늘어진 끈
        b.box(0, 0.33, -0.02, 0.56, 0.06, 0.5, band);
        b.box(0.1, 0.12, -0.28, 0.06, 0.22, 0.04, band);
        b.box(0.17, 0.16, -0.275, 0.06, 0.18, 0.04, band);
      } else if (app.head === 2) {
        // 머릿수건: 정수리를 얇게 덮고 옆·뒤로 어깨까지 드리움 + 머리띠로 묶음
        b.box(0, 0.4, -0.03, 0.56, 0.14, 0.5, cloth);
        b.box(0, 0.54, -0.04, 0.44, 0.03, 0.38, cloth);
        // 머리카락보다 바깥에 띄워서 면이 겹쳐 깜빡이지 않게
        for (const sx of [-1, 1]) b.box(sx * 0.3, -0.06, -0.1, 0.04, 0.46, 0.28, cloth);
        b.box(0, -0.38, -0.3, 0.64, 0.8, 0.05, cloth); // 긴 머리도 덮도록 등까지
        b.box(0, 0.33, 0.0, 0.575, 0.05, 0.47, band);
      }
    }, 41));

    this.eyes.add(part((b) => {
      for (const sx of [-1, 1]) {
        b.box(sx * 0.11, -0.07, 0, 0.0625, 0.125, 0.02, 0x201410);
        b.box(sx * 0.11 + 0.012, 0.01, 0.006, 0.03, 0.03, 0.02, 0xf8f0e0); // 눈 반짝임
        b.box(sx * 0.252, -0.07, -0.07, 0.02, 0.11, 0.0625, 0x201410); // 옆모습 눈
      }
    }, 51));
    if (!this.eyes.parent) this.head.add(this.eyes);
    addOccludedSilhouette(this.body);
    this.buildTools();
  }

  private applyPose(p: WorkPose, k: number) {
    const t = this.time;
    // 목표 각도 (기본은 평소 서 있는 자세)
    let aLx = 0, aRx = 0, aLz = -0.06, aRz = 0.06, lean = 0, hx = 0, hy = 0;
    switch (p) {
      case 'caulk': {
        const sweep = Math.sin(t * 2.7);
        aRx = -1.1 + sweep * .24; aRz = .2 + sweep * .12; aLx = -.65; lean = .13; hx = .2;
        break;
      }
      case 'hammer': {
        const strike = Math.pow(Math.max(0, Math.sin(t * 6.5)), 2);
        aRx = lerp(-2.25, -0.65, strike); aLx = -0.9; aLz = 0.2; lean = 0.08 + 0.1 * strike; hx = 0.18;
        break;
      }
      case 'saw': {
        const s = Math.sin(t * 5);
        aRx = -1.15 + s * 0.38; aLx = -1.0 + s * 0.38; aLz = 0.12; aRz = -0.02; lean = 0.22 + s * 0.05; hx = 0.28;
        break;
      }
      case 'study':
        hx = 0.42; hy = Math.sin(t * 0.7) * 0.4; aRx = -1.05 + Math.sin(t * 1.4) * 0.1; aLx = -0.25; aRz = -0.05; lean = 0.08;
        break;
      case 'point':
        aRx = -1.35 + Math.sin(t * 1.2) * 0.12; aRz = 0.4; hy = Math.sin(t * 0.5) * 0.35; hx = -0.05;
        break;
      case 'carry':
        aLx = aRx = -1.2; aLz = 0.18; aRz = -0.18; lean = -0.04; hx = 0.05;
        break;
      case 'measure': {
        const w = 1.2 + Math.sin(t * 0.9) * 0.28;
        aLx = aRx = -0.15; aLz = -w; aRz = w; hy = Math.sin(t * 0.9) * 0.2; hx = 0.1;
        break;
      }
      case 'wipe':
        aRx = -2.55 + Math.sin(t * 5) * 0.08; aRz = 0.55; hx = -0.1; lean = -0.03;
        break;
    }
    this.armL.rotation.x = lerp(this.armL.rotation.x, aLx, k);
    this.armR.rotation.x = lerp(this.armR.rotation.x, aRx, k);
    this.armL.rotation.z = lerp(this.armL.rotation.z, aLz, k);
    this.armR.rotation.z = lerp(this.armR.rotation.z, aRz, k);
    this.body.rotation.x = lerp(this.body.rotation.x, lean, k);
    this.head.rotation.x = lerp(this.head.rotation.x, hx, k);
    this.head.rotation.y = lerp(this.head.rotation.y, hy, k);
  }

  get position() {
    return this.root.position;
  }

  face(rad: number) {
    this.facing = rad;
    this.body.rotation.y = rad;
  }

  faceTo(x: number, z: number) {
    this.facing = Math.atan2(x - this.root.position.x, z - this.root.position.z);
    this.body.rotation.y = this.facing;
  }

  update(dt: number, input: MoveInput, col: Collision, dynamic: { x: number; z: number; r: number }[]) {
    this.time += dt;
    const len = Math.hypot(input.x, input.z);
    const speed = (input.run ? 6.2 : 3.6) * this.speedMul;
    const moving = len > 0.01 && !this.turntable;
    this.moving = moving;

    if (moving) {
      const nx = input.x / len, nz = input.z / len;
      const p = this.root.position;
      const next = { x: p.x + nx * speed * dt, z: p.z + nz * speed * dt };
      col.resolve(next, this.radius);
      for (const d of dynamic) {
        const dx = next.x - d.x, dz = next.z - d.z, m = this.radius + d.r;
        const dd = Math.hypot(dx, dz);
        if (dd < m && dd > 1e-4) { next.x = d.x + (dx / dd) * m; next.z = d.z + (dz / dd) * m; }
      }
      col.resolve(next, this.radius);
      p.x = next.x; p.z = next.z;
      // 진행 방향으로 회전 (최단 각)
      const target = Math.atan2(nx, nz);
      let diff = target - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * Math.min(1, dt * 16);
      this.phase += dt * (input.run ? 15 : 10.5) * Math.sqrt(this.speedMul);
    }
    // 커스터마이징 화면: 제자리에서 천천히 한 바퀴씩
    if (this.turntable) this.facing += dt * 0.9;
    this.moveBlend += ((moving ? 1 : 0) - this.moveBlend) * Math.min(1, dt * 12);
    this.body.rotation.y = this.facing;

    // 걷기: 다리/팔 교차 스윙 + 통통 튀는 몸
    const mb = this.moveBlend;
    const swing = Math.sin(this.phase) * (input.run ? 0.85 : 0.65) * mb;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.9;
    this.armR.rotation.x = swing * 0.9;
    this.armL.rotation.z = -0.06 - 0.06 * mb;
    this.armR.rotation.z = 0.06 + 0.06 * mb;
    const bob = Math.abs(Math.sin(this.phase)) * 0.06 * mb;
    const breathe = Math.sin(this.time * 2.2) * 0.012 * (1 - mb);
    this.body.position.y = bob;
    this.head.position.y = 0.88 + breathe;
    this.head.rotation.x = (input.run ? 0.12 : 0.04) * mb;
    this.body.rotation.x = (input.run ? 0.1 : 0.03) * mb;
    this.body.rotation.z = Math.sin(this.phase) * 0.025 * mb;

    // 손에 든 도구: 맨손이 아니면 오른팔을 살짝 앞으로 들어 올림 (일 동작 중에는 그 동작이 우선)
    this.heldBlend += ((this.heldId && !this.pose ? 1 : 0) - this.heldBlend) * Math.min(1, dt * 10);
    if (this.heldBlend > 0.01) {
      this.armR.rotation.x = lerp(this.armR.rotation.x, -0.4 + Math.sin(this.phase) * 0.35 * mb, this.heldBlend);
      this.armR.rotation.z = lerp(this.armR.rotation.z, 0.02, this.heldBlend);
    }
    // 서서 하는 일 동작: 움직이지 않는 동안 팔·몸·머리를 일에 맞게 (걷기 동작 위에 덮어씀)
    this.poseBlend += ((this.pose && !moving ? 1 : 0) - this.poseBlend) * Math.min(1, dt * 8);
    if (this.poseBlend > 0.01 && this.pose) this.applyPose(this.pose, this.poseBlend);
    else if (Math.abs(this.head.rotation.y) > 0.001) this.head.rotation.y *= 0.8; // 일 동작이 끝나면 고개를 바로

    this.actionAge = Math.min(1, this.actionAge + dt);
    if (this.actionAge < 0.5 && !this.pose && !this.turntable) {
      const t = this.actionAge / 0.5;
      const heavy = this.actionTool === 'axe' || this.actionTool === 'hoe';
      // 들어 올림 → 빠른 타격 → 반동과 복귀. 판정·이동 속도는 바꾸지 않는다.
      const lift = Math.sin(Math.min(1, t / 0.3) * Math.PI / 2);
      const strike = t < 0.3 ? -lift * (heavy ? 1.7 : 0.9)
        : (heavy ? 0.65 : -0.35) * Math.sin((t - 0.3) / 0.7 * Math.PI);
      const envelope = Math.sin(t * Math.PI);
      this.armR.rotation.x += strike;
      this.armL.rotation.x -= envelope * (heavy ? 0.45 : 0.2);
      this.body.rotation.x += envelope * (heavy ? 0.12 : 0.05);
      this.head.rotation.x += envelope * 0.1;
    }

    // 깜빡임
    this.nextBlink -= dt;
    const blinking = this.nextBlink < 0.12;
    this.eyes.scale.y = blinking ? 0.2 : 1;
    if (this.nextBlink < 0) this.nextBlink = 2 + Math.random() * 3;
  }
}
