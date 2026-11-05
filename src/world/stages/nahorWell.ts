import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildWell } from '../props/biblicalProps';
import * as P from '../props';
import { Camel } from '../../entities/animals';

export interface NahorWellStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  well: THREE.Group;
  eveningLight: THREE.PointLight;
  camels: Camel[];
  update: (dt: number, time: number) => void;
}

/**
 * 제6권 메소포타미아 나홀의 성 우물가 3D 복셀 무대
 * - 메소포타미아 성벽 원경 및 성문
 * - 중앙 깊은 돌 우물 및 10마리 낙타를 위한 대형 석조 물구유
 * - 낙타 대상단 및 리브가의 물동이
 */
export function buildNahorWellStage(): NahorWellStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.MESOPOTAMIA;

  // 1. 아람나하라임 황토 지면 (36x36)
  vb.box(0, -0.25, 0, 36, 0.5, 36, reg.ground, { tex: 'soil' });

  // 2. 나홀 성벽 원경 (북쪽)
  vb.box(0, 3.0, -14, 34, 6.0, 2.5, reg.brick, { tex: 'brick' });
  vb.box(0, 6.5, -14, 34, 1.0, 2.7, reg.brick, { tex: 'brick' });
  col.addBox(0, -14, 34, 3.0);
  // 성문 아치 통로
  vb.box(0, 2.0, -14, 4.0, 4.0, 3.0, 0x1a1612);

  // 3. 우물터 석조 바닥 포장 (중앙)
  vb.box(0, 0.05, 0, 14, 0.15, 10, PAL.stone[3], { tex: 'stone' });

  // 4. 낙타 10필을 위한 대형 석조 물구유 (좌우 양 날개)
  vb.box(-4, 0.25, 0, 4.0, 0.5, 1.2, PAL.stone[2], { tex: 'stone' });
  vb.box(-4, 0.38, 0, 3.6, 0.18, 0.8, PAL.water[1], { tex: 'water' });
  col.addBox(-4, 0, 4.2, 1.4);

  vb.box(4, 0.25, 0, 4.0, 0.5, 1.2, PAL.stone[2], { tex: 'stone' });
  vb.box(4, 0.38, 0, 3.6, 0.18, 0.8, PAL.water[1], { tex: 'water' });
  col.addBox(4, 0, 4.2, 1.4);

  // 5. 물동이 항아리들 (우물가 배치)
  P.pot(vb, -1.2, 0.1, 1.5);
  P.pot(vb, 1.2, 0.1, 1.5);
  P.pot(vb, 1.6, 0.1, 1.2);

  // 6. 종려나무 및 사막 관목
  P.palmTree(vb, col, -10, -5, 1.4);
  P.palmTree(vb, col, 10, -5, 1.3);
  P.bush(vb, col, -8, 7, 1.1);
  P.bush(vb, col, 8, 7, 1.0);

  const stageMesh = vb.build();
  root.add(stageMesh);

  // 7. 깊은 돌 우물
  const well = buildWell();
  well.position.set(0, 0, 0);
  col.addBox(0, 0, 2.5, 2.5);
  root.add(well);

  // 8. 엘리에셀의 낙타들 (무릎 꿇은 낙타 및 선 낙타)
  const camels: Camel[] = [];
  const c1 = new Camel(-5, 3, true);
  const c2 = new Camel(5, 3, false);
  const c3 = new Camel(0, 6, true);
  camels.push(c1, c2, c3);
  root.add(c1.root, c2.root, c3.root);
  col.addBox(-5, 3, 2.2, 2.2);
  col.addBox(5, 3, 2.2, 2.2);
  col.addBox(0, 6, 2.2, 2.2);

  // 9. 저녁 우물가의 온화한 황혼 조명
  const eveningLight = new THREE.PointLight(0xffbe77, 1.5, 16, 1.2);
  eveningLight.position.set(0, 4.0, 0);
  root.add(eveningLight);

  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  const update = (_dt: number, time: number) => {
    eveningLight.intensity = 1.5 + Math.sin(time * 3.0) * 0.15;
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
