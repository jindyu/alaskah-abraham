/**
 * 대사·전승 안내 패널 배치 규칙 (순수 함수 — tests/dialogueLayout.test.ts).
 * 상호작용 프롬프트(E)는 패널보다 먼저 그려지므로, 패널이 프롬프트 상자를 덮지 않게 위/아래로 비킨다.
 */
export interface Box { x: number; y: number; w: number; h: number }

/** 두 사각형이 겹치는가 (pad 만큼 여유를 두고 판정) */
export function boxesOverlap(ax: number, ay: number, aw: number, ah: number, b: Box, pad = 0): boolean {
  return ax < b.x + b.w + pad && ax + aw > b.x - pad && ay < b.y + b.h + pad && ay + ah > b.y - pad;
}

/**
 * 폭 panelW·높이 panelH 인 패널의 세로 자리 y 를 prompt 와 겹치지 않게 고른다.
 * 겹치면 프롬프트 아래(minY~maxY 안일 때) 또는 위 중 원래 자리에 가까운 쪽. 둘 다 안 되면 원래 자리(범위 안으로 맞춤).
 */
export function avoidPrompt(y: number, x: number, panelW: number, panelH: number, minY: number, maxY: number, prompt: Box | null, gap = 4): number {
  const clamp = (v: number) => Math.max(minY, Math.min(Math.max(minY, maxY), v));
  const y0 = clamp(y);
  if (!prompt || !boxesOverlap(x, y0, panelW, panelH, prompt, gap)) return y0;
  const below = prompt.y + prompt.h + gap, above = prompt.y - panelH - gap;
  const okBelow = below >= minY && below <= maxY, okAbove = above >= minY && above <= maxY;
  if (okBelow && okAbove) return Math.abs(below - y0) <= Math.abs(above - y0) ? below : above;
  if (okBelow) return below;
  if (okAbove) return above;
  return y0;
}

/** 이야기꾼(화자 없음) 안내는 작게: 글자 13, 줄 높이 20 / 화자 있는 대사는 16, 24 */
export const NARRATION_PX = 13, NARRATION_LINE_H = 20, SPEECH_PX = 16, SPEECH_LINE_H = 24;

/** 화자 없는 안내의 자동 사라짐 상한 (초) — 읽을 시간은 글자 수에 비례하되 이 값을 넘지 않는다 */
export function narrationLife(requested: number, chars: number): number {
  const need = 2.2 + chars * 0.045;
  return Math.max(2.5, Math.min(requested, need, 5));
}
