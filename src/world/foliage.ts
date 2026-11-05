import { valueNoise, hash2 } from '../core/rng';
import { PAL } from './palette';
import type { VoxelBuilder } from './voxel';
import type { Collision } from './collision';
import { addSpot } from '../systems/interaction';

const T = 1 / 16;
const WHITE = 0xffffff;

/**
 * 복셀 캐노피: 타원체 여러 개를 격자 셀로 채운 뒤, 겉으로 드러난 셀만 박스로 낸다.
 * 셀 색은 높이(위가 밝음) + 햇빛 방향 + 약간의 난수로 팔레트에서 골라
 * 텍스처 없이도 스타듀풍 잎 덩어리 음영이 나오게 한다.
 */
export class Canopy {
  private cells = new Map<string, [number, number, number]>();
  private minY = Infinity;
  private maxY = -Infinity;
  constructor(private readonly b: VoxelBuilder, readonly cell: number, private readonly seed: number) {}

  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, rough = 0.35) {
    const c = this.cell;
    for (let iy = Math.floor((cy - ry) / c); iy <= Math.ceil((cy + ry) / c); iy++)
      for (let iz = Math.floor((cz - rz) / c); iz <= Math.ceil((cz + rz) / c); iz++)
        for (let ix = Math.floor((cx - rx) / c); ix <= Math.ceil((cx + rx) / c); ix++) {
          const x = (ix + 0.5) * c, y = (iy + 0.5) * c, z = (iz + 0.5) * c;
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          const n = valueNoise(ix * 0.9 + this.seed, iz * 0.9 + iy * 1.7, 3) - 0.5;
          if (d > 1 + n * rough) continue;
          this.cells.set(`${ix},${iy},${iz}`, [ix, iy, iz]);
          this.minY = Math.min(this.minY, y);
          this.maxY = Math.max(this.maxY, y);
        }
  }

  emit(pal: readonly number[], opts: { holes?: number; fruit?: number | null; fruitRate?: number } = {}) {
    const { b, cell: c } = this;
    const has = (x: number, y: number, z: number) => this.cells.has(`${x},${y},${z}`);
    let sx = 0, sz = 0, n = 0;
    for (const [ix, , iz] of this.cells.values()) { sx += ix; sz += iz; n++; }
    const mx = sx / n, mz = sz / n;
    const hy = Math.max(0.001, this.maxY - this.minY);
    const spreadX = 0.9 + hash2(this.seed, 1, 619) * 0.22;
    const spreadZ = 0.9 + hash2(this.seed, 2, 619) * 0.22;
    const leanX = (hash2(this.seed, 3, 619) - 0.5) * 0.3;
    for (const [ix, iy, iz] of this.cells.values()) {
      const exposed = !has(ix + 1, iy, iz) || !has(ix - 1, iy, iz) || !has(ix, iy + 1, iz)
        || !has(ix, iy - 1, iz) || !has(ix, iy, iz + 1) || !has(ix, iy, iz - 1);
      if (!exposed) continue;
      // 겉 셀 일부를 비워 성긴 잎 느낌 (위쪽 면은 덜 비움)
      if (opts.holes && has(ix, iy + 1, iz) && b.rng.chance(opts.holes)) continue;
      const y = (iy + 0.5) * c;
      const h = (y - this.minY) / hy;
      const ox = ix - mx, oz = iz - mz;
      const ol = Math.hypot(ox, oz) || 1;
      const sun = (-ox * 0.6 + oz * 0.45) / ol; // 해는 왼쪽 앞 위
      const t = 0.05 + h * 0.75 + sun * 0.16 + (b.rng.next() - 0.5) * 0.12;
      const idx = Math.max(0, Math.min(pal.length - 1, Math.floor(t * pal.length)));
      const px = (mx + 0.5 + ox * spreadX) * c + h * leanX;
      const pz = (mz + 0.5 + oz * spreadZ) * c;
      b.box(px, iy * c, pz, c * spreadX, c, c * spreadZ, pal[idx], { tex: 'canopy', jitter: 0.02, ao: false });
      if (opts.fruit != null && b.rng.chance(opts.fruitRate ?? 0.04)) {
        b.box(px + (b.rng.next() - 0.5) * c * 0.4, iy * c - 0.02, pz + c * spreadZ / 2 + 0.01,
          0.1, 0.1, 0.05, opts.fruit, { ao: false, jitter: 0.08 });
      }
    }
    this.cells.clear();
  }
}

/** 굽은 줄기: 점점 가늘어지며 방향을 틀어 올라감. 끝 위치를 돌려줌 */
function trunk(b: VoxelBuilder, segs: number, w0: number, w1: number, segH: number, drift: number, tint = WHITE): [number, number, number] {
  let x = 0, z = 0, y = 0;
  const r = b.rng;
  for (let i = 0; i < segs; i++) {
    const t = i / Math.max(1, segs - 1);
    const w = w0 + (w1 - w0) * t;
    b.box(x, y, z, w, segH + 0.02, w * r.range(0.85, 1), tint, { tex: 'bark', ao: i === 0 });
    x += r.range(-drift, drift);
    z += r.range(-drift, drift);
    y += segH;
  }
  return [x, y, z];
}

