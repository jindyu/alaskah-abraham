import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildNomadTent, buildWell, buildStoneAltar } from '../props/biblicalProps';
import * as P from '../props';
import { buildPerimeterRidges } from './scenery36';
import { buildFarField, buildHorizonPlane, scatterGroundCover } from './common';
import {
  buildStageGroundPlane,
  buildTerebinthOak,
  buildChieftainTent,
} from './scenery12';
import { fbm, hash2, valueNoise } from '../../core/rng';
import { ditherPick } from '../textures';

export interface MamreStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  mamreOak: THREE.Group;
  torchLight: THREE.PointLight;
  diningTable: THREE.Group;
  covenantAltar: THREE.Group;
  update: (dt: number, time: number) => void;
}

/**
 * 제3권 & 제4권 헤브론 마므레 상수리나무 장막 3D 복셀 무대
 * - 헤브론 마므레의 거대한 세 줄기 고목 상수리나무와 서늘한 수관 그늘
 * - 아브라함의 큰 검은 장막(차양)과 사라의 내실 장막
 * - 세 천사 영접 야외 오찬 평상과 떡, 송아지 구이, 우유 대접
 * - 횃불 언약 제단(쪼갠 제물과 타는 횃불) 및 소돔 중보 기도 전망대
 * - 소년 이스마엘의 활쏘기 과녁과 포도원/올리브 계단식 농경 테라스
 */
