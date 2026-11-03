import { tr } from '../i18n/tr';

/** 글을 폭에 맞춰 줄로 나눔 (순수 — 글자 폭은 measure 가 알려 줌) */

/** maxW 안에 들어가는 앞글자 수 (이진 탐색, 최소 1) */
function fitCount(s: string, maxW: number, measure: (s: string) => number): number {
  let lo = 1, hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measure(s.slice(0, mid)) <= maxW) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** 폭을 넘으면 끝을 … 로 줄임 */
function ellipsize(s: string, maxW: number, measure: (s: string) => number): string {
  if (measure(s) <= maxW) return s;
  let lo = 1, hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measure(`${s.slice(0, mid).trimEnd()}…`) <= maxW) lo = mid; else hi = mid - 1;
  }
  return `${s.slice(0, lo).trimEnd()}…`;
}

/**
 * '\n' 으로 나뉜 문단마다 wrapLines 로 줄을 나눔. 전체 maxLines 안에서 뒤 문단이 최소 한 줄을 갖도록 앞 문단 줄 수를 제한
 */
export function wrapParagraphs(text: string, maxW: number, measure: (s: string) => number, maxLines = 3): string[] {
  const paras = tr(text).split('\n');
  const out: string[] = [];
  paras.forEach((p, i) => {
    const left = paras.length - 1 - i;
    out.push(...wrapLines(p, maxW, measure, Math.max(1, maxLines - out.length - left)));
  });
  return out;
}

/**
 * 띄어쓰기에서 줄을 바꾸고(‘·’ 는 뒤 낱말에 붙여 줄 끝에 홀로 남지 않게), 낱말 하나가 폭보다 길면 글자 단위로 자름.
 * maxLines 를 넘으면 마지막 줄을 … 로 줄임. 항상 한 줄 이상을 돌려줌
 */
export function wrapLines(text: string, maxW: number, measure: (s: string) => number, maxLines = 2): string[] {
  text = tr(text); // 영어 모드: 줄을 나누기 전에 번역 (조각으로 나눈 뒤에는 번역할 수 없음)
  const limit = Math.max(1, Math.floor(maxLines));
  if (measure(text) <= maxW) return [text];
  const words: string[] = [];
  let dot = false;
  for (const w of text.split(' ')) {
    if (w === '') continue;
    if (dot) { words.push(`· ${w}`); dot = false; } else if (w === '·') dot = true; else words.push(w);
  }
  if (dot) words.push('·');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= maxW) { cur = next; continue; }
    if (cur) { lines.push(cur); cur = ''; }
    let rest = w;
    while (rest && measure(rest) > maxW) {
      const n = fitCount(rest, maxW, measure);
      lines.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    cur = rest;
  }
  if (cur) lines.push(cur);
  if (lines.length === 0) return [text];
  if (lines.length <= limit) return lines;
  const head = lines.slice(0, limit - 1);
  head.push(ellipsize(lines.slice(limit - 1).join(' '), maxW, measure));
  return head;
}
