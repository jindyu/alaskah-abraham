import { serializeLog, type LogEntry } from './chapterLog';
import { noteError } from '../core/diagnostics';
import ledger from '../data/ledger.json';

/**
 * story.flags / story.done 직렬화·복원 (순수). 저장 글에는 세 종류가 들어간다:
 *  - `loop:<서명>` = true       끝낸 상호작용 묶음
 *  - `pick:<단계 id>` = 갈래 이름  이후 장의 대사·할 일이 읽는 선택
 *  - `chlog:<권:장|…>` = true    이 장 안의 진행 기록 (입력 재생용)
 */
export interface StoryState {
  loopsDone: ReadonlySet<string>;
  picks: ReadonlyMap<string, string>;
  doneChapters: ReadonlySet<string>;
  chapterLog: { book: number; chapter: number; entries: ReadonlyArray<LogEntry> };
}

export function buildFlags(s: StoryState): Record<string, boolean | string> {
  const f: Record<string, boolean | string> = {};
  for (const [id, tag] of s.picks) f['pick:' + id] = tag;
  for (const sig of s.loopsDone) f['loop:' + sig] = true;
  if (s.chapterLog.entries.length > 0) {
    const lg = serializeLog(s.chapterLog.book, s.chapterLog.chapter, s.chapterLog.entries);
    if (lg) f['chlog:' + lg] = true;
    else noteError('chapterLog:overflow', `${s.chapterLog.entries.length}개 기록이 상한을 넘어 이 장의 진행 복원을 저장하지 않는다`); // 상한을 넘으면 '' — 저장하지 않되 이유는 진단 기록에 남긴다
  }
  return f;
}

/** 저장된 flags·done 을 읽어 loopsDone/picks/doneChapters 를 채운다. 알 수 없는 키·잘못된 값은 무시 */
export function restoreFlags(
  flags: Record<string, number | boolean | string> | undefined,
  done: ReadonlyArray<unknown> | undefined,
  into: { loopsDone: Set<string>; picks: Map<string, string>; doneChapters: Set<string> },
): void {
  if (done) for (const k of done) if (typeof k === 'string') into.doneChapters.add(k);
  if (!flags) return;
  for (const k of Object.keys(flags)) {
    const v = flags[k];
    if (k.startsWith('loop:') && v) into.loopsDone.add(k.slice(5));
    else if (k.startsWith('pick:') && typeof v === 'string' && v) into.picks.set(k.slice(5), v);
  }
}

/** 선택 갈래 이름 → 성향 (대단원 맺음말을 고르는 데 쓴다) */
export const TRAIT_OF: Record<string, 'courage' | 'trust' | 'care'> = {
  '담대히 선포': 'courage', '새벽에 서둘러': 'courage', '돌려 드림': 'courage',
  '믿음으로 답함': 'trust', '하나님께 맡김': 'trust', '침묵으로 맞섬': 'trust', '할례 언약': 'trust',
  '활을 가르침': 'care', '지켜봐 줌': 'trust',
  '곁에 앉음': 'care', '이스마엘을 위한 간구': 'care', '사라 이야기': 'care', '롯을 염려함': 'care', '아버지를 기리며': 'care', '이삭의 웃음': 'care',
};

/** 성향이 없는 갈래(맺음말에 영향 없음) — 의도적으로 비운 것만 여기 둔다 (tests/storyFlags.test.ts 가 모든 갈래가 둘 중 한 곳에 있는지 검사) */
export const NEUTRAL_TAGS: ReadonlySet<string> = new Set(['아무렇지 않게 떠남', '한 그릇 더']);

export interface Epilogue { title: string; sub: string }

/**
 * 이야기 끝(대단원)에 보이는 맺음말: 지금까지 한 선택의 성향 중 가장 많은 것을 따른다 (순수).
 * 동률이면 돌봄 > 맡김 > 담대함 순. 고른 선택이 없거나 성향이 없으면 기본 문구.
 */
export type Trait = 'courage' | 'trust' | 'care';

/**
 * 지금까지 한 선택에서 가장 많은 성향 (순수). 성향이 없으면 null.
 * 동률이면 **가장 최근에 한 선택의 성향**을 따른다 (Map 의 삽입 순서 = 선택한 순서) — 특정 성향이 늘 유리하지 않게.
 */
export function dominantTrait(picks: ReadonlyMap<string, string>): Trait | null {
  const n = { courage: 0, trust: 0, care: 0 };
  let latest: Trait | null = null;
  const order: Trait[] = [];
  for (const tag of picks.values()) {
    const t = TRAIT_OF[tag];
    if (!t) continue;
    n[t]++;
    const at = order.indexOf(t);
    if (at >= 0) order.splice(at, 1);
    order.push(t); // 마지막에 고른 성향이 맨 뒤
    latest = t;
  }
  const best = Math.max(n.courage, n.trust, n.care);
  if (best === 0) return null;
  // 동률인 성향들 중 가장 최근에 고른 것
  for (let i = order.length - 1; i >= 0; i--) if (n[order[i]] === best) return order[i];
  return latest;
}

