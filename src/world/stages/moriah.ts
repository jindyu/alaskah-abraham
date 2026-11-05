import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL } from '../palette';
import { Collision } from '../collision';
import { buildStoneAltar } from '../props/biblicalProps';
import * as P from '../props';
import { Donkey, RamInThicket } from '../../entities/animals';

export interface MoriahStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  altar: THREE.Group;
  ram: RamInThicket;
  donkey: Donkey;
  divineLight: THREE.PointLight;
  update: (dt: number, time: number) => void;
}

/**
 * 제5권 모리아 산 3D 복셀 무대
 * - 모리아 산기슭 나귀 베이스캠프 (종들과 나귀)
 * - 깎아지른 바위 등산로와 정상 제단 단상
 * - 쪼갠 장작더미와 이삭 결박(아케다) 번제단
 * - 수풀에 뿔이 걸린 숫양 (여호와 이레 대속)
 */
export function buildMoriahStage(): MoriahStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16

  // 1. 모리아 산 험준한 바위 지면 (36x36)
  vb.box(0, -0.25, 0, 36, 0.5, 36, PAL.stone[1], { tex: 'soil' });

  // 2. 남쪽 산기슭 베이스캠프 (종들과 나귀가 머무는 곳)
  vb.box(0, 0.2, 10, 16, 0.4, 10, PAL.dirt[2], { tex: 'soil' });

  // 3. 계단식 바위 등산로
  vb.box(0, 1.0, 4, 10, 1.2, 6, PAL.stone[2], { tex: 'cliff' });
  vb.box(0, 2.0, -1, 8, 1.0, 6, PAL.stone[2], { tex: 'cliff' });

  // 4. 모리아 산 정상 번제단 바위 단상 (북쪽 정상)
  vb.box(0, 3.2, -7, 10, 1.4, 8, PAL.stone[3], { tex: 'cliff' });
  col.addBox(0, -7, 10, 8);

  // 5. 쪼갠 번제 나무 장작개비들 (제단 옆)
  vb.box(-2.5, 4.0, -7, 1.4, 0.6, 1.2, PAL.wood[1], { tex: 'wood' });
  vb.box(-2.5, 4.5, -7, 1.2, 0.4, 1.0, PAL.wood[2], { tex: 'wood' });

  // 6. 거친 산악 바위와 마른 관목
  P.rock(vb, col, -7, 3, 1.8);
  P.rock(vb, col, 7, 2, 1.6);
  P.rock(vb, col, -8, -6, 2.2);
  P.rock(vb, col, 8, -5, 2.0);
  P.bush(vb, col, -4, -3, 0.8);
  P.bush(vb, col, 4, -4, 0.9);

  const stageMesh = vb.build();
  root.add(stageMesh);

  // 7. 모리아 산 정상 돌 번제단
  const altar = buildStoneAltar(false);
  altar.position.set(0, 3.9, -7);
  col.addBox(0, -7, 2.5, 2.2);
  root.add(altar);

  // 8. 수풀에 뿔이 걸린 숫양 (제단 뒤편 가시덤불 속)
  const ram = new RamInThicket(3.2, -7.5);
  root.add(ram.root);
  col.addBox(3.2, -7.5, 1.8, 1.8);

  // 9. 산기슭의 나귀
  const donkey = new Donkey(-3, 8);
  root.add(donkey.root);
  col.addBox(-3, 8, 2.0, 1.5);

  // 10. 하나님의 음성과 천사의 영광 조명
  const divineLight = new THREE.PointLight(0xffea88, 2.0, 14, 1.5);
  divineLight.position.set(0, 6.0, -7);
  root.add(divineLight);

  col.bounds = { minX: -14, maxX: 14, minZ: -14, maxZ: 14 };

  const update = (_dt: number, time: number) => {
    divineLight.intensity = 2.0 + Math.sin(time * 6.0) * 0.3;
  };

  return {
    root,
    col,
    bounds: col.bounds,
    altar,
    ram,
    donkey,
    divineLight,
    update,
  };
}
