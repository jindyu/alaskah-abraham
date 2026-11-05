import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildNomadTent } from '../props/biblicalProps';
import * as P from '../props';

export interface SiddimHobahStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  torchLights: THREE.PointLight[];
  melchizedekTable: THREE.Group;
  update: (dt: number, time: number) => void;
}

/**
 * 제2권 싯딤 골짜기 전장 및 호바 야간 기습 3D 복셀 무대
 * - 붉은 사암 협곡과 검은 역청(아스팔트) 구덩이
 * - 4개국 연합군 적진 야영지 및 군사 텐트
 * - 318명 사병의 야간 횃불 기습 잠입로
 * - 살렘 왕 멜기세덱의 떡과 포도주 축복 단상
 */
export function buildSiddimHobahStage(): SiddimHobahStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.SODOM_NEGEV;

  // 1. 싯딤 골짜기 붉은 협곡 지면 (36x36)
  vb.box(0, -0.25, 0, 36, 0.5, 36, reg.canyonRed, { tex: 'soil' });

  // 2. 좌우 깎아지른 붉은 사암 절벽 협곡
  vb.box(-14, 3.0, 0, 8, 6.0, 36, PAL.stone[1], { tex: 'cliff' });
  col.addBox(-14, 0, 8, 36);

  vb.box(14, 3.0, 0, 8, 6.0, 36, PAL.stone[1], { tex: 'cliff' });
  col.addBox(14, 0, 8, 36);

  // 3. 검은 역청(아스팔트) 진흙 웅덩이들 (소돔 왕이 빠졌던 구덩이)
  vb.box(-4, -0.1, -4, 5, 0.3, 5, 0x181414, { tex: 'plain' });
  vb.box(3, -0.1, -8, 6, 0.3, 4, 0x181414, { tex: 'plain' });
  col.addBox(-4, -4, 4.5, 4.5);

  // 4. 북쪽 적진 야영지 지휘 단상
  vb.box(0, 0.6, -11, 12, 1.2, 8, reg.canyonRed, { tex: 'cliff' });
  col.addBox(0, -11, 12, 8);

  // 5. 멜기세덱의 축복 석조 제단/탁자 (남쪽 평지)
  vb.box(0, 0.4, 6, 3.0, 0.8, 1.8, PAL.stone[3], { tex: 'stone' });
  // 떡과 포도주 잔 오브젝트
  vb.box(-0.6, 0.9, 6, 0.8, 0.2, 0.8, PAL.fabric.cream, { tex: 'plain' }); // 떡 바구니
  vb.box(0.6, 1.0, 6, 0.4, 0.4, 0.4, PAL_REGION.EGYPT.gold, { tex: 'plain' }); // 금빛 포도주 잔
  col.addBox(0, 6, 3.2, 2.0);

  // 6. 무기 거치대 및 바위 엄폐물들
  P.rock(vb, col, -7, 2, 1.6);
  P.rock(vb, col, 7, 3, 1.4);
  P.rock(vb, col, -6, -8, 1.2);
  P.rock(vb, col, 8, -6, 1.5);

  const stageMesh = vb.build();
  root.add(stageMesh);

  // 7. 군사 텐트 (적진 야영지)
  const enemyTent1 = buildNomadTent(PAL.fabric.redDark);
  enemyTent1.position.set(-4, 1.2, -11);
  const enemyTent2 = buildNomadTent(PAL.stone[2]);
  enemyTent2.position.set(4, 1.2, -11);
  root.add(enemyTent1, enemyTent2);

  // 8. 야간 기습 횃불 조명들
  const torchLights: THREE.PointLight[] = [];
  const torchPositions = [
    { x: -5, y: 1.8, z: 0 },
    { x: 5, y: 1.8, z: 0 },
    { x: 0, y: 2.2, z: -9 },
    { x: 0, y: 1.8, z: 6 },
  ];

  torchPositions.forEach((pos) => {
    const light = new THREE.PointLight(0xff6622, 1.8, 9, 1.6);
    light.position.set(pos.x, pos.y, pos.z);
    root.add(light);
    torchLights.push(light);
  });

  const melchizedekTable = new THREE.Group();
  melchizedekTable.position.set(0, 0, 6);
  root.add(melchizedekTable);

  col.bounds = { minX: -10, maxX: 10, minZ: -16, maxZ: 16 };

  const update = (_dt: number, time: number) => {
    // 횃불 조명 깜빡임
    torchLights.forEach((light, idx) => {
      light.intensity = 1.8 + Math.sin(time * 7.0 + idx * 1.5) * 0.35;
    });
  };

  return {
    root,
    col,
    bounds: col.bounds,
    torchLights,
    melchizedekTable,
    update,
  };
}
