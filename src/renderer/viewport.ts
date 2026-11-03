/**
 * 화면(CSS 픽셀) 크기 → 내부 렌더 해상도·정수 확대 배율·PPU(월드 1유닛 = 몇 텍셀).
 *
 * 규칙 (V2):
 * 1. 확대 배율은 정수: `scale = max(1, round(cssH / targetH))`. 픽셀이 반듯하게 커지고, 내부 해상도·GPU 부담은 예전과 같다.
 * 2. 내부 해상도는 창을 꽉 채움: `w = ceil(cssW / scale)`, `h = ceil(cssH / scale)`.
 * 3. PPU 는 내부 세로에서 고른 정수: `ppu = max(1, round(h / viewUnits))` → 어느 기기에서나 세로로 약 viewUnits(설계 11) 유닛이 보인다.
 *    정수라 땅 칸 경계가 고른 텍셀 간격으로 떨어지고, 반올림 오차는 세로 ±0.5 텍셀/유닛 (h ≥ 360 에서 1.5% 안쪽).
 *
 * 예전에는 PPU 를 49 로 고정해 보이는 세로가 h/49 로 기기마다 달랐다(휴대폰 가로 8유닛, 1080p 브라우저 9.7, 1366×768 15.7).
 */
export interface Viewport {
  /** 내부 텍셀 하나가 화면에서 차지하는 CSS 픽셀 수 (정수 배율) */
  scale: number;
  /** 내부 렌더 해상도 (텍셀) */
  w: number;
  h: number;
  /** 월드 1유닛 = ppu 텍셀 (framing 1, zoom 1 기준) */
  ppu: number;
}

/** 기본 목표 내부 세로 해상도 (배율을 고르는 기준) */
export const DEFAULT_TARGET_H = 540;
/** 설계 시야: 화면 세로에 보이는 월드 범위 (유닛) */
export const DESIGN_VIEW_UNITS = 11;

export function pickViewport(cssW: number, cssH: number, targetH = DEFAULT_TARGET_H, viewUnits = DESIGN_VIEW_UNITS): Viewport {
  // 창이 접혔거나(0) 값이 이상해도 렌더 타깃이 0·NaN 이 되지 않게
  const W = Number.isFinite(cssW) && cssW > 0 ? cssW : 1;
  const H = Number.isFinite(cssH) && cssH > 0 ? cssH : 1;
  const scale = Math.max(1, Math.round(H / targetH));
  const w = Math.max(1, Math.ceil(W / scale));
  const h = Math.max(1, Math.ceil(H / scale));
  const ppu = Math.max(1, Math.round(h / viewUnits));
  return { scale, w, h, ppu };
}

/** framing 배 넓힌 구도에서 카메라 절두체의 반폭·반높이 (유닛) */
export function viewHalfExtent(vp: Pick<Viewport, 'w' | 'h' | 'ppu'>, framing = 1) {
  return { halfW: vp.w / vp.ppu / 2 * framing, halfH: vp.h / vp.ppu / 2 * framing };
}

/** 가로로 fitWidth 유닛을 담으려면 필요한 framing (항해 전경의 세로 화면용) */
export function framingForWidth(vp: Pick<Viewport, 'w' | 'ppu'>, fitWidth: number) {
  return fitWidth > 0 ? fitWidth * vp.ppu / vp.w : 0;
}
