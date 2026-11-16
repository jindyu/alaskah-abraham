import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildWell, buildBorderChest } from '../props/biblicalProps';
import * as P from '../props';
import { Camel } from '../../entities/animals';
import { buildFarField, buildHorizonPlane, scatterGroundCover } from './common';
import {
  createStageGroundMesh,
  buildPerimeterRidges,
  buildTroughLong,
  buildTorchStand,
  buildStoragePropCluster,
  buildStoneBenchCurved,
} from './scenery36';
import { fbm, hash2, valueNoise } from '../../core/rng';

export interface NahorWellStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  well: THREE.Group;
  eveningLight: THREE.PointLight;
  camels: Camel[];
  update: (dt: number, time: number) => void;
}

const NAHOR_HALF = 18;

/** 나홀의 성 고해상도 지면: 유프라테스 충적토 황토, 성문 앞 포석, 우물가 물 웅덩이, 대상로 */
function buildNahorGroundMesh(): THREE.Mesh {
  const reg = PAL_REGION.MESOPOTAMIA;
  const resolution = 480;

  return createStageGroundMesh(NAHOR_HALF, resolution, (x, z, _u, _v, i, j) => {
    // 1. 아람나하라임(메소포타미아) 충적토 황토 기본 대지
    const nBase = fbm(x / 7, z / 7, 101, 2) * 0.5 + valueNoise(i / 14, j / 14, 102) * 0.3 + hash2(i, j, 103) * 0.2;
    let c = nBase > 0.62 ? 0xc49c66 : nBase > 0.38 ? reg.ground : 0xa47c46;

    // 미세 실트 모래알
    const hGrit = hash2(i, j, 105);
    if (hGrit < 0.015) c = 0x7e5830;
    else if (hGrit > 0.985) c = 0xdfbc84;

    // 2. 우물터 넓은 석조 앞마당 (중앙 x: -7 ~ 7, z: -5 ~ 5)
    if (Math.abs(x) < 7.2 && Math.abs(z) < 5.2) {
      const cell = 12;
      const li = i % cell, lj = j % cell;
      if (li === 0 || lj === 0) {
        c = 0x483826; // 젖은 진흙 줄눈
      } else {
        const stoneTones = [0xa29a8c, 0xb2aa9c, 0x948c7e, 0xbeb6a8];
        c = stoneTones[Math.floor(hash2(Math.floor(i / cell), Math.floor(j / cell), 111) * 4)];
        // 우물과 구유 주변 튄 물방울과 웅덩이
        const dWell = Math.hypot(x, z);
        if (dWell < 3.2 && hash2(i, j, 113) < 0.12) {
          c = PAL.water[1];
        }
      }
    }

    // 3. 성문 대로 (z: -12 ~ -5, |x| < 4.5) 소성벽돌 포석
    if (z >= -12.5 && z <= -5.0 && Math.abs(x) < 4.5) {
      const cellW = 8, cellH = 4;
      const li = i % cellW, lj = j % cellH;
      if (li === 0 || lj === 0) {
        c = 0x6e4624;
      } else {
        c = 0xae7446;
        if (li === 1 || lj === 1) c = 0xc88e5e;
      }
    }

    // 4. 낙타 대상단 이동로 (우물가에서 남동쪽 귀환 길목 x: 8, z: 8 방향)
    const distToCaravanTrail = Math.abs(z - (x - 0));
    if (x >= 2.0 && x <= 11.0 && z >= 2.0 && z <= 11.0 && distToCaravanTrail < 2.5) {
      const nTrail = valueNoise(i / 8, j / 8, 121);
      if (nTrail > 0.35) {
        c = 0x9e7240; // 다져진 마찻길
        if (hash2(i, j, 123) < 0.04) c = 0x7a5228;
      }
    }

    // 5. 종려나무 주변 오아시스 수로 풀밭 (동/서 가장자리)
    if (Math.abs(x) > 8.5) {
      const nGrass = fbm(x * 1.5, z * 1.5, 131, 2);
      if (nGrass > 0.42) {
        c = nGrass > 0.65 ? PAL.grass[2] : PAL.dryGrass[1];
      }
    }

    return c;
  });
}

/**
 * 제6권 메소포타미아 나홀의 성 우물가 3D 복셀 무대
 */
