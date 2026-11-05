import * as THREE from 'three';
import { Collision } from '../collision';
import { PAL, PAL_REGION } from '../palette';
import { VoxelBuilder } from '../voxel';
import { buildNomadTent } from '../props/biblicalProps';
import { Px, TD, ditherPick } from '../textures';
import { fbm, hash2, valueNoise } from '../../core/rng';

export interface EsauCampStage {
  root: THREE.Group;
  col: Collision;
  spawn: { x: number; z: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  potPos: THREE.Vector3;
  jacobSpot: THREE.Vector3;
  esauSpot: THREE.Vector3;
  stewMesh: THREE.Group;
  updateAnimations(dt: number, time: number): void;
}

const CAMP_HALF = 24; // 48x48m

/** 가나안 헤브론 구릉지 대지: 메마른 사막 황토와 드문드문 돋아난 에셀나무 풀밭 (TD=16) */
function buildCampGround(): THREE.Mesh {
  const N = CAMP_HALF * 2 * TD; // 768x768
  const px = new Px(N, N);
  const toW = (idx: number) => -CAMP_HALF + (idx + 0.5) / TD;
  const reg = PAL_REGION.CANAAN;

  for (let j = 0; j < N; j++) {
    const z = toW(j);
    for (let i = 0; i < N; i++) {
      const x = toW(i);

      // 1. 기본 대지: 가나안 건조토와 붉은 석회암 모래
      const nBase = fbm(x / 7, z / 7, 711, 2) * 0.5 + valueNoise(i / 12, j / 12, 712) * 0.3 + hash2(i, j, 713) * 0.2;
      let c = ditherPick([reg.ground, 0xb88856, 0xc69664, 0xaa7c4a], nBase, i, j, 0.35);

      // 2. 장막 주변 짓밟힌 마당 및 짚풀 (|x| <= 6, |z| <= 5)
      const dCamp = Math.hypot(x, z);
      if (dCamp < 6.5) {
        const nYard = valueNoise(i / 8, j / 8, 721);
        if (nYard > 0.45) {
          c = ditherPick([0xcbb38a, 0xba9e74, 0xad9066], nYard, i, j);
          if (hash2(i, j, 723) < 0.02) c = PAL.straw[0];
        }
      } else {
        // 외곽 야생 풀밭
        const nWildGrass = fbm(x * 1.5, z * 1.5, 731, 2);
        if (nWildGrass > 0.52) {
          c = ditherPick([PAL.grass[2], PAL.dryGrass[1], PAL.grass[3]], nWildGrass, i, j, 0.4);
        }
      }

      // 모닥불 자리 잿더미 그을음 (|x| <= 1.2, |z - 0.5| <= 1.2)
      const dFire = Math.hypot(x, z - 0.5);
      if (dFire < 1.4) {
        c = ditherPick([0x2a221c, 0x3d322a, 0x1f1814], hash2(i, j, 741), i, j);
      }

      px.set(i, j, c);
    }
  }

  const tex = px.toTexture();
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CAMP_HALF * 2, CAMP_HALF * 2),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.01;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildEsauCampStage(): EsauCampStage {
  const root = new THREE.Group();
  const col = new Collision();
  col.bounds = { minX: -CAMP_HALF + 4, maxX: CAMP_HALF - 4, minZ: -CAMP_HALF + 4, maxZ: CAMP_HALF - 4 };

  // 지면 추가
  root.add(buildCampGround());

  const b = new VoxelBuilder(777, false);

  // ─────────────────────────────────────────────────────────────
  // 1. 유목민 검은 염소털 장막 2채 (아브라함/이삭 가문의 장막)
  // ─────────────────────────────────────────────────────────────
  // 본 장막 (북서쪽: 야곱과 가족들의 거처)
  const mainTent = buildNomadTent(PAL_REGION.CANAAN.tentBlack);
  mainTent.position.set(-5.5, 0, -3.5);
  root.add(mainTent);
  col.addBox(-5.5, -3.5, 4.8, 3.8);

  // 부속 장막 (북동쪽: 양털 및 식량 저장고)
  const storeTent = buildNomadTent(PAL.fabric.redDark);
  storeTent.position.set(5.0, 0, -2.5);
  storeTent.rotation.y = -Math.PI * 0.2;
  root.add(storeTent);
  col.addBox(5.0, -2.5, 4.0, 3.4);

  // ─────────────────────────────────────────────────────────────
  // 2. 모닥불과 청동 삼각대 팥죽 솥 (Centerpiece: Red Lentil Cauldron)
  // ─────────────────────────────────────────────────────────────
  const PX = 0, PZ = 0.5;

  // 모닥불 받침 돌
  const stoneAngles = [0, 1.0, 2.1, 3.14, 4.2, 5.2];
  for (const ang of stoneAngles) {
    const sx = PX + Math.cos(ang) * 0.85;
    const sz = PZ + Math.sin(ang) * 0.85;
    b.box(sx, 0.18, sz, 0.35, 0.35, 0.35, 0x7a6e64, { tex: 'stone' });
  }

  // 타오르는 장작과 붉은 숯불
  b.box(PX, 0.12, PZ, 0.8, 0.2, 0.8, 0x422618, { tex: 'wood' });
  b.box(PX, 0.22, PZ, 0.5, 0.15, 0.5, 0xff5511);

  // 청동 삼각대 3다리
  for (let a = 0; a < 3; a++) {
    const legAng = a * (Math.PI * 2 / 3);
    const lx = PX + Math.cos(legAng) * 0.7;
    const lz = PZ + Math.sin(legAng) * 0.7;
    b.box(lx * 0.5, 0.9, lz * 0.5, 0.1, 1.4, 0.1, 0x3d3024);
  }
  // 삼각대 상단 고리
  b.box(PX, 1.6, PZ, 0.2, 0.15, 0.2, 0x221a14);

  // 걸려있는 묵직한 쇠솥 (Cauldron Body)
  b.box(PX, 0.65, PZ, 0.9, 0.55, 0.9, 0x1c1a18, { tex: 'stone' });
  // 솥 귓볼 및 걸쇠 체인
  b.box(PX, 1.15, PZ, 0.08, 0.8, 0.08, 0x3a3430);

  // 끓어오르는 붉은 렌즈콩 팥죽 복셀 메쉬 (별도 그룹으로 애니메이션 제어)
  const stewMesh = new THREE.Group();
  stewMesh.name = 'bubbling_lentil_stew';
  const sb = new VoxelBuilder(888, false);
  // 붉은 팥죽 표면
  sb.box(PX, 0.84, PZ, 0.76, 0.1, 0.76, 0xb83820);
  // 끓어오르는 팥죽 거품 복셀들
  sb.box(PX - 0.18, 0.9, PZ + 0.12, 0.22, 0.12, 0.22, 0xdd4828);
  sb.box(PX + 0.15, 0.9, PZ - 0.15, 0.18, 0.14, 0.18, 0xee5c34);
  sb.box(PX + 0.08, 0.88, PZ + 0.18, 0.15, 0.1, 0.15, 0xc6381e);
  stewMesh.add(sb.build());
  root.add(stewMesh);

  col.addBox(PX, PZ, 1.4, 1.4);

  // 모닥불 광원
  const fireLight = new THREE.PointLight(0xff6622, 2.2, 8.0);
  fireLight.position.set(PX, 0.8, PZ);
  root.add(fireLight);

  // ─────────────────────────────────────────────────────────────
  // 3. 야곱의 나무 의자와 국자 소품
  // ─────────────────────────────────────────────────────────────
  // 야곱 의자
  b.box(-1.4, 0.25, 0.5, 0.5, 0.5, 0.5, 0x5a3e2a, { tex: 'wood' });
  // 나무 숟가락과 식기 그릇
  b.box(-0.8, 0.35, 0.3, 0.35, 0.15, 0.35, 0x9a7248);

  // ─────────────────────────────────────────────────────────────
  // 4. 에서의 사냥 도구 소품 (들판 사냥꾼의 흔적)
  // ─────────────────────────────────────────────────────────────
  // 활과 화살통 (바닥에 놓임)
  b.box(2.2, 0.1, 1.2, 0.15, 0.1, 1.1, 0x4a301e, { tex: 'wood' });
  b.box(2.4, 0.15, 1.0, 0.25, 0.25, 0.7, 0x824424);
  // 노루 뿔과 동물 모피
  b.box(2.0, 0.08, 2.2, 1.2, 0.08, 1.4, 0x76543a);

  // 야생 들판의 바위와 에셀나무
  b.box(-8.0, 0.8, 6.0, 1.8, 1.6, 1.8, 0x9a8e80, { tex: 'stone' });
  b.box(9.0, 0.6, 7.5, 2.2, 1.2, 1.6, 0x8e8276, { tex: 'stone' });
  col.addBox(-8.0, 6.0, 2.0, 2.0);
  col.addBox(9.0, 7.5, 2.4, 2.0);

  root.add(b.build());

  return {
    root,
    col,
    spawn: { x: 0, z: 10.0 }, // 남쪽 들판에서 걸어 들어오는 위치
    bounds: { minX: -CAMP_HALF + 4, maxX: CAMP_HALF - 4, minZ: -CAMP_HALF + 4, maxZ: CAMP_HALF - 4 },
    potPos: new THREE.Vector3(PX, 0.85, PZ),
    jacobSpot: new THREE.Vector3(-1.4, 0, 0.5),
    esauSpot: new THREE.Vector3(1.0, 0, 0.5),
    stewMesh,
    updateAnimations(_dt: number, time: number) {
      // 팥죽 표면 보글보글 애니메이션
      stewMesh.position.y = Math.sin(time * 6.0) * 0.02;
      fireLight.intensity = 2.0 + Math.sin(time * 9.0) * 0.4 + Math.cos(time * 14.0) * 0.2;
    },
  };
}
