import { uiLayout } from './layout';
/**
 * HUD·창 캔버스의 배율과 반올림 규칙 (DOM 없이 계산하는 순수 함수만 — tests/ui-scale.test.ts).
 *
 * 용어
 * - UI 좌표: 패널·글자 배치를 정하는 좌표. 화면 높이는 늘 440 이상, 폭은 560 이상 (layout.ts)
 * - d: UI 1칸이 장치(화면) 픽셀 몇 개인가. PC 1080p 는 2, 휴대폰 가로(844×390·dpr3)는 약 2.66,
 *   Windows 125% 는 약 2.45 처럼 정수가 아닐 때가 많다
 * - 장치 픽셀: 캔버스의 실제 픽셀 (canvas.width 기준)
 *
 * 규칙 (U10)
 * 1. 글자는 UI 크기 × d 를 반올림한 장치 px 로 직접 그리고(textDevicePx), 1:1 로 찍는다 — 정수 배율로 그린 뒤
 *    줄이면 픽셀 행·열이 빠져 한글 획이 뭉개진다. d 가 정수면 예전과 같은 글자판이 나온다.
 * 2. 사각형은 가장자리마다 장치 픽셀 격자에 반올림한다(snapSpan). 이웃한 사각형이 틈·겹침 없이 맞물리고 흐린 테가 없다.
 * 3. 테두리가 여러 겹인 그림(패널 테·키캡·숫자 글꼴)은 바깥 사각형만 격자에 맞추고, 안쪽 겹은 각 가장자리에서
 *    inset(k) = round(k·d) 만큼 들어간 자리에 그린다(frame). 그래서 왼쪽·오른쪽, 위·아래 테 두께가 늘 같고,
 *    같은 그림은 어디에 놓여도 모양이 같다(캐시해서 재사용 가능 — U14).
 *
 * U3(글자 크기 설정)은 TextPolicy 로 들어왔다(textGrow·textWiden 이 배치 규칙), U14(dpr 상한·폭 측정)는 MAX_DPR·textBox 를
 * 고치면 된다 — 다른 곳에 배율 계산을 두지 말 것.
 */

/** HUD 캔버스 dpr 상한 (U14 가 2 로 낮출 자리) */
export const MAX_DPR = 3;

export const clampDpr = (dpr: number | undefined): number => Math.max(1, Math.min(MAX_DPR, (typeof dpr === 'number' && Number.isFinite(dpr) && dpr) || 1));

export interface HudScale {
  /** 캔버스 장치 픽셀 크기 */
  canvasW: number;
  canvasH: number;
  /** 캔버스 CSS 크기 */
  cssW: number;
  cssH: number;
  /** UI 좌표 크기 */
  uiW: number;
  uiH: number;
  /** UI 1칸 = 장치 픽셀 d 개 */
  d: number;
  dpr: number;
  /** UI 1칸 = CSS px (d / dpr) */
  cssPerUi: number;
}

/**
 * 월드 내부 해상도(w×h, 정수 배율 scale)와 dpr 로 HUD 캔버스·UI 좌표 크기를 정한다.
 * UI 배율은 월드 배율과 같게 하되 작은 화면에서는 고정 폭 패널이 들어가도록 줄인다(layout.ts).
 * 정수로 내리지 않는 이유: 휴대폰 가로에서 2 로 내리면 UI 가 25% 더 작아져(1칸 0.67 CSS px) U3 와 반대가 된다.
 */
export function hudScale(w: number, h: number, scale: number, dpr: number): HudScale {
  const p = clampDpr(dpr);
  const cssW = w * scale, cssH = h * scale;
  const canvasW = Math.max(1, Math.round(cssW * p)), canvasH = Math.max(1, Math.round(cssH * p));
  const L = uiLayout(cssW * p, cssH * p, scale * p);
  return { canvasW, canvasH, cssW, cssH, uiW: L.width, uiH: L.height, d: L.scale, dpr: p, cssPerUi: L.scale / p };
}

/** UI 좌표 → 장치 픽셀 가장자리 (반올림) */
export const dev = (v: number, d: number): number => Math.round(v * d);

/** 테두리 겹의 안쪽 거리: UI k 칸 → 장치 픽셀 (반올림, 위치와 상관없이 늘 같은 값) */
export const inset = (k: number, d: number): number => Math.round(k * d);

/**
 * UI 구간 [a, a+len) 을 장치 픽셀 [p0, p1) 로. 가장자리를 각각 반올림하므로 이웃 구간과 틈·겹침이 없다.
 * len 이 0 보다 크면 최소 1 장치 픽셀 (d < 1 인 작은 창에서 1px 선이 사라지지 않게). 음수 길이는 뒤집어서 같은 구간.
 */
export function snapSpan(a: number, len: number, d: number): [number, number] {
  if (len < 0) { a += len; len = -len; }
  const p0 = dev(a, d);
  let p1 = dev(a + len, d);
  if (len > 0 && p1 <= p0) p1 = p0 + 1;
  return [p0, p1];
}

/** 장치 픽셀 사각형 (가장자리 좌표, x1·y1 은 끝 다음 칸) */
export interface DevRect { x0: number; y0: number; x1: number; y1: number }

/** fillRect(x, y, w, h) (UI 좌표) → 장치 픽셀 사각형 */
export function snapRect(x: number, y: number, w: number, h: number, d: number): DevRect {
  const [x0, x1] = snapSpan(x, w, d), [y0, y1] = snapSpan(y, h, d);
  return { x0, y0, x1, y1 };
}