export function buildMamreStage(): MamreStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.CANAAN;

  // 1. 원경 헤브론 고원 지평선 바닥
  root.add(buildHorizonPlane(reg.ground));

  buildFarField(root, 18, { seed: 3, pal: [0x4a6a3a, 0x5a7a44, 0x6a8a4c, 0x7a6a48], tex: 'soil', accents: [0x7e7870, 0x3e5a2c], depth: 44, haze: reg.ground, ground: 0x4e6e3c, rim: { min: 1.8, max: 3.6, south: 0.4 } });

  // 2. 고해상도 절차적 지면 (헤브론 비옥한 토양, 짙은 상수리 그늘 잔디, 포석 오솔길, 농경 테라스)
  const groundMesh = buildStageGroundPlane({
    size: 52,
    res: 512,
    yOffset: -0.01,
    painter: (x, z, i, j) => {
      // 0) 횃불 제단·식탁 주변 따뜻한 불빛 웅덩이 (밤에 불 주변이 빛나 보이게; 낮에는 그을린 다져진 흙)
      const dFire = Math.hypot(x - 6, z - 2);
      if (dFire < 2.6 && hash2(i, j, 541) < 1.0 - dFire / 2.9) {
        return dFire < 1.2 ? 0xd8a060 : 0xb88850;
      }
      // 1) 마므레 거목 상수리나무 그늘 잔디 (중앙 북쪽 x: -4~4, z: -8~1)
      const dOak = Math.hypot(x - 0, z - (-3.5));
      if (dOak < 5.2) {
        const nShade = fbm(x * 2, z * 2, 501, 2);
        return ditherPick([PAL.grass[1], PAL.grass[2], PAL.grass[3], 0x486b36], nShade, i, j, 0.4);
      }

      // 2) 오솔길: 서쪽 장막(-8, -4 / -8, 4) -> 중앙 오찬 평상(1.5, 0) -> 동쪽 우물(7, -5) / 제단(6, 2)
      const dPath1 = Math.abs(z - 0.4 * x); // 장막~식탁 통로
      const dPath2 = Math.abs((z - 0) - (-0.7 * (x - 1.5))); // 식탁~우물 통로
      const dPath3 = Math.abs((z - 0) - (0.45 * (x - 1.5))); // 식탁~제단 통로
      const onPath = (dPath1 < 1.3 && x >= -8.5 && x <= 2.0) ||
                     (dPath2 < 1.3 && x >= 1.5 && x <= 7.5 && z <= 0.5 && z >= -5.5) ||
                     (dPath3 < 1.3 && x >= 1.5 && x <= 7.0 && z >= -0.5 && z <= 3.0);

      if (onPath) {
        const nPath = valueNoise(i / 8, j / 8, 511);
        return ditherPick([0xbe9764, 0xa57c50, 0x8a6440, reg.ground], nPath, i, j, 0.38);
      }

      // 3) 남동쪽 포도원 및 경작 테라스 흙 (x: 4~16, z: 6~16)
      if (x >= 4 && z >= 5) {
        const row = Math.floor(z / 1.6);
        const nTerrace = hash2(i, j, 521);
        if (row % 2 === 0) {
          return ditherPick([0x5a3e2a, 0x6e4c34, 0x7e5a3e], nTerrace, i, j, 0.3);
        }
      }

      // 4) 기본 헤브론 구릉 잔디 및 황토
      const nBase = fbm(x / 8, z / 8, 531, 2) * 0.5 + valueNoise(i / 16, j / 16, 532) * 0.3 + hash2(i, j, 533) * 0.2;
      return ditherPick([reg.ground, PAL.grass[2], PAL.grass[3], PAL.dryGrass[1]], nBase, i, j, 0.35);
    },
  });
  root.add(groundMesh);

  // ─────────────────────────────────────────────────────────────
  // 3. 마므레 거목 상수리나무 평상 단상 (중앙 x: 0, z: -3.5)
  // ─────────────────────────────────────────────────────────────
  vb.box(0, 0, -3.5, 7.5, 0.25, 7.5, PAL.dirt[2], { tex: 'soil' });

  // 거대한 세 줄기 마므레 상수리나무 고목 (Canopy 기반 웅장한 수관)
  buildTerebinthOak(vb, col, 0, -4.0, 1.45, 999);

  // ─────────────────────────────────────────────────────────────
  // 4. 세 천사 영접 야외 오찬 평상과 석탁 (x: 1.5, z: 0)
  // ─────────────────────────────────────────────────────────────
  // 오찬 평상 목재 데크
  vb.box(1.5, 0, 0, 3.6, 0.2, 3.2, PAL.wood[3], { tex: 'wood' });

  // 메인 식사 테이블
  vb.box(1.5, 0.2, 0, 2.4, 0.7, 1.6, PAL.wood[1], { tex: 'wood' });
  col.addBox(1.5, 0, 2.8, 2.0);

  // 세 천사를 위한 원목 스툴 3개 (북, 동, 남)
  vb.box(0.1, 0.2, 0, 0.6, 0.45, 0.6, PAL.wood[2], { tex: 'wood' });
  vb.box(2.9, 0.2, 0, 0.6, 0.45, 0.6, PAL.wood[2], { tex: 'wood' });
  vb.box(1.5, 0.2, 1.25, 0.6, 0.45, 0.6, PAL.wood[2], { tex: 'wood' });

  // 식탁 위 잔치 요리 (고운 가루 떡, 엉긴 젖/버터, 우유 대접, 연하고 좋은 송아지 요리)
  vb.box(0.9, 0.9, -0.2, 0.5, 0.12, 0.5, PAL.fabric.cream, { tex: 'plain' }); // 떡 그릇
  vb.box(0.9, 1.02, -0.2, 0.4, 0.08, 0.4, PAL.produce.bread, { tex: 'plain' });
  vb.box(1.5, 0.9, 0.1, 0.65, 0.14, 0.45, 0xb87a52, { tex: 'soil' }); // 구운 송아지 고기
  vb.box(2.1, 0.9, -0.2, 0.4, 0.22, 0.4, PAL.clay[2], { tex: 'soil' }); // 우유 단지

  // 손님을 위한 손발 씻는 물 대야 (손 대접)
  vb.box(1.5, 0.2, -1.2, 0.6, 0.3, 0.6, PAL.stone[2], { tex: 'stone' });
  vb.box(1.5, 0.4, -1.2, 0.45, 0.08, 0.45, PAL.water[1], { tex: 'water' });

  // ─────────────────────────────────────────────────────────────
  // 5. 소년 이스마엘 활쏘기 과녁 훈련장 (남동쪽 x: 9, z: 6)
  // ─────────────────────────────────────────────────────────────
  // 짚단 과녁 받침대와 과녁
  vb.box(9, 0, 6, 0.9, 1.6, 0.9, PAL.straw[2], { tex: 'reed' });
  vb.box(9, 0.8, 6, 1.02, 0.3, 1.02, PAL.fabric.red, { tex: 'plain' }); // 붉은 과녁 중심
  vb.box(9, 0.9, 6, 1.05, 0.1, 1.05, PAL.fabric.cream, { tex: 'plain' });
  col.addBox(9, 6, 1.4, 1.4);

  // 과녁 뒤 화살 수거용 목재 울타리
  vb.box(9, 0, 7.5, 2.8, 1.8, 0.18, PAL.wood[1], { tex: 'wood' });
  // 화살통과 활 거치대
  vb.box(7.8, 0, 5.8, 0.35, 0.8, 0.35, PAL.wood[2], { tex: 'wood' });

  // ─────────────────────────────────────────────────────────────
  // 6. 소돔을 향한 중보 기도 전망대 (남동쪽 암반 x: 6, z: -4)
  // ─────────────────────────────────────────────────────────────
  // 동쪽 평야가 내려다보이는 높은 석회암 바위 전망대
  vb.box(6, 0, -4, 3.8, 0.9, 3.8, PAL.stone[2], { tex: 'cliff' });
  vb.box(6, 0.9, -4, 2.6, 0.5, 2.6, PAL.stone[3], { tex: 'cliff' });
  col.addBox(6, -4, 3.6, 3.6);

  // ─────────────────────────────────────────────────────────────
  // 7. 계단식 농경 테라스와 포도밭 (Agricultural Terraces)
  // ─────────────────────────────────────────────────────────────
  // 1단 테라스 석축 (z: 6)
  P.stoneWall(vb, col, 3, 6, 14, 6);
  // 2단 테라스 석축 (z: 11)
  P.stoneWall(vb, col, 3, 11, 14, 11);

  // 포도나무 이랑들 (Vine rows)
  P.vineRow(vb, col, 4, 12, 8.5);
  P.vineRow(vb, col, 4, 12, 13.5);

  // 건초더미 (Hay bales)
  P.hay(vb, col, 12.5, 7.2, 0.2);
  P.hay(vb, col, 13.2, 8.0, -0.4);

  // ─────────────────────────────────────────────────────────────
  // 8. 서쪽 장막 구역 (아브라함의 큰 검은 장막 & 사라의 내실 장막)
  // ─────────────────────────────────────────────────────────────
  // 아브라함의 족장 장막 (-8, -4)
  buildChieftainTent(vb, col, -8, -4, reg.tentBlack, { width: 5.0, depth: 4.0, awningZ: 2.0 });

  // 사라의 장막 (-8, 4)
  const sarahTent = buildNomadTent(PAL.fabric.redDark);
  sarahTent.position.set(-8, 0, 4);
  col.addBox(-8, 4, 4.2, 3.8);
  root.add(sarahTent);

  // 장막 앞 야외 화덕과 취사 가구
  P.campfire(vb, col, -4.5, 1.5);
  P.bench(vb, col, -5.5, 2.5, 0.3);
  P.pot(vb, -6.5, 0.5, 1.2);
  P.pot(vb, -6.0, 0.0, 1.0);
  P.sack(vb, -6.8, -0.8, 0.3);
  P.sack(vb, -7.2, -1.2, -0.2);
  P.woodpile(vb, col, -4.8, -1.8, 0.1);

  // ─────────────────────────────────────────────────────────────
  // 9. 외곽 구릉 능선 (바깥 허공 완전 차단)
  // ─────────────────────────────────────────────────────────────
  // 시각 외곽은 buildFarField 의 rim(매끈한 능선 → 안개)이 그린다 — 여기서는 충돌체만
  buildPerimeterRidges(vb, col, 18, [], { openNorth: false });

  // ─────────────────────────────────────────────────────────────
  // 10. 풍성한 수목 및 자연석 소품들 (올리브, 관목, 바위, 들꽃)
  // ─────────────────────────────────────────────────────────────
  // 올리브 나무들
  P.oliveTree(vb, col, -12, -10);
  P.oliveTree(vb, col, -13, 8);
  P.oliveTree(vb, col, 12, -10);
  P.oliveTree(vb, col, 13, -2);
  P.oliveTree(vb, col, -3, -12);
  P.figTree(vb, col, 12, 3);

  // 관목 (Bush)
  P.bush(vb, col, -3.5, 5.0, 1.1);
  P.bush(vb, col, 4.0, 3.5, 1.0);
  P.bush(vb, col, 8.5, -1.5, 1.1);
  P.bush(vb, col, -2.5, -8.0, 1.2);
  P.bush(vb, col, 10.5, -7.0, 0.9);
  P.bush(vb, col, -12.0, 2.0, 0.9);

  // 자연석 바위 (Rock of various sizes)
  P.rock(vb, col, -4.5, -4.5, 1.3);
  P.rock(vb, col, 3.5, -5.5, 1.5);
  P.rock(vb, col, 8.5, 2.5, 1.4);
  P.rock(vb, col, -13.5, -4.0, 1.8);
  P.rock(vb, col, 13.5, -13.5, 2.0);
  P.rock(vb, col, -13.5, 13.5, 1.9);
  P.rock(vb, col, 13.5, 13.5, 1.7);
  P.rock(vb, col, 3.0, 9.5, 1.2);

  // 들꽃 및 풀포기
  P.tuft(vb, 0.5, 2.0);
  P.tuft(vb, 3.0, -2.0);
  P.tuft(vb, 7.0, 4.5);
  P.tuft(vb, -2.0, -1.0);
  P.tuft(vb, -5.0, 4.5);
  P.flower(vb, -1.5, 2.5, PAL.flower[0]);
  P.flower(vb, 2.5, 2.0, PAL.flower[1]);
  P.flower(vb, 4.5, -2.5, PAL.flower[2]);
  P.flower(vb, 6.5, 4.0, PAL.flower[4]);

  scatterGroundCover(vb, col, { seed: 301, half: 18, count: 320, flowers: [0xf0e8a0,0xe86a8a,0xc8a0e8,0xffffff], tufts: [0x4a7a38,0x5c8a40,0x3e6a30], pebbles: [0x9a9488,0xb0a898] });
  const stageMesh = vb.build();
  root.add(stageMesh);

  // 11. 마므레 거목 상수리나무 더미 그룹 (기존 인터페이스 호환용)
  const mamreOak = new THREE.Group();
  mamreOak.position.set(0, 0, -4);
  root.add(mamreOak);

  // 12. 동북쪽 마므레 돌 우물 (Stone Well)
  const well = buildWell();
  well.position.set(7, 0, -5);
  col.addBox(7, -5, 2.4, 2.4);
  root.add(well);

  // 13. 횃불 언약 제단 (동쪽 밤하늘 조망 터 x: 6, z: 2)
  const covenantAltar = buildStoneAltar(true);
  covenantAltar.position.set(6, 0, 2);
  col.addBox(6, 2, 2.2, 2.0);
  root.add(covenantAltar);

  // 14. 횃불 언약 타오르는 횃불 점광원
  const torchLight = new THREE.PointLight(0xff8830, 3.6, 15, 1.4);
  torchLight.position.set(6, 1.6, 2);
  root.add(torchLight);

  const diningTable = new THREE.Group();
  diningTable.position.set(1.5, 0, 0);
  root.add(diningTable);

  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  const update = (_dt: number, time: number) => {
    // 횃불 조명 깜빡임 (Zero allocation)
    torchLight.intensity = 3.6 + Math.sin(time * 8.0) * 0.5 + Math.cos(time * 16.0) * 0.25;
  };

  return {
    root,
    col,
    bounds: col.bounds,
    mamreOak,
    torchLight,
    diningTable,
    covenantAltar,
    update,
  };
}
