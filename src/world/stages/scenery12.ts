import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { Canopy } from '../foliage';
import { Px, TD, ditherPick } from '../textures';
import { fbm, hash2, valueNoise } from '../../core/rng';
import { groundVariation, tintColor } from './common';
import { ridgeMound, shiftPal } from './scenery36';

/**
 * 고해상도 절차적 지면 메시 빌더 (ur.ts 지면 기법 표준 준수)
 * DataTexture 기반 픽셀 지면을 생성하여 평면 메시로 반환합니다.
 */
export function buildStageGroundPlane(opts: {
  size: number;
  res: number;
  yOffset?: number;
  painter: (x: number, z: number, i: number, j: number) => number;
}): THREE.Mesh {
  const { size, res, yOffset = -0.01, painter } = opts;
  const px = new Px(res, res);
  const half = size / 2;
  const toW = (idx: number) => -half + ((idx + 0.5) / res) * size;

  for (let j = 0; j < res; j++) {
    const z = toW(j);
    for (let i = 0; i < res; i++) {
      const x = toW(i);
      const c = groundVariation(painter(x, z, i, j), x, z, res % 7);
      px.set(i, j, c);
    }
  }

  const tex = px.toTexture();
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = yOffset;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * 고대 모레 & 마므레 거목 상수리나무(Terebinth Oak) 빌더
 * - 뒤틀린 거대한 밑동과 사방으로 뻗은 굵은 주가지
 * - Canopy를 활용한 풍성하고 유기적인 다층 수관
 */
export function buildTerebinthOak(
  b: VoxelBuilder,
  col: Collision | null,
  x: number,
  z: number,
  scale = 1.0,
  seed = 42,
) {
  const r = b.rng;
  const barkColor = PAL_REGION.CANAAN.oakBark;
  const leafPal = [PAL.olive[1], PAL.olive[2], PAL_REGION.CANAAN.oakLeaf, PAL.olive[3], PAL.olive[4]] as const;

  b.at(x, 0, z, 0, () => {
    // 1. 뒤틀린 거목 밑동과 돌출된 지표 뿌리들
    b.box(0, 0, 0, 1.4 * scale, 0.6 * scale, 1.4 * scale, barkColor, { tex: 'bark' });
    b.box(-0.6 * scale, 0, -0.5 * scale, 0.7 * scale, 0.35 * scale, 0.6 * scale, barkColor, { tex: 'bark' });
    b.box(0.6 * scale, 0, 0.4 * scale, 0.7 * scale, 0.35 * scale, 0.6 * scale, barkColor, { tex: 'bark' });
    b.box(-0.4 * scale, 0, 0.6 * scale, 0.6 * scale, 0.3 * scale, 0.7 * scale, barkColor, { tex: 'bark' });
    b.box(0.5 * scale, 0, -0.6 * scale, 0.6 * scale, 0.3 * scale, 0.7 * scale, barkColor, { tex: 'bark' });

    // 2. 중심 기둥 상승부
    b.box(0, 0.5 * scale, 0, 1.15 * scale, 1.3 * scale, 1.15 * scale, barkColor, { tex: 'bark' });
    b.box(0.1 * scale, 1.6 * scale, -0.1 * scale, 0.95 * scale, 1.0 * scale, 0.95 * scale, barkColor, { tex: 'bark' });

    // 3. 사방으로 뻗어 올라가는 3개의 큰 주가지
    // 북서쪽 가지
    b.at(-0.4 * scale, 2.2 * scale, -0.4 * scale, -Math.PI * 0.25, () => {
      b.box(0, 0, 0, 0.45 * scale, 1.4 * scale, 0.45 * scale, barkColor, { tex: 'bark', ao: false });
      b.box(-0.3 * scale, 1.1 * scale, 0, 0.35 * scale, 0.9 * scale, 0.35 * scale, barkColor, { tex: 'bark', ao: false });
    }, 0.35, 0.35);

    // 남동쪽 가지
    b.at(0.45 * scale, 2.1 * scale, 0.4 * scale, Math.PI * 0.75, () => {
      b.box(0, 0, 0, 0.48 * scale, 1.5 * scale, 0.45 * scale, barkColor, { tex: 'bark', ao: false });
      b.box(0.25 * scale, 1.2 * scale, 0, 0.35 * scale, 0.9 * scale, 0.35 * scale, barkColor, { tex: 'bark', ao: false });
    }, -0.3, -0.35);

    // 북동쪽 높은 가지
    b.at(0.2 * scale, 2.5 * scale, -0.35 * scale, 0.5, () => {
      b.box(0, 0, 0, 0.42 * scale, 1.6 * scale, 0.42 * scale, barkColor, { tex: 'bark', ao: false });
    }, 0.2, -0.3);

    // 4. Canopy 잎 덩어리: 덩어리마다 팔레트(밝기·따뜻함)를 달리해 색조 얼룩을 만든다
    const lobes: [number, number, number, number, number, number][] = [
      [0, 3.8, 0, 2.2, 1.3, 2.2], [-1.5, 3.2, -1.3, 1.6, 1.1, 1.5], [1.6, 3.1, 1.4, 1.7, 1.15, 1.6],
      [0.9, 4.2, -1.2, 1.5, 1.0, 1.5], [-0.6, 4.4, 0.8, 1.4, 0.95, 1.4], [0, 4.9, 0, 1.4, 0.85, 1.4],
      [-2.1, 2.7, 0.6, 1.0, 0.7, 1.0], [2.2, 2.6, -0.5, 1.0, 0.65, 1.0], [0.3, 2.3, 1.9, 0.9, 0.6, 0.9],
    ];
    for (let k = 0; k < lobes.length; k++) {
      const L = lobes[k];
      const cn = new Canopy(b, 0.25 * scale, seed + k * 7);
      cn.ellipsoid(L[0] * scale, L[1] * scale, L[2] * scale, L[3] * scale, L[4] * scale, L[5] * scale, 0.45);
      cn.emit(shiftPal(leafPal, 0.82 + hash2(seed, k, 5151) * 0.4, (hash2(seed, k, 5152) - 0.5) * 0.16), { holes: 0.18 });
    }
  });

  if (col) {
    col.addCircle(x, z, 0.9 * scale);
  }
}

/**
 * 애굽 나일강변 갈대밭 (파피루스 & 갈대 군락)
 */
export function buildNileReedBank(
  b: VoxelBuilder,
  col: Collision | null,
  startX: number,
  startZ: number,
  length: number,
  isAlongZ = true,
) {
  const reedColors = [PAL.cypress[2], PAL.palm[1], PAL.grass[2], PAL.cypress[1]];

  const steps = Math.floor(length / 0.8);
  for (let s = 0; s < steps; s++) {
    const offset = s * 0.8;
    const cx = isAlongZ ? startX + Math.sin(s * 0.7) * 0.4 : startX + offset;
    const cz = isAlongZ ? startZ + offset : startZ + Math.sin(s * 0.7) * 0.4;

    // 습지 진흙 턱
    b.box(cx, 0, cz, 0.9, 0.15, 0.9, 0x3d3024, { tex: 'soil' });

    // 파피루스 줄기 다발 3~4개
    for (let k = 0; k < 3; k++) {
      const rx = (hash2(s, k, 101) - 0.5) * 0.5;
      const rz = (hash2(s, k, 102) - 0.5) * 0.5;
      const h = 1.2 + hash2(s, k, 103) * 0.9;
      const colr = reedColors[(s + k) % reedColors.length];

      b.box(cx + rx, 0.15, cz + rz, 0.1, h, 0.1, colr, { tex: 'reed', ao: false });
      // 파피루스 상단 부채꼴 꽃술
      b.box(cx + rx, 0.15 + h, cz + rz, 0.35, 0.18, 0.35, PAL.palm[3], { tex: 'leafVine', ao: false });
    }
  }

  if (col) {
    if (isAlongZ) {
      col.addBox(startX, startZ + length / 2, 1.4, length);
    } else {
      col.addBox(startX + length / 2, startZ, length, 1.4);
    }
  }
}

/**
 * 애굽 사암 오벨리스크 (Obelisk)
 * - 3단 계단식 기단
 * - 상승할수록 가늘어지는 4각 기둥
 * - 황금빛 피라미디온(Pyramidion) 꼭대기
 */
export function buildEgyptianObelisk(b: VoxelBuilder, col: Collision | null, x: number, z: number) {
  const pCol = PAL_REGION.EGYPT.sandstonePillar;
  const gold = PAL_REGION.EGYPT.gold;
  const lapis = PAL_REGION.EGYPT.lapis;

  // 기단부 3단
  b.box(x, 0, z, 2.6, 0.4, 2.6, pCol, { tex: 'stone' });
  b.box(x, 0.4, z, 2.1, 0.35, 2.1, pCol, { tex: 'stone' });
  b.box(x, 0.75, z, 1.6, 0.3, 1.6, pCol, { tex: 'stone' });

  // 상형문자 띠가 있는 주두 하단
  b.box(x, 1.05, z, 1.3, 0.35, 1.3, lapis, { tex: 'plain' });

  // 4단계 테이퍼링 오벨리스크 샤프트 (높이 총 6.0m)
  b.box(x, 1.4, z, 1.15, 1.8, 1.15, pCol, { tex: 'cliff' });
  b.box(x, 3.2, z, 0.98, 1.8, 0.98, pCol, { tex: 'cliff' });
  b.box(x, 5.0, z, 0.82, 1.6, 0.82, pCol, { tex: 'cliff' });

  // 황금 피라미디온 꼭대기
  b.box(x, 6.6, z, 0.72, 0.6, 0.72, gold, { tex: 'metal' });
  b.box(x, 7.2, z, 0.46, 0.5, 0.46, gold, { tex: 'metal' });
  b.box(x, 7.7, z, 0.22, 0.4, 0.22, gold, { tex: 'metal' });

  if (col) {
    col.addBox(x, z, 2.4, 2.4);
  }
}

/**
 * 애굽 국경 세관 관문 파일런(Pylon) 성채 탑
 * - 사다리꼴 경사벽 복셀과 상부 토러스 몰딩 및 코니스 지붕
 */
export function buildCustomsPylon(
  b: VoxelBuilder,
  col: Collision | null,
  x: number,
  z: number,
  width = 3.6,
  depth = 2.8,
) {
  const pCol = PAL_REGION.EGYPT.sandstonePillar;
  const gold = PAL_REGION.EGYPT.gold;
  const lapis = PAL_REGION.EGYPT.lapis;

  // 1. 하단 기단 (3단 경사벽)
  b.box(x, 0, z, width, 2.0, depth, pCol, { tex: 'stone' });
  b.box(x, 2.0, z, width - 0.3, 2.0, depth - 0.3, pCol, { tex: 'stone' });
  b.box(x, 4.0, z, width - 0.6, 1.8, depth - 0.5, pCol, { tex: 'stone' });

  // 2. 상부 코니스 몰딩 (바깥으로 돌출되는 처마와 띠)
  b.box(x, 5.8, z, width - 0.4, 0.25, depth - 0.3, lapis, { tex: 'plain' });
  b.box(x, 6.05, z, width, 0.4, depth + 0.1, pCol, { tex: 'stone' });
  b.box(x, 6.45, z, width + 0.2, 0.25, depth + 0.3, gold, { tex: 'metal' });

  // 깃대 홈과 삼색 깃발
  b.box(x, 0.5, z + depth / 2 + 0.1, 0.18, 7.2, 0.18, PAL.wood[1], { tex: 'wood' });
  b.box(x + 0.45, 6.5, z + depth / 2 + 0.1, 0.8, 0.6, 0.05, PAL.fabric.red, { tex: 'stripeRed' });

  if (col) {
    col.addBox(x, z, width + 0.2, depth + 0.2);
  }
}

/**
 * 싯딤 골짜기 검은 역청(Bitumen/Tar) 구덩이
 * - 유황 및 그을린 바위 테두리와 번들거리는 검은 피치 웅덩이
 */
export function buildTarPit(
  b: VoxelBuilder,
  col: Collision | null,
  x: number,
  z: number,
  rx = 2.4,
  rz = 2.2,
) {
  const rimColor = 0x2e241c;
  const tarColor = 0x121010;
  const sulfurColor = PAL_REGION.SODOM_NEGEV.sulfurYellow;

  // 1. 그을린 솟은 분화구 둘레
  b.box(x, 0, z, rx * 2 + 0.8, 0.3, rz * 2 + 0.8, rimColor, { tex: 'cliff' });

  // 2. 가라앉은 검은 역청 웅덩이
  // 한 장의 검은 판 대신 0.6m 칸마다 높이·색조(기름막의 푸르스름/자줏빛)가 다른 역청 조각들을 깐다
  const tarTones = [0x0e0c0e, 0x161214, 0x1c1618, 0x1a1a22, 0x241a20, 0x12161a];
  const cx0 = Math.max(1, Math.round((rx * 2) / 0.6)), cz0 = Math.max(1, Math.round((rz * 2) / 0.6));
  for (let i = 0; i < cx0; i++) {
    for (let j = 0; j < cz0; j++) {
      const u = ((i + 0.5) / cx0) * 2 - 1, v = ((j + 0.5) / cz0) * 2 - 1;
      if (u * u + v * v > 1.15) continue;
      const hv = hash2(i + Math.floor(x * 3), j + Math.floor(z * 3), 877);
      const tone = tarTones[Math.floor(hv * tarTones.length) % tarTones.length];
      b.box(x + u * rx * 0.97, 0.08, z + v * rz * 0.97, (rx * 2) / cx0 + 0.02, 0.24 + hv * 0.07, (rz * 2) / cz0 + 0.02, tone, { tex: 'wetStone' });
    }
  }
  void tarColor;

  // 3. 솟구치는 역청 거품 둔덕 2~3개
  b.box(x - 0.5, 0.26, z - 0.3, 0.9, 0.18, 0.9, 0x1c1716, { tex: 'plain' });
  b.box(x + 0.6, 0.24, z + 0.4, 0.7, 0.14, 0.7, 0x1c1716, { tex: 'plain' });

  // 4. 역청 찌꺼기에 걸린 유황 잔해 및 부러진 뼈/나무 조각
  b.box(x + rx * 0.7, 0.2, z - rz * 0.6, 0.35, 0.15, 0.35, sulfurColor, { tex: 'soil' });
  b.box(x - rx * 0.6, 0.22, z + rz * 0.7, 0.4, 0.12, 0.4, sulfurColor, { tex: 'soil' });
  b.box(x, 0.25, z, 0.15, 0.12, 0.6, PAL.wood[0], { tex: 'wood' }); // 부러진 창대

  if (col) {
    col.addBox(x, z, rx * 1.8, rz * 1.8);
  }
}

/**
 * 연합군 전장 군기/군사 깃발 (Battle Standard)
 */
export function buildBattleStandard(
  b: VoxelBuilder,
  x: number,
  z: number,
  pennantColor: number = PAL.fabric.redDark,
  h = 3.6,
) {
  // 청동 꽂이 주춧돌
  b.box(x, 0, z, 0.4, 0.25, 0.4, PAL.stone[2], { tex: 'stone' });
  // 나무 창대
  b.box(x, 0.2, z, 0.1, h, 0.1, PAL.wood[1], { tex: 'wood' });
  // 상부 금속 촉
  b.box(x, 0.2 + h, z, 0.18, 0.45, 0.18, 0x9aa2aa, { tex: 'metal' });

  // 매달린 깃발 천 (바람에 펄럭이는 형상)
  b.box(x + 0.4, h - 0.4, z, 0.7, 0.5, 0.04, pennantColor, { tex: 'stripeRed', ao: false });
  b.box(x + 0.95, h - 0.35, z + 0.1, 0.5, 0.35, 0.04, pennantColor, { tex: 'stripeRed', ao: false });
}

/**
 * 차양과 실내 소품이 딸린 웅장한 유목 장막(Bedouin Chieftain Tent)
 */
export function buildChieftainTent(
  b: VoxelBuilder,
  col: Collision | null,
  x: number,
  z: number,
  tentColor: number,
  opts: { width?: number; depth?: number; awningZ?: number } = {},
) {
  const w = opts.width ?? 4.4;
  const d = opts.depth ?? 3.6;
  const az = opts.awningZ ?? 1.6;

  b.at(x, 0, z, 0, () => {
    // 1. 메인 텐트 기둥 4개 및 상부 들보
    const halfW = w / 2 - 0.3;
    const halfD = d / 2 - 0.3;
    for (const sx of [-halfW, halfW]) {
      for (const sz of [-halfD, halfD]) {
        b.box(sx, 0, sz, 0.12, 2.5, 0.12, PAL.wood[0], { tex: 'wood' });
      }
    }
    b.box(0, 2.45, -halfD, w, 0.12, 0.12, PAL.wood[1], { tex: 'wood' });
    b.box(0, 2.45, halfD, w, 0.12, 0.12, PAL.wood[1], { tex: 'wood' });

    // 2. 지붕 천 (경사 복셀 박스)
    b.box(0, 2.5, 0, w + 0.3, 0.15, d * 0.4, tentColor, { tex: 'wool' });
    b.box(0, 2.1, -d * 0.3, w + 0.3, 0.15, d * 0.35, tentColor, { tex: 'wool' });
    b.box(0, 1.6, -d * 0.45, w + 0.3, 0.15, d * 0.3, tentColor, { tex: 'wool' });
    b.box(0, 2.1, d * 0.3, w + 0.3, 0.15, d * 0.35, tentColor, { tex: 'wool' });
    b.box(0, 1.6, d * 0.45, w + 0.3, 0.15, d * 0.3, tentColor, { tex: 'wool' });

    // 3. 좌우 차단막
    b.box(-w / 2, 0, 0, 0.15, 2.0, d, tentColor, { tex: 'wool' });
    b.box(w / 2, 0, 0, 0.15, 2.0, d, tentColor, { tex: 'wool' });

    // 4. 전면 그늘 차양 (Awning)
    b.box(-halfW, 0, halfD + az, 0.1, 2.1, 0.1, PAL.wood[0], { tex: 'wood' });
    b.box(halfW, 0, halfD + az, 0.1, 2.1, 0.1, PAL.wood[0], { tex: 'wood' });
    b.box(0, 2.1, halfD + az * 0.5, w + 0.2, 0.08, az + 0.2, PAL.fabric.ochre, { tex: 'fabricCream' });

    // 5. 차양 아래 평상과 양탄자, 물단지
    b.box(0, 0.04, halfD + az * 0.5, w * 0.7, 0.08, az * 0.8, PAL.fabric.cream, { tex: 'fabricCream' });
    b.box(-halfW * 0.4, 0.1, halfD + az * 0.5, 0.5, 0.4, 0.5, PAL.wood[2], { tex: 'wood' });
    b.box(halfW * 0.4, 0.1, halfD + az * 0.5, 0.35, 0.45, 0.35, PAL.clay[2], { tex: 'soil' });
  });

  if (col) {
    col.addBox(x, z + (az > 0 ? 0.3 : 0), w + 0.4, d + az + 0.2);
  }
}

/**
 * 맵 외곽을 감싸는 자연석 구릉/능선 빌더
 * 허공(Void)이 보이지 않고 36x36 맵이 드넓은 자연의 일부처럼 느껴지도록 외곽을 두릅니다.
 */
export function buildPerimeterHills(
  b: VoxelBuilder,
  col: Collision | null,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  groundColor: number,
  stoneColor: number,
) {
  // 능선: 칸마다 높이·지층·기울기가 다른 ridgeMound 두 겹 (가까운 겹은 흙색, 먼 겹은 돌색)
  const lowG = tintColor(groundColor, 0.92), lowS = tintColor(stoneColor, 0.88);
  for (let x = minX - 4; x <= maxX + 4; x += 3.2) {
    const n = valueNoise(x / 6, 1, 611);
    ridgeMound(b, x, minZ - 2, 3.8, 5.0, 1.8 + n * 2.0, groundColor, lowG, 'dune');
    ridgeMound(b, x + 1.1, minZ - 5, 3.8, 6.0, 3.2 + valueNoise(x / 5, 4, 613) * 3.2, stoneColor, lowS, 'dune');
    // 남쪽은 카메라에 가장 가까워 화면 아래를 크게 가리므로 낮게
    ridgeMound(b, x, maxZ + 2, 3.8, 5.0, (1.4 + valueNoise(x / 6, 7, 617) * 1.2) * 0.6, groundColor, lowG, 'dune');
    ridgeMound(b, x + 0.8, maxZ + 5, 3.8, 6.0, (2.8 + valueNoise(x / 5, 9, 619) * 2) * 0.5, stoneColor, lowS, 'dune');
  }
  for (let z = minZ - 2; z <= maxZ + 2; z += 3.2) {
    ridgeMound(b, minX - 3, z, 5.5, 3.8, 2.2 + valueNoise(z / 6, 11, 631) * 2.6, stoneColor, lowS, 'dune');
    ridgeMound(b, maxX + 3, z, 5.5, 3.8, 2.2 + valueNoise(z / 6, 13, 633) * 2.6, stoneColor, lowS, 'dune');
  }

  if (col) {
    col.addBox(0, minZ - 3.5, maxX - minX + 10, 4.0);
    col.addBox(0, maxZ + 3.5, maxX - minX + 10, 4.0);
    col.addBox(minX - 3.5, 0, 4.0, maxZ - minZ + 10);
    col.addBox(maxX + 3.5, 0, 4.0, maxZ - minZ + 10);
  }
}
