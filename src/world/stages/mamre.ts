import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildNomadTent, buildMamreOak, buildWell, buildStoneAltar } from '../props/biblicalProps';
import * as P from '../props';

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
 * 제3권 & 제4권 마므레 상수리나무 장막 3D 복셀 무대
 * - 헤브론 마므레의 세 줄기 고목 상수리나무
 * - 아브라함과 사라의 검은 염소털 유목 장막 2채
 * - 횃불 언약 제단 (쪼갠 고기와 타는 횃불)
 * - 세 나그네(천사) 영접용 야외 오찬 평상과 우물
 * - 소년 이스마엘의 활쏘기 과녁(짚단)
 */
export function buildMamreStage(): MamreStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.CANAAN;

  // 1. 헤브론 마므레 평원 비옥한 황토 지면 (36x36)
  vb.box(0, -0.25, 0, 36, 0.5, 36, reg.ground, { tex: 'soil' });

  // 2. 마므레 거목 상수리나무 그늘 평상 단상 (중앙)
  vb.box(0, 0.15, -2, 6, 0.3, 6, PAL.dirt[2], { tex: 'soil' });

  // 3. 손님 대접 야외 평상 탁자 (세 천사 오찬)
  vb.box(1.5, 0.4, 0, 2.6, 0.7, 1.6, PAL.wood[2], { tex: 'wood' });
  col.addBox(1.5, 0, 2.6, 1.6);
  // 나무 의자/스툴 3개
  vb.box(0.2, 0.25, 0, 0.6, 0.5, 0.6, PAL.wood[1], { tex: 'wood' });
  vb.box(2.8, 0.25, 0, 0.6, 0.5, 0.6, PAL.wood[1], { tex: 'wood' });
  vb.box(1.5, 0.25, 1.3, 0.6, 0.5, 0.6, PAL.wood[1], { tex: 'wood' });

  // 4. 소년 이스마엘 활쏘기 연습용 짚단 과녁 (남동쪽)
  vb.box(9, 0.6, 6, 0.8, 1.4, 0.8, PAL.straw[2], { tex: 'reed' });
  vb.box(9, 1.3, 6, 0.9, 0.2, 0.9, PAL.fabric.red, { tex: 'plain' }); // 과녁 중심 붉은 표식
  col.addBox(9, 6, 1.2, 1.2);

  // 5. 마므레 올리브나무 및 관목
  P.oliveTree(vb, col, -10, -8);
  P.oliveTree(vb, col, 10, -9);
  P.bush(vb, col, -4, 7, 1.2);
  P.bush(vb, col, 8, -2, 1.0);
  P.rock(vb, col, -8, 8, 1.5);
  P.rock(vb, col, 12, 4, 1.1);

  // 야외 화덕과 토기/자루
  P.campfire(vb, col, -3, 3);
  P.pot(vb, -5, 2, 1.2);
  P.sack(vb, -5.5, 2.5);

  const stageMesh = vb.build();
  root.add(stageMesh);

  // 6. 마므레 고목 상수리나무 (중앙 북쪽)
  const mamreOak = buildMamreOak();
  mamreOak.position.set(0, 0, -4);
  mamreOak.scale.set(1.3, 1.3, 1.3);
  col.addBox(0, -4, 4.0, 4.0);
  root.add(mamreOak);

  // 7. 아브라함의 큰 검은 장막 (서북쪽) & 사라의 내실 장막 (서남쪽)
  const masterTent = buildNomadTent(reg.tentBlack);
  masterTent.position.set(-8, 0, -4);
  col.addBox(-8, -4, 4.5, 4.0);

  const sarahTent = buildNomadTent(PAL.fabric.redDark);
  sarahTent.position.set(-8, 0, 4);
  col.addBox(-8, 4, 4.0, 3.5);
  root.add(masterTent, sarahTent);

  // 8. 마므레 돌 우물 (동북쪽)
  const well = buildWell();
  well.position.set(7, 0, -5);
  col.addBox(7, -5, 2.4, 2.4);
  root.add(well);

  // 9. 횃불 언약 제단 (동쪽 밤하늘 조망 터)
  const covenantAltar = buildStoneAltar(true);
  covenantAltar.position.set(6, 0, 2);
  col.addBox(6, 2, 2.2, 2.0);
  root.add(covenantAltar);

  // 10. 타는 횃불 조명
  const torchLight = new THREE.PointLight(0xff7722, 1.8, 9, 1.6);
  torchLight.position.set(6, 1.5, 2);
  root.add(torchLight);

  const diningTable = new THREE.Group();
  diningTable.position.set(1.5, 0, 0);
  root.add(diningTable);

  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  const update = (_dt: number, time: number) => {
    torchLight.intensity = 1.8 + Math.sin(time * 8.0) * 0.35;
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
