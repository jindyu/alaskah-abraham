import * as THREE from 'three';
import { Rng, fbm, hash2, valueNoise } from '../core/rng';
import { PAL } from './palette';

/** 월드 1유닛당 텍셀 수. 모든 텍스처가 같은 밀도로 붙어서 픽셀 크기가 통일됨 */
export const TD = 16;

type RGB = [number, number, number];
const rgb = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const shade = (c: number, k: number): RGB => {
  const [r, g, b] = rgb(c);
  return [Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k)];
};

export class Px {
  readonly data: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, c: number | RGB) {
    x = ((x % this.w) + this.w) % this.w;
    y = ((y % this.h) + this.h) % this.h;
    const [r, g, b] = typeof c === 'number' ? rgb(c) : c;
    const i = (y * this.w + x) * 4;
    this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
  }
  get(x: number, y: number): RGB {
    x = ((x % this.w) + this.w) % this.w;
    y = ((y % this.h) + this.h) % this.h;
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }
  fill(fn: (x: number, y: number) => number | RGB) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, fn(x, y));
  }
  toTexture(): THREE.DataTexture {
    // DataTexture는 v=0이 첫 행이므로 캔버스처럼 위→아래로 읽히게 행을 뒤집어 넣음
    const flipped = new Uint8Array(this.data.length);
    const row = this.w * 4;
    for (let y = 0; y < this.h; y++) flipped.set(this.data.subarray(y * row, y * row + row), (this.h - 1 - y) * row);
    const t = new THREE.DataTexture(flipped, this.w, this.h, THREE.RGBAFormat);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }
}

/** 팔레트 배열에서 노이즈 값(0~1)으로 색 고르기, 서열 디더링 포함 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function ditherPick(pal: readonly number[], t: number, x: number, y: number, amount = 0.6): number {
  const d = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * amount / pal.length;
  const i = Math.floor(Math.max(0, Math.min(0.999, t + d)) * pal.length);
  return pal[i];
}

// ───────────── 개별 텍스처 생성기 ─────────────

function plain(): Px {
  const p = new Px(32, 32);
  p.fill((x, y) => {
    const v = 0.9 + valueNoise(x / 5, y / 5, 3) * 0.07 + hash2(x, y, 9) * 0.03;
    return [255 * v, 255 * v, 255 * v];
  });
  return p;
}

function plaster(): Px {
  const p = new Px(32, 32);
  const pal = PAL.plaster;
  p.fill((x, y) => {
    const n = fbm(x / 7, y / 7, 11, 3);
    let c = ditherPick([pal[1], pal[2], pal[2], pal[3]], n, x, y);
    if (hash2(x, y, 5) < 0.035) c = pal[0];
    return c;
  });
  // 가는 균열 몇 줄
  const r = new Rng(41);
  for (let k = 0; k < 3; k++) {
    let x = r.int(0, 31), y = r.int(0, 31);
    for (let s = 0; s < 7; s++) {
      p.set(x, y, pal[0]);
      y += 1;
      x += r.int(-1, 1);
    }
  }
  // 드러난 벽돌 조각
  for (let k = 0; k < 2; k++) {
    const bx = r.int(0, 24), by = r.int(0, 24);
    for (let yy = 0; yy < 4; yy++)
      for (let xx = 0; xx < 7; xx++) {
        const edge = yy === 3 || xx === 6;
        p.set(bx + xx, by + yy, edge ? PAL.brick[0] : yy === 0 ? PAL.brick[3] : PAL.brick[2]);
      }
  }
  return p;
}

function brick(): Px {
  const p = new Px(32, 32);
  const pal = PAL.brick;
  const r = new Rng(7);
  const brickCol: number[] = [];
  for (let i = 0; i < 64; i++) brickCol.push(r.pick([pal[1], pal[2], pal[2], pal[3]]));
  p.fill((x, y) => {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 4 : 0;
    const col = Math.floor((x + off) / 8) % 4;
    const ly = y % 4, lx = (x + off) % 8;
    if (ly === 3 || lx === 7) return pal[0];
    const base = brickCol[row * 4 + col];
    if (ly === 0) return shade(base, 1.08);
    if (hash2(x, y, 3) < 0.07) return shade(base, 0.86);
    return base;
  });
  return p;
}

function wood(): Px {
  const p = new Px(32, 32);
  const pal = PAL.wood;
  p.fill((x, y) => {
    // 네 판재가 정확히 반복되며, 결은 옹이 주위에서 휘어진다.
    const plank = Math.floor(x / 8), lx = x % 8;
    const ky = [7, 23, 13, 28][plank];
    const dy = Math.min(Math.abs(y - ky), 32 - Math.abs(y - ky));
    const knot = Math.hypot((lx - 3.5) * 1.5, dy * 0.55);
    if (lx === 7) return pal[0];
    if (lx === 0) return shade(pal[3], 1.06);
    if ((y + plank * 9) % 32 === 0) return pal[1];
    if (knot < 1.1) return pal[0];
    const grain = Math.sin(lx * 2.7 + Math.sin(y * Math.PI / 16) * 0.7 + Math.exp(-dy * 0.25) * 2);
    const base = plank % 2 ? pal[3] : pal[2];
    return shade(base, 0.94 + grain * 0.07 + hash2(x, y, 13) * 0.06);
  });
  return p;
}

/** 우물 아래쪽의 습기와 이끼. 돌의 줄눈은 원래 텍스처와 맞춘다. */
function wetStone(): Px {
  const p = stone();
  p.fill((x, y) => {
    const c = p.get(x, y);
    const moss = fbm(x / 6, y / 6, 317, 2) > 0.55;
    return [c[0] * (moss ? 0.59 : 0.72), c[1] * (moss ? 0.76 : 0.77), c[2] * 0.69];
  });
  return p;
}