/**
 * 여러 겹 그림의 틀: 바깥 사각형을 격자에 맞추고, 각 가장자리에서 UI k 칸 안쪽 자리를 장치 픽셀로 돌려준다.
 * L(k)·T(k) 는 왼쪽·위에서, R(k)·B(k) 는 오른쪽·아래에서 k 칸 들어간 가장자리.
 * 예) 1칸 테: 바깥 OUTLINE (L0,T0,R0,B0) 위에 속 (L1,T1,R1,B1) — 네 변 두께가 모두 inset(1)
 */
export interface Frame extends DevRect {
  L(k: number): number;
  R(k: number): number;
  T(k: number): number;
  B(k: number): number;
}
export function frame(x: number, y: number, w: number, h: number, d: number): Frame {
  const r = snapRect(x, y, w, h, d);
  return {
    ...r,
    L: (k) => r.x0 + inset(k, d),
    R: (k) => r.x1 - inset(k, d),
    T: (k) => r.y0 + inset(k, d),
    B: (k) => r.y1 - inset(k, d),
  };
}

/**
 * 글자 크기 정책 (U3). 정하는 곳은 textSize.textPolicyFor — 설정의 '글자 크기' 단계와 터치 여부로 고른다.
 * - scale: 글자 크기 단계 배율 (HUD·창·대사·자막 전체, 보통 = 1)
 * - minCssPx: 이 CSS px 보다 작게 그리지 않음 (터치 모드 최소 크기). 0 이면 없음
 * 기본(TEXT_POLICY_NONE)이면 글자도 배치도 예전과 똑같다.
 */
export interface TextPolicy { readonly scale: number; readonly minCssPx: number }
export const TEXT_POLICY_NONE: TextPolicy = Object.freeze({ scale: 1, minCssPx: 0 });

/** 정책을 적용한 UI 글자 크기 (cssPerUi = UI 1칸의 CSS px). 배치(줄 간격 등)도 이 값을 따라야 겹치지 않는다 */
export function policyTextSize(size: number, cssPerUi: number, p: TextPolicy = TEXT_POLICY_NONE): number {
  if (p.scale === 1 && !(p.minCssPx > 0)) return size;
  // 배율 곱의 부동소수 찌꺼기(13 × 15/13 = 14.999…)를 떼어 냄 — 장치 px 로 반올림할 때 한 칸 어긋나지 않게
  const s = Math.round(size * p.scale * 1e6) / 1e6;
  return p.minCssPx > 0 && cssPerUi > 0 ? Math.max(s, p.minCssPx / cssPerUi) : s;
}

/**
 * 글자가 원래 크기(size)보다 커진 만큼 (UI 칸, 정수로 올림, 0 이상).
 * 배치 규칙: 글자 크기 size 에 맞춰 정해 둔 고정 높이(줄 간격·행 높이·패널 높이)에는 이 값을 더한다 —
 * 기본 정책이면 0 이라 예전 배치와 같고, 글자가 커진 만큼만 줄·행이 벌어진다.
 */
export function textGrow(size: number, cssPerUi: number, p: TextPolicy = TEXT_POLICY_NONE): number {
  return Math.max(0, Math.ceil(policyTextSize(size, cssPerUi, p) - size - 1e-6));
}

/** 패널 폭을 넓히는 배율: 본문(12) 글자가 커진 비율, 1 ~ cap. 기본 정책이면 1 (폭을 고정해 둔 창이 글자와 함께 넓어지게) */
export const WIDEN_CAP = 1.3;
export function textWiden(cssPerUi: number, p: TextPolicy = TEXT_POLICY_NONE, cap = WIDEN_CAP): number {
  return Math.min(cap, Math.max(1, policyTextSize(12, cssPerUi, p) / 12));
}

/** 고정 폭 base 를 글자에 맞춰 넓힌 폭 (화면 폭 max 를 넘지 않게, 정수). 넓힐 일이 없으면 base 그대로 */
export function widenWidth(base: number, k: number, max = Infinity): number {
  return Math.max(Math.min(base, max), Math.min(max, Math.round(base * k)));
}

/**
 * 줄 rows 개를 높이 avail 안에 넣을 줄 높이: 바라는 높이(want)를 넘지 않고, 글자가 들어갈 최소(min)보다 작아지지 않게.
 * 작은 화면에서 글자가 커져 목록이 화면을 넘칠 때 행 사이 여백부터 줄인다
 */
export function fitRowHeight(want: number, min: number, rows: number, avail: number): number {
  if (rows <= 0) return want;
  return Math.max(min, Math.min(want, Math.floor(avail / rows)));
}

/** UI 글자 크기 → 실제로 그릴 글꼴 장치 px (반올림, 최소 1) */
export const textDevicePx = (size: number, d: number): number => Math.max(1, Math.round(size * d));

/** 글자판의 여백 단위 = 그림자 거리 (장치 px, UI 1칸을 반올림, 최소 1) */
export const textPad = (d: number): number => Math.max(1, Math.round(d));

/**
 * 글자판 크기(장치 px): 글자 폭(measureText) + 오른쪽 여백 3칸, 높이 = 글꼴 px + 5칸. 글자는 위에서 1칸 내려 찍음.
 * pixelText 가 이 값으로 캔버스를 만들므로, 실제로 그리지 않고 폭만 재려면(U14) 같은 함수를 쓴다: UI 폭 = w / d
 */
export function textBox(measured: number, fontPx: number, d: number): { w: number; h: number; pad: number } {
  const pad = textPad(d);
  return { w: Math.ceil(measured) + 3 * pad, h: fontPx + 5 * pad, pad };
}
