import { wrapLines } from './wrap';
import type { CaptionState } from '../systems/cutscene/cutscene';
import type { Hud } from './hud';

export interface CaptionLayout { w: number; lines: string[]; widths: number[]; maxW: number }

/**
 * 자막 줄 나눔·폭 계산 (순수 배치; 결과는 Hud.captionLayout 이 자막 객체별로 캐시하므로 자막이 바뀔 때만 불린다).
 * 한 줄이 화면의 60%(음성) / 90% 를 넘으면 나눈다.
 */
export function layoutCaption(hud: Hud, c: CaptionState, base: number, voice: boolean, title: boolean): CaptionLayout {
  const measure = (s: string) => hud.tw(hud.txt(s, base, '#000000', null));
  let lines = [c.text];
  if (voice && measure(c.text) > hud.w * 0.6) {
    const mid = c.text.length / 2;
    let cut = -1;
    for (let i = 0; i < c.text.length; i++) if (c.text[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
    if (cut > 0) lines = [c.text.slice(0, cut), c.text.slice(cut + 1)];
  }
  let tooWide = false;
  for (let i = 0; i < lines.length; i++) if (measure(lines[i]) > hud.w * 0.9) { tooWide = true; break; }
  if (tooWide) lines = wrapLines(c.text, hud.w * 0.9, measure, title ? 2 : voice ? 3 : 2);
  const widths: number[] = [];
  let maxW = 0;
  for (let i = 0; i < lines.length; i++) { const w = measure(lines[i]); widths.push(w); if (w > maxW) maxW = w; }
  return { w: hud.w, lines, widths, maxW };
}

/** 줄 배열 안 글판들 중 가장 넓은 폭 (스프레드 없이 — Math.max(...) 는 호출마다 인자 배열을 만든다) */
export function maxWidth(widths: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < widths.length; i++) if (widths[i] > m) m = widths[i];
  return m;
}
