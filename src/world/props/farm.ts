// 농경지·경계 구조물: 울타리, 돌담, 포도나무 줄, 밀밭, 타작마당
import { PAL } from '../palette';
import type { VoxelBuilder } from '../voxel';
import type { Collision } from '../collision';
import { addSpot } from '../../systems/interaction';
import { T, WHITE } from './common';

/** 축 정렬 나무 울타리. gaps: 시작점 기준 거리 [from, to] 구간은 비움(문) */
export function fence(b: VoxelBuilder, col: Collision, x0: number, z0: number, x1: number, z1: number, gaps: [number, number][] = []) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
  const alongX = Math.abs(dx) > 0.5;
  const inGap = (t: number) => gaps.some(([a, bb]) => t > a && t < bb);
  const n = Math.round(len / 1.0);
  const step = len / n;
  for (let i = 0; i <= n; i++) {
    const t = i * step;
    if (inGap(t) && inGap(t + 0.001) && inGap(t - 0.001)) continue;
    const px = x0 + dx * t, pz = z0 + dz * t;
    b.box(px, 0, pz, 0.14, 0.82, 0.14, PAL.wood[2], { tex: 'wood', jitter: 0.1 });
    b.box(px, 0.82, pz, 0.18, 0.06, 0.18, PAL.wood[3], { jitter: 0.06 });
  }
  // 가로대: 구간별로 끊어서
  let segStart = 0;
  const flush = (a: number, bb: number) => {
    if (bb - a < 0.05) return;
    const m = (a + bb) / 2, l = bb - a;
    const mx = x0 + dx * m, mz = z0 + dz * m;
    for (const ry of [0.3, 0.62])
      b.box(mx, ry, mz, alongX ? l : 0.06, 0.09, alongX ? 0.06 : l, PAL.wood[3], { tex: 'wood', jitter: 0.05 });
    col.addBox(mx, mz, alongX ? l : 0.2, alongX ? 0.2 : l);
  };
  const sorted = [...gaps].sort((a, c) => a[0] - c[0]);
  for (const [a, bb] of sorted) { flush(segStart, a); segStart = bb; }
  flush(segStart, len);
}

export function stoneWall(b: VoxelBuilder, col: Collision, x0: number, z0: number, x1: number, z1: number, gaps: [number, number][] = []) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
  const alongX = Math.abs(dx) > 0.5;
  const r = b.rng;
  const inGap = (t: number) => gaps.some(([a, bb]) => t > a - 0.2 && t < bb + 0.2);
  for (let row = 0; row < 2; row++) {
    let t = row ? 0.2 : 0;
    while (t < len) {
      const sl = r.range(0.35, 0.55);
      const m = t + sl / 2;
      if (!inGap(m)) {
        const px = x0 + dx * m, pz = z0 + dz * m;
        const hh = row ? r.range(0.24, 0.32) : r.range(0.3, 0.36);
        const th = row ? 0.4 : 0.5;
        b.box(px + (alongX ? 0 : r.range(-0.03, 0.03)), row * 0.33, pz + (alongX ? r.range(-0.03, 0.03) : 0),
          alongX ? sl - 0.04 : th, hh, alongX ? th : sl - 0.04, r.pick([PAL.stone[2], PAL.stone[3], PAL.stone[2], PAL.stone[1]]),
          { tex: 'plain', jitter: 0.06 });
        if (row === 1 && r.chance(0.18))
          b.box(px, 0.33 + hh, pz, alongX ? 0.2 : 0.3, T, alongX ? 0.3 : 0.2, PAL.grass[2], { ao: false });
      }
      t += sl;
    }
  }
  let segStart = 0;
  const flush = (a: number, bb: number) => {
    if (bb - a < 0.05) return;
    const m = (a + bb) / 2, l = bb - a;
    col.addBox(x0 + dx * m, z0 + dz * m, alongX ? l : 0.55, alongX ? 0.55 : l);
  };
  for (const [a, bb] of [...gaps].sort((a, c) => a[0] - c[0])) { flush(segStart, a); segStart = bb; }
  flush(segStart, len);
}