export function oliveTree(b: VoxelBuilder, col: Collision | null, x: number, z: number, gy = 0) {
  const r = b.rng;
  b.groundY = gy;
  const tint = 0xc8bca8;
  b.at(x, gy, z, r.range(0, Math.PI * 2), () => {
    // 굵은 밑동이 두 줄기로 꼬이며 갈라짐 (올리브 특유의 뒤틀린 줄기)
    b.box(0, 0, 0, 0.62, 0.22, 0.54, tint, { tex: 'bark' });
    b.box(0.12, 0.1, 0.12, 0.3, 0.16, 0.26, tint, { tex: 'bark' }); // 드러난 뿌리
    const stems: [number, number, number][] = [];
    for (const s of [-1, 1]) {
      let sx = s * 0.1, sz = 0, sy = 0.2;
      for (let i = 0; i < 4; i++) {
        b.box(sx, sy, sz, 0.24 - i * 0.02, 0.3, 0.22 - i * 0.02, tint, { tex: 'bark', ao: i === 0 });
        sx += s * r.range(0.03, 0.09); sz += r.range(-0.07, 0.07); sy += 0.28;
      }
      stems.push([sx, sy, sz]);
    }
    // 가지 끝마다 작은 잎 뭉치 → 사이사이 틈이 보이는 성긴 수관
    const cn = new Canopy(b, 0.1875, r.int(0, 999));
    const nb = r.int(4, 5);
    for (let i = 0; i < nb; i++) {
      const [sx, sy, sz] = stems[i % 2];
      const a = (i / nb) * Math.PI * 2 + r.range(-0.3, 0.3);
      const len = r.range(0.6, 0.95);
      const tilt = r.range(0.7, 1.0);
      const ex = sx + Math.cos(a) * Math.sin(tilt) * len;
      const ez = sz + Math.sin(a) * Math.sin(tilt) * len;
      const ey = sy + Math.cos(tilt) * len;
      b.at(sx, sy - 0.05, sz, -a, () => b.box(0, 0, 0, 0.13, len, 0.13, tint, { tex: 'bark', ao: false }), 0, -tilt);
      cn.ellipsoid(ex, ey + 0.15, ez, r.range(0.48, 0.62), r.range(0.3, 0.38), r.range(0.45, 0.58), 0.5);
      if (r.chance(0.6))
        cn.ellipsoid(ex * 0.6, ey + 0.45, ez * 0.6, 0.36, 0.26, 0.36, 0.5);
    }
    cn.ellipsoid(0, stems[0][1] + 0.7, 0, 0.5, 0.3, 0.45, 0.5);
    cn.emit(PAL.olive, { holes: 0.22, fruit: PAL.produce.olive, fruitRate: 0.05 });
  });
  b.groundY = 0;
  if (col) { col.addCircle(x, z, 0.34); addSpot('olive', x, z, 2.4); }
}

export function figTree(b: VoxelBuilder, col: Collision | null, x: number, z: number, gy = 0) {
  const r = b.rng;
  b.groundY = gy;
  b.at(x, gy, z, r.range(0, Math.PI * 2), () => {
    // 매끈한 회색 줄기가 낮게 여러 갈래
    const tint = 0xe0d8d0;
    b.box(0, 0, 0, 0.44, 0.7, 0.42, tint, { tex: 'bark' });
    for (const [a, ry] of [[-0.6, 0], [0.55, 0.5], [0.5, 2.1]] as const)
      b.at(0, 0.6, 0, ry, () => b.box(0, 0, 0, 0.19, 0.8, 0.19, tint, { tex: 'bark', ao: false }), 0, a);
    const cn = new Canopy(b, 0.25, r.int(0, 999));
    cn.ellipsoid(0, 1.75, 0, 1.35, 0.75, 1.2, 0.3);
    cn.ellipsoid(-0.6, 2.2, 0.2, 0.8, 0.55, 0.75);
    cn.ellipsoid(0.55, 2.3, -0.25, 0.8, 0.5, 0.8);
    cn.ellipsoid(r.range(-0.8, 0.8), 1.4, r.range(-0.6, 0.6), 0.7, 0.4, 0.7);
    cn.emit(PAL.fig, { holes: 0.06, fruit: PAL.produce.fig, fruitRate: 0.06 });
    // 넓은 무화과 잎이 가장자리에서 삐져나옴
    for (let i = 0; i < 7; i++) {
      const a = r.range(0, Math.PI * 2);
      b.at(Math.cos(a) * 1.3, r.range(1.35, 2.2), Math.sin(a) * 1.15, a, () =>
        b.box(0, 0, 0, 0.31, T, 0.25, PAL.fig[4], { ao: false, jitter: 0.08 }), 0, 0.3);
    }
  });
  b.groundY = 0;
  if (col) { col.addCircle(x, z, 0.35); addSpot('fig', x, z, 2.4); }
}

