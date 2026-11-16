import type { VoxelBuilder } from '../voxel';
import type { Collision } from '../collision';
import { PAL } from '../palette';
import * as P from '../props';
import { hash2 } from '../../core/rng';
import { tintColor } from './common';

/**
 * 무대 세트 드레싱 도우미 (빌드 때만 실행 — step() 과 무관).
 * 놓은 자리를 기록해 두었다가 fillGaps 가 6x6 칸마다 비어 있는 곳에 군락을 채운다.
 */
export class Dressing {
  private pts: number[] = [];
  constructor(readonly vb: VoxelBuilder, readonly col: Collision, readonly seed: number) {}

  /** 이미 다른 것(건물·장막·손으로 놓은 소품)이 있는 자리를 알린다 */
  mark(x: number, z: number): void { this.pts.push(x, z); }

  private near(x0: number, z0: number, size: number): boolean {
    for (let i = 0; i < this.pts.length; i += 2) {
      if (this.pts[i] >= x0 && this.pts[i] < x0 + size && this.pts[i + 1] >= z0 && this.pts[i + 1] < z0 + size) return true;
    }
    return false;
  }

  /** 돌 화덕 + 재 + 둘러앉은 통나무 */
  fireRing(x: number, z: number, logs = 3, lit = true): void {
    const vb = this.vb;
    this.mark(x, z);
    vb.box(x, 0.0, z, 1.5, 0.03, 1.5, 0x2c241e, { jitter: 0.03 });
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + hash2(k, 1, this.seed) * 0.3;
      vb.box(x + Math.cos(a) * 0.7, 0, z + Math.sin(a) * 0.7, 0.3, 0.2 + hash2(k, 2, this.seed) * 0.1, 0.28, tintColor(0x8a8078, 0.8 + hash2(k, 3, this.seed) * 0.35), { tex: 'stone' });
    }
    vb.box(x, 0.02, z, 0.5, 0.12, 0.12, 0x3a2414, { tex: 'wood' });
    vb.box(x, 0.02, z, 0.12, 0.12, 0.5, 0x3a2414, { tex: 'wood' });
    if (lit) { vb.box(x, 0.1, z, 0.28, 0.12, 0.28, 0xff6a18); vb.box(x, 0.2, z, 0.14, 0.14, 0.14, 0xffc040); }
    for (let k = 0; k < logs; k++) {
      const a = k * (Math.PI * 2 / logs) + 0.6;
      const lx = x + Math.cos(a) * 1.5, lz = z + Math.sin(a) * 1.5;
      if (k % 2 === 0) vb.box(lx, 0, lz, 0.9, 0.28, 0.3, PAL.wood[2], { tex: 'wood' });
      else vb.box(lx, 0, lz, 0.3, 0.28, 0.9, PAL.wood[1], { tex: 'wood' });
    }
  }

  /** 가죽·천·말린 고기를 거는 건조대 (x 방향 길이 len) */
  dryingRack(x: number, z: number, len = 2.6, hang = 0xd8c8a0): void {
    const vb = this.vb;
    this.mark(x, z);
    vb.box(x - len / 2, 0, z, 0.12, 1.5, 0.12, PAL.wood[1], { tex: 'wood' });
    vb.box(x + len / 2, 0, z, 0.12, 1.5, 0.12, PAL.wood[1], { tex: 'wood' });
    vb.box(x, 1.4, z, len + 0.2, 0.1, 0.1, PAL.wood[2], { tex: 'wood' });
    vb.box(x, 0.8, z, len, 0.07, 0.07, PAL.wood[2], { tex: 'wood' });
    const n = Math.max(3, Math.round(len / 0.55));
    for (let k = 0; k < n; k++) {
      const hx = x - len / 2 + 0.35 + k * ((len - 0.7) / (n - 1));
      const c = k % 3 === 0 ? hang : k % 3 === 1 ? 0x9a5a38 : 0xb8a888;
      const h = 0.45 + hash2(k, 4, this.seed) * 0.35;
      vb.box(hx, 1.38 - h, z, 0.34, h, 0.05, tintColor(c, 0.9 + hash2(k, 5, this.seed) * 0.25), { tex: 'wool' });
    }
    for (let k = 0; k < 3; k++) vb.box(x - len * 0.3 + k * len * 0.3, 0.55, z, 0.16, 0.25, 0.05, 0x7a3a2a);
    vb.box(x, 0, z, len + 0.6, 0.02, 0.9, 0x6a5238, { jitter: 0.03 });
  }

  /** 작은 가축 우리: 울타리 + 건초 + 구유 */
  pen(x: number, z: number, w = 5, d = 4): void {
    const vb = this.vb, col = this.col;
    this.mark(x, z); this.mark(x + w / 2, z + d / 2);
    P.fence(vb, col, x, z, x + w, z);
    P.fence(vb, col, x, z + d, x + w, z + d);
    P.fence(vb, col, x, z, x, z + d);
    P.fence(vb, col, x + w, z, x + w, z + d, [[d * 0.35, d * 0.7]]);
    vb.box(x + w / 2, 0, z + d / 2, w - 0.6, 0.03, d - 0.6, 0x7a6038, { jitter: 0.04 });
    P.hay(vb, col, x + 0.9, z + 0.9, 0.2);
    P.trough(vb, col, x + w - 1.2, z + d - 0.9, 0);
  }

  /** 보급품 더미: 자루·상자·항아리·바구니 */
  supplyPile(x: number, z: number, n = 5): void {
    const vb = this.vb;
    this.mark(x, z);
    for (let k = 0; k < n; k++) {
      const px = x + (hash2(k, 6, this.seed + Math.round(x * 7)) - 0.5) * 2.2;
      const pz = z + (hash2(k, 7, this.seed + Math.round(z * 7)) - 0.5) * 1.6;
      const t = k % 4;
      if (t === 0) P.sack(vb, px, pz, k * 0.7);
      else if (t === 1) P.crate(vb, px, 0, pz, k * 0.4, 0.5);
      else if (t === 2) P.pot(vb, px, pz, 0.9 + hash2(k, 8, this.seed) * 0.4, k % 2 ? PAL.clay[2] : PAL.clay[1]);
      else P.basket(vb, px, 0, pz, 0xc8a050);
    }
    vb.box(x, 0, z, 2.6, 0.03, 2.0, 0x6a5238, { jitter: 0.03 });
  }

  /** 바위 군락: 큰 돌 + 작은 돌 + 풀 */
  rocks(x: number, z: number, n: number, tone = 0x8a8278, block = false): void {
    const vb = this.vb;
    this.mark(x, z);
    for (let k = 0; k < n; k++) {
      const rx = x + (hash2(k, 9, this.seed + Math.round(x * 5)) - 0.5) * 2.4;
      const rz = z + (hash2(k, 10, this.seed + Math.round(z * 5)) - 0.5) * 2.0;
      const s = (k === 0 ? 1.2 : 0.4) + hash2(k, 11, this.seed) * 0.5;
      const hh = s * (0.5 + hash2(k, 12, this.seed) * 0.3);
      vb.box(rx, 0, rz, s, hh * 0.6, s * 0.85, tintColor(tone, 1.4 + hash2(k, 13, this.seed) * 0.2), { tex: 'stone', jitter: 0.05 });
      vb.box(rx + 0.04, hh * 0.6, rz, s * 0.7, hh * 0.4, s * 0.6, tintColor(tone, 1.75 + hash2(k, 14, this.seed) * 0.15), { tex: 'stone', jitter: 0.05 });
      if (block && k === 0) this.col.addBox(rx, rz, s, s);
    }
  }

  /** 관목 군락: 크기가 다른 덤불 여러 개 */
  shrubs(x: number, z: number, n: number, colors: ReadonlyArray<number>): void {
    const vb = this.vb;
    this.mark(x, z);
    for (let k = 0; k < n; k++) {
      const bx = x + (hash2(k, 15, this.seed + Math.round(x * 3)) - 0.5) * 2.6;
      const bz = z + (hash2(k, 16, this.seed + Math.round(z * 3)) - 0.5) * 2.2;
      const base = colors[k % colors.length];
      const s = 0.5 + hash2(k, 17, this.seed) * 0.5;
      vb.box(bx, 0, bz, s, s * 0.6, s * 0.9, tintColor(base, 0.7), { jitter: 0.05 });
      vb.box(bx + 0.05, s * 0.45, bz, s * 0.7, s * 0.45, s * 0.65, tintColor(base, 0.95), { jitter: 0.05 });
      if (k % 2 === 0) vb.box(bx, s * 0.8, bz, s * 0.35, s * 0.25, s * 0.35, tintColor(base, 1.2, 0.04), { jitter: 0.05 });
    }
  }

  /** 짚·잔가지 널린 작업 자리 (베틀 터/장작 패는 자리) */
  workSpot(x: number, z: number): void {
    const vb = this.vb;
    this.mark(x, z);
    vb.box(x, 0.0, z, 0.6, 0.35, 0.6, PAL.wood[2], { tex: 'wood' });
    vb.box(x, 0.35, z, 0.18, 0.5, 0.06, 0x6a6a70, { tex: 'metal' });
    for (let k = 0; k < 6; k++) vb.box(x + (hash2(k, 18, this.seed) - 0.5) * 1.8, 0, z + (hash2(k, 19, this.seed) - 0.5) * 1.8, 0.5, 0.06, 0.07, tintColor(0x9a7a48, 0.8 + hash2(k, 20, this.seed) * 0.4));
    vb.box(x, 0, z, 2.2, 0.02, 2.2, 0x6a5238, { jitter: 0.03 });
  }

  /**
   * 지정한 범위를 6x6 칸으로 나눠, 아무것도 없는 칸마다 군락(바위/관목/보급품/작업 자리)을 하나 놓는다.
   * skip 이 true 인 칸(건물·물·절벽)은 건너뛴다.
   */
  fillGaps(minX: number, maxX: number, minZ: number, maxZ: number, shrubCols: ReadonlyArray<number>, rockTone: number, skip?: (x: number, z: number) => boolean): void {
    let n = 0;
    for (let z0 = minZ; z0 < maxZ; z0 += 6) {
      for (let x0 = minX; x0 < maxX; x0 += 6) {
        if (this.near(x0, z0, 6)) continue;
        const cx = x0 + 1.2 + hash2(Math.round(x0), Math.round(z0), this.seed + 5) * 3.6;
        const cz = z0 + 1.2 + hash2(Math.round(z0), Math.round(x0), this.seed + 6) * 3.6;
        if ((skip && skip(cx, cz)) || this.col.blocked(cx, cz, 1.2)) { this.mark(x0 + 3, z0 + 3); continue; }
        const t = n++ % 5;
        if (t === 0) this.rocks(cx, cz, 4, rockTone);
        else if (t === 1) this.shrubs(cx, cz, 4, shrubCols);
        else if (t === 2) this.supplyPile(cx, cz, 4);
        else if (t === 3) { this.rocks(cx, cz, 3, rockTone); this.shrubs(cx + 1.6, cz + 1.2, 2, shrubCols); }
        else this.workSpot(cx, cz);
      }
    }
  }
}

/** 점 (x,z) 에서 꺾은선 pts[x0,z0,x1,z1,...] 까지의 최단거리 (지면 길 칠하기용, 빌드 때만) */
export function distToPolyline(x: number, z: number, pts: ReadonlyArray<number>): number {
  let best = 1e9;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i], az = pts[i + 1], bx = pts[i + 2], bz = pts[i + 3];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}
