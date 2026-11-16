/** 장 선택 보조 계산 (순수 — tests/chapterHints.test.ts) */

export interface ChapterPos { book: number; chapter: number }

/** 추천 다음 장: 권·장 순서에서 처음으로 끝내지 않은 장. 모두 끝냈으면 null. counts[b] = 그 권의 장 수 */
export function recommendedNext(done: ReadonlySet<string>, counts: ReadonlyArray<number>): ChapterPos | null {
  for (let b = 0; b < counts.length; b++) {
    for (let c = 0; c < counts[b]; c++) if (!done.has(`${b}:${c}`)) return { book: b, chapter: c };
  }
  return null;
}

/** 보이는 줄 수: 목록에 쓸 수 있는 높이에서 (행 높이 기준) 4~10 줄 */
export function visibleRows(availH: number, rowH: number, maxRows = 10): number {
  return Math.max(4, Math.min(maxRows, Math.floor(availH / rowH)));
}

/** 선택 항목이 가운데 근처에 오는 스크롤 시작 줄 */
export function scrollStart(index: number, total: number, visible: number): number {
  return Math.max(0, Math.min(total - visible, index - Math.floor(visible / 2)));
}

/** 스크롤 막대(손잡이) 위치·길이: 트랙 높이 trackH 안에서. 다 보이면 null */
export function scrollThumb(start: number, visible: number, total: number, trackH: number): { y: number; h: number } | null {
  if (total <= visible || trackH <= 0) return null;
  const h = Math.max(8, Math.round((trackH * visible) / total));
  const y = Math.round(((trackH - h) * start) / (total - visible));
  return { y, h };
}
