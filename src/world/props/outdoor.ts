// 야외 명소: 모닥불과 샘 연못
import { PAL } from '../palette';
import type { VoxelBuilder } from '../voxel';
import type { Collision } from '../collision';
import { LAMPS } from '../../systems/lighting';
import { addSpot } from '../../systems/interaction';
import { T, WHITE } from './common';

/** 돌 테 + 장작 + 앉는 통나무. 불꽃 애니메이션은 entities/fire.ts */
export function campfire(b: VoxelBuilder, col: Collision, x: number, z: number) {
  const r = b.rng;
  b.box(x, 0, z, 0.9, 0.03, 0.9, 0x3a3230, { jitter: 0, ao: false }); // 재
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    b.at(x + Math.cos(a) * 0.55, 0, z + Math.sin(a) * 0.55, -a, () =>
      b.box(0, 0, 0, 0.22, r.range(0.14, 0.2), 0.3, r.pick([PAL.stone[1], PAL.stone[2]]), { tex: 'plain', jitter: 0.08 }));
  }
  // 엇갈려 쌓은 장작 (끝이 탄 색)
  for (let i = 0; i < 4; i++) {
    b.at(x, 0.03, z, (i / 4) * Math.PI + 0.3, () => {
      b.box(0, 0.02 + (i % 2) * 0.08, 0, 0.7, 0.1, 0.1, WHITE, { tex: 'bark', ao: false });
      b.box(0, 0.03 + (i % 2) * 0.08, 0, 0.2, 0.1, 0.11, 0x2a1a14, { ao: false, jitter: 0 });
    });
  }
  b.box(x, 0.03, z, 0.3, 0.05, 0.3, 0xff7a30, { tex: 'flame', jitter: 0, ao: false }); // 숯불
  // 둘러앉는 통나무 셋
  for (const [a, len] of [[0.3, 1.2], [2.3, 1.0], [4.2, 1.1]] as const) {
    const lx = x + Math.cos(a) * 1.5, lz = z + Math.sin(a) * 1.5;
    b.at(lx, 0, lz, -a + Math.PI / 2, () => {
      b.box(0, 0, 0, len, 0.3, 0.3, WHITE, { tex: 'bark' });
      b.box(len / 2, 0.02, 0, T, 0.26, 0.26, PAL.wood[4], { ao: false });
      b.box(-len / 2, 0.02, 0, T, 0.26, 0.26, PAL.wood[4], { ao: false });
    });
    col.addCircle(lx, lz, 0.45);
  }
  col.addCircle(x, z, 0.6);
  LAMPS.push({ x, y: 0, z, kind: 'fire' });
  addSpot('fire', x, z, 1.0);
}

// ───────────── 샘 연못 ─────────────

/** d(x,z): 연못 가장자리까지 거리 (음수=물 안). 물은 1/8 유닛 타일로 계단진 가장자리 */
export function pond(b: VoxelBuilder, col: Collision, cx: number, cz: number, rad: number, d: (x: number, z: number) => number) {
  const r = b.rng;
  const c = 0.125;
  const deep = PAL.water[0], shallow = PAL.water[1];
  for (let z = cz - rad - 1; z < cz + rad + 1; z += c)
    for (let x = cx - rad - 1; x < cx + rad + 1; x += c) {
      const dd = d(x + c / 2, z + c / 2);
      if (dd >= 0) continue;
      // 가장자리일수록 얕은 색
      const k = Math.min(1, -dd / 1.1);
      const col2 = k > 0.55 ? deep : k > 0.18 ? shallow : PAL.water[2];
      b.box(x + c / 2, 0, z + c / 2, c, 0.03, c, col2, { tex: 'water', jitter: 0, ao: false });
    }
  // 연잎과 꽃
  for (let i = 0; i < 9; i++) {
    const a = r.range(0, Math.PI * 2), rr = r.range(0.4, rad * 0.8);
    const px = cx + Math.cos(a) * rr, pz = cz + Math.sin(a) * rr;
    if (d(px, pz) > -0.3) continue;
    b.box(px, 0.03, pz, 0.25, 0.02, 0.22, PAL.vine[1], { ao: false, jitter: 0.1 });
    b.box(px + 0.06, 0.03, pz + 0.05, 0.06, 0.021, 0.06, PAL.water[1], { tex: 'water', ao: false, jitter: 0 }); // 잎 틈
    if (r.chance(0.35)) b.box(px - 0.04, 0.05, pz - 0.03, 0.08, 0.06, 0.08, PAL.flower[2], { ao: false, jitter: 0 });
  }
  // 물가 갈대·부들과 돌
  for (let i = 0; i < 70; i++) {
    const a = r.range(0, Math.PI * 2);
    let px = cx + Math.cos(a) * rad, pz = cz + Math.sin(a) * rad;
    // 가장자리로 이동
    for (let k = 0; k < 6; k++) { const dd = d(px, pz); px -= Math.cos(a) * dd * 0.8; pz -= Math.sin(a) * dd * 0.8; }
    px += Math.cos(a) * r.range(-0.1, 0.35); pz += Math.sin(a) * r.range(-0.1, 0.35);
    if (a > 1.1 && a < 2.0) continue; // 앞쪽(화면 아래)은 비워서 물이 보이게
    if (r.chance(0.2)) {
      b.box(px, 0, pz, r.range(0.18, 0.3), r.range(0.1, 0.16), r.range(0.15, 0.25), r.pick([PAL.stone[2], PAL.stone[3]]), { tex: 'plain', jitter: 0.06 });
      continue;
    }
    const h = r.range(0.4, 0.85);
    b.box(px, 0, pz, T, h, T, r.pick([PAL.grass[2], PAL.grass[3], PAL.dryGrass[0]]), { jitter: 0.05, ao: false });
    if (r.chance(0.3)) b.box(px, h - 0.18, pz, 0.07, 0.16, 0.07, PAL.wood[1], { jitter: 0.05, ao: false }); // 부들 이삭
  }
  col.addCircle(cx, cz, rad * 0.92);
  addSpot('pond', cx, cz, 0.6);
}
