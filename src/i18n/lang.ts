// 언어 설정: 'ko'(기본) · 'en'. 브라우저 저장소(abraham.lang.v1)에 기억하고, URL ?lang=en 처럼 고를 수도 있다.
export type Lang = 'ko' | 'en';
export const LANGS: readonly Lang[] = ['ko', 'en'];
/** 언어 이름은 자기 나라 글자로 (번역하지 않음) */
export const LANG_LABEL: Record<Lang, string> = { ko: '한국어', en: 'English' };
/** 탭 제목 (게임 이름) */
const TITLE: Record<Lang, string> = { ko: '아브라함', en: 'Abraham' };
const KEY = 'abraham.lang.v1';

const valid = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

function initial(): Lang {
  try {
    const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('lang');
    if (valid(q)) return q;
  } catch { /* 주소를 못 읽으면 저장된 값으로 */ }
  try {
    const s = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (valid(s)) return s;
  } catch { /* 저장소를 못 쓰면 기본값 */ }
  // 고른 적이 없으면 브라우저 언어가 지원하는 언어일 때 그 언어 (그 밖에는 한국어, 설정 ‘언어’에서 언제든 바꿈)
  try {
    // 실제 브라우저일 때만 (Node 의 navigator.language 가 'en-US' 라서 테스트가 영어로 도는 일을 막음)
    if (typeof window === 'undefined' || typeof document === 'undefined') return 'ko';
    const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } }).navigator;
    const first = (nav?.languages?.[0] ?? nav?.language ?? '').toLowerCase().split(/[-_]/)[0];
    if (valid(first)) return first;
  } catch { /* 브라우저 언어를 못 읽으면 기본값 */ }
  return 'ko';
}

let cur: Lang = initial();
const listeners = new Set<(l: Lang) => void>();

/** 문서의 lang 속성·제목을 언어에 맞춤 (화면 읽기 프로그램·탭 제목) */
function applyDocument(l: Lang): void {
  try {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = l;
    document.title = TITLE[l];
  } catch { /* 문서를 못 만지면 무시 */ }
}
applyDocument(cur);

export const lang = (): Lang => cur;
/** 한국어(원문 그대로)인가 — 아니면 번역표를 거치고 한국어 조사·음성은 쓰지 않음 */
export const isKo = (): boolean => cur === 'ko';

/** 언어를 바꿈 (persist 가 true 면 저장소에 기억). 바뀌었으면 듣는 쪽에 알림 */
export function setLang(l: Lang, persist = true): void {
  if (!valid(l) || l === cur) return;
  cur = l;
  applyDocument(l);
  if (persist) { try { localStorage.setItem(KEY, l); } catch { /* 저장소를 못 써도 이번 실행에는 적용 */ } }
  for (const fn of listeners) { try { fn(l); } catch { /* 듣는 쪽 오류는 무시 */ } }
}

/** 언어가 그대로여도 화면 글을 다시 채워야 할 때(번역표를 방금 불러왔을 때) 듣는 쪽에 알림 */
export function notifyLangChange(): void {
  for (const fn of listeners) { try { fn(cur); } catch { /* 듣는 쪽 오류는 무시 */ } }
}

/** 언어가 바뀔 때 부를 함수를 등록 (돌려받은 함수를 부르면 해제) */
export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 다음/이전 언어 (설정 화면의 ◀ ▶) */
export function nextLang(l: Lang, dir: 1 | -1 = 1): Lang {
  return LANGS[(LANGS.indexOf(l) + dir + LANGS.length) % LANGS.length];
}

/** 테스트용: 저장·주소와 무관하게 값을 바로 지정 */
export function __setLangForTest(l: Lang): void { cur = l; }