function reed(): Px {
  const p = new Px(32, 32);
  const pal = PAL.straw;
  p.fill((x, y) => {
    const lane = Math.floor(y / 2);
    const n = valueNoise(x / 6 + lane * 3.1, lane, 5);
    if (y % 2 === 1 && hash2(x, lane, 2) < 0.5) return pal[0];
    return ditherPick([pal[1], pal[2], pal[2], pal[3]], n, x, y);
  });
  return p;
}

function mudRoof(): Px {
  // 다진 흙지붕: 회갈색 얼룩 + 잔금 + 박힌 짚. 벽(회반죽)보다 어둡고 회색빛이라 구분됨
  const p = new Px(64, 64);
  const pal = [0x9c7c5a, 0xae8d66, 0xbd9c72, 0xc9aa80, 0xd4b88e];
  p.fill((x, y) => {
    const n = fbm(x / 9, y / 9, 31, 3) * 0.75 + hash2(x, y, 32) * 0.25;
    let c = ditherPick(pal, n, x, y, 0.9);
    const h = hash2(x, y, 8);
    if (h < 0.025) c = PAL.straw[2];
    else if (hash2(x - 1, y, 8) < 0.025) c = PAL.straw[1];
    if (hash2(x, y, 12) < 0.02) c = pal[0];
    return c;
  });
  const r = new Rng(35);
  for (let k = 0; k < 5; k++) {
    let x = r.int(0, 63), y = r.int(0, 63);
    for (let s2 = 0; s2 < 6; s2++) { p.set(x, y, 0x8a6c4e); x += r.int(0, 1); y += r.int(-1, 1); }
  }
  return p;
}

/** 격자 지터 보로노이: 반환값 [가장 가까운 셀 id, 경계까지 거리] */
function voronoi(x: number, y: number, cell: number, seed: number, wrap: number): [number, number] {
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  let d1 = 1e9, d2 = 1e9, id = 0;
  const n = wrap / cell;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j;
      const wx = ((gx % n) + n) % n, wy = ((gy % n) + n) % n;
      const px = (gx + 0.15 + hash2(wx, wy, seed) * 0.7) * cell;
      const py = (gy + 0.15 + hash2(wx, wy, seed + 1) * 0.7) * cell;
      const d = Math.hypot(px - x, py - y);
      if (d < d1) { d2 = d1; d1 = d; id = wy * 97 + wx; } else if (d < d2) d2 = d;
    }
  return [id, (d2 - d1) / 2];
}