export function palmTree(b: VoxelBuilder, col: Collision | null, x: number, z: number, gy = 0) {
  const r = b.rng;
  b.groundY = gy;
  const lean = r.range(0.35, 0.7), la = r.range(0, Math.PI * 2);
  const lx = Math.cos(la), lz = Math.sin(la);
  const segs = r.int(11, 13);
  let cx = 0, cz = 0, cy = 0;
  const tint = 0xd8c4a4;
  b.at(x, gy, z, 0, () => {
    // 부푼 밑동
    b.box(0, 0, 0, 0.46, 0.25, 0.46, tint, { tex: 'bark' });
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      cx = lx * lean * t * t; cz = lz * lean * t * t;
      const w = 0.32 - t * 0.05;
      b.box(cx, cy, cz, w, 0.34, w, tint, { tex: 'bark', ao: i < 2, jitter: 0.03 });
      // 마디 턱: 살짝 더 넓고 어두운 고리
      b.box(cx, cy + 0.28, cz, w + 0.05, 0.06, w + 0.05, 0xa89070, { tex: 'bark', ao: false, jitter: 0.03 });
      cy += 0.34;
    }
    // 수관 중심과 대추 송이
    b.box(cx, cy - 0.2, cz, 0.26, 0.26, 0.26, PAL.palm[0], { ao: false });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      for (let k = 0; k < 6; k++)
        b.box(cx + Math.cos(a) * 0.26 + r.range(-0.07, 0.07), cy - 0.42 - r.range(0, 0.25), cz + Math.sin(a) * 0.26 + r.range(-0.07, 0.07),
          0.09, 0.09, 0.09, r.pick([PAL.produce.date, PAL.fabric.ochre, PAL.produce.date]), { ao: false, jitter: 0.08 });
    }
    // 잎: 중심 잎맥에서 양옆으로 가는 잎조각이 빗살처럼 처짐. 끝으로 갈수록 좁고 밝게
    const fronds = 11;
    for (let f = 0; f < fronds; f++) {
      const a = (f / fronds) * Math.PI * 2 + r.range(-0.18, 0.18);
      // 위로 솟는 잎 / 옆으로 뻗는 잎을 섞고, 끝만 살짝 휘게 (처지지 않게)
      const rise = f % 3 === 0 ? 0.2 : f % 3 === 1 ? 0.1 : 0.03;
      b.at(cx, cy + 0.05, cz, a, () => {
        const n = 5;
        for (let k = 0; k < n; k++) {
          const step = 0.285; // 잎 끝 반경 ≈ 0.16 + 4 × step = 1.3
          const dist = 0.16 + k * step;
          const y = k * rise - k * k * 0.022;
          const slope = rise - (2 * k + 1) * 0.022;
          // 밑동이 가장 넓고 끝으로 갈수록 뾰족하게
          const len = 0.46 - k * 0.085;
          const rib = 0.07 - k * 0.008;
          const col = PAL.palm[Math.min(3, Math.floor((k + (f % 2)) / 1.5))];
          b.at(dist, y, 0, 0, () => {
            b.box(0, 0, 0, 0.31, 0.05, rib, PAL.palm[0], { tex: 'canopy', ao: false, jitter: 0 });
            for (const s of [-1, 1])
              for (const off of [-0.06, 0.06]) {
                b.at(off, -0.01, s * 0.03, s * 0.3, () =>
                  b.box(0, 0, s * len / 2, 0.07, 0.04, len, col, { tex: 'canopy', ao: false, jitter: 0.06 }), s * 0.3);
              }
          }, 0, Math.atan(slope / step));
        }
      });
    }
    // 수관 아래 마른 잎 두어 장 (갈색으로 축 늘어짐)
    for (let f = 0; f < 2; f++) {
      b.at(cx, cy - 0.1, cz, r.range(0, Math.PI * 2), () => {
        for (let k = 0; k < 3; k++)
          b.at(0.18 + k * 0.1, -0.2 - k * 0.3, 0, 0, () => b.box(0, 0, 0, 0.1, 0.34, 0.26, PAL.bark[2 + (k % 2)], { ao: false, jitter: 0.05 }), 0, -0.3);
      });
    }
  });
  b.groundY = 0;
  if (col) { col.addCircle(x, z, 0.28); addSpot('palm', x, z, 1.6); }
}

export function bush(b: VoxelBuilder, col: Collision | null, x: number, z: number, size = 0.7,
  pal: readonly number[] = PAL.shrub, berries: number | null = null) {
  const r = b.rng;
  b.at(x, 0, z, r.range(0, Math.PI), () => {
    const cn = new Canopy(b, 0.1875, r.int(0, 999));
    cn.ellipsoid(0, size * 0.4, 0, size * 0.62, size * 0.45, size * 0.55, 0.4);
    cn.ellipsoid(size * 0.3, size * 0.3, size * 0.1, size * 0.4, size * 0.35, size * 0.4, 0.4);
    cn.emit(pal, { holes: 0.04, fruit: berries, fruitRate: 0.12 });
  });
  if (col && size > 0.6) col.addCircle(x, z, size * 0.45);
}
