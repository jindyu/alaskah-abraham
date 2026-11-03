// 번역: 한국어 원문을 키로 번역을 찾는다 (src/i18n/en.json, tools/migrate 가 alaskah-bibles 번역에서 만듦).
//  - 한국어 모드이면 원문 그대로 (한국어 게임은 이 파일의 영향을 받지 않음)
//  - 정확히 같은 원문이 있으면 그 번역
//  - 아니면 {0} {1} … 자리가 있는 틀(코드의 템플릿 문자열)과 맞춰 보고, 자리에 들어간 값(아이템 이름 등)도 다시 번역
//  - 그래도 없으면 원문을 돌려주고 '놓친 글'로 기록 (개발 중 확인: abraham.i18nMisses())
import { LANG_LABEL, isKo, lang, notifyLangChange, type Lang } from './lang';

type Table = Record<string, string>;
/** 번역표(언어마다 약 300KB)는 그 언어를 처음 쓸 때 따로 내려받음 — 한국어만 하는 사람은 받지 않음 */
const LOADERS: Record<Exclude<Lang, 'ko'>, () => Promise<{ default: unknown }>> = {
  en: () => import('./en.json'),
};
const tables = new Map<Lang, Table>();
const loading = new Map<Lang, Promise<void>>();
/** 그 언어의 번역표를 불러옴 (이미 불러왔거나 불러오는 중이면 같은 약속). 다 불러오면 화면 글을 다시 채우도록 알림 */
export function loadLang(l: Lang): Promise<void> {
  if (l === 'ko') return Promise.resolve();
  let p = loading.get(l);
  if (!p) {
    p = LOADERS[l]().then((m) => {
      tables.set(l, m.default as Table);
      if (active === l) active = null; // 쓰던 캐시 버림
      notifyLangChange();
    }, () => { loading.delete(l); });
    loading.set(l, p);
  }
  return p;
}
export const loadEnglish = (): Promise<void> => loadLang('en');

/** 언어 이름(자기 나라 글자) — 어느 언어 모드에서도 그대로 */
const KEEP = new Set(Object.values(LANG_LABEL));
const HANGUL = /[가-힣]/;

interface Template { re: RegExp; out: string; weight: number }
let templates: Template[] | null = null;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const memo = new Map<string, string>();
const MEMO_MAX = 4000;
const missed = new Set<string>();
/** 지금 캐시·틀이 만들어진 언어 (언어가 바뀌면 비움) */
let active: Lang | null = null;
let table: Table | null = null;
const derived = new WeakSet<Table>();

/** 줄바꿈이 든 키(조합된 목표 등)는 줄마다 따로 번역되므로, 줄 수가 같은 번역은 줄별 키도 만들어 둠 ({n} 자리는 줄 안에서 0부터 다시 매김) */
function addLineKeys(t: Table): void {
  const extra: [string, string][] = [];
  for (const [ko, out] of Object.entries(t)) {
    if (!ko.includes('\n')) continue;
    const ks = ko.split('\n'), os = out.split('\n');
    if (ks.length !== os.length) continue;
    ks.forEach((k, i) => {
      if (!HANGUL.test(k) || k in t) return;
      const map = new Map<string, number>();
      for (const m of k.matchAll(/\{(\d+)\}/g)) if (!map.has(m[1])) map.set(m[1], map.size);
      let ok = true;
      const renum = (s: string) => s.replace(/\{(\d+)\}/g, (_, n: string) => { const v = map.get(n); if (v === undefined) { ok = false; return ''; } return `{${v}}`; });
      const kk = renum(k), oo = renum(os[i]);
      if (ok) extra.push([kk, oo]);
    });
  }
  for (const [k, v] of extra) if (!(k in t)) t[k] = v;
}

function sync(l: Lang): boolean {
  if (active === l) return table !== null;
  table = tables.get(l) ?? null;
  if (table && !derived.has(table)) { addLineKeys(table); derived.add(table); }
  memo.clear(); missed.clear(); templates = null;
  active = table ? l : null;
  return table !== null;
}

