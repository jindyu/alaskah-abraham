import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildWell, buildTamarisk, buildNomadTent } from '../props/biblicalProps';
import * as P from '../props';
import { Sheep } from '../../entities/animals';

export interface BeershebaStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  well: THREE.Group;
  tamarisk: THREE.Group;
  feastTable: THREE.Group;
  update: (dt: number, time: number) => void;
}

/**
 * 제5권 브엘세바 우물터 3D 복셀 무대
 * - 맹세의 우물 (브엘세바)
 * - 아브라함이 심은 푸른 잎의 에셀나무
 * - 아비멜렉과의 언약을 위한 암양 7마리 울타리
 * - 이삭 출생과 젖 떼는 날의 큰 잔치 평상
 */
export function buildBeershebaStage(): BeershebaStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.SODOM_NEGEV;

  // 1. 브엘세바 사막 오아시스 모래 지면 (36x36)
  vb.box(0, -0.25, 0, 36, 0.5, 36, reg.desertSand, { tex: 'plain' });

  // 2. 우물 주변 석조 포장길 (중앙)
  vb.box(0, 0.1, 0, 8, 0.2, 8, PAL.stone[3], { tex: 'stone' });

  // 3. 이삭 젖 떼는 날 큰 잔치 평상과 연회 탁자 (북동쪽)
  vb.box(6, 0.35, -5, 5, 0.7, 3, PAL.wood[2], { tex: 'wood' });
  col.addBox(6, -5, 5, 3);
  // 포도주 잔, 빵, 석류 열매 장식
  vb.box(4.5, 0.8, -5, 0.8, 0.3, 0.8, PAL.produce.bread, { tex: 'plain' });
  vb.box(6.2, 0.85, -5, 0.4, 0.4, 0.4, PAL_REGION.EGYPT.gold, { tex: 'plain' });
  vb.box(7.5, 0.8, -5, 0.6, 0.3, 0.6, PAL.produce.pomegranate, { tex: 'plain' });

  // 4. 암양 7마리 목재 우리 울타리 (동남쪽)
  vb.box(7, 0.4, 4, 6, 0.8, 0.2, PAL.wood[1], { tex: 'wood' });
  vb.box(7, 0.4, 10, 6, 0.8, 0.2, PAL.wood[1], { tex: 'wood' });
  vb.box(4, 0.4, 7, 0.2, 0.8, 6, PAL.wood[1], { tex: 'wood' });
  vb.box(10, 0.4, 7, 0.2, 0.8, 6, PAL.wood[1], { tex: 'wood' });
  col.addBox(7, 7, 6.2, 6.2);

  // 5. 사막 관목과 바위
  P.bush(vb, col, -7, 6, 1.2);
  P.bush(vb, col, -4, -8, 1.0);
  P.rock(vb, col, 12, -8, 1.4);
  P.rock(vb, col, -11, 2, 1.2);

  const stageMesh = vb.build();
  root.add(stageMesh);

  // 6. 브엘세바 돌 우물 (중앙)
  const well = buildWell();
  well.position.set(0, 0, 0);
  col.addBox(0, 0, 2.5, 2.5);
  root.add(well);

  // 7. 에셀나무 (서북쪽)
  const tamarisk = buildTamarisk();
  tamarisk.position.set(-6, 0, -4);
  col.addBox(-6, -4, 3.5, 3.5);
  root.add(tamarisk);

  // 8. 아브라함과 사라의 장막 (서남쪽)
  const tent = buildNomadTent(PAL_REGION.CANAAN.tentBlack);
  tent.position.set(-8, 0, 4);
  col.addBox(-8, 4, 4.0, 3.5);
  root.add(tent);

  // 9. 언약의 증표 암양들
  const sheep1 = new Sheep(6, 6);
  const sheep2 = new Sheep(8, 7);
  const sheep3 = new Sheep(7, 8);
  root.add(sheep1.root, sheep2.root, sheep3.root);

  const feastTable = new THREE.Group();
  feastTable.position.set(6, 0, -5);
  root.add(feastTable);

  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  const update = (_dt: number, _time: number) => {};

  return {
    root,
    col,
    bounds: col.bounds,
    well,
    tamarisk,
    feastTable,
    update,
  };
}
