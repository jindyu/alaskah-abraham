import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildMachpelahCave } from '../props/biblicalProps';
import * as P from '../props';
import { buildFarField, buildHorizonPlane, scatterGroundCover } from './common';
import {
  createStageGroundMesh,
  buildPerimeterRidges,
  buildFoliageTree,
  buildStoneBenchCurved,
  buildStoragePropCluster,
  buildTorchStand,
} from './scenery36';
import { fbm, hash2, valueNoise } from '../../core/rng';

export interface HebronMachpelahStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  cave: THREE.Group;
  tombLight: THREE.PointLight;
  scaleTable: THREE.Group;
  update: (dt: number, time: number) => void;
}

const MACHPELAH_HALF = 18;

/** 헤브론 막벨라 굴 고해상도 지면: 가나안 테라로사 붉은 갈색 흙, 올리브 밭, 성문 석회암 광장 */
function buildMachpelahGroundMesh(): THREE.Mesh {
  const reg = PAL_REGION.CANAAN;
  const resolution = 480;

  return createStageGroundMesh(MACHPELAH_HALF, resolution, (x, z, _u, _v, i, j) => {
    // 1. 기본 가나안 석회암 구릉과 비옥한 테라로사 흙
    const nBase = fbm(x / 7, z / 7, 901, 2) * 0.5 + valueNoise(i / 14, j / 14, 902) * 0.3 + hash2(i, j, 903) * 0.2;
    let c = nBase > 0.62 ? 0x82965c : nBase > 0.38 ? reg.ground : 0x5e7240;

    // 석회암 자갈 및 풍화 토양 입자
    const hGrit = hash2(i, j, 905);
    if (hGrit < 0.015) c = 0x485830;
    else if (hGrit > 0.985) c = reg.limestone;

    // 2. 헤브론 성문 앞 석조 광장 (서남쪽 x: -10 ~ -2, z: 2 ~ 9)
    if (x >= -10.5 && x <= -1.5 && z >= 1.5 && z <= 9.5) {
      const cell = 12;
      const li = i % cell, lj = j % cell;
      if (li === 0 || lj === 0) {
        c = 0x5a564e; // 줄눈
      } else {
        const tones = [0xd6cfbc, 0xc8c0ae, 0xe0d9c8, 0xbcb4a0];
        c = tones[Math.floor(hash2(Math.floor(i / cell), Math.floor(j / cell), 911) * 4)];
        if (li === 1 || lj === 1) c = 0xf0e8d8;
      }
    }

    // 3. 성문에서 막벨라 굴로 이어지는 에브론의 밭 고운 오솔길
    // x: -2 ~ 7, z: 4 ~ -6
    const trailT = (x - (-2)) / 9; // 0 ~ 1
    const targetZ = 4 + trailT * (-10);
    const dTrail = Math.abs(z - targetZ);
    if (x >= -2 && x <= 8 && dTrail < 1.6) {
      const nTrail = valueNoise(i / 8, j / 8, 921);
      if (nTrail > 0.3) {
        c = 0xb4a488; // 다져진 석회암 길
        if (hash2(i, j, 923) < 0.05) c = 0x8a7a60;
      }
    }

    // 4. 에브론의 올리브 밭고랑 흔적 (북서쪽 x: -3 ~ 4, z: -8 ~ 0)
    if (x >= -3 && x <= 4 && z >= -8 && z <= 0) {
      const row = Math.floor((z + 10) / 1.8);
      const isFurrow = Math.abs((z + 10) % 1.8) < 0.4;
      if (isFurrow) {
        c = 0x504230; // 갈아놓은 비옥한 밭고랑
      }
    }

    // 5. 막벨라 굴 앞 묘실 안뜰 (동북쪽 x: 5 ~ 11, z: -9 ~ -3) 묵상 석판
    if (x >= 5.5 && x <= 11.5 && z >= -8.5 && z <= -3.5) {
      const dCourtyard = Math.hypot(x - 8, z - (-6));
      if (dCourtyard < 3.8) {
        const nCourt = fbm(x * 2, z * 2, 931, 2);
        c = nCourt > 0.45 ? 0xc4bcac : 0xb0a898;
      }
    }

    return c;
  });
}

/**
 * 제6권 헤브론 막벨라 굴 3D 복셀 무대
 */