function buildTemplates(): Template[] {
  const list: Template[] = [];
  for (const [ko, out] of Object.entries(table ?? {})) {
    if (!/\{\d+\}/.test(ko)) continue;
    const parts = ko.split(/\{\d+\}/);
    const re = new RegExp(`^${parts.map(escapeRe).join('([^\\n]+?)')}$`);
    list.push({ re, out, weight: parts.join('').length });
  }
  // 고정 글자가 많은(더 구체적인) 틀부터 맞춰 봄
  return list.sort((a, b) => b.weight - a.weight);
}

function lookup(s: string): string {
  if (KEEP.has(s)) return s;
  const hit = table?.[s];
  if (hit !== undefined && !/\{\d+\}/.test(s)) return hit;
  // ' · ' 로 이어 붙인 목표: 조각이 모두 번역될 때만 조각별로 번역 (틀이 이어 붙인 글 전체에 엉뚱하게 맞는 것을 막음)
  if (s.includes(' · ') && hit === undefined && s.length < 160 && !/[<\n]/.test(s)) {
    const before = new Set(missed);
    const parts = s.split(' · ').map(tr);
    if (!parts.some((x) => HANGUL.test(x))) return parts.join(' · ');
    for (const m of missed) if (!before.has(m)) missed.delete(m); // 시험 삼아 번역해 본 조각은 놓친 글이 아님
  }
  templates ??= buildTemplates();
  for (const t of templates) {
    const m = t.re.exec(s);
    if (!m) continue;
    return t.out.replace(/\{(\d+)\}/g, (_, n: string) => tr(m[Number(n) + 1] ?? ''));
  }
  if (hit !== undefined) return hit; // 틀 모양 키가 글자 그대로 쓰인 경우
  // 문단을 가로질러 일반적인 틀이 잘못 맞지 않게 하고, 조합된 목표는 줄마다 번역한다.
  if (s.includes('\n')) return s.split('\n').map(tr).join('\n');
  // 줍기 알림 '+3 돌': 개수는 두고 이름만 번역
  const gain = /^\+(\d+) (.+)$/.exec(s);
  if (gain) return `+${gain[1]} ${tr(gain[2])}`;
  // 언어 변경 전에 생성된 알림에는 한국어 조사가 이미 붙어 있다.
  // 번역표에 정확한 명사가 있는 경우에만 분리하여 고유 명칭을 임의로 바꾸지 않는다.
  for (const particle of ['으로', '이', '가', '은', '는', '을', '를', '과', '와', '로']) {
    if (!s.endsWith(particle)) continue;
    const base = table?.[s.slice(0, -particle.length)];
    if (typeof base === 'string' && !/\{\d+\}/.test(base) && !HANGUL.test(base)) return base;
  }
  return s;
}

/** 한국어 모드가 아니면 번역해서, 아니면 그대로 돌려줌 */
export function tr(s: string): string {
  if (isKo() || !HANGUL.test(s)) return s;
  const l = lang();
  if (!sync(l)) { void loadLang(l); return s; } // 아직 내려받는 중: 원문을 보여 주다가 다 오면 다시 그림
  const cached = memo.get(s);
  if (cached !== undefined) return cached;
  const out = lookup(s);
  if (HANGUL.test(out) && !KEEP.has(s)) missed.add(s);
  if (memo.size >= MEMO_MAX) memo.clear();
  memo.set(s, out);
  return out;
}

/** 번역했는데도 한국어가 화면에 나간 글들 (개발·QA 확인용) */
export const i18nMisses = (): string[] => [...missed];
/** 테스트용: 기록·캐시 비움 (번역표는 그대로) */
export function __resetTr(): void { memo.clear(); missed.clear(); templates = null; active = null; table = null; }
/** 지금 언어 번역표에 있는 키 수 (테스트·진단) */
export const translationCount = (): number => Object.keys(tables.get(lang()) ?? {}).length;
