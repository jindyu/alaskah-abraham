import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import * as P from '../props';

export interface SodomStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  lotHouse: THREE.Group;
  saltPillar: THREE.Group;
  sulfurLights: THREE.PointLight[];
  update: (dt: number, time: number) => void;
}

/**
 * 제4권 소돔 성문 및 멸망의 거리 3D 복셀 무대
 * - 높은 사암 성벽과 아치형 성문 광장
 * - 롯의 2층 벽돌 가옥과 안뜰
 * - 하늘에서 쏟아지는 유황불과 무너진 석재 잔해
 * - 뒤를 돌아보아 굳어진 백색 복셀 '소금 기둥(Pillar of Salt)'
 */
export function buildSodomStage(): SodomStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.SODOM_NEGEV;

  // 1. 소돔 평야 붉은 흙과 유황 노란 지면 (36x36)
  vb.box(0, -0.25, 0, 36, 0.5, 36, reg.canyonRed, { tex: 'soil' });

  // 유황 침전물 얼룩들
  vb.box(-5, -0.05, 4, 6, 0.2, 5, reg.sulfurYellow, { tex: 'plain' });
  vb.box(6, -0.05, -3, 5, 0.2, 6, reg.sulfurYellow, { tex: 'plain' });

  // 2. 소돔 북쪽 거대 방어 성벽 (좌우 옹벽과 중앙 성문)
  vb.box(-8, 3.2, -10, 10, 6.4, 2.4, PAL.stone[1], { tex: 'brick' });
  col.addBox(-8, -10, 10, 2.4);

  vb.box(8, 3.2, -10, 10, 6.4, 2.4, PAL.stone[1], { tex: 'brick' });
  col.addBox(8, -10, 10, 2.4);

  // 중앙 성문 아치 및 문루
  vb.box(0, 5.2, -10, 6, 2.4, 2.4, PAL.stone[2], { tex: 'brick' });
  // 나무 성문
  vb.box(-1.2, 2.0, -10, 2.2, 4.0, 0.4, PAL.wood[1], { tex: 'wood' });
  vb.box(1.2, 2.0, -10, 2.2, 4.0, 0.4, PAL.wood[1], { tex: 'wood' });
  col.addBox(-1.5, -10, 1.5, 1.0);
  col.addBox(1.5, -10, 1.5, 1.0);

  // 3. 롯의 가옥 (남서쪽 2층 흙벽돌 가옥)
  vb.box(-7, 2.2, 2, 7, 4.4, 6, PAL.brick[1], { tex: 'brick' });
  col.addBox(-7, 2, 7, 6);
  // 롯의 가옥 문
  vb.box(-3.4, 1.2, 2, 0.2, 2.4, 1.2, PAL.wood[0], { tex: 'wood' });
  // 옥상 난간
  vb.box(-7, 4.6, 2, 7.2, 0.6, 6.2, PAL.brick[2], { tex: 'brick' });

  // 4. 소돔 탈출로 남동쪽 언덕 바위
  vb.box(8, 0.6, 7, 8, 1.2, 8, PAL.stone[2], { tex: 'cliff' });
  col.addBox(8, 7, 8, 8);

  // 5. 무너진 잔해 및 불타는 기둥들
  P.rock(vb, col, 3, 2, 1.5);
  P.rock(vb, col, -2, -5, 1.2);
  P.rock(vb, col, 5, -6, 1.4);

  const stageMesh = vb.build();
  root.add(stageMesh);

  // 6. 소금 기둥 (탈출로 언덕 위에 홀로 선 롯의 아내)
  const saltPillar = new THREE.Group();
  const saltVb = new VoxelBuilder(16, false);
  // 바위 받침대
  saltVb.box(8, 1.4, 7, 1.6, 0.6, 1.6, PAL.stone[3], { tex: 'cliff' });
  // 사람 형상의 백색 소금 기둥
  saltVb.box(8, 2.4, 7, 0.6, 1.4, 0.6, reg.saltPillar, { tex: 'plain' });
  saltVb.box(8, 3.3, 7, 0.5, 0.5, 0.5, reg.saltPillar, { tex: 'plain' }); // 머리
  // 뒤(소돔 성문)를 돌아보는 실루엣
  saltVb.box(7.8, 3.3, 6.8, 0.2, 0.2, 0.3, reg.saltPillar, { tex: 'plain' });
  saltPillar.add(saltVb.build());
  root.add(saltPillar);

  // 7. 유황불 낙하 조명들
  const sulfurLights: THREE.PointLight[] = [];
  const lightPositions = [
    { x: -5, y: 3.5, z: 2 },
    { x: 4, y: 2.8, z: -4 },
    { x: 0, y: 4.5, z: -8 },
    { x: 8, y: 2.2, z: 5 },
  ];

  lightPositions.forEach((pos) => {
    const light = new THREE.PointLight(0xff3311, 2.0, 10, 1.8);
    light.position.set(pos.x, pos.y, pos.z);
    root.add(light);
    sulfurLights.push(light);
  });

  const lotHouse = new THREE.Group();
  lotHouse.position.set(-7, 0, 2);
  root.add(lotHouse);

  col.bounds = { minX: -14, maxX: 14, minZ: -14, maxZ: 14 };

  const update = (_dt: number, time: number) => {
    // 유황불 깜빡임
    sulfurLights.forEach((light, idx) => {
      light.intensity = 2.0 + Math.sin(time * 9.0 + idx * 2.0) * 0.45;
    });
  };

  return {
    root,
    col,
    bounds: col.bounds,
    lotHouse,
    saltPillar,
    sulfurLights,
    update,
  };
}
