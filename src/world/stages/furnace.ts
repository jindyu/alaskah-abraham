import * as THREE from 'three';
import { Collision } from '../collision';
import { PAL, PAL_REGION } from '../palette';
import { VoxelBuilder } from '../voxel';
import { Px, TD, ditherPick } from '../textures';
import { fbm, hash2, valueNoise } from '../../core/rng';
import { buildZiggurat } from '../props/urProps';
import { buildFarField, tintColor } from './common';

export interface FurnaceStage {
  root: THREE.Group;
  col: Collision;
  spawn: { x: number; z: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  furnace: {
    group: THREE.Group;
    flameLight: THREE.PointLight;
    backLight: THREE.PointLight;
    innerFireMesh: THREE.Group;
    chimneyPos: THREE.Vector3;
    pitPos: THREE.Vector3;
    rampPos: THREE.Vector3;
  };
  garden: {
    group: THREE.Group;
    springLight: THREE.PointLight;
    show: () => void;
    hide: () => void;
  };
  throne: {
    group: THREE.Group;
    seatPos: THREE.Vector3;
  };
  spectatorSpot: THREE.Vector3;
  braziers: THREE.PointLight[];
}

const FURNACE_HALF = 24; // 48x48m

/** 우르 풀무불 광장의 그을린 석판, 바벨 황실 보도, 화염 균열 지면 생성 (TD=16 고해상도) */
function buildFurnaceGround(): THREE.Mesh {
  const N = FURNACE_HALF * 2 * TD; // 768x768
  const px = new Px(N, N);
  const toW = (idx: number) => -FURNACE_HALF + (idx + 0.5) / TD;
  const reg = PAL_REGION.MESOPOTAMIA;

  for (let j = 0; j < N; j++) {
    const z = toW(j);
    for (let i = 0; i < N; i++) {
      const x = toW(i);

      // 1. 기본 광장 포석: 바빌로니아 황실 황갈색 및 테라코타 소성 벽돌
      const nBase = fbm(x / 8, z / 8, 801, 2) * 0.5 + valueNoise(i / 12, j / 12, 802) * 0.3 + hash2(i, j, 803) * 0.2;
      let c = ditherPick([0x9c724e, 0x8e6442, 0xa87c54, 0x7e5436], nBase, i, j, 0.3);

      // 격자형 석판 줄눈 (1m x 1m = 16x16 텍셀)
      // 줄은 어긋나게(벽돌 쌓기), 석판마다 밝기·따뜻함이 달라 넓은 바닥이 한 장의 평면으로 보이지 않게
      const row = Math.floor(j / TD);
      const si = i + (row & 1) * (TD >> 1);
      const li = si % TD;
      const lj = j % TD;
      const slab = Math.floor(si / TD);
      const sk = 0.82 + hash2(slab, row, 851) * 0.3;
      c = tintColor(c, sk + (lj / TD - 0.5) * 0.06 * hash2(slab, row, 853), (hash2(slab, row, 855) - 0.5) * 0.1);
      // 마모·잔금: 석판 한 귀퉁이가 닳고, 가는 금이 간다
      if (hash2(slab, row, 857) > 0.8 && li > TD - 5 && lj < 5) c = tintColor(c, 0.78);
      if (hash2(slab, row, 859) > 0.86 && Math.abs(li - lj * 0.7 - 3) < 0.7) c = tintColor(c, 0.62);
      if (li === 0 || lj === 0) {
        c = 0x5a3c26; // 진한 갈색 줄눈
      } else if (li === 1 || lj === 1) {
        c = 0xb48860; // 베벨 하이라이트
      }

      // 2. 풀무불 화로 주변 (x: 0, z: -3.5) 반경 6.5m 그을음 및 검은 현무암 지대
      const dFurnace = Math.hypot(x, z - (-3.5));
      if (dFurnace < 6.8) {
        const sootRatio = 1 - dFurnace / 6.8;
        const nSoot = valueNoise(i / 8, j / 8, 811);
        if (nSoot < sootRatio * 1.25) {
          c = ditherPick([0x1a1410, 0x2b2018, 0x3d2c20, 0x140e0a], nSoot, i, j);
          // 화염 열기에 갈라진 붉은 마그마 틈새
          const crackNoise = hash2(i, j, 813);
          if (dFurnace < 3.8 && crackNoise < 0.045) {
            c = 0xff4810; // 붉은 불씨 균열
          } else if (dFurnace < 3.8 && crackNoise < 0.085) {
            c = 0xffa020; // 황금 불씨 틈새
          }
        }
      }

      // 3. 북쪽 니므롯 왕실 단상 하부 (z: -14.0 ~ -8.5, |x| < 8.0) 청유리 타일 보도
      if (z >= -14.0 && z <= -8.5 && Math.abs(x) < 8.0) {
        const nPalace = (Math.floor(x * 2) + Math.floor(z * 2)) % 2 === 0;
        if (nPalace) {
          c = reg.ishtarBlue; // 이슈타르 청유리
        } else {
          c = 0xd4a024; // 황금 타일
        }
        if (li === 0 || lj === 0) c = 0x112244;
      }

      // 4. 광장 단장: 남쪽 입구에서 풀무불로 이어지는 의식용 카펫 길 (청·금·자주 띠)
      if (z > -1.0 && z < 17 && Math.abs(x) < 2.4) {
        const ax = Math.abs(x);
        const fringe = ((Math.floor(z * 2) % 2) === 0);
        if (ax < 0.3) c = 0xd4a024;
        else if (ax < 1.5) c = (Math.floor(z * 1.5) % 4 === 0) ? 0xd9b24a : 0x7a1c2c;
        else if (ax < 1.9) c = 0xd4a024;
        else c = fringe ? reg.ishtarBlue : 0x16345e;
        if (hash2(i, j, 861) < 0.06) c = tintColor(c, 0.88);
      }
      // 광장 가장자리 띠: 어두운 현무암 테두리 + 청유리 줄 (벽 아래 도랑 느낌)
      const eDist = Math.min(FURNACE_HALF - Math.abs(x), FURNACE_HALF - Math.abs(z));
      if (Math.abs(x) > 15.2 && Math.abs(x) < 17.4) c = Math.abs(x) < 15.6 ? 0x16345e : tintColor(c, 0.7);
      if (eDist < 0) c = 0x3a281a;
      // 큰 얼룩(보도 석판의 색 편차)
      if (valueNoise(x / 3, z / 3, 871) > 0.72 && dFurnace > 7) c = tintColor(c, 0.88);
      // 청동 화로 둘레 원형 상감 (금색 원 + 청색 점)
      const dRing = Math.abs(Math.hypot(x, z - 4.0) - 5.2);
      if (dRing < 0.14 && (z > 0)) c = 0xd4a024;
      px.set(i, j, c);
    }
  }

  const tex = px.toTexture();
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(FURNACE_HALF * 2, FURNACE_HALF * 2),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.01;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildUrFurnaceStage(): FurnaceStage {
  const root = new THREE.Group();
  const col = new Collision();
  col.bounds = {
    minX: -FURNACE_HALF + 3,
    maxX: FURNACE_HALF - 3,
    minZ: -FURNACE_HALF + 3,
    maxZ: FURNACE_HALF - 3,
  };

  const reg = PAL_REGION.MESOPOTAMIA;

  // 1. 지평선 바닥 및 고해상도 광장 타일
  const horizonGeo = new THREE.PlaneGeometry(240, 240);
  const horizonMat = new THREE.MeshLambertMaterial({ color: 0x8a6444 });
  const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
  horizonMesh.rotation.x = -Math.PI / 2;
  horizonMesh.position.y = -0.05;
  root.add(horizonMesh);
  root.add(buildFurnaceGround());
  buildFarField(root, FURNACE_HALF, { seed: 31, pal: [0x9c724e, 0x8e6442, 0xa87c54, 0x7e5436], tex: 'brick', accents: [0x6a4a30, 0x4a3a2a], depth: 30, nearH: 1.0, maxH: 3.0, haze: 0xb89870 });

  // ─────────────────────────────────────────────────────────────
  // 2. 바벨의 거대 계단식 소성 풀무불 가마 (전면 개방형 중공 가마 구조)
  //    중심: (0, 0, -3.5), 카메라는 남쪽에서 북쪽을 바라봄
  // ─────────────────────────────────────────────────────────────
  const furnaceGroup = new THREE.Group();
  const fb = new VoxelBuilder(9, false);

  // 북쪽 후벽 (가마 뒷벽 & 거대 굴뚝)
  fb.box(0, 0, -6.4, 9.6, 3.6, 1.6, reg.brick, { tex: 'brick' });
  fb.box(0, 3.6, -6.4, 6.4, 1.8, 1.6, 0x784a28, { tex: 'brick' });
  // 후방 배기 굴뚝 타워
  fb.box(0, 5.4, -6.4, 3.6, 2.2, 1.6, 0x4a2612, { tex: 'brick' });
  fb.box(0, 7.6, -6.4, 2.4, 0.4, 1.2, 0x111111);

  // 서쪽 측벽
  fb.box(-4.4, 0, -3.5, 1.6, 3.0, 4.8, reg.brick, { tex: 'brick' });
  fb.box(-4.4, 3.0, -3.5, 1.2, 1.0, 4.0, 0x784a28, { tex: 'brick' });

  // 동쪽 측벽 및 투척 램프 (Execution Ramp)
  fb.box(4.4, 0, -3.5, 1.6, 3.0, 4.8, reg.brick, { tex: 'brick' });
  for (let step = 0; step < 6; step++) {
    const rx = 5.6 + step * 0.35;
    const rz = -0.5 - step * 0.6;
    const rh = 0.38 * (step + 1);
    fb.box(rx, 0, rz, 1.2, rh, 0.8, PAL.stone[1], { tex: 'stone' });
  }
  // 투척 발코니 플랫폼 (높이 2.4m, x = 3.4, z = -3.5)
  fb.box(3.4, 2.4, -3.5, 1.8, 0.4, 2.0, PAL.stone[2], { tex: 'stone' });
  fb.box(3.4, 2.8, -2.4, 1.8, 0.6, 0.1, 0xb88628, { tex: 'metal' }); // 난간

  // 남쪽 전면 낮은 문턱 및 개방형 아치 (높이 3.8m로 올려 내부 시야 완전 개방!)
  fb.box(-3.2, 0, -1.0, 1.6, 1.4, 0.8, reg.brick, { tex: 'brick' });
  fb.box(3.2, 0, -1.0, 1.6, 1.4, 0.8, reg.brick, { tex: 'brick' });
  fb.box(0, 0, -1.0, 5.0, 0.3, 0.8, 0x3d2817); // 바닥 턱
  // 전면 황동 장식 석주 (외곽에 배치하여 중앙 5m 시야 완전 개방!)
  fb.box(-3.4, 0, -0.9, 0.5, 3.2, 0.5, 0xb88628, { tex: 'metal' });
  fb.box(3.4, 0, -0.9, 0.5, 3.2, 0.5, 0xb88628, { tex: 'metal' });

  furnaceGroup.add(fb.build());

  // 가마 내부 타오르는 숯과 화염 메쉬
  const fireBuilder = new VoxelBuilder(9, false);
  fireBuilder.box(0, 0, -3.5, 6.8, 0.6, 4.2, reg.furnaceFire, { tex: 'flame' });
  fireBuilder.box(0, 0.5, -3.5, 5.0, 0.6, 3.0, 0xff9910, { tex: 'flame' });
  fireBuilder.box(0, 1.0, -3.5, 3.2, 0.5, 1.8, 0xffea30, { tex: 'flame' });
  const innerFireMesh = fireBuilder.build();
  furnaceGroup.add(innerFireMesh);

  // 화염 광원
  const flameLight = new THREE.PointLight(0xff4800, 6.0, 24);
  flameLight.position.set(0, 1.8, -3.5);
  furnaceGroup.add(flameLight);

  const backLight = new THREE.PointLight(0xffaa10, 4.0, 18);
  backLight.position.set(0, 2.8, -5.0);
  furnaceGroup.add(backLight);

  root.add(furnaceGroup);

  // 충돌체
  col.addBox(-5.4, -3.4, -6.0, -1.0); // 서벽
  col.addBox(3.4, 5.4, -6.0, -1.0);  // 동벽
  col.addBox(-5.0, 5.0, -7.4, -5.4); // 후벽

  // ─────────────────────────────────────────────────────────────
  // 3. 기적의 장미꽃 동산 & 맑은 샘물 세트피스 (Rose Garden Miracle)
  //    중심: (0, 0, -3.5)
  // ─────────────────────────────────────────────────────────────
  const gardenGroup = new THREE.Group();
  gardenGroup.position.set(0, 0, -3.5);
  const gb = new VoxelBuilder(9, false);

  // 푸른 풀밭 카펫
  gb.box(0, 0, 0, 7.0, 0.2, 4.4, 0x2e7d32, { tex: 'soil' });
  // 맑은 샘물 수로
  gb.box(0, 0.1, 0, 2.0, 0.16, 4.0, 0x4fc3f7, { tex: 'water' });

  // 18개의 정밀 복셀 장미꽃 덤불 (진홍 장미 & 순백 백합)
  const roseSpots = [
    { x: -2.2, z: -1.4, col: 0xd32f2f },
    { x: -1.6, z: -0.6, col: 0xffffff },
    { x: -2.4, z: 0.6, col: 0xd32f2f },
    { x: -1.7, z: 1.4, col: 0xffb6c1 },
    { x: 2.2, z: -1.4, col: 0xffffff },
    { x: 1.6, z: -0.5, col: 0xd32f2f },
    { x: 2.4, z: 0.6, col: 0xffffff },
    { x: 1.8, z: 1.4, col: 0xd32f2f },
    { x: -0.9, z: -1.5, col: 0xd32f2f },
    { x: 0.9, z: -1.5, col: 0xffffff },
    { x: -0.9, z: 1.5, col: 0xffffff },
    { x: 0.9, z: 1.5, col: 0xd32f2f },
    { x: -2.7, z: 0.0, col: 0xd32f2f },
    { x: 2.7, z: 0.0, col: 0xffffff },
    { x: -1.3, z: 0.8, col: 0xd32f2f },
    { x: 1.3, z: 0.8, col: 0xffb6c1 },
    { x: -1.3, z: -0.8, col: 0xffffff },
    { x: 1.3, z: -0.8, col: 0xd32f2f },
  ];

  for (const s of roseSpots) {
    gb.box(s.x, 0.2, s.z, 0.52, 0.28, 0.52, 0x1b5e20, { tex: 'soil' });
    gb.box(s.x, 0.48, s.z, 0.32, 0.24, 0.32, s.col);
    gb.box(s.x, 0.72, s.z, 0.14, 0.08, 0.14, 0xffeb3b);
  }

  gardenGroup.add(gb.build());

  const springLight = new THREE.PointLight(0x80deea, 0, 16);
  springLight.position.set(0, 1.8, 0);
  gardenGroup.add(springLight);

  gardenGroup.visible = false;
  root.add(gardenGroup);

  const gardenApi = {
    group: gardenGroup,
    springLight,
    show: () => {
      gardenGroup.visible = true;
      innerFireMesh.visible = false;
      flameLight.color.setHex(0x80deea);
      flameLight.intensity = 3.5;
      backLight.color.setHex(0xffffff);
      backLight.intensity = 2.5;
      springLight.intensity = 4.0;
    },
    hide: () => {
      gardenGroup.visible = false;
      innerFireMesh.visible = true;
      flameLight.color.setHex(0xff4800);
      flameLight.intensity = 6.0;
      backLight.color.setHex(0xffaa10);
      backLight.intensity = 4.0;
      springLight.intensity = 0;
    },
  };

  // ─────────────────────────────────────────────────────────────
  // 4. 북쪽 높은 왕실 테라스 & 황금 사자 왕좌 (Nimrod's Royal Terrace)
  //    위치: z = -11.0, 정면 남쪽(카메라 쪽)을 웅장하게 내려다봄!
  // ─────────────────────────────────────────────────────────────
  const throneGroup = new THREE.Group();
  const tb = new VoxelBuilder(9, false);

  // 테라스 기저부 (가로 14m x 세로 5m, 높이 3.6m, z: -13.5 ~ -8.5)
  tb.box(0, 0, -11.0, 14.0, 3.6, 5.0, reg.brick, { tex: 'brick' });
  // 광택 대리석 바닥
  tb.box(0, 3.6, -11.0, 14.2, 0.2, 5.2, 0xd4af37);

  // 이슈타르 청유리 원기둥 4쌍 (기둥 높이 3.8m)
  const columnX = [-5.5, -2.0, 2.0, 5.5];
  for (const cx of columnX) {
    tb.box(cx, 3.8, -9.0, 0.9, 3.5, 0.9, reg.ishtarBlue, { tex: 'stone' });
    tb.box(cx, 7.3, -9.0, 1.3, 0.4, 1.3, 0xf3c13a); // 황금 주두
  }

  // 테라스 앞쪽 낮은 청동 난간 (높이 0.7m, 시야 가림 없음!)
  tb.box(0, 3.8, -8.6, 14.0, 0.7, 0.15, 0x8a2018);

  // 황금 사자 왕좌 (Golden Lion Throne at 0, 3.8, -11.5)
  tb.box(0, 3.8, -11.4, 3.0, 0.4, 2.4, 0xd4af37);
  // 자줏빛 벨벳 방석
  tb.box(0, 4.2, -11.4, 1.4, 0.35, 1.2, 0x880e4f);
  // 등받이 & 황금 독수리 날개
  tb.box(0, 4.2, -12.1, 1.6, 2.0, 0.3, 0xf5c022);
  tb.box(0, 6.2, -12.1, 0.8, 0.5, 0.35, 0xd32f2f); // 루비 왕관 문장
  // 팔걸이 사자상
  tb.box(-0.85, 4.2, -11.3, 0.3, 0.7, 1.1, 0xd4af37);
  tb.box(0.85, 4.2, -11.3, 0.3, 0.7, 1.1, 0xd4af37);

  // 왕실 군기 2대
  tb.box(-2.8, 3.8, -11.5, 0.1, 4.5, 0.1, 0x3d2817);
  tb.box(-3.4, 6.2, -11.5, 1.2, 1.8, 0.05, 0xb71c1c);
  tb.box(2.8, 3.8, -11.5, 0.1, 4.5, 0.1, 0x3d2817);
  tb.box(3.4, 6.2, -11.5, 1.2, 1.8, 0.05, 0xb71c1c);

  throneGroup.add(tb.build());
  root.add(throneGroup);

  col.addBox(-7.2, 7.2, -13.6, -8.4);

  // ─────────────────────────────────────────────────────────────
  // 5. 서쪽 참관석 테라스 & 청동 화로 4기 (Viewing Gallery & Braziers)
  // ─────────────────────────────────────────────────────────────
  const spectatorGroup = new THREE.Group();
  const sb = new VoxelBuilder(9, false);

  // 서쪽 석조 참관 난간 (x: -9.5, z: -1.0 ~ 3.5, 높이 1.2m)
  sb.box(-10.0, 0, 0.5, 3.0, 1.2, 6.5, PAL.stone[1], { tex: 'stone' });
  sb.box(-8.7, 1.2, 0.5, 0.3, 0.7, 6.5, PAL.stone[2], { tex: 'stone' });
  spectatorGroup.add(sb.build());
  root.add(spectatorGroup);
  col.addBox(-11.6, -8.4, -2.8, 3.8);

  // 청동 화로 4기
  const braziers: THREE.PointLight[] = [];
  const brazierSpots = [
    { x: -5.5, z: 2.0 },
    { x: 5.5, z: 2.0 },
    { x: -6.5, z: -8.0 },
    { x: 6.5, z: -8.0 },
  ];

  for (const bSpot of brazierSpots) {
    const bb = new VoxelBuilder(9, false);
    bb.box(bSpot.x, 0, bSpot.z, 0.65, 0.9, 0.65, 0x8a623c, { tex: 'metal' });
    bb.box(bSpot.x, 0.9, bSpot.z, 0.9, 0.25, 0.9, 0x22140a);
    bb.box(bSpot.x, 1.15, bSpot.z, 0.7, 0.18, 0.7, 0xff5510, { tex: 'flame' });
    root.add(bb.build());

    const bLight = new THREE.PointLight(0xff6610, 2.0, 10);
    bLight.position.set(bSpot.x, 1.4, bSpot.z);
    root.add(bLight);
    braziers.push(bLight);
  }

  // ─────────────────────────────────────────────────────────────
  // 6. 광장 건축: 측면 성벽(청유리 띠·여장), 관람 계단, 열주, 사자상, 배경 지구라트
  // ─────────────────────────────────────────────────────────────
  const cy = new VoxelBuilder(9, false);
  const brickC = reg.brick;
  for (const sx of [-1, 1]) {
    const wx = sx * 17.6;
    cy.box(wx, 0, -1, 1.8, 4.6, 30, brickC, { tex: 'brick' });
    cy.box(wx, 4.6, -1, 2.1, 0.3, 30.3, 0xd4a024, { tex: 'metal' });
    cy.box(wx - sx * 0.95, 2.9, -1, 0.1, 0.5, 30, reg.ishtarBlue, { tex: 'stone' });
    cy.box(wx - sx * 0.95, 1.2, -1, 0.1, 0.18, 30, 0xd4a024, { tex: 'metal' });
    for (let k = 0; k < 17; k++) cy.box(wx, 4.9, -14.5 + k * 1.75, 1.2, 0.8, 0.9, tintColor(brickC, 1.1 + hash2(k, sx + 2, 881) * 0.1), { tex: 'brick' });
    // 벽면 사자 부조 (청 바탕 + 금빛 사자)
    for (let k = 0; k < 5; k++) {
      const wz2 = -10 + k * 5.6;
      cy.box(wx - sx * 0.95, 1.4, wz2, 0.12, 2.2, 2.0, reg.ishtarBlue, { tex: 'stone' });
      cy.box(wx - sx * 1.02, 1.8, wz2, 0.1, 0.8, 1.2, 0xd4a024, { tex: 'metal' });
      cy.box(wx - sx * 1.02, 2.5, wz2 - 0.35, 0.1, 0.5, 0.45, 0xd4a024, { tex: 'metal' });
    }
    col.addBox(wx, -1, 1.8, 30);
  }
  // 관람 계단 (동쪽: 북쪽 구간, 서쪽: 남쪽 구간) + 청색 깃발
  const tiers = [{ x: 14.4, z0: -4, z1: 8 }, { x: -14.4, z0: 5, z1: 13 }];
  for (const t of tiers) {
    const sgn = t.x > 0 ? 1 : -1;
    for (let r = 0; r < 3; r++) {
      cy.box(t.x + sgn * r * 0.9, 0, (t.z0 + t.z1) / 2, 1.0, 0.5 + r * 0.5, t.z1 - t.z0, tintColor(brickC, 0.95 + r * 0.08), { tex: 'brick' });
      cy.box(t.x + sgn * r * 0.9 - sgn * 0.3, 0.5 + r * 0.5, (t.z0 + t.z1) / 2, 0.35, 0.06, t.z1 - t.z0 - 0.4, r % 2 ? 0x7a1c2c : reg.ishtarBlue, { tex: 'wool' });
    }
    col.addBox(t.x + sgn * 0.9, (t.z0 + t.z1) / 2, 3.2, t.z1 - t.z0);
    for (let k = 0; k < 4; k++) {
      const bz = t.z0 + 1 + k * ((t.z1 - t.z0 - 2) / 3);
      cy.box(t.x + sgn * 2.3, 0, bz, 0.1, 3.4, 0.1, 0x3d2817);
      cy.box(t.x + sgn * 2.3, 2.0, bz + 0.45, 0.06, 1.3, 0.8, k % 2 ? 0xb71c1c : reg.ishtarBlue);
    }
  }
  // 입구 쪽 열주 (청유리 기둥 + 금 주두) 두 줄
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const pz = 7.5 + k * 2.8, px2 = sx * 8.2;
      if (sx < 0 && pz < 5) continue;
      cy.box(px2, 0, pz, 0.9, 0.5, 0.9, 0x5a3c26, { tex: 'brick' });
      cy.box(px2, 0.5, pz, 0.7, 3.4, 0.7, reg.ishtarBlue, { tex: 'stone' });
      cy.box(px2, 3.9, pz, 1.1, 0.35, 1.1, 0xf3c13a, { tex: 'metal' });
      col.addBox(px2, pz, 0.9, 0.9);
    }
    cy.box(sx * 8.2, 4.25, 10.2, 1.0, 0.35, 9.0, tintColor(brickC, 1.1), { tex: 'brick' });
  }
  // 카펫 길 입구 황금 사자상 한 쌍 (z=15)
  for (const sx of [-1, 1]) {
    cy.box(sx * 3.4, 0, 14.5, 1.4, 0.6, 2.2, 0x5a3c26, { tex: 'brick' });
    cy.box(sx * 3.4, 0.6, 14.5, 0.9, 0.8, 1.8, 0xd4a024, { tex: 'metal' });
    cy.box(sx * 3.4, 1.4, 13.8, 0.8, 0.8, 0.8, 0xe6b82c, { tex: 'metal' });
    cy.box(sx * 3.4, 1.5, 13.3, 0.6, 0.5, 0.3, 0xb88628, { tex: 'metal' });
    col.addBox(sx * 3.4, 14.5, 1.5, 2.3);
  }
  root.add(cy.build());

  // 배경 지구라트 (북쪽 멀리, 실루엣만 — 카메라는 위쪽 일부만 본다)
  const zig = buildZiggurat();
  zig.scale.setScalar(0.6);
  zig.position.set(-9, 0, -30);
  root.add(zig);

  return {
    root,
    col,
    spawn: { x: 0, z: 2.0 },
    bounds: { minX: -20, maxX: 20, minZ: -18, maxZ: 18 },
    furnace: {
      group: furnaceGroup,
      flameLight,
      backLight,
      innerFireMesh,
      chimneyPos: new THREE.Vector3(0, 7.4, -6.4),
      pitPos: new THREE.Vector3(0, 0.6, -3.5),
      rampPos: new THREE.Vector3(3.4, 2.4, -3.5),
    },
    garden: gardenApi,
    throne: {
      group: throneGroup,
      seatPos: new THREE.Vector3(0, 4.4, -11.4),
    },
    spectatorSpot: new THREE.Vector3(-9.2, 1.2, 0.5),
    braziers,
  };
}