export function buildNahorWellStage(): NahorWellStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.MESOPOTAMIA;

  // 1. 나홀 원경 지평선 및 고해상도 지면 메쉬
  root.add(buildHorizonPlane(reg.ground));
  root.add(buildNahorGroundMesh());


  buildFarField(root, NAHOR_HALF, { seed: 6, pal: [reg.brick, reg.ground, 0x8e5c30, 0x6e4220], tex: 'soil', accents: [0x4a6a34, 0x5a7a3a], depth: 44, haze: reg.ground });
  // 2. 외곽 공허 차단: 메소포타미아 점토 제방 및 대추야자 숲 능선 (남/동/서)
  buildPerimeterRidges(vb, col, NAHOR_HALF, [reg.brick, reg.ground, 0x8e5c30, 0x6e4220], {
    seed: 101,
    minH: 3.5,
    maxH: 6.8,
    tex: 'brick',
    openNorth: true, // 북쪽은 나홀 거대 성벽
  });

  // 3. 북쪽 나홀 성벽 원경 및 아치형 웅장한 성문 (x: -18 ~ 18, z: -11.5 ~ -14)
  const wallZ = -12.5;
  const wallH = 7.2;

  // 좌측 성벽
  vb.box(-11, 0, wallZ, 14, wallH, 3.2, reg.brick, { tex: 'brick' });
  col.addBox(-11, wallZ, 14, 3.5);
  // 우측 성벽
  vb.box(11, 0, wallZ, 14, wallH, 3.2, reg.brick, { tex: 'brick' });
  col.addBox(11, wallZ, 14, 3.5);

  // 성벽 상부 바빌로니아 계단형 여장 (Crenellations)
  for (let bx = -17; bx <= 17; bx += 2.2) {
    if (Math.abs(bx) < 3.2) continue; // 성문 위 제외
    vb.box(bx, wallH, wallZ, 1.3, 0.9, 0.6, reg.brick, { tex: 'brick' });
    vb.box(bx, wallH + 0.9, wallZ, 0.5, 0.4, 0.6, reg.brick, { tex: 'brick' });
  }

  // 중앙 아치형 성문 문루 (이슈타르 청유리 벽돌 장식)
  vb.box(0, 0, wallZ, 7.2, wallH + 1.2, 4.0, reg.brick, { tex: 'brick' });
  col.addBox(0, wallZ, 7.5, 4.2);
  // 청유리 벽돌 띠 장식 (Mesopotamia Ishtar Blue)
  vb.box(0, 5.2, wallZ + 2.05, 7.0, 0.45, 0.1, reg.ishtarBlue, { tex: 'plain' });
  vb.box(0, 6.2, wallZ + 2.05, 7.0, 0.45, 0.1, reg.ishtarBlue, { tex: 'plain' });

  // 성문 아치 개구부
  vb.box(0, 0, wallZ, 3.6, 4.5, 4.4, 0x181410);

  // 4. 중앙 깊은 돌 우물 (x: 0, z: 0: 엘리에셀의 기도 지점)
  const well = buildWell();
  well.position.set(0, 0, 0);
  col.addBox(0, 0, 2.6, 2.6);
  root.add(well);

  // 우물 앞 리브가의 물동이 받침석과 기도 발판석
  vb.box(0, 0.02, 1.4, 1.6, 0.08, 1.2, PAL.stone[3], { tex: 'stone' });

  // 5. 낙타 10필을 위한 좌우 대형 석조 물구유 (양 날개)
  // 서쪽 물구유 (x: -4.5, z: 0)
  buildTroughLong(vb, col, -4.5, 0, 4.8, 'x');
  // 동쪽 물구유 (x: 4.5, z: 0)
  buildTroughLong(vb, col, 4.5, 0, 4.8, 'x');
  // 남쪽 보조 물구유 (x: 0, z: -3.0)
  buildTroughLong(vb, col, 0, -3.0, 3.6, 'x');

  // 우물과 구유를 잇는 석조 도수로 (배수로)
  vb.box(-1.8, 0, 0, 1.8, 0.25, 0.4, PAL.stone[2], { tex: 'stone' });
  vb.box(1.8, 0, 0, 1.8, 0.25, 0.4, PAL.stone[2], { tex: 'stone' });

  // 6. 엘리에셀의 낙타 대상단 (무릎 꿇은 낙타 및 선 낙타들)
  const camels: Camel[] = [];
  const c1 = new Camel(-5.5, 3.2, true);
  const c2 = new Camel(5.5, 3.2, false);
  const c3 = new Camel(-2.5, 5.5, true);
  const c4 = new Camel(3.0, 6.0, false);
  camels.push(c1, c2, c3, c4);
  root.add(c1.root, c2.root, c3.root, c4.root);

  col.addBox(-5.5, 3.2, 2.2, 2.2);
  col.addBox(5.5, 3.2, 2.2, 2.2);
  col.addBox(-2.5, 5.5, 2.2, 2.2);
  col.addBox(3.0, 6.0, 2.2, 2.2);

  // 낙타 안장 및 여정 보따리, 건초 단
  vb.box(-7.0, 0, 3.2, 1.4, 0.5, 1.0, PAL.straw[1], { tex: 'reed' });
  vb.box(7.0, 0, 3.2, 1.4, 0.5, 1.0, PAL.straw[1], { tex: 'reed' });
  vb.box(-4.0, 0, 4.8, 0.8, 0.6, 0.8, 0x5a3c26, { tex: 'wood' }); // 여행 궤짝

  // 7. 리브가에게 선사할 금 장신구 보물 상자 (금 코걸이, 손목고리)
  const giftChest = buildBorderChest();
  giftChest.position.set(-1.5, 0, 1.6);
  root.add(giftChest);
  col.addBox(-1.5, 1.6, 1.4, 1.0);

  // 8. 가나안 네게브 들판 귀환 길목 (남동쪽 x: 8, z: 8)
  // 귀환 이정표 및 석조 벤치
  vb.box(8, 0, 8, 1.4, 1.6, 1.4, PAL.stone[2], { tex: 'stone' });
  col.addBox(8, 8, 1.6, 1.6);
  buildStoneBenchCurved(vb, col, 7.5, 9.5, 2.4, 0.85);

  // 9. 나홀 성벽 앞 대추야자 숲 (야자수 4그루)
  P.palmTree(vb, col, -10.5, -5.5, 0);
  P.palmTree(vb, col, 10.5, -5.5, 0);
  P.palmTree(vb, col, -11.0, 5.0, 0);
  P.palmTree(vb, col, 11.5, 5.5, 0);

  // 10. 물동이 항아리들, 곡물 자루, 바구니, 횃불대 (30-60개 소품)
  P.pot(vb, -1.2, 1.4, 1.0);
  P.pot(vb, 1.2, 1.4, 1.0);
  P.pot(vb, 1.6, 1.0, 0.85);
  P.pot(vb, -1.6, 1.0, 0.85);

  buildStoragePropCluster(vb, -6.8, -1.5, 5, 151);
  buildStoragePropCluster(vb, 6.8, -1.5, 5, 152);

  // 횃불대 (성문 어귀, 우물터 앞마당)
  buildTorchStand(vb, col, -3.2, -6.0, 2.2);
  buildTorchStand(vb, col, 3.2, -6.0, 2.2);
  buildTorchStand(vb, col, -4.8, 1.8, 2.0);
  buildTorchStand(vb, col, 4.8, 1.8, 2.0);

  // 사막 관목과 바위
  P.rock(vb, col, -12, 1, 1.6);
  P.rock(vb, col, 12, 1, 1.6);
  P.bush(vb, col, -8, 7, 1.1, PAL.shrub);
  P.bush(vb, col, 8, -6, 1.0, PAL.shrub);

  scatterGroundCover(vb, col, { seed: 101, half: 18, count: 272, flowers: [0xe8c040,0xf0f0e0], tufts: [0x5a8040,0x6a9048,0x4a6a36], pebbles: [0x8a6a48,0xa08058,0x705038] });
  const stageMesh = vb.build();
  root.add(stageMesh);

  // 11. 저녁 황혼의 따스한 노을빛 조명
  const eveningLight = new THREE.PointLight(0xffbe77, 1.8, 18, 1.2);
  eveningLight.position.set(0, 5.0, 0);
  root.add(eveningLight);

  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  // per-frame zero allocation update
  const update = (_dt: number, time: number) => {
    eveningLight.intensity = 1.8 + Math.sin(time * 3.0) * 0.2;
  };

  return {
    root,
    col,
    bounds: col.bounds,
    well,
    eveningLight,
    camels,
    update,
  };
}
