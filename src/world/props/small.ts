// 작은 소품·자연물 조각: 항아리, 바구니, 자루, 상자, 바위, 풀숲, 꽃
import { PAL } from '../palette';
import type { VoxelBuilder } from '../voxel';
import type { Collision } from '../collision';
import { T, WHITE, DARK } from './common';

export function pot(b: VoxelBuilder, x: number, z: number, size = 1, color: number = PAL.clay[2]) {
  const k = size;
  b.at(x, 0, z, b.rng.range(0, Math.PI), () => {
    b.box(0, 0, 0, 0.19 * k, 0.06, 0.19 * k, color, { tex: 'plain' });
    b.box(0, 0.06, 0, 0.31 * k, 0.19 * k, 0.31 * k, color, { tex: 'plain' });
    b.box(0, 0.06 + 0.19 * k, 0, 0.36 * k, 0.12 * k, 0.36 * k, color, { tex: 'plain' });
    b.box(0, 0.06 + 0.31 * k, 0, 0.25 * k, 0.07 * k, 0.25 * k, color, { tex: 'plain' });
    b.box(0, 0.06 + 0.38 * k, 0, 0.14 * k, 0.1 * k, 0.14 * k, color, { tex: 'plain' });
    b.box(0, 0.06 + 0.48 * k, 0, 0.21 * k, 0.05, 0.21 * k, PAL.clay[3], { tex: 'plain' });
    // 목 둘레 띠 무늬
    b.box(0, 0.06 + 0.24 * k, 0, 0.37 * k, 0.03, 0.37 * k, PAL.clay[0], { tex: 'plain', jitter: 0 });
  });
}

export function basket(b: VoxelBuilder, x: number, y: number, z: number, fill: number | null, w = 0.375, d = 0.3125) {
  b.box(x, y, z, w, 0.19, d, WHITE, { tex: 'reed', ao: y < 0.1 });
  b.box(x, y + 0.19, z, w + T, 0.05, d + T, PAL.straw[1], { tex: 'reed', ao: false });
  if (fill !== null) {
    // 과일을 한 알씩 소복하게
    for (let i = 0; i < 7; i++) {
      const fx = x + b.rng.range(-w / 2 + 0.06, w / 2 - 0.06);
      const fz = z + b.rng.range(-d / 2 + 0.06, d / 2 - 0.06);
      b.box(fx, y + 0.19 + b.rng.range(0, 0.05), fz, 0.1, 0.1, 0.1, fill, { jitter: 0.12, ao: false });
    }
  } else {
    b.box(x, y + 0.17, z, w - 2 * T, 0.03, d - 2 * T, DARK, { ao: false, jitter: 0 });
  }
}

export function sack(b: VoxelBuilder, x: number, z: number, ry = 0) {
  b.at(x, 0, z, ry, () => {
    b.box(0, 0, 0, 0.34, 0.36, 0.3, WHITE, { tex: 'fabricCream' });
    b.box(0, 0.36, 0, 0.22, 0.06, 0.2, WHITE, { tex: 'fabricCream' });
    b.box(0, 0.42, 0, 0.1, 0.03, 0.1, PAL.wood[1]);
    b.box(0, 0.44, 0, 0.16, 0.06, 0.14, WHITE, { tex: 'fabricCream' });
  });
}

export function crate(b: VoxelBuilder, x: number, y: number, z: number, ry = 0, s = 0.5) {
  b.at(x, y, z, ry, () => {
    b.box(0, 0, 0, s, s, s, PAL.wood[3], { tex: 'wood' });
    // 모서리 각재
    for (const cx of [-1, 1]) for (const cz of [-1, 1])
      b.box(cx * (s / 2 - 0.03), 0, cz * (s / 2 - 0.03), 0.07, s + 0.01, 0.07, PAL.wood[1], { tex: 'wood' });
    b.box(0, s * 0.45, 0, s + 0.02, 0.06, s + 0.02, PAL.wood[2], { tex: 'wood' });
  });
}

export function rock(b: VoxelBuilder, col: Collision | null, x: number, z: number, size: number) {
  const r = b.rng;
  b.at(x, 0, z, r.range(0, Math.PI * 2), () => {
    const c = r.pick([PAL.stone[2], PAL.stone[3], PAL.stone[2]]);
    b.box(0, 0, 0, size, size * 0.62, size * 0.85, c, { tex: 'plain', jitter: 0.08 });
    b.box(size * 0.08, size * 0.62, 0, size * 0.7, size * 0.18, size * 0.6, c, { tex: 'plain', jitter: 0.08 });
    if (size > 0.35) {
      b.box(size * 0.55, 0, size * 0.25, size * 0.45, size * 0.35, size * 0.45, PAL.stone[1], { tex: 'plain', jitter: 0.08 });
      if (r.chance(0.5)) b.box(-size * 0.1, size * 0.8, -size * 0.05, size * 0.4, T, size * 0.35, PAL.grass[2], { jitter: 0.1 });
    }
  });
  if (col && size > 0.5) col.addCircle(x, z, size * 0.5);
}

export function tuft(b: VoxelBuilder, x: number, z: number, dry = false) {
  const r = b.rng;
  const pal = dry ? PAL.dryGrass : PAL.grass;
  const n = r.int(3, 5);
  for (let i = 0; i < n; i++) {
    const h = r.range(0.1, 0.28);
    b.box(x + r.range(-0.1, 0.1), 0, z + r.range(-0.06, 0.06), T, h, T,
      dry ? pal[r.int(0, 2)] : pal[r.int(2, 5)], { jitter: 0.06, ao: false });
  }
}

export function flower(b: VoxelBuilder, x: number, z: number, color: number) {
  const r = b.rng;
  const n = r.int(1, 3);
  for (let i = 0; i < n; i++) {
    const fx = x + r.range(-0.15, 0.15), fz = z + r.range(-0.1, 0.1), h = r.range(0.12, 0.26);
    b.box(fx, 0, fz, T, h, T, PAL.grass[2], { ao: false });
    b.box(fx, h, fz, 0.125, 0.0625, 0.125, color, { ao: false, jitter: 0.05 });
    b.box(fx, h + 0.0625, fz, T, T, T, PAL.flower[1], { ao: false, jitter: 0 });
  }
  b.box(x, 0, z + 0.04, 0.2, T, 0.12, PAL.grass[1], { ao: false });
}
