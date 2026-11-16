/**
 * 장 내부 진행 기록·복원.
 *
 * 액션 모듈의 진행 상태(몇 번째 단계인지 등)는 클로저 안에 있어 직접 저장할 수 없다.
 * 대신 이 장에서 플레이어가 실행한 상호작용 id 와 선택지 번호를 순서대로 기록해 저장하고,
 * 이어하기 때 **같은 입력을 같은 순서로 조용히 다시 넣어** 같은 상태로 되돌린다.
 * 재생 중에는 토스트·소리·입자·컷신을 끄고, 선택지는 기록된 값으로 자동 응답하고, 지연 실행은 즉시 실행한다.
 */
export type LogEntry = { k: 'a'; id: string } | { k: 'c'; i: number };

export class ChapterLog {
  entries: LogEntry[] = [];
  replaying = false;
  private choices: number[] = [];

  reset(): void { this.entries.length = 0; this.choices.length = 0; }
  recordAct(id: string): void { if (!this.replaying) this.entries.push({ k: 'a', id }); }
  recordChoice(i: number): void { if (!this.replaying) this.entries.push({ k: 'c', i }); }
  /** 재생 중 선택지가 뜨면 기록된 다음 선택지 번호 (없으면 0) */
  nextChoice(): number { const v = this.choices.shift(); return v === undefined ? 0 : v; }
  startReplay(entries: ReadonlyArray<LogEntry>): void {
    this.choices = [];
    for (const e of entries) if (e.k === 'c') this.choices.push(e.i);
    this.replaying = true;
  }
  /** 재생을 끝내고, 이후 저장에도 이어지도록 기록을 그대로 둔다 */
  endReplay(entries: ReadonlyArray<LogEntry>): void {
    this.replaying = false;
    this.choices.length = 0;
    this.entries = entries.slice();
  }
}

// 앞쪽을 잘라 내면 복원 상태가 틀어지므로 넉넉히 잡는다 (항목당 ~12자, 최악 ~12KB). 넘치면 복원하지 않는 편이 낫다 — serializeLog 가 '' 를 돌려준다.
/**
 * 기록 형식·장 콘텐츠 판 번호. 단계 id·선택지 순서를 바꾸는 수정을 하면 올린다 — 옛 기록은 다시 재생하지 않고 버려(장 처음부터), 어긋난 상태로 복원되는 것을 막는다.
 */
export const CHAPTER_LOG_VERSION = 1;
const MAX_ENTRIES = 1000;

/** "권:장|a:id|c:1|…" (순수) */
export function serializeLog(book: number, chapter: number, entries: ReadonlyArray<LogEntry>): string {
  if (entries.length > MAX_ENTRIES) return '';
  const parts = entries.map((e) => (e.k === 'a' ? `a:${e.id}` : `c:${e.i}`));
  return `v${CHAPTER_LOG_VERSION}@${book}:${chapter}|${parts.join('|')}`;
}

export function parseLog(s: unknown): { book: number; chapter: number; entries: LogEntry[] } | null {
  if (typeof s !== 'string') return null;
  const [head, ...parts] = s.split('|');
  const m = new RegExp(`^v${CHAPTER_LOG_VERSION}@(\\d+):(\\d+)$`).exec(head ?? '');
  if (!m) return null;
  const entries: LogEntry[] = [];
  for (const p of parts) {
    if (p.startsWith('a:') && p.length > 2) entries.push({ k: 'a', id: p.slice(2) });
    else if (p.startsWith('c:')) { const i = Number(p.slice(2)); if (Number.isInteger(i) && i >= 0) entries.push({ k: 'c', i }); else return null; }
    else return null;
  }
  return { book: Number(m[1]), chapter: Number(m[2]), entries };
}

type AnyObj = Record<string | symbol, unknown>;

/** 객체의 메서드를 원본에 묶어(this 보존) 돌려주는 프록시. 재생 중에는 quiet 에 든 메서드를 아무것도 안 하게 한다 */
function quietProxy<T extends object>(target: T, log: ChapterLog, quiet: ((prop: string) => boolean) | null): T {
  return new Proxy(target, {
    get(t, prop) {
      const v = (t as AnyObj)[prop];
      if (typeof v === 'function') {
        if (log.replaying && typeof prop === 'string' && (quiet === null || quiet(prop))) return () => undefined;
        return (v as (...a: unknown[]) => unknown).bind(t);
      }
      return v;
    },
    set(t, prop, value) { (t as AnyObj)[prop] = value; return true; },
  });
}

const HUD_QUIET = new Set(['toast', 'celebrate']);

/**
 * HUD: 재생 중 토스트·축하 연출을 끄고, `showChoice` 는 재생 중이면 기록된 번호로 즉시 응답,
 * 평소에는 onSelect 를 감싸 선택 번호를 기록한다. 그 밖의 속성(목표 문구 등)은 그대로 통과한다.
 */
export function wrapHud<T extends object>(hud: T, log: ChapterLog): T {
  return new Proxy(hud, {
    get(t, prop) {
      const v = (t as AnyObj)[prop];
      if (typeof v !== 'function') return v;
      const fn = v as (...a: unknown[]) => unknown;
      if (typeof prop === 'string') {
        if (log.replaying && HUD_QUIET.has(prop)) return () => undefined;
        if (prop === 'showChoice') {
          return (prompt: unknown, options: unknown, onSelect: (i: number) => void) => {
            if (log.replaying) { onSelect(log.nextChoice()); return; }
            fn.call(t, prompt, options, (i: number) => { log.recordChoice(i); onSelect(i); });
          };
        }
      }
      return fn.bind(t);
    },
    set(t, prop, value) { (t as AnyObj)[prop] = value; return true; },
  });
}

/** 소리·입자처럼 재생 중에는 전부 꺼도 되는 객체 */
export function wrapQuiet<T extends object>(obj: T, log: ChapterLog): T {
  return quietProxy(obj, log, null);
}

/** 컷신: 재생 중에는 play 가 곧바로 끝난 것으로 보고 onDone 만 부른다 */
export function wrapCutscene<T extends object>(cutscene: T, log: ChapterLog): T {
  return new Proxy(cutscene, {
    get(t, prop) {
      const v = (t as AnyObj)[prop];
      if (typeof v === 'function') {
        if (log.replaying && prop === 'play') return (_steps: unknown, onDone?: () => void) => { if (onDone) onDone(); };
        return (v as (...a: unknown[]) => unknown).bind(t);
      }
      return v;
    },
    set(t, prop, value) { (t as AnyObj)[prop] = value; return true; },
  });
}
