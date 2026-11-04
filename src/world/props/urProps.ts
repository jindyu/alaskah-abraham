import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { WHITE } from './common';
import type { Collision } from '../collision';

/** 우르 북서쪽 원경에 우뚝 솟은 거대 수메르 지구라트 (3단 테라스 신전) */
export function buildZiggurat(): THREE.Group {
  const grp = new THREE.Group();
  const b = new VoxelBuilder(42, false);
  const reg = PAL_REGION.MESOPOTAMIA;

  // 지하 암반 및 기초 토대 (지면 틈새 방지)
  b.box(0, -0.6, 0, 32, 1.2, 26, 0x7c5235, { tex: 'brick' });

  // 1단 기단 (거대 테라스 28x22)
  b.box(0, 2.5, 0, 28, 5.0, 22, reg.brick, { tex: 'brick' });
  // 1단 상부 테라스 테두리 난간
  b.box(0, 5.2, 10.8, 28, 0.4, 0.4, 0x4a3222, { tex: 'brick' });
  b.box(0, 5.2, -10.8, 28, 0.4, 0.4, 0x4a3222, { tex: 'brick' });
  b.box(13.8, 5.2, 0, 0.4, 0.4, 21.6, 0x4a3222, { tex: 'brick' });
  b.box(-13.8, 5.2, 0, 0.4, 0.4, 21.6, 0x4a3222, { tex: 'brick' });

  // 2단 기단 (19x15)
  b.box(0, 7.0, 0, 19, 4.0, 15, 0x6e4830, { tex: 'brick' });
  b.box(0, 9.2, 7.3, 19, 0.4, 0.4, 0x3d2618, { tex: 'brick' });
  b.box(0, 9.2, -7.3, 19, 0.4, 0.4, 0x3d2618, { tex: 'brick' });

  // 3단 기단 (12x10)
  b.box(0, 10.5, 0, 12, 3.0, 10, reg.brick, { tex: 'brick' });

  // 최상부 난나(달의 신) 신전 (이슈타르 청유리 타일과 황금 띠)
  b.box(0, 13.0, 0, 7.0, 2.6, 6.0, reg.ishtarBlue, { tex: 'stone' });
  b.box(0, 14.5, 0, 7.6, 0.4, 6.6, 0xd4af37, { tex: 'metal' }); // 황금 장식 지붕

  // 중앙 거대 계단 (전면으로 뻗은 램프/계단)
  for (let step = 0; step < 18; step++) {
    const y = step * 0.4 + 0.2;
    const z = 11.0 + (18 - step) * 0.6;
    b.box(0, y, z, 3.8, 0.4, 0.65, 0x5a3b22, { tex: 'stone' });
    // 계단 좌우 난간 벽
    b.box(-2.1, y + 0.3, z, 0.4, 0.8, 0.65, reg.brick, { tex: 'brick' });
    b.box(2.1, y + 0.3, z, 0.4, 0.8, 0.65, reg.brick, { tex: 'brick' });
  }

  grp.add(b.build());
  return grp;
}

/** 데라의 공방 전용 가구 및 도구 (조각대, 안료함, 끌과 망치, 도끼 거치대) */
export function buildWorkshopDetails(b: VoxelBuilder, col: Collision, cx: number, cz: number) {
  // 메인 조각 작업대 (가로 4.0, 세로 1.2, 높이 0.85)
  b.box(cx - 3.5, 0.45, cz - 2.5, 3.6, 0.9, 1.3, PAL.wood[2], { tex: 'wood' });
  col.addBox(cx - 3.5, cz - 2.5, 3.7, 1.4);

  // 작업대 위 미완성 점토/돌 조각들과 정, 망치
  b.box(cx - 4.5, 0.96, cz - 2.4, 0.4, 0.2, 0.3, PAL.stone[2], { tex: 'stone' });
  b.box(cx - 3.8, 0.95, cz - 2.6, 0.35, 0.18, 0.35, 0x9c7a52, { tex: 'soil' }); // 점토 덩어리
  // 쇠망치와 정
  b.box(cx - 2.8, 0.92, cz - 2.3, 0.1, 0.08, 0.35, PAL.wood[4]);
  b.box(cx - 2.8, 0.94, cz - 2.5, 0.22, 0.12, 0.12, 0x7a8288, { tex: 'metal' });
  b.box(cx - 2.4, 0.92, cz - 2.4, 0.05, 0.06, 0.3, 0x9aa2aa, { tex: 'metal' });

  // 우상 진열 선반장 (우측 벽면)
  b.box(cx + 4.2, 1.2, cz - 2.0, 1.0, 2.4, 3.8, PAL.wood[1], { tex: 'wood' });
  col.addBox(cx + 4.2, cz - 2.0, 1.1, 3.9);
  // 선반 칸막이
  b.box(cx + 3.8, 0.8, cz - 2.0, 0.4, 0.06, 3.6, PAL.wood[3]);
  b.box(cx + 3.8, 1.5, cz - 2.0, 0.4, 0.06, 3.6, PAL.wood[3]);
  b.box(cx + 3.8, 2.1, cz - 2.0, 0.4, 0.06, 3.6, PAL.wood[3]);

  // 도끼 거치대 (중앙 기둥 옆에 기대어 둠)
  b.box(cx + 2.2, 0.4, cz - 1.2, 0.6, 0.8, 0.4, PAL.wood[3], { tex: 'wood' });
  col.addBox(cx + 2.2, cz - 1.2, 0.7, 0.5);

  // 안마당 점토 반죽통과 물항아리
  b.box(cx - 5.2, 0.3, cz + 2.0, 1.4, 0.6, 1.4, 0x5a3b22, { tex: 'wood' });
  b.box(cx - 5.2, 0.4, cz + 2.0, 1.2, 0.2, 1.2, 0x8a6242, { tex: 'soil' }); // 반죽된 점토
  col.addBox(cx - 5.2, cz + 2.0, 1.5, 1.5);
}

/** 옥상 테라스 난간과 밤하늘 관측 돗자리 */
export function buildRooftopTerrace(b: VoxelBuilder, cx: number, cy: number, cz: number) {
  // 테라스 바닥 짚 매트 (별을 올려다보는 자리)
  b.box(cx, cy + 0.02, cz, 2.2, 0.04, 2.2, 0xd8c28a, { tex: 'reed' });
  // 등잔 받침대
  b.box(cx + 1.4, cy + 0.3, cz - 1.2, 0.35, 0.6, 0.35, PAL_REGION.MESOPOTAMIA.brick, { tex: 'brick' });
  b.box(cx + 1.4, cy + 0.65, cz - 1.2, 0.25, 0.12, 0.25, 0xcaa060, { tex: 'metal' });
  b.box(cx + 1.4, cy + 0.75, cz - 1.2, 0.1, 0.1, 0.1, 0xff7a30, { tex: 'flame', ao: false });
}