/** x축 방향 포도나무 한 줄 */
export function vineRow(b: VoxelBuilder, col: Collision, x0: number, x1: number, z: number) {
  const r = b.rng;
  const len = x1 - x0;
  // 지지대 + 철사 대신 가는 장대
  for (let t = 0; t <= len + 0.01; t += len / Math.round(len / 1.6)) {
    b.box(x0 + t, 0, z, 0.1, 1.3, 0.1, PAL.wood[2], { tex: 'wood', jitter: 0.1 });
  }
  b.box((x0 + x1) / 2, 1.18, z, len, 0.05, 0.05, PAL.wood[1], { jitter: 0 });
  b.box((x0 + x1) / 2, 0.7, z, len, 0.04, 0.04, PAL.wood[1], { jitter: 0 });
  for (let t = 0.4; t < len - 0.2; t += 0.8) {
    const px = x0 + t + r.range(-0.1, 0.1);
    // 굵고 뒤틀린 포도 줄기
    b.box(px, 0, z, 0.12, 0.45, 0.12, WHITE, { tex: 'bark' });
    b.box(px + 0.05, 0.45, z, 0.1, 0.35, 0.1, WHITE, { tex: 'bark', ao: false });
    // 잎 뭉치
    b.box(px, 0.62, z, r.range(0.7, 0.9), r.range(0.5, 0.65), 0.5, WHITE, { tex: 'leafVine', jitter: 0.07, ao: false });
    b.box(px + r.range(-0.2, 0.2), 1.1, z, 0.5, 0.2, 0.4, WHITE, { tex: 'leafVine', jitter: 0.07, ao: false });
    for (let k = 0; k < 3; k++)
      b.box(px + r.range(-0.4, 0.4), r.range(0.65, 1.1), z + r.pick([-1, 1]) * 0.27, 0.2, 0.16, 0.08, PAL.vine[2], { ao: false, jitter: 0.1 });
    // 포도송이: 앞/뒤로 늘어뜨림 (역삼각형)
    for (const s of [-1, 1]) {
      if (!r.chance(0.8)) continue;
      const gx = px + r.range(-0.25, 0.25), gz = z + s * 0.27;
      const gc = r.pick(PAL.grape);
      b.box(gx, 0.58, gz, 0.2, 0.08, 0.08, gc, { ao: false, jitter: 0.08 });
      b.box(gx, 0.5, gz, 0.14, 0.08, 0.08, gc, { ao: false, jitter: 0.08 });
      b.box(gx, 0.43, gz, 0.07, 0.07, 0.07, gc, { ao: false, jitter: 0.08 });
      b.box(gx - 0.05, 0.6, gz + s * 0.02, T, T, T, 0xb08ab8, { ao: false, jitter: 0 }); // 반짝임
    }
  }
  col.addBox((x0 + x1) / 2, z, len + 0.1, 0.5);
  for (let t = 0.8; t < len; t += 1.6) addSpot('vine', x0 + t, z, 1.3);
}

// ───────────── 밀밭 / 타작마당 ─────────────

export function wheatField(b: VoxelBuilder, col: Collision, x0: number, z0: number, x1: number, z1: number) {
  const r = b.rng;
  for (let z = z0 + 0.15; z < z1; z += 0.22)
    for (let x = x0 + 0.15; x < x1; x += 0.2) {
      const px = x + r.range(-0.07, 0.07), pz = z + r.range(-0.06, 0.06);
      const h = r.range(0.5, 0.72);
      const lean = r.range(-0.03, 0.03);
      b.box(px, 0, pz, T, h, T, r.pick([PAL.straw[1], PAL.straw[2], PAL.dryGrass[1]]), { jitter: 0.05 });
      b.box(px + lean, h, pz, 0.08, 0.16, 0.08, r.pick([PAL.straw[2], PAL.straw[3], PAL.straw[3]]), { jitter: 0.06, ao: false });
      if (r.chance(0.3)) b.box(px + lean, h + 0.16, pz, 0.03, 0.08, 0.03, PAL.straw[3], { ao: false, jitter: 0 }); // 까락
    }
  // 가장자리 허수아비 대신 바구니와 낫질한 단
  col.addBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0);
}

export function threshingFloor(b: VoxelBuilder, col: Collision, x: number, z: number, rad: number) {
  const r = b.rng;
  // 가장자리 돌 테
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.at(x + Math.cos(a) * (rad + 0.15), 0, z + Math.sin(a) * (rad + 0.15), -a, () =>
      b.box(0, 0, 0, 0.3, r.range(0.12, 0.2), 0.6, r.pick([PAL.stone[2], PAL.stone[3]]), { tex: 'plain', jitter: 0.06 }));
  }
  // 가운데 곡식 더미
  b.box(x - 0.3, 0, z - 0.2, 1.1, 0.25, 0.9, PAL.straw[2], { tex: 'plain', jitter: 0.04 });
  b.box(x - 0.3, 0.25, z - 0.2, 0.7, 0.18, 0.55, PAL.straw[3], { tex: 'plain', jitter: 0.04 });
  b.box(x - 0.3, 0.43, z - 0.2, 0.35, 0.1, 0.3, PAL.straw[3], { tex: 'plain', jitter: 0.04 });
  // 타작 썰매 + 키질용 나무 갈퀴
  b.at(x + 0.7, 0, z + 0.6, 0.4, () => {
    b.box(0, 0, 0, 1.0, 0.1, 0.55, PAL.wood[3], { tex: 'wood' });
    for (let i = 0; i < 5; i++) b.box(-0.4 + i * 0.2, 0.1, 0, 0.05, 0.03, 0.5, PAL.stone[1], { ao: false, jitter: 0 });
  });
  b.at(x + 0.9, 0.04, z - 0.6, -0.6, () => {
    b.box(0, 0, 0, 1.3, 0.05, 0.05, PAL.wood[3], { tex: 'wood', ao: false });
    b.box(0.7, 0, 0, 0.12, 0.05, 0.3, PAL.wood[3], { ao: false });
  });
  for (let i = 0; i < 3; i++) P_sheaf(b, x - 1.0 + i * 0.35, z + 0.9);
  col.addCircle(x - 0.3, z - 0.2, 0.7);
}

function P_sheaf(b: VoxelBuilder, x: number, z: number) {
  b.box(x, 0, z, 0.2, 0.42, 0.2, PAL.straw[2], { jitter: 0.06 });
  b.box(x, 0.42, z, 0.28, 0.12, 0.28, PAL.straw[3], { jitter: 0.06 });
  b.box(x, 0.18, z, 0.22, 0.04, 0.22, PAL.wood[1], { jitter: 0 });
}