export function buildHebronMachpelahStage(): HebronMachpelahStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.CANAAN;

  // 1. 헤브론 원경 지평선 및 고해상도 지면 메쉬
  root.add(buildHorizonPlane(0xb4bea0, 360, -0.05, 0.2));
  buildFarField(root, MACHPELAH_HALF, { seed: 12, pal: [0x62803f, 0x7a8c4c, 0x98976a, 0xb4ab8a], tex: 'soil', accents: [0x8a8672, 0x4a6a34], depth: 40, haze: 0xb4bea0, ground: 0x6a8a48, rim: { min: 2.0, max: 4.0, south: 0.4 }, maxH: 3 });
  root.add(buildMachpelahGroundMesh());

  // 2. 외곽 공허 차단: 가나안 석회암 구릉 테라스 및 바위 절벽 (사방)
  buildPerimeterRidges(vb, col, MACHPELAH_HALF, [reg.limestone, PAL.stone[2], PAL.stone[3], 0xb8b09e], {
    seed: 901,
    minH: 3.5,
    maxH: 7.5,
    tex: 'dune',
  });

  // 3. 서쪽 헤브론 성벽 및 성문 망루 (x: -12 ~ -6, z: 1.5 ~ 9.5)
  // 성문 북쪽 성벽
  vb.box(-11, 0, 1.5, 3.2, 6.2, 5.0, PAL.stone[2], { tex: 'stone' });
  col.addBox(-11, 1.5, 3.4, 5.2);
  // 성문 남쪽 성벽
  vb.box(-11, 0, 9.5, 3.2, 6.2, 5.0, PAL.stone[2], { tex: 'stone' });
  col.addBox(-11, 9.5, 3.4, 5.2);

  // 성문 아치 기둥 2기 및 상인방
  vb.box(-8, 0, 4.0, 1.8, 5.2, 1.8, PAL.stone[2], { tex: 'stone' });
  vb.box(-3, 0, 4.0, 1.8, 5.2, 1.8, PAL.stone[2], { tex: 'stone' });
  vb.box(-5.5, 5.2, 4.0, 6.8, 1.4, 2.2, PAL.stone[3], { tex: 'stone' });
  col.addBox(-8, 4.0, 2.0, 2.0);
  col.addBox(-3, 4.0, 2.0, 2.0);

  // 성문 옥상 여장
  vb.box(-5.5, 6.6, 4.0, 6.8, 0.8, 0.6, PAL.stone[3], { tex: 'stone' });

  // 4. 헷 족속 장로들의 석조 좌석 (성문 어귀 공증 장소)
  buildStoneBenchCurved(vb, col, -9.5, 6.0, 2.6, 0.85);
  buildStoneBenchCurved(vb, col, -9.5, 2.5, 2.6, 0.85);
  buildStoneBenchCurved(vb, col, -2.5, 6.5, 2.2, 0.85);

  // 5. 에브론의 은 400세겔 계량 탁자 (x: -5.5, z: 6.5)
  const scaleTable = new THREE.Group();
  scaleTable.position.set(-5.5, 0, 6.5);
  root.add(scaleTable);

  // 견고한 아카시아 목재 탁자
  vb.box(-5.5, 0, 6.5, 2.6, 0.95, 1.5, PAL.wood[2], { tex: 'wood' });
  col.addBox(-5.5, 6.5, 2.8, 1.7);

  // 양팔저울(천칭)과 상인의 통용 은 400세겔 주괴들
  vb.box(-5.5, 0.95, 6.5, 0.12, 0.7, 0.12, 0x8a6a3a, { tex: 'metal' }); // 저울 기둥
  vb.box(-5.5, 1.55, 6.5, 1.2, 0.08, 0.08, 0x8a6a3a, { tex: 'metal' }); // 가로 빔
  // 좌/우 접시
  vb.box(-6.0, 1.25, 6.5, 0.45, 0.06, 0.45, 0x8a6a3a, { tex: 'metal' });
  vb.box(-5.0, 1.25, 6.5, 0.45, 0.06, 0.45, 0x8a6a3a, { tex: 'metal' });
  // 은 400세겔 주괴 및 양피지 매매 증서
  vb.box(-5.0, 1.31, 6.5, 0.35, 0.18, 0.35, PAL.stone[4], { tex: 'plain' });
  vb.box(-6.2, 0.95, 6.4, 0.6, 0.05, 0.4, PAL.fabric.cream, { tex: 'plain' }); // 매매 계약서
  vb.box(-6.2, 1.0, 6.4, 0.12, 0.08, 0.12, 0xb02a30, { tex: 'plain' }); // 붉은 인장 진흙

  // 6. 메소포타미아 나홀의 성 파견 길목 (x: -12, z: 4)
  // 성문 바깥 서쪽 출구 이정표
  vb.box(-12, 0, 4, 1.2, 1.6, 1.2, PAL.stone[2], { tex: 'stone' });
  col.addBox(-12, 4, 1.4, 1.4);

  // 7. 에브론의 밭 석축 테라스 담장 (헤브론 전형적인 계단식 밭)
  P.stoneWall(vb, col, 1.0, 7.5, 7.5, 7.5); // 남쪽 경계석벽
  P.stoneWall(vb, col, 1.0, -2.5, 7.5, -2.5); // 중앙 테라스석벽
  P.stoneWall(vb, col, -0.5, -8.0, 5.5, -8.0); // 북쪽 밭 경계석벽

  // 8. 밭머리의 막벨라 겹동굴과 사라의 묘실 안뜰 (동북쪽 x: 8, z: -8)
  const cave = buildMachpelahCave();
  cave.position.set(8, 0, -8);
  col.addBox(8, -8, 8.0, 6.0);
  root.add(cave);

  // 동굴 입구 거대한 둥근 봉인석 (구르는 돌)
  vb.box(9.6, 0, -5.6, 1.6, 2.2, 0.9, PAL.stone[2], { tex: 'cliff' });
  col.addBox(9.6, -5.6, 1.8, 1.1);

  // 사라의 묘실 석관 (x: 8, z: -6.5)
  vb.box(8, 0, -6.5, 2.4, 0.9, 1.4, PAL.stone[4], { tex: 'stone' });
  col.addBox(8, -6.5, 2.6, 1.6);
  // 석관 덮개 정밀 조각
  vb.box(8, 0.9, -6.5, 2.5, 0.25, 1.5, reg.limestone, { tex: 'stone' });
  vb.box(8, 1.15, -6.5, 2.1, 0.15, 1.1, reg.limestone, { tex: 'stone' });

  // 9. 아브라함의 마지막 안식처 묵상 벤치 (x: 8, z: -4)
  buildStoneBenchCurved(vb, col, 8, -4, 2.4, 0.85);
  // 안식처 앞 석조 화병 및 헌화 꽃
  vb.box(7.0, 0, -4, 0.45, 0.55, 0.45, PAL.stone[3], { tex: 'stone' });
  vb.box(7.0, 0.55, -4, 0.35, 0.25, 0.35, PAL.flower[0], { tex: 'plain' });
  vb.box(9.0, 0, -4, 0.45, 0.55, 0.45, PAL.stone[3], { tex: 'stone' });
  vb.box(9.0, 0.55, -4, 0.35, 0.25, 0.35, PAL.flower[2], { tex: 'plain' });

  // 10. 밭 사방 둘레에 심긴 올리브 고목들과 사이프러스 (30-60개 소품)
  // "그 밭과 거기 속한 굴과 그 주위에 둘린 모든 나무가 다 아브라함의 소유로 확정된지라" (창 23:17)
  buildFoliageTree(vb, col, 2.5, -4.5, {
    trunkH: 2.4,
    trunkThickness: 0.5,
    foliagePal: PAL.olive,
    seed: 941,
  });
  buildFoliageTree(vb, col, -2.0, -8.5, {
    trunkH: 2.2,
    trunkThickness: 0.48,
    foliagePal: PAL.olive,
    seed: 942,
  });
  buildFoliageTree(vb, col, 10.5, 3.5, {
    trunkH: 2.5,
    trunkThickness: 0.52,
    foliagePal: PAL.olive,
    seed: 943,
  });
  buildFoliageTree(vb, col, 3.0, 4.0, {
    trunkH: 2.3,
    trunkThickness: 0.45,
    foliagePal: PAL.olive,
    seed: 944,
  });

  // 묘실 호위 사이프러스 상록수 (동굴 좌우)
  vb.box(5.0, 0, -7.0, 0.8, 4.2, 0.8, PAL.cypress[2], { tex: 'leafVine' });
  vb.box(5.0, 4.2, -7.0, 0.6, 2.0, 0.6, PAL.cypress[3], { tex: 'leafVine' });
  col.addBox(5.0, -7.0, 1.2, 1.2);

  // 11. 가나안 바위, 관목, 올리브 기름 항아리들
  P.rock(vb, col, 5.5, -0.5, 1.6);
  P.rock(vb, col, -6.5, -4.5, 1.5);
  P.rock(vb, col, 12.0, -8.0, 1.8);
  P.rock(vb, col, -1.0, 8.5, 1.4);

  P.bush(vb, col, 6.0, -2.5, 1.0, PAL.shrub);
  P.bush(vb, col, -7.5, -7.5, 0.9, PAL.shrub);
  P.bush(vb, col, 11.5, -1.0, 1.1, PAL.shrub);

  buildStoragePropCluster(vb, -7.2, 4.5, 4, 951);
  buildStoragePropCluster(vb, 6.5, -7.5, 4, 952);

  // 성문 및 묘실 입구 횃불대 2기
  buildTorchStand(vb, col, -4.2, 4.2, 2.2);
  buildTorchStand(vb, col, 6.5, -5.2, 2.0);

  scatterGroundCover(vb, col, { seed: 901, half: 18, count: 288, flowers: [0xf4e07a,0xe8e8f0,0xd870a0], tufts: [0x6a8a48,0x7a9a50,0x56743c], pebbles: [0xb8b09e,0xa09a8a,0xd6cfbc] });
  const stageMesh = vb.build();
  root.add(stageMesh);

  // 12. 묘실 횃불 감실 영구 조명
  const tombLight = new THREE.PointLight(0xffae62, 2.2, 14, 1.5);
  tombLight.position.set(8.0, 2.5, -6.5);
  root.add(tombLight);

  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  // per-frame zero allocation update
  const update = (_dt: number, time: number) => {
    tombLight.intensity = 2.2 + Math.sin(time * 5.0) * 0.3;
  };

  return {
    root,
    col,
    bounds: col.bounds,
    cave,
    tombLight,
    scaleTable,
    update,
  };
}
