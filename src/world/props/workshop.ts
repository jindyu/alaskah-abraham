// 작업장 소품: 대장간 앞마당, 제재소, 역청 웅덩이
import { PAL } from '../palette';
import type { VoxelBuilder } from '../voxel';
import type { Collision } from '../collision';
import { addSpot } from '../../systems/interaction';
import { WHITE } from './common';
import { sack } from './small';

/** 대장간 앞마당: 야외 모루와 숯 자루 */
export function anvilYard(b: VoxelBuilder, col: Collision, x: number, z: number) {
  b.box(x, 0, z, 0.55, 0.5, 0.55, WHITE, { tex: 'bark' });
  b.box(x, 0.5, z, 0.85, 0.15, 0.34, PAL.stone[0], { tex: 'metal', ao: false });
  b.box(x, 0.65, z, 0.48, 0.09, 0.28, PAL.stone[1], { tex: 'metal', ao: false });
  b.box(x + 0.5, 0.57, z, 0.26, 0.07, 0.15, PAL.stone[0], { tex: 'metal', ao: false });
  b.box(x, 0.74, z, 0.72, 0.03, 0.3, PAL.stone[3], { tex: 'metal', ao: false, jitter: 0 });
  col.addCircle(x, z, 0.4);
  sack(b, x - 0.9, z + 0.3, 0.3);
}

/** 제재소: 톱질 모탕에 얹은 통나무, 큰 톱, 판자 더미, 톱밥 */
export function sawmill(b: VoxelBuilder, col: Collision, x: number, z: number) {
  const r = b.rng;
  for (const dx of [-0.7, 0.7]) {
    // 모탕(톱질대): X자 다리 + 가로대
    for (const dz of [-0.28, 0.28]) b.box(x + dx, 0, z + dz, 0.12, 0.72, 0.12, PAL.wood[2], { tex: 'wood' });
    b.box(x + dx, 0.66, z, 0.18, 0.1, 0.8, PAL.wood[3], { tex: 'wood' });
  }
  b.box(x, 0.76, z, 1.9, 0.34, 0.34, WHITE, { tex: 'bark' });
  b.box(x + 0.95, 0.76, z, 0.02, 0.34, 0.3, PAL.wood[4], { ao: false });
  // 톱 (반쯤 박힌 긴 톱날 + 손잡이)
  b.box(x - 0.2, 1.08, z + 0.18, 1.2, 0.09, 0.02, PAL.stone[3], { tex: 'metal', ao: false, jitter: 0 });
  b.box(x - 0.85, 1.05, z + 0.18, 0.08, 0.26, 0.06, PAL.wood[2], { ao: false });
  b.box(x + 0.45, 1.05, z + 0.18, 0.08, 0.26, 0.06, PAL.wood[2], { ao: false });
  // 판자 더미
  for (let i = 0; i < 5; i++) b.box(x + 1.55, i * 0.07, z - 0.1, 0.9 - (i % 2) * 0.06, 0.07, 0.42, PAL.wood[3 - (i % 2)], { tex: 'wood', ao: i === 0 });
  // 톱밥 무더기와 나무 부스러기
  for (let i = 0; i < 14; i++)
    b.box(x + r.range(-1.1, 0.9), 0, z + r.range(0.2, 0.9), 0.1, r.range(0.02, 0.07), 0.1,
      r.pick([PAL.straw[2], PAL.straw[3], PAL.wood[4]]), { ao: false, jitter: 0.08 });
  // 뒤쪽: 켤 통나무 더미와 높은 나무틀 (위에서 내려다봐도 작업대임을 알아보게, 캐릭터에 가려지지 않는 높이)
  for (const [dy, dz] of [[0, -0.55], [0, -0.95], [0.3, -0.75]] as const) b.box(x - 0.2, dy, z + dz, 2.2, 0.32, 0.32, WHITE, { tex: 'bark' });
  for (const dx of [-1.25, 1.05]) b.box(x + dx, 0, z - 0.75, 0.16, 1.7, 0.16, PAL.wood[2], { tex: 'wood' });
  b.box(x - 0.1, 1.7, z - 0.75, 2.6, 0.16, 0.2, PAL.wood[3], { tex: 'wood' });
  // 틀에 걸어 둔 큰 톱
  b.box(x - 0.1, 1.38, z - 0.64, 1.6, 0.12, 0.03, PAL.stone[3], { tex: 'metal', ao: false, jitter: 0 });
  for (const dx of [-0.95, 0.75]) b.box(x + dx, 1.38, z - 0.64, 0.08, 0.3, 0.06, PAL.wood[2], { ao: false });
  col.addBox(x, z, 2.0, 0.5);
  col.addBox(x + 1.55, z - 0.1, 0.9, 0.45);
  col.addBox(x - 0.1, z - 0.75, 2.7, 0.6);
  addSpot('saw', x, z + 0.6, 0.9);
}

/** 역청 웅덩이: 검고 끈적한 못, 김이 오르는 거품, 긁개와 항아리 */
export function pitchPit(b: VoxelBuilder, col: Collision, x: number, z: number, rad: number) {
  const r = b.rng;
  // 돌 테두리
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    b.box(x + Math.cos(a) * (rad + 0.1), 0, z + Math.sin(a) * (rad + 0.1), 0.34, r.range(0.1, 0.2), 0.34,
      r.pick([PAL.stone[1], PAL.stone[2]]), { tex: 'plain', jitter: 0.08 });
  }
  b.box(x, 0, z, rad * 1.7, 0.05, rad * 1.7, 0x241e18, { ao: false, jitter: 0 });
  b.box(x, 0.05, z, rad * 1.3, 0.02, rad * 1.3, 0x3a3128, { ao: false, jitter: 0.05 });
  for (let i = 0; i < 5; i++) b.box(x + r.range(-0.4, 0.4), 0.07, z + r.range(-0.4, 0.4), 0.09, 0.05, 0.09, 0x5a4c3c, { ao: false, jitter: 0.1 });
  // 항아리와 나무 긁개
  b.box(x + rad + 0.55, 0, z + 0.2, 0.3, 0.34, 0.3, 0x2e261e, { ao: false });
  b.box(x + rad + 0.55, 0.34, z + 0.2, 0.22, 0.05, 0.22, PAL.clay[0], { ao: false });
  b.at(x - rad - 0.5, 0, z + 0.4, 0.5, () => {
    b.box(0, 0, 0, 0.06, 0.9, 0.06, PAL.wood[2], { tex: 'wood', ao: false });
    b.box(0, 0.86, 0, 0.3, 0.05, 0.05, PAL.wood[3], { ao: false });
  }, 0, 0.35);
  col.addCircle(x, z, rad + 0.2);
  addSpot('pitch', x, z + rad + 0.3, 0.6);
}
