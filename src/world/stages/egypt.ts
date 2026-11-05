import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildBorderChest } from '../props/biblicalProps';
import * as P from '../props';

export interface EgyptStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  chest: THREE.Group;
  throneDais: THREE.Group;
  nileWater: THREE.Group;
  brazierLight: THREE.PointLight;
  update: (dt: number, time: number) => void;
}

/**
 * 제2권 애굽 국경 세관 및 바로 궁정 3D 복셀 무대
 * - 나일강 수로와 갈대숲, 사암 열주 관문
 * - 세관 관헌의 보석 상자 (미드라시: 상자 속 사래 검문)
 * - 바로의 황금 옥좌 단상과 연꽃 문양 대리석 기둥
 */
export function buildEgyptStage(): EgyptStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.EGYPT;

  // 1. 애굽 황금 모래 지면 (36x36)
  vb.box(0, -0.25, 0, 36, 0.5, 36, reg.sand, { tex: 'plain' });

  // 2. 나일강 수로 (서쪽 가장자리)
  vb.box(-13, -0.1, 0, 6, 0.4, 36, reg.nileWater, { tex: 'water' });
  col.addBox(-13, 0, 6, 36);

  // 나일강 둑 돌 제방
  vb.box(-9.5, 0.2, 0, 1.2, 0.6, 36, reg.sandstonePillar, { tex: 'stone' });

  // 3. 애굽 국경 관문 거대 열주 (중앙 북쪽)
  const pillarColors = [reg.sandstonePillar, reg.gold, reg.lapis];
  for (let x = -4; x <= 6; x += 5) {
    // 기둥 받침
    vb.box(x, 0.2, -6, 2.0, 0.4, 2.0, reg.sandstonePillar, { tex: 'stone' });
    // 기둥 본체
    vb.box(x, 2.4, -6, 1.4, 4.0, 1.4, reg.sandstonePillar, { tex: 'stone' });
    // 기둥 주두 (연꽃 문양 장식)
    vb.box(x, 4.6, -6, 2.2, 0.6, 2.2, reg.gold, { tex: 'plain' });
    col.addBox(x, -6, 2.0, 2.0);
  }
  // 관문 상인방 (대들보)
  vb.box(1, 5.2, -6, 12, 0.8, 2.4, reg.sandstonePillar, { tex: 'stone' });

  // 4. 바로 궁정 황금 옥좌 단상 (동북쪽)
  vb.box(10, 0.4, -6, 8, 0.8, 8, PAL.stone[3], { tex: 'stone' });
  vb.box(10, 0.9, -6, 6, 0.4, 6, reg.lapis, { tex: 'plain' });
  vb.box(10, 1.6, -8, 3.2, 1.2, 1.6, reg.gold, { tex: 'plain' }); // 황금 보좌
  col.addBox(10, -6, 8, 8);

  // 5. 종려나무와 사막 관목
  P.palmTree(vb, col, -7, -4);
  P.palmTree(vb, col, -6, 6);
  P.palmTree(vb, col, 14, 5);
  P.bush(vb, col, 2, 7, 1.0);
  P.bush(vb, col, 5, 8, 0.8);

  // 6. 국경 세관 초소 탁자와 항아리들
  vb.box(0, 0.4, -2, 2.2, 0.8, 1.2, PAL.wood[2], { tex: 'wood' });
  col.addBox(0, -2, 2.2, 1.2);
  P.pot(vb, -3, -1, 1.2);
  P.sack(vb, 4, -2);

  const stageMesh = vb.build();
  root.add(stageMesh);

  // 7. 세관 보석 상자 (미드라시 핵심 인터랙션 오브젝트)
  const chest = buildBorderChest();
  chest.position.set(1.5, 0, -2);
  col.addBox(1.5, -2, 1.8, 1.4);
  root.add(chest);

  // 8. 궁정 화로 조명
  const brazierLight = new THREE.PointLight(0xff9933, 1.6, 10, 1.8);
  brazierLight.position.set(10, 2.4, -4);
  root.add(brazierLight);

  const throneDais = new THREE.Group();
  throneDais.position.set(10, 0, -6);
  root.add(throneDais);

  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  const update = (_dt: number, time: number) => {
    brazierLight.intensity = 1.6 + Math.sin(time * 7.0) * 0.25;
  };

  return {
    root,
    col,
    bounds: col.bounds,
    chest,
    throneDais,
    nileWater: stageMesh,
    brazierLight,
    update,
  };
}
