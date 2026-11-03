import { OUTLINE, PAPER } from './theme';
import { dev, inset, textBox, textDevicePx } from './uiScale';
/**
 * 픽셀 글자: 시스템 한글 폰트를 화면 픽셀 크기 그대로 그린 뒤 알파를 0/255로 잘라 계단진 글자로 만든다.
 * 같은 (문자열, 크기, 색, 배율) 조합은 캐시해서 매 프레임 다시 그리지 않음.
 */
const FONT = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
const cache = new Map<string, HTMLCanvasElement>();
/** 캐시 상한: "밀 3개를 21에 팔았다"처럼 값이 바뀌는 문장이 끝없이 쌓이지 않게, 오래 안 쓴 것부터 버림 */
const CACHE_MAX = 600;
const scratch = document.createElement('canvas');
const sctx = scratch.getContext('2d', { willReadFrequently: true })!;

function hexRgb(c: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
}

/** 최근에 쓴 것으로 옮기며 꺼냄 (Map 은 넣은 순서를 기억함) / 넣을 때 상한을 넘으면 가장 오래된 것부터 버림 */
function lruGet<V>(m: Map<string, V>, key: string): V | undefined {
  const hit = m.get(key);
  if (hit !== undefined) { m.delete(key); m.set(key, hit); }
  return hit;
}
function lruSet<V>(m: Map<string, V>, key: string, v: V, max: number) {
  if (m.size >= max) m.delete(m.keys().next().value!);
  m.set(key, v);
}

/**
 * size: UI 글자 크기, density: UI 1칸 = 화면 픽셀 몇 개 (hud.density, 정수가 아니어도 됨)
 * 글꼴은 round(size·density) 화면 px 로 직접 그려서(uiScale.textDevicePx) 1:1 로 찍는다 —
 * 정수 배율로 크게 그린 뒤 줄이면 픽셀 행·열이 빠져 획이 뭉개지므로 (U10). density 가 정수면 예전 글자판과 같다.
 * shadow: 오른쪽 아래 그림자 색 (거리 = UI 1칸을 반올림한 화면 px, 없으면 생략)
 */
export function pixelText(s: string, size: number, color: string, shadow: string | null = null, density = 1): HTMLCanvasElement {
  const fs = textDevicePx(size, density);
  const key = `${s}|${fs}|${color}|${shadow}|${density}`;
  const hit = lruGet(cache, key);
  if (hit) return hit;
  sctx.font = `bold ${fs}px ${FONT}`;
  const { w, h, pad } = textBox(sctx.measureText(s).width, fs, density);
  scratch.width = w; scratch.height = h;
  sctx.font = `bold ${fs}px ${FONT}`;
  sctx.textBaseline = 'top';
  sctx.fillStyle = '#000';
  sctx.fillText(s, 0, pad);
  const src = sctx.getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const g = out.getContext('2d')!;
  const img = g.createImageData(w, h);
  const [r, gg, b] = hexRgb(color);
  const sh = shadow ? hexRgb(shadow) : null;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] >= 100;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (on(x, y)) img.data.set([r, gg, b, 255], i);
      else if (sh && on(x - pad, y - pad)) img.data.set([sh[0], sh[1], sh[2], 255], i);
    }
  g.putImageData(img, 0, 0);
  (out as HTMLCanvasElement & { density?: number }).density = density;
  lruSet(cache, key, out, CACHE_MAX);
  return out;
}

/** 3x5 숫자 폰트 (칸 안 개수 표시용 — 한글 폰트는 이 크기에서 뭉개짐) */
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
};
const digitCache = new Map<string, HTMLCanvasElement>();
/**
 * 숫자 글자판 (화면 픽셀). UI 칸 (-1,-1) 이 왼쪽 위, 칸 k 는 inset(k+1) 에서 시작 — 놓는 자리와 상관없이 모양이 같다.
 * 외곽선(상하좌우 1칸 + 오른쪽 아래) 때문에 숫자 칸보다 사방 1칸 큼
 */
function digitSprite(s: string, color: string, outline: string, d: number): HTMLCanvasElement {
  const key = `${s}|${color}|${outline}|${d}`;
  const hit = lruGet(digitCache, key);
  if (hit) return hit;
  const cols = s.length * 4 + 1, rows = 7; // 숫자 폭 (4n-1) + 양옆 1칸, 높이 5 + 위아래 1칸
  const c = document.createElement('canvas');
  c.width = Math.max(1, inset(cols, d)); c.height = Math.max(1, inset(rows, d));
  const g = c.getContext('2d')!;
  const span = (k: number): [number, number] => { const a = inset(k + 1, d); return [a, Math.max(a + 1, inset(k + 2, d))]; };
  const plot = (col: string, ox: number, oy: number) => {
    g.fillStyle = col;
    [...s].forEach((ch, k) => DIGITS[ch]?.forEach((row, y) => [...row].forEach((v, x) => {
      if (v !== '1') return;
      const [x0, x1] = span(k * 4 + x + ox), [y0, y1] = span(y + oy);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    })));
  };
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) plot(outline, ox, oy);
  plot(color, 0, 0);
  lruSet(digitCache, key, c, 300);
  return c;
}
/** 오른쪽 끝을 x에 맞춰 외곽선 있는 숫자를 찍음 (g 는 UI 배율이 걸린 HUD 컨텍스트) */
export function drawDigits(g: CanvasRenderingContext2D, s: string, right: number, top: number, color = PAPER, outline = OUTLINE) {
  const d = g.getTransform().a || 1;
  const x0 = right - (s.length * 4 - 1);
  const sp = digitSprite(s, color, outline, d);
  g.drawImage(sp, dev(x0 - 1, d) / d, dev(top - 1, d) / d, sp.width / d, sp.height / d);
}

const inkCache = new WeakMap<HTMLCanvasElement, { top: number; bottom: number }>();
/** 캔버스에서 실제로 칠해진 행 범위 (세로 가운데 정렬용) */
export function inkRows(c: HTMLCanvasElement): { top: number; bottom: number } {
  const hit = inkCache.get(c);
  if (hit) return hit;
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let top = c.height, bottom = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 0) { top = Math.min(top, y); bottom = Math.max(bottom, y); break; }
  const r = bottom < 0 ? { top: 0, bottom: c.height - 1 } : { top, bottom };
  inkCache.set(c, r);
  return r;
}

/** 캔버스의 해상도 배율 (pixelText가 표시해 둔 값, 아이콘은 1) */
export const densityOf = (c: HTMLCanvasElement) => (c as HTMLCanvasElement & { density?: number }).density ?? 1;

/** 칠해진 부분이 [y0, y1] 구간(UI 좌표)의 세로 가운데에 오도록 그릴 y 좌표 */
export function centerY(c: HTMLCanvasElement, y0: number, y1: number): number {
  const d = densityOf(c);
  const { top, bottom } = inkRows(c);
  const t = top / d, bh = (bottom - top + 1) / d;
  return Math.round(((y0 + y1 + 1 - bh) / 2 - t) * d) / d;
}