const EPILOGUE: Record<Trait, Epilogue> = {
  care: { title: '대단원 · 돌보는 믿음', sub: '당신의 아브라함은 곁에 있는 사람들의 마음을 먼저 살폈습니다' },
  trust: { title: '대단원 · 맡기는 믿음', sub: '당신의 아브라함은 알지 못하는 길을 하나님께 맡기고 고요히 걸었습니다' },
  courage: { title: '대단원 · 담대한 믿음', sub: '당신의 아브라함은 두려움 앞에서도 먼저 입을 열고 앞서 걸었습니다' },
};

/**
 * 이야기 끝(대단원)에 보이는 맺음말 배너: 가장 많은 성향을 따른다 (순수). 선택이 없으면 기본 문구.
 */
export function epilogueFor(picks: ReadonlyMap<string, string>): Epilogue {
  const t = dominantTrait(picks);
  return t ? EPILOGUE[t] : { title: '대단원', sub: '아브라함의 모든 여정을 마쳤습니다' };
}

/** 대단원 맺음말 자막 (성향별 세 줄). 성향이 없으면 빈 배열 — 기존 배너만 보인다. 순수. */
const EPILOGUE_LINES: Record<Trait, string[]> = {
  courage: ['당신의 아브라함은 두려운 자리에서도 먼저 입을 열었습니다.', '왕 앞에서도, 불길 앞에서도, 광야의 길 위에서도 그의 걸음은 앞서 있었습니다.', '그러나 앞서 걷던 이도 끝내 모든 것을 약속의 하나님께 맡겼습니다.'],
  trust: ['당신의 아브라함은 알지 못하는 길을 하나님께 맡기고 고요히 걸었습니다.', '서두르지 않았고, 모든 것을 이기려 하지도 않았습니다.', '맡긴 것들 위에 약속은 별처럼 자라났습니다.'],
  care: ['당신의 아브라함은 곁에 있는 사람들의 마음을 먼저 살폈습니다.', '아들 곁에 앉던 저녁과, 롯을 위해 드린 기도와, 이스마엘에게 건넨 말이 그의 믿음이었습니다.', '그 돌봄이 모여 한 사람을 열국의 아버지로 만들었습니다.'],
};

interface LedgerEntry { book: number; pick: string; lines: Record<string, { ko: string; en: string }> }
export const LEDGER_ENTRIES: ReadonlyArray<LedgerEntry> = ledger.entries as unknown as LedgerEntry[];
export const LEDGER_HEADER: { ko: string; en: string } = ledger.header;

/**
 * 여정의 기록 (순수, 데이터 주도): 권 순서대로 그 권에서 한 선택을 한 줄씩 되짚는다. 한 선택도 없으면 [].
 * 줄은 src/data/ledger.json 에서 온다 (이 게임이 덧붙인 성찰이며 성경 본문이 아니다).
 */
export function journeyLedgerLines(picks: ReadonlyMap<string, string>): string[] {
  const out: string[] = [];
  for (const e of LEDGER_ENTRIES) {
    const tag = picks.get(e.pick);
    const line = tag ? e.lines[tag] : undefined;
    if (line) out.push(line.ko);
  }
  return out.length > 0 ? [LEDGER_HEADER.ko, ...out] : [];
}

/** 대단원 자막: 성향별 맺음말 세 줄 + 여정의 기록. 성향도 기록도 없으면 [] */
export function epilogueLines(picks: ReadonlyMap<string, string>): string[] {
  const t = dominantTrait(picks);
  const base = t ? EPILOGUE_LINES[t] : [];
  return [...base, ...journeyLedgerLines(picks)];
}

/**
 * 선택을 남기는 단계 id 를 이야기 순서대로 (dominantTrait 의 동률 판정이 '가장 최근 선택'이므로 순서가 중요하다).
 * getTrait 가 연결되지 않은 액션 모듈(예: 5권)이 getPick 만으로 같은 성향을 다시 계산하는 데 쓴다.
 */
export const PICK_ORDER: ReadonlyArray<string> = ['palace_answer', 'haran_depart', 'esau_eat', 'war_envoy', 'archery_target', 'sarah_tent', 'satan_elder', 'isaac_field'];

/** getPick 만으로 지금까지의 지배 성향을 구한다 (순수). 선택이 없으면 null */
export function traitFromGetPick(getPick: ((id: string) => string | undefined) | undefined): Trait | null {
  if (!getPick) return null;
  const m = new Map<string, string>();
  for (const id of PICK_ORDER) { const tag = getPick(id); if (tag) m.set(id, tag); }
  return dominantTrait(m);
}
