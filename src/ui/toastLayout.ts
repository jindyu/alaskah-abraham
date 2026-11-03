/** 터치 모드 알림(토스트)의 위쪽 가운데 자리 계산 (UI 좌표). 왼쪽 아래 스틱과 겹치지 않게 시계·할 일·지도 사이 빈 폭에 쌓는다 */

/** 알림 한 줄 높이·알림 사이 간격·둘째 줄 한 줄 높이 (PC 의 왼쪽 아래 알림과 같은 크기) */
export const TOAST_H = 26;
export const TOAST_GAP = 3;
export const TOAST_LINE_H = 14;
/** 쌓인 알림이 좌우 패널·지도에 바짝 붙지 않게 두는 틈 */
const SIDE_GAP = 6;
/** 이보다 좁아지면(아주 좁은 화면) 좌우 패널은 무시하고 화면 가장자리까지 씀 */
const MIN_SPAN = 96;

export interface ToastSpan { x0: number; x1: number }

/**
 * 알림이 쓸 수 있는 가로 구간. left = 왼쪽 위 도움말 단추·지도의 오른쪽 끝, right = 오른쪽 위 시계·할 일 패널의 왼쪽 끝,
 * edgeLeft·edgeRight = 안전 영역 여백 (구간이 너무 좁으면 화면 가장자리 안쪽 전체를 씀)
 */
export function toastSpan(uiW: number, left: number, right: number, edgeLeft = 0, edgeRight = 0): ToastSpan {
  const x0 = left + SIDE_GAP, x1 = right - SIDE_GAP;
  if (x1 - x0 >= MIN_SPAN) return { x0, x1 };
  return { x0: 8 + edgeLeft, x1: uiW - 8 - edgeRight };
}

/** 구간 가운데에 폭 w 인 알림의 왼쪽 x (구간보다 넓으면 구간 왼쪽 끝) */
export function toastCenterX(span: ToastSpan, w: number): number {
  return Math.max(span.x0, Math.round((span.x0 + span.x1 - w) / 2));
}

/** 들어올 때 위에서 4단계로 내려오는 세로 이동량 (0 이하, 높이 h 의 안쪽으로 사라짐). 0.2 초 뒤엔 0 */
export function toastSlideY(age: number, h: number): number {
  return age < 0.2 ? Math.round((1 - age / 0.2) * 4) * -(h / 4) : 0;
}

/** 알림 줄 수에 따른 높이. grow = 글자가 커진 만큼(hud.grow(13)) — 한 줄 높이와 줄 간격에 함께 더함 */
export function toastHeight(lines: number, grow = 0): number {
  return TOAST_H + grow + (Math.max(1, lines) - 1) * (TOAST_LINE_H + grow);
}