function stone(): Px {
  const p = new Px(32, 32);
  const pal = PAL.stone;
  p.fill((x, y) => {
    const [id, edge] = voronoi(x, y, 8, 51, 32);
    if (edge < 0.9) return pal[0];
    const base = [pal[1], pal[2], pal[3], pal[2]][id % 4];
    // 경계 바로 안쪽: 위쪽은 밝게, 아래쪽은 어둡게 → 돌이 도드라져 보임
    const [, eUp] = voronoi(x, y - 1, 8, 51, 32);
    if (edge < 1.8 && eUp < 0.9) return shade(base, 1.12);
    const [, eDn] = voronoi(x, y + 1, 8, 51, 32);
    if (edge < 1.8 && eDn < 0.9) return shade(base, 0.82);
    if (hash2(x, y, 4) < 0.05) return pal[1];
    return base;
  });
  return p;
}

function leaf(pal: readonly number[], seed: number): Px {
  const p = new Px(32, 32);
  p.fill((x, y) => {
    const n = fbm(x / 4, y / 4, seed, 2) * 0.75 + hash2(x, y, seed) * 0.25;
    return ditherPick(pal, n, x, y, 0.8);
  });
  // 잎 하이라이트 조각 (2x1 밝은 픽셀 + 아래 그림자)
  const r = new Rng(seed);
  for (let k = 0; k < 26; k++) {
    const x = r.int(0, 31), y = r.int(0, 31);
    p.set(x, y, pal[pal.length - 1]);
    p.set(x + 1, y, pal[pal.length - 1]);
    p.set(x, y + 1, pal[0]);
  }
  return p;
}

function bark(): Px {
  const p = new Px(32, 32);
  const pal = PAL.bark;
  p.fill((x, y) => {
    const n = valueNoise(x * 1.3, y / 7, 61);
    if (n > 0.78) return pal[0];
    if (n < 0.2) return pal[3];
    return n > 0.5 ? pal[1] : pal[2];
  });
  return p;
}

function wool(): Px {
  const p = new Px(16, 16);
  const pal = PAL.wool;
  p.fill((x, y) => {
    const ox = Math.floor(y / 4) % 2 ? 2 : 0;
    const lx = (x + ox) % 4, ly = y % 4;
    if (lx === 3 && ly === 3) return pal[0];
    if (lx === 3 || ly === 3) return pal[1];
    if (lx === 0 && ly === 0) return pal[3];
    return pal[2];
  });
  return p;
}

function stripes(a: number, b: number, w: number, hem: number): Px {
  const p = new Px(32, 32);
  p.fill((x, y) => {
    const band = Math.floor(x / w) % 2;
    let c = band ? b : a;
    const weave = (x + y) % 2 === 0 && hash2(x, y, 3) < 0.35;
    if (y % 16 === 15) c = hem;
    return weave ? shade(c, 0.92) : c;
  });
  return p;
}

function weave(a: number): Px {
  const p = new Px(16, 16);
  p.fill((x, y) => ((x + y) % 2 === 0 ? shade(a, 0.9) : hash2(x, y, 5) < 0.1 ? shade(a, 1.1) : a));
  return p;
}

function cliff(): Px {
  const p = new Px(32, 32);
  const pal = PAL.dirt;
  p.fill((x, y) => {
    // 가로 지층 + 박힌 돌
    const layer = valueNoise(x / 10, y / 3, 71);
    let c = ditherPick([pal[0], pal[1], pal[1], pal[2]], layer, x, y);
    const [, edge] = voronoi(x, y, 7, 73, 28);
    if (hash2(Math.floor(x / 7), Math.floor(y / 7), 74) < 0.35 && edge > 1.2) c = edge > 2.2 ? PAL.stone[2] : PAL.stone[1];
    return c;
  });
  return p;
}

function soil(): Px {
  const p = new Px(32, 32);
  const pal = PAL.dirt;
  p.fill((x, y) => {
    const furrow = y % 4;
    const n = hash2(x, y, 81);
    if (furrow === 3) return pal[0];
    if (furrow === 0) return n < 0.5 ? pal[2] : pal[1];
    return n < 0.12 ? pal[0] : pal[1];
  });
  return p;
}

function water(): Px {
  const p = new Px(32, 32);
  const pal = PAL.water;
  p.fill((x, y) => {
    const n = valueNoise(x / 6, y / 3, 91);
    if (n > 0.8 && y % 3 === 0) return pal[3];
    return ditherPick([pal[0], pal[1], pal[1], pal[2]], n, x, y);
  });
  return p;
}

