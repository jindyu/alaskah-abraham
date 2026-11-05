import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildStoneAltar, buildMamreOak, buildNomadTent } from '../props/biblicalProps';
import * as P from '../props';
import { Sheep } from '../../entities/animals';

export interface ShechemBethelStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  altar: THREE.Group;
  altarLight: THREE.PointLight;
  shechemOak: THREE.Group;
  sheepGroup: THREE.Group;
  update: (dt: number, time: number) => void;
}

/**
 * 제2권 세겜 & 벧엘 상수리나무 언덕 3D 복셀 무대
 * - 세겜 모레 상수리나무 아래 첫 제단
 * - 벧엘과 아이 사이의 석회암 언덕 전망대 (동서남북 조망)
 * - 가나안 유목 장막과 양 떼 방목지
 */
export function buildShechemBethelStage(): ShechemBethelStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // 고해상도 TD=16 텍스처
  const reg = PAL_REGION.CANAAN;

  // 1. 가나안 비옥한 황토 지면 (36x36)
  vb.box(0, -0.25, 0, 36, 0.5, 36, reg.ground, { tex: 'soil' });

  // 2. 벧엘 고지대 언덕 바위 절벽 (북동쪽)
  vb.box(8, 0.8, -8, 14, 1.6, 14, reg.limestone, { tex: 'cliff' });
  col.addBox(8, -8, 14, 14);

  // 벧엘 언덕 정상 전망대 계단식 바위
  vb.box(10, 1.8, -10, 8, 0.8, 8, reg.limestone, { tex: 'cliff' });
  vb.box(12, 2.4, -12, 4, 0.6, 4, PAL.stone[3], { tex: 'cliff' });

  // 3. 남서쪽 낮은 석회암 둔덕과 언덕길
  vb.box(-10, 0.3, 8, 10, 0.6, 12, reg.limestone, { tex: 'soil' });
  vb.box(-5, 0.15, 0, 4, 0.3, 16, PAL.dirt[2], { tex: 'soil' }); // 오솔길

  // 4. 관목 및 자연석 배치
  P.bush(vb, col, -4, 5, 1.2);
  P.bush(vb, col, -7, 6, 0.9);
  P.bush(vb, col, 6, 2, 1.0);
  P.bush(vb, col, 12, 4, 1.1);
  P.rock(vb, col, -3, -7, 1.2);
  P.rock(vb, col, 4, -4, 0.9);
  P.rock(vb, col, -11, -3, 1.5);

  root.add(vb.build());

  // 5. 세겜 모레의 거대한 상수리나무 (서북쪽)
  const shechemOak = buildMamreOak();
  shechemOak.position.set(-6, 0, -5);
  shechemOak.scale.set(1.2, 1.2, 1.2);
  col.addBox(-6, -5, 3.5, 3.5);
  root.add(shechemOak);

  // 6. 첫 제단 (나무 앞마당) 및 감사 번제 불꽃
  const altar = buildStoneAltar(true);
  altar.position.set(-2, 0, -2);
  col.addBox(-2, -2, 2.0, 1.8);
  root.add(altar);

  const altarLight = new THREE.PointLight(0xff7722, 1.8, 8, 1.5);
  altarLight.position.set(-2, 1.2, -2);
  root.add(altarLight);

  // 7. 아브람과 사래의 가나안 정착 장막 (남서쪽)
  const tent = buildNomadTent(reg.tentBlack);
  tent.position.set(-8, 0, 4);
  col.addBox(-8, 4, 4.0, 3.5);
  root.add(tent);

  // 야외 화덕과 토기
  const campVb = new VoxelBuilder(9, false);
  P.campfire(campVb, col, -4, 3);
  P.pot(campVb, -6, 2, 1.2);
  P.sack(campVb, -6.5, 2.3);
  root.add(campVb.build());

  // 8. 방목 중인 양 떼 (가나안 목축)
  const sheepGroup = new THREE.Group();
  const sheep1 = new Sheep(4, 5);
  const sheep2 = new Sheep(6, 7);
  const sheep3 = new Sheep(2, 8);
  sheepGroup.add(sheep1.root, sheep2.root, sheep3.root);
  root.add(sheepGroup);

  // 경계 영역
  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  const update = (_dt: number, time: number) => {
    // 제단 번제 화염 조명 깜빡임
    altarLight.intensity = 1.8 + Math.sin(time * 8.0) * 0.3 + Math.cos(time * 15.0) * 0.15;
  };

  return {
    root,
    col,
    bounds: col.bounds,
    altar,
    altarLight,
    shechemOak,
    sheepGroup,
    update,
  };
}
