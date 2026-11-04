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

const UR_HALF = 40; // 80x80 메인 시가지 고해상도 지면 (TD=16 기준 1280x1280 노아 정통 고해상도 픽셀 지면!)

/** 우르의 고해상도 벽돌길, 사막 모래흙, 오아시스 초목 지면 텍스처 평면 생성 (노아 TD=16 벤치마크) */
function buildUrGround(): THREE.Mesh {
  const N = UR_HALF * 2 * TD; // 1280x1280 노아 정통 고해상도 지면!
  const px = new Px(N, N);
  const toW = (idx: number) => -UR_HALF + (idx + 0.5) / TD;
  const reg = PAL_REGION.MESOPOTAMIA;

  for (let j = 0; j < N; j++) {
    const z = toW(j);
    for (let i = 0; i < N; i++) {
      const x = toW(i);

      // 1. 기본 대지: 메소포타미아 황토와 고운 사막 모래 (노아의 grassColor 기법을 사막 흙에 적용)
      const nBase = fbm(x / 10, z / 10, 301, 2) * 0.45 + valueNoise(i / 16, j / 16, 302) * 0.35 + hash2(i, j, 303) * 0.2;
      let c = ditherPick([reg.ground, 0xd2a874, 0xc49c68, 0xb88e54, 0xa87d46], nBase, i, j, 0.32);

      // 모래알 및 미세 자갈 스펙클
      const hGrit = hash2(i, j, 305);
      if (hGrit < 0.012) c = 0x8a623c;
      else if (hash2(i, j - 1, 305) < 0.012) c = 0xe4cc9c;

      // 2. 동서 대로 (z: 1.5 ~ 6.0, |x| < 26) 및 공방 진입로 (|x| < 2.6, z: -8.0 ~ 1.5)
      const isEastWestRoad = z >= 1.5 && z <= 5.8 && Math.abs(x) < 25.5;
      const isWorkshopPath = Math.abs(x) < 2.5 && z >= -7.5 && z <= 1.5;
      const isRoadArea = isEastWestRoad || isWorkshopPath;

      if (isRoadArea) {
        const roadEdgeDist = isEastWestRoad
          ? Math.min(z - 1.5, 5.8 - z, 25.5 - Math.abs(x))
          : Math.min(x - (-2.5), 2.5 - x, z - (-7.5), 1.5 - z);

        if (roadEdgeDist > 0.08) {
          // 벽돌 패턴 (cellW: 10, cellH: 5 텍셀 = 가로 62cm, 세로 31cm 고대 소성 벽돌)
          const cellW = 10, cellH = 5;
          const row = Math.floor(j / cellH);
          const shiftX = (row % 2) * (cellW / 2);
          const col = Math.floor((i + shiftX) / cellW);
          const li = (i + shiftX) % cellW;
          const lj = j % cellH;

          // 벽돌 틈새 줄눈
          if (li === 0 || lj === 0) {
            c = hash2(i, j, 411) < 0.2 ? 0x6e4828 : 0x845a34;
          } else {
            // 벽돌 색상 변량 (가마에서 구워진 벽돌마다 다른 황토/테라코타 톤)
            const brickTones = [0xb87c4a, 0xae7244, 0xc68a56, 0xa2683c];
            const tone = brickTones[Math.floor(hash2(col, row, 412) * brickTones.length)];
            // 입체감 베벨 (상/좌측 밝음, 하/우측 어두움)
            if (li === 1 || lj === 1) c = 0xd49a68;
            else if (li === cellW - 1 || lj === cellH - 1) c = 0x86502a;
            else {
              const nBrick = valueNoise(i / 2, j / 2, 413);
              c = nBrick > 0.65 ? 0xc28652 : tone;
            }
            if (hash2(i, j, 414) < 0.025) c = 0x764220; // 흠집
          }

          // 도로 가장자리 풍화 마모
          if (roadEdgeDist < 0.35 && hash2(i, j, 415) < (0.35 - roadEdgeDist) * 2.2) {
            c = ditherPick([reg.ground, 0xb88e54, 0x8a623c], hash2(i, j, 416), i, j);
          }
        }
      }

      // 3. 서쪽 우물 광장 (x: -12.0, z: 3.5): 방사형 포석 + 오아시스 초목
      const dWell = Math.hypot(x - (-12.0), z - 3.5);
      if (dWell < 5.4) {
        if (dWell < 2.6) {
          // 우물 바로 주변: 젖은 판석 및 물기 머금은 바닥
          const cellP = 8;
          const cxP = Math.floor(i / cellP), cyP = Math.floor(j / cellP);
          const liP = i % cellP, ljP = j % cellP;
          if (liP === 0 || ljP === 0) {
            c = 0x4a3a2a; // 젖은 흙 줄눈
          } else {
            const stoneTones = [0x9a9484, 0xa8a090, 0x8c8676, 0xb2aa98];
            c = stoneTones[Math.floor(hash2(cxP, cyP, 511) * 4)];
            if (liP === 1 || ljP === 1) c = 0xc0b8a4;
            if (hash2(i, j, 512) < 0.08) c = PAL.water[0]; // 튄 물방울
          }
        } else {
          // 우물 바깥 잔디 및 대추야자 잎 그늘 (노아의 grassColor)
          const nGrass = fbm(x * 2, z * 2, 521, 2);
          if (nGrass > 0.40) {
            c = ditherPick([PAL.grass[2], PAL.grass[3], PAL.dryGrass[1], reg.ground], nGrass, i, j, 0.4);
            if (hash2(i, j, 523) < 0.02) c = PAL.grass[4]; // 풀싹
          }
        }
      }

      // 4. 남쪽 장터 (x: -2 ~ 12, z: 8.5 ~ 13.5): 단단히 다져진 마당 + 짚과 향신료 흔적
      if (x >= -3.5 && x <= 13.5 && z >= 8.2 && z <= 13.5) {
        const nMarket = fbm(x * 1.5, z * 1.5, 601, 2);
        if (nMarket > 0.48) {
          c = ditherPick([0xc29462, 0xd4a872, 0xaf7e4e, 0x9e6e40], nMarket, i, j, 0.35);
          if (hash2(i, j, 603) < 0.03) c = PAL.straw[1]; // 흩뿌려진 짚
          if (hash2(i, j, 604) < 0.015) c = 0xa43828; // 석류/향신료 얼룩
        }
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
  // 5. 이웃 가옥들 및 골목길 (밀도 높은 고대 도시감, 가옥-NPC 충분한 간격 확보)
  // ─────────────────────────────────────────────────────────────
  // 동쪽 이웃집 1 (데라 가족 안채: x: 14.5, z: -8.0, 앞마당을 넉넉히 비워 사래 배치)
  P.house(b, col, 14.5, -8.0, {
    w: 6.2, d: 5.0, h: 3.0,
    style: 'brick',
    awning: 'stripeRed',
    stairs: 1,
  });
  P.oven(b, col, 10.2, -6.5);
  P.woodpile(b, col, 18.5, -6.5, Math.PI / 2);
  P.pot(b, 10.5, -4.8, 0.9);
  P.pot(b, 11.0, -4.9, 0.7, PAL.clay[1]);

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
  P.tuft(b, -7.0, 2.2);
  P.tuft(b, 7.8, -1.8);

  // ─────────────────────────────────────────────────────────────
  // 6. 서쪽 광장: 우물과 종려나무(대추야자) 쉼터 (중앙 마당을 넓혀 롯이 시원하게 보이도록 배치)
  // ─────────────────────────────────────────────────────────────
  P.well(b, col, -12.5, 3.5);
  P.palmTree(b, col, -16.5, 1.0);
  P.palmTree(b, col, -6.5, 0.5);
  P.palmTree(b, col, -16.5, 6.0);
  P.palmTree(b, col, -6.5, 6.5);
  P.bench(b, col, -12.5, 6.0);
  P.bench(b, col, -12.5, 1.0);
  P.pot(b, -14.5, 2.0, 0.95);
  P.pot(b, -14.5, 5.0, 0.8, PAL.clay[2]);
  P.torchPost(b, col, -14.5, 3.5);
  LAMPS.push({ x: -14.5, y: 1.8, z: 3.5, kind: 'torch' });

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
  // 10. 주요 3D 복셀 NPC들 (건물·소품과 겹치지 않는 탁 트인 마당에 배치)
  // ─────────────────────────────────────────────────────────────
  const actors: Actor[] = [];

  // 아버지 데라: 공방 앞마당 (차양 기둥과 2m 이상 떨어진 넓은 공방 마당)
  const terahActor = new Actor('terah', 'terah');
  terahActor.root.position.set(-2.5, 0, 0.8);
  terahActor.face(Math.PI * 0.25);
  root.add(terahActor.root);
  col.addCircle(-2.5, 0.8, 0.45);
  actors.push(terahActor);

  // 조카 어린 롯: 우물가 동쪽 잔디 쉼터 (우물·종려나무와 3.5m 이상 떨어진 햇살 드는 잔디밭)
  const lotActor = new Actor('lot', 'lot');
  lotActor.root.position.set(-8.5, 0, 3.5);
  lotActor.face(Math.PI * 0.5);
  root.add(lotActor.root);
  col.addCircle(-8.5, 3.5, 0.45);
  actors.push(lotActor);

  // 아내 사래: 안채 앞 넓은 마당 (가옥 외벽·차양과 4m 이상 떨어진 탁 트인 마당)
  const saraiActor = new Actor('sarai', 'sarai');
  saraiActor.root.position.set(12.0, 0, -1.5);
  saraiActor.face(-Math.PI * 0.25);
  root.add(saraiActor.root);
  col.addCircle(12.0, -1.5, 0.45);
  actors.push(saraiActor);

  // 수메르 장터 상인: 장터 광장 북쪽 (가판대 차양 밖, 도로에서 내려오는 손님을 맞는 탁 트인 자리)
  const merchantActor = new Actor('merchant', 'citizen');
  merchantActor.root.position.set(4.0, 0, 7.8);
  merchantActor.face(0);
  root.add(merchantActor.root);
  col.addCircle(4.0, 7.8, 0.45);
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