export function grassColor(x: number, y: number): number {
  // 큰 얼룩(160) → 중간 덩어리(62) → 잔 변화(14) 순으로 비중을 둬 같은 무늬가 되풀이돼 보이지 않게
  const n = fbm(x / 160, y / 160, 131, 2) * 0.25 + fbm(x / 62, y / 62, 101, 2) * 0.6 + valueNoise(x / 14, y / 14, 103) * 0.15;
  const pal = PAL.grass;
  let c = ditherPick([pal[1], pal[2], pal[2], pal[3], pal[3], pal[4]], n, x, y, 0.22);
  // 풀잎: 밝은 점 + 바로 아래 어두운 점
  const h = hash2(x, y, 107);
  if (h < 0.008 && n > 0.44) c = pal[4];
  else if (hash2(x, y - 1, 107) < 0.008 && n > 0.44) c = pal[2];
  return c;
}

function grassTop(): Px {
  const p = new Px(64, 64);
  p.fill((x, y) => grassColor(x, y));
  return p;
}

// ───────────── 등록 ─────────────

export type TexKey =
  | 'plain' | 'plaster' | 'brick' | 'wood' | 'reed' | 'mudRoof' | 'stone' | 'wetStone'
  | 'leafVine' | 'bark' | 'wool' | 'metal' | 'canopy'
  | 'stripeRed' | 'stripeIndigo' | 'stripeSaffron' | 'fabricTeal' | 'fabricCream'
  | 'cliff' | 'soil' | 'water' | 'grassTop'
  /** 밤에만 빛나는 면(창문) / 항상 빛나는 면(불꽃) — 재질은 lighting에서 오버라이드 */
  | 'glow' | 'flame' | 'skyWindow';

const GEN: Record<TexKey, () => Px> = {
  plain, plaster, brick, wood, reed, mudRoof, stone, wetStone,
  leafVine: () => leaf(PAL.vine, 204),
  bark, wool,
  canopy: () => { const p = new Px(16, 16); p.fill((x, y) => shade(0xffffff, 0.94 + hash2(x, y, 9681) * 0.06)); return p; },
  metal: () => { const p = new Px(32, 32); p.fill((x, y) => { const h = hash2(x, y, 9680); return shade(0xb5b9bd, 0.86 + h * 0.2 + (x % 8 === 0 ? 0.05 : 0)); }); return p; },
  stripeRed: () => stripes(PAL.fabric.red, PAL.fabric.cream, 4, PAL.fabric.redDark),
  stripeIndigo: () => stripes(PAL.fabric.indigo, PAL.fabric.cream, 3, PAL.fabric.saffron),
  stripeSaffron: () => stripes(PAL.fabric.saffron, PAL.fabric.red, 5, PAL.fabric.redDark),
  fabricTeal: () => weave(PAL.fabric.teal),
  fabricCream: () => weave(PAL.fabric.cream),
  cliff, soil, water, grassTop,
  glow: plain, flame: plain, skyWindow: plain,
};

/** 결이 있는 텍스처: 면의 긴 방향으로 결(v축)을 돌려 붙임 */
export const GRAINED = new Set<TexKey>(['wood', 'bark']);

const cache = new Map<TexKey, THREE.DataTexture>();
const reliefCache = new Map<TexKey, THREE.DataTexture>();
/** 색 보정 없이 읽는 선형 높이 맵. 색 텍스처와 별도로 캐시한다. */
export function getRelief(key: TexKey): THREE.DataTexture {
  let t = reliefCache.get(key);
  if (!t) {
    const p = GEN[key]();
    for (let i = 0; i < p.data.length; i += 4) {
      const h = p.data[i] * 0.2126 + p.data[i + 1] * 0.7152 + p.data[i + 2] * 0.0722;
      p.data[i] = p.data[i + 1] = p.data[i + 2] = h;
    }
    t = p.toTexture();
    t.colorSpace = THREE.NoColorSpace;
    reliefCache.set(key, t);
  }
  return t;
}
export function getTexture(key: TexKey): THREE.DataTexture {
  let t = cache.get(key);
  if (!t) {
    t = GEN[key]().toTexture();
    cache.set(key, t);
  }
  return t;
}
