/** 고정 폭 패널도 작은 화면 안에 들어가도록 UI를 월드와 독립적으로 맞춘다. */
export function uiLayout(width: number, height: number, preferredScale: number) {
  const scale = Math.min(preferredScale, width / 560, height / 440);
  return { width: width / scale, height: height / scale, scale };
}
