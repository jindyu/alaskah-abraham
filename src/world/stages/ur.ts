import * as THREE from 'three';
import { Collision } from '../collision';
import { PAL, PAL_REGION } from '../palette';
import { VoxelBuilder } from '../voxel';
import * as P from '../props';
import { buildZiggurat, buildWorkshopDetails, buildRooftopTerrace } from '../props/urProps';
import { buildIdols } from '../props/biblicalProps';
import { LAMPS } from '../../systems/lighting';
import { Actor } from '../../entities/actor';
import { Px, TD, ditherPick } from '../textures';
import { fbm, hash2, valueNoise } from '../../core/rng';

export interface UrStage {
  root: THREE.Group;
  col: Collision;
  spawn: { x: number; z: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  idols: {
    smallIdols: THREE.Group[];
    largeIdol: THREE.Group;
    axeMesh: THREE.Group;
    brokenRubble: THREE.Group;
  };
  rooftopSpot: { x: number; y: number; z: number };
  actors: Actor[];
}

const UR_HALF = 48; // 96x96 광활한 고대 수메르 대지

/** 우르의 자연스러운 모래흙, 벽돌길, 자갈 지면 텍스처 평면 생성 */
function buildUrGround(): THREE.Mesh {
  const N = UR_HALF * 2 * 2; // 192x192 텍셀 해상도
  const px = new Px(N, N);
  const toW = (idx: number) => -UR_HALF + (idx + 0.5) * (UR_HALF * 2 / N);
  const reg = PAL_REGION.MESOPOTAMIA;

  for (let j = 0; j < N; j++) {
    const z = toW(j);
    for (let i = 0; i < N; i++) {
      const x = toW(i);

      // 기본 메소포타미아 황토/사막 모래 베이스
      const nBase = fbm(x / 4, z / 4, 301, 2);
      let c = ditherPick([reg.ground, 0xc49c68, 0xb88e54, 0xa57c44], nBase, i, j, 0.4);

      // 도로 구역 (중앙 동서 도로: z: 1 ~ 6, x: -30 ~ 30)
      if (z >= 1.0 && z <= 6.2 && Math.abs(x) < 32) {
        const nRoad = valueNoise(i / 2, j / 2, 401);
        c = ditherPick([reg.brick, 0x8a5830, 0xa46c3c, reg.ground], nRoad, i, j, 0.2);
        // 벽돌 틈새 디테일
        if (hash2(i, j, 11) < 0.08) c = 0x6e4020;
      }

      // 공방 진입로 (x: -3 ~ 3, z: -8 ~ 1)
      if (Math.abs(x) < 3.2 && z >= -8.0 && z <= 1.0) {
        const nPath = valueNoise(i / 2, j / 2, 419);
        c = ditherPick([reg.brick, 0x9c6838, 0xa46c3c], nPath, i, j, 0.3);
      }

      // 서쪽 우물 광장 (x: -12, z: 3.5, r: 4.5)
      const dWell = Math.hypot(x - (-12), z - 3.5);
      if (dWell < 4.8) {
        const nWell = fbm(x * 2, z * 2, 501, 2);
        // 물기 머금은 짙은 흙과 작은 오아시스 잔디 흔적
        c = dWell < 2.8
          ? ditherPick([PAL.dirt[0], PAL.dirt[1], PAL.water[0]], nWell, i, j, 0.5)
          : ditherPick([reg.ground, PAL.dryGrass[1], PAL.grass[2]], nWell, i, j, 0.4);
      }

      // 남쪽 시장 광장 (x: 4, z: 12)
      if (x >= -4 && x <= 16 && z >= 8 && z <= 16) {
        const nMarket = fbm(x * 1.5, z * 1.5, 601, 2);
        c = ditherPick([0xc89868, reg.brick, PAL.dirt[2], 0xdeaa74], nMarket, i, j, 0.35);
      }

      // 외곽 거친 자갈과 바위 지대 노이즈
      const dCenter = Math.hypot(x, z);
      if (dCenter > 28) {
        const nWild = fbm(x / 6, z / 6, 701, 2);
        if (nWild > 0.6) c = hash2(i, j, 99) < 0.4 ? PAL.stone[1] : 0x8a623c;
      }

      px.set(i, j, c);
    }
  }

  const tex = px.toTexture();
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(UR_HALF * 2, UR_HALF * 2),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.01;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildUrStage(): UrStage {
  const root = new THREE.Group();
  const col = new Collision();
  col.bounds = { minX: -UR_HALF + 4, maxX: UR_HALF - 4, minZ: -UR_HALF + 4, maxZ: UR_HALF - 4 };

  const b = new VoxelBuilder(777, false);
  const reg = PAL_REGION.MESOPOTAMIA;

  // 1. 대형 지면 텍스처 평면 + 광활한 사막 지평선 바닥 (원경 컷신에서도 단색 틈새 완전 차단)
  const horizonGeo = new THREE.PlaneGeometry(360, 360);
  const horizonMat = new THREE.MeshLambertMaterial({ color: reg.ground });
  const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
  horizonMesh.rotation.x = -Math.PI / 2;
  horizonMesh.position.y = -0.05;
  horizonMesh.receiveShadow = true;
  root.add(horizonMesh);
  root.add(buildUrGround());

  // ─────────────────────────────────────────────────────────────
  // 2. 외곽을 감싸는 메소포타미아 계단식 점토 언덕과 사구 (바깥이 뚝 끊기지 않게 둘러쌈!)
  // ─────────────────────────────────────────────────────────────
  // 북쪽 외곽 고원 (z: -26 ~ -44)
  for (let x = -44; x <= 44; x += 3.2) {
    const h1 = 2.0 + Math.sin(x * 0.2) * 0.8;
    b.box(x, h1 * 0.5, -28, 3.4, h1, 8.0, reg.ground, { tex: 'soil', jitter: 0.05 });
    const h2 = 4.2 + Math.cos(x * 0.15) * 1.2;
    b.box(x, h2 * 0.5, -36, 3.4, h2, 9.0, 0x8a5e38, { tex: 'brick', jitter: 0.05 });
  }

  // 남쪽 외곽 모래 언덕 (z: 24 ~ 40)
  for (let x = -44; x <= 44; x += 3.4) {
    const h = 2.2 + Math.cos(x * 0.22) * 0.9;
    b.box(x, h * 0.5, 26, 3.6, h, 8.0, reg.ground, { tex: 'soil', jitter: 0.04 });
  }

  // 서쪽 외곽 고지대 (x: -28 ~ -44)
  for (let z = -24; z <= 24; z += 3.2) {
    const h = 2.6 + Math.sin(z * 0.18) * 0.7;
    b.box(-30, h * 0.5, z, 7.0, h, 3.4, reg.ground, { tex: 'soil', jitter: 0.04 });
  }

  // 동쪽 고대 도시 성벽 라인 (x: 28 ~ 38)
  for (let z = -24; z <= 24; z += 3.6) {
    b.box(32, 2.5, z, 5.0, 5.0, 3.8, reg.brick, { tex: 'brick', jitter: 0.03 });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. 데라의 우상 공방 본채 (북쪽 중앙: x: 0, z: -7)
  // ─────────────────────────────────────────────────────────────
  const WX = 0, WZ = -7;
  // 본채 외벽 (가로 12, 세로 7, 높이 3.4)
  b.box(WX, 1.7, WZ - 3.4, 12.4, 3.4, 0.8, reg.brick, { tex: 'brick' });
  col.addBox(WX, WZ - 3.4, 12.5, 0.9);
  b.box(WX - 5.8, 1.7, WZ, 0.8, 3.4, 7.0, reg.brick, { tex: 'brick' });
  col.addBox(WX - 5.8, WZ, 0.9, 7.1);
  b.box(WX + 5.8, 1.7, WZ, 0.8, 3.4, 7.0, reg.brick, { tex: 'brick' });
  col.addBox(WX + 5.8, WZ, 0.9, 7.1);
  // 전면 기둥 2개와 아치 개방 입구
  b.box(WX - 4.2, 1.7, WZ + 3.4, 3.2, 3.4, 0.8, reg.brick, { tex: 'brick' });
  col.addBox(WX - 4.2, WZ + 3.4, 3.3, 0.9);
  b.box(WX + 4.2, 1.7, WZ + 3.4, 3.2, 3.4, 0.8, reg.brick, { tex: 'brick' });
  col.addBox(WX + 4.2, WZ + 3.4, 3.3, 0.9);
  b.box(WX, 3.1, WZ + 3.4, 5.4, 0.6, 0.85, 0x4a3222, { tex: 'brick' });

  // 공방 전면 직물 차양막 (줄무늬 샤프란)
  b.box(WX, 3.0, WZ + 4.8, 5.8, 0.1, 2.0, 0xd4a040, { tex: 'stripeSaffron' });
  b.box(WX - 2.8, 1.5, WZ + 5.7, 0.15, 3.0, 0.15, PAL.wood[3], { tex: 'wood' });
  b.box(WX + 2.8, 1.5, WZ + 5.7, 0.15, 3.0, 0.15, PAL.wood[3], { tex: 'wood' });
  col.addBox(WX - 2.8, WZ + 5.7, 0.3, 0.3);
  col.addBox(WX + 2.8, WZ + 5.7, 0.3, 0.3);

  // 공방 평지붕 (옥상 테라스 y: 3.4)
  b.box(WX, 3.45, WZ, 12.0, 0.3, 7.2, 0xd6b894, { tex: 'mudRoof' });
  b.box(WX, 3.75, WZ - 3.4, 12.4, 0.35, 0.3, reg.brick, { tex: 'brick' });
  b.box(WX - 5.8, 3.75, WZ, 0.3, 0.35, 7.0, reg.brick, { tex: 'brick' });
  b.box(WX + 5.8, 3.75, WZ, 0.3, 0.35, 7.0, reg.brick, { tex: 'brick' });
  b.box(WX, 3.75, WZ + 3.4, 12.4, 0.35, 0.3, reg.brick, { tex: 'brick' });

  // 옥상 테라스 계단
  for (let s = 0; s < 10; s++) {
    const sy = s * 0.34 + 0.17;
    const sz = WZ + 3.0 - s * 0.65;
    b.box(WX - 6.8, sy, sz, 1.2, 0.34, 0.68, 0x6e4830, { tex: 'stone' });
    col.addBox(WX - 6.8, sz, 1.3, 0.7);
  }

  buildRooftopTerrace(b, WX, 3.6, WZ);
  buildWorkshopDetails(b, col, WX, WZ);

  LAMPS.push({ x: WX, y: 2.2, z: WZ, kind: 'torch' });
  LAMPS.push({ x: WX, y: 4.2, z: WZ, kind: 'torch' });

  // ─────────────────────────────────────────────────────────────
  // 4. 우상들 배치 (공방 내부)
  // ─────────────────────────────────────────────────────────────
  const idols = buildIdols();
  idols.smallIdols[0].position.set(WX - 4.5, 0.9, WZ - 2.5);
  idols.smallIdols[1].position.set(WX - 3.5, 0.9, WZ - 2.5);
  idols.smallIdols[2].position.set(WX - 2.5, 0.9, WZ - 2.5);
  root.add(idols.smallIdols[0], idols.smallIdols[1], idols.smallIdols[2]);

  idols.largeIdol.position.set(WX, 0, WZ - 2.2);
  root.add(idols.largeIdol);
  col.addBox(WX, WZ - 2.2, 1.6, 1.4);

  // ─────────────────────────────────────────────────────────────
  // 5. 이웃 가옥들 및 골목길 (밀도 높은 고대 도시감)
  // ─────────────────────────────────────────────────────────────
  // 동쪽 이웃집 1 (데라 가족 안채: x: 13.5, z: -6.5)
  P.house(b, col, 13.5, -6.5, {
    w: 6.2, d: 5.0, h: 3.0,
    style: 'brick',
    awning: 'stripeRed',
    stairs: 1,
  });
  P.oven(b, col, 9.8, -4.8);
  P.woodpile(b, col, 17.2, -4.6, Math.PI / 2);
  P.pot(b, 10.2, -3.5, 0.9);
  P.pot(b, 10.7, -3.6, 0.7, PAL.clay[1]);

  // 서쪽 가옥 (x: -17.5, z: -5.5)
  P.house(b, col, -17.5, -5.5, {
    w: 5.8, d: 4.8, h: 2.8,
    style: 'brick',
    awning: 'stripeIndigo',
  });
  P.bench(b, col, -14.2, -2.4);

  // 남서쪽 가옥 (x: -15.0, z: 13.0)
  P.house(b, col, -15.0, 13.0, {
    w: 5.4, d: 4.2, h: 2.7,
    style: 'brick',
    roofProps: true,
  });

  // 남동쪽 상인 주택 (x: 14.5, z: 14.0)
  P.house(b, col, 14.5, 14.0, {
    w: 5.0, d: 4.0, h: 2.6,
    style: 'brick',
  });

  // 건물 사이 바위와 풀포기 흩뿌리기
  P.rock(b, col, -7.5, 1.2, 0.7);
  P.rock(b, col, 8.2, -2.5, 0.8);
  P.rock(b, col, -18.2, 4.5, 0.6);
  P.tuft(b, -8.2, 1.8);
  P.tuft(b, -6.5, 2.2);
  P.tuft(b, 7.8, -1.8);

  // ─────────────────────────────────────────────────────────────
  // 6. 서쪽 광장: 우물과 종려나무(대추야자) 쉼터
  // ─────────────────────────────────────────────────────────────
  P.well(b, col, -12.0, 3.5);
  P.palmTree(b, col, -15.5, 1.5);
  P.palmTree(b, col, -8.5, 1.8);
  P.palmTree(b, col, -15.2, 6.2);
  P.palmTree(b, col, -9.0, 6.5);
  P.bench(b, col, -11.8, 6.2);
  P.bench(b, col, -8.8, 4.0);
  P.pot(b, -10.2, 2.5, 0.95);
  P.pot(b, -13.8, 2.7, 0.8, PAL.clay[2]);
  P.torchPost(b, col, -12.0, 0.8);
  LAMPS.push({ x: -12.0, y: 1.8, z: 0.8, kind: 'torch' });

  // ─────────────────────────────────────────────────────────────
  // 7. 남쪽 장터: 활기찬 수메르 장터 (과일, 토기, 양탄자 가판대)
  // ─────────────────────────────────────────────────────────────
  P.stall(b, col, -1.0, 10.5, 'stripeRed', 'fruit');
  P.stall(b, col, 4.5, 10.5, 'stripeIndigo', 'pots');
  P.stall(b, col, 10.0, 10.5, 'stripeSaffron', 'cloth');

  P.cart(b, col, 15.0, 11.2);
  P.crate(b, -3.2, 0, 10.8);
  P.crate(b, -3.2, 0.5, 10.8, 0.3, 0.4);
  col.addBox(-3.2, 10.8, 0.6, 0.6);

  P.sack(b, 2.0, 11.2, 0.4);
  P.sack(b, 2.4, 11.0, 0.8);
  P.basket(b, -2.4, 0, 11.8, PAL.produce.fig);
  P.basket(b, -1.8, 0, 11.9, PAL.produce.pomegranate);
  P.basket(b, 6.2, 0, 11.5, PAL.produce.melon);

  P.torchPost(b, col, 1.5, 8.8);
  P.torchPost(b, col, 7.5, 8.8);
  LAMPS.push({ x: 1.5, y: 1.8, z: 8.8, kind: 'torch' });
  LAMPS.push({ x: 7.5, y: 1.8, z: 8.8, kind: 'torch' });

  // ─────────────────────────────────────────────────────────────
  // 8. 남동쪽 우르 성문 회랑 (x: 22, z: 3.5)
  // ─────────────────────────────────────────────────────────────
  b.box(23.5, 2.5, -4.0, 1.8, 5.0, 12.0, reg.brick, { tex: 'brick' });
  col.addBox(23.5, -4.0, 1.9, 12.1);
  b.box(23.5, 2.5, 12.0, 1.8, 5.0, 12.0, reg.brick, { tex: 'brick' });
  col.addBox(23.5, 12.0, 1.9, 12.1);
  b.box(23.5, 4.4, 3.5, 2.2, 1.4, 5.0, reg.brick, { tex: 'brick' });
  b.box(23.5, 5.2, 3.5, 2.4, 0.4, 5.4, 0x4a3222, { tex: 'brick' });

  P.torchPost(b, col, 22.2, 1.5);
  P.torchPost(b, col, 22.2, 5.5);
  LAMPS.push({ x: 22.2, y: 1.8, z: 1.5, kind: 'torch' });
  LAMPS.push({ x: 22.2, y: 1.8, z: 5.5, kind: 'torch' });

  // ─────────────────────────────────────────────────────────────
  // 9. 원경 복셀 지구라트 & 고원 배치
  // ─────────────────────────────────────────────────────────────
  const ziggurat = buildZiggurat();
  ziggurat.position.set(-36, 0, -28); // 북서쪽 고원 지면에 완벽히 밀착
  root.add(ziggurat);

  // ─────────────────────────────────────────────────────────────
  // 10. 주요 3D 복셀 NPC들
  // ─────────────────────────────────────────────────────────────
  const actors: Actor[] = [];

  const terahActor = new Actor('terah', 'terah');
  terahActor.root.position.set(-2.0, 0, 2.2);
  terahActor.face(Math.PI * 0.25);
  root.add(terahActor.root);
  col.addCircle(-2.0, 2.2, 0.45);
  actors.push(terahActor);

  const lotActor = new Actor('lot', 'lot');
  lotActor.root.position.set(-10.5, 0, 3.5);
  lotActor.face(Math.PI * 0.5);
  root.add(lotActor.root);
  col.addCircle(-10.5, 3.5, 0.45);
  actors.push(lotActor);

  const saraiActor = new Actor('sarai', 'sarai');
  saraiActor.root.position.set(11.5, 0, -4.0);
  saraiActor.face(-Math.PI * 0.25);
  root.add(saraiActor.root);
  col.addCircle(11.5, -4.0, 0.45);
  actors.push(saraiActor);

  const merchantActor = new Actor('merchant', 'citizen');
  merchantActor.root.position.set(4.5, 0, 9.0);
  merchantActor.face(0);
  root.add(merchantActor.root);
  col.addCircle(4.5, 9.0, 0.45);
  actors.push(merchantActor);

  root.add(b.build());

  return {
    root,
    col,
    spawn: { x: WX, z: 3.2 },
    bounds: col.bounds,
    idols,
    rooftopSpot: { x: WX, y: 3.6, z: WZ },
    actors,
  };
}
