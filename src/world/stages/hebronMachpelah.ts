import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildMachpelahCave } from '../props/biblicalProps';
import * as P from '../props';

export interface HebronMachpelahStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  cave: THREE.Group;
  tombLight: THREE.PointLight;
  scaleTable: THREE.Group;
  update: (dt: number, time: number) => void;
}

/**
 * 제6권 헤브론 막벨라 굴 3D 복셀 무대
 * - 헤브론 성문 광장: 헷 족속 장로들의 좌석 및 은 400세겔 계량 탁자
 * - 에브론의 밭: 테라스 석축과 올리브 고목들
 * - 밭 끝의 막벨라 겹동굴: 사라의 석관과 안장 횃불 감실
 */
export function buildHebronMachpelahStage(): HebronMachpelahStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.CANAAN;

  // 1. 헤브론 석회암 구릉 지면 (36x36)
  vb.box(0, -0.25, 0, 36, 0.5, 36, reg.ground, { tex: 'soil' });

  // 2. 헤브론 성문 어귀 석조 광장 (서남쪽)
  vb.box(-6, 0.05, 4, 14, 0.2, 12, reg.limestone, { tex: 'stone' });

  // 3. 헤브론 성문 기둥 및 상인 아치
  vb.box(-8, 2.5, 4, 1.8, 5.0, 1.8, PAL.stone[2], { tex: 'stone' });
  vb.box(-3, 2.5, 4, 1.8, 5.0, 1.8, PAL.stone[2], { tex: 'stone' });
  vb.box(-5.5, 5.0, 4, 6.0, 1.2, 2.0, PAL.stone[3], { tex: 'stone' });
  col.addBox(-8, 4, 2.0, 2.0);
  col.addBox(-3, 4, 2.0, 2.0);

  // 성문 장로들의 좌석
  P.bench(vb, col, -9.5, 6, 0);
  P.bench(vb, col, -9.5, 2, 0);

  // 4. 에브론의 은 400세겔 계량 탁자 (양팔저울과 통용 은덩이)
  vb.box(-5.5, 0.45, 6.5, 2.4, 0.9, 1.4, PAL.wood[2], { tex: 'wood' });
  col.addBox(-5.5, 6.5, 2.5, 1.5);
  // 은 400세겔 주괴 묶음
  vb.box(-5.2, 0.95, 6.5, 0.7, 0.2, 0.5, PAL.stone[4], { tex: 'plain' });

  // 5. 에브론의 밭 석축 테라스 담장
  P.stoneWall(vb, col, 0, 0, 8, 0);

  // 6. 밭 둘레의 올리브 고목들
  P.oliveTree(vb, col, 2, -4, 1.3);
  P.oliveTree(vb, col, -2, -9, 1.4);
  P.oliveTree(vb, col, 10, 4, 1.2);
  P.bush(vb, col, 6, -1, 1.0);
  P.bush(vb, col, -8, -5, 0.9);

  // 7. 사라의 묘실 석관 (막벨라 굴 앞)
  vb.box(8, 0.4, -6.5, 2.2, 0.8, 1.4, PAL.stone[4], { tex: 'stone' });
  col.addBox(8, -6.5, 2.4, 1.6);

  const stageMesh = vb.build();
  root.add(stageMesh);

  // 8. 밭 끝의 막벨라 겹동굴
  const cave = buildMachpelahCave();
  cave.position.set(8, 0, -8);
  col.addBox(8, -8, 7.5, 5.5);
  root.add(cave);

  // 9. 묘실 횃불 감실 영구 조명
  const tombLight = new THREE.PointLight(0xffa855, 1.8, 12, 1.5);
  tombLight.position.set(8, 2.2, -6.5);
  root.add(tombLight);

  const scaleTable = new THREE.Group();
  scaleTable.position.set(-5.5, 0, 6.5);
  root.add(scaleTable);

  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  const update = (_dt: number, time: number) => {
    tombLight.intensity = 1.8 + Math.sin(time * 5.0) * 0.25;
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
