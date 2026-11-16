import type { LegacyStep } from './chapterScript';
import { dialogueOnlySteps, traditionSources, withChapterIntro } from './chapterScript';
import { tr } from '../i18n/tr';
import { after } from './timers';

type BookScript = { default: { chapters: Array<{ steps: LegacyStep[] }> } };

/** 1~6권 대본(JSON)을 필요할 때만 불러오는 지연 로더 (별도 청크) */
export const BOOK_SCRIPTS: Record<number, () => Promise<BookScript>> = {
  1: () => import('../data/books/abraham_1.json') as unknown as Promise<BookScript>,
  2: () => import('../data/books/abraham_2.json') as unknown as Promise<BookScript>,
  3: () => import('../data/books/abraham_3.json') as unknown as Promise<BookScript>,
  4: () => import('../data/books/abraham_4.json') as unknown as Promise<BookScript>,
  5: () => import('../data/books/abraham_5.json') as unknown as Promise<BookScript>,
  6: () => import('../data/books/abraham_6.json') as unknown as Promise<BookScript>,
};

const STAGING_POLL_MS = 400;

export interface ChapterMeta { title?: string; summary?: string; tags?: string[] }

export interface PlaybackDeps {
  getBook: () => number;
  getChapter: () => number;
  /** 권·장 메타데이터 (제목·요약·태그) */
  meta: (book: number, chapter: number) => ChapterMeta | undefined;
  /** 직접 쓴 장면이나 대본이 이미 재생 중인가 */
  busy: () => boolean;
  /** 이 장의 연출(staging)이 재생 중인가 — 그렇다면 연출이 끝난 뒤에 원래 대사를 이어서 보인다 (대사를 건너뛰지 않는다) */
  stagingRunning?: () => boolean;
  playSteps: (steps: unknown[]) => void;
  toast: (key: string, icon: null, text: string, count?: number, life?: number) => void;
  /** 테스트에서 대본 로더를 바꿔 끼울 수 있게 (기본: BOOK_SCRIPTS) */
  loadScript?: (book: number) => Promise<BookScript>;
}

export interface ChapterPlayback {
  /** 장 대본의 대사를 불러와 재생한다 (직접 쓴 장면이 없는 장에서 호출). 실패하면 한 번 다시 시도하고 그래도 안 되면 알린다 */
  play(retry?: boolean): void;
  /** 진행 중인 대본 불러오기 결과를 버린다 (장이 바뀔 때) */
  cancel(): void;
  /** 전승(미드라시·탈무드 등)이 섞인 장은 들어갈 때 출처를 밝힌다 — 없으면 성경 본문을 따르는 장임을 밝힌다 */
  announceTradition(): void;
}

export function createChapterPlayback(d: PlaybackDeps): ChapterPlayback {
  let token = 0;
  const announcedBooks = new Set<number>();
  const load = d.loadScript ?? ((b: number) => BOOK_SCRIPTS[b]());

  function play(retry = true): void {
    const book = d.getBook();
    const chapter = d.getChapter();
    if (book < 1 || book > 6) return;
    if (d.busy()) {
      // 연출이 먼저 나오는 장: 끝날 때까지 기다렸다가 원래 대사를 재생한다 (타이머라 프레임 루프와 무관, 장이 바뀌면 stale 로 버려진다)
      if (d.stagingRunning?.()) {
        const my0 = ++token;
        after(() => { if (my0 === token && book === d.getBook() && chapter === d.getChapter()) play(retry); }, STAGING_POLL_MS);
      }
      return;
    }
    const my = ++token;
    const stale = (): boolean => my !== token || book !== d.getBook() || chapter !== d.getChapter();
    load(book)
      .then((mod) => {
        if (stale()) return; // 그 사이 장이 바뀜
        if (d.busy()) return;
        const steps = withChapterIntro(dialogueOnlySteps(mod.default.chapters[chapter]?.steps ?? []), d.meta(book, chapter)?.summary);
        if (steps.length > 0) d.playSteps(steps as unknown[]);
      })
      .catch((err) => {
        console.error('[chapterScript] 챕터 대본을 불러오지 못했다', err);
        if (stale()) return; // 이미 다른 장
        if (retry) after(() => play(false), 1500); // 네트워크가 잠깐 끊긴 경우를 위해 한 번 다시 시도
        else d.toast('script-load-failed', null, tr('이 장의 이야기를 불러오지 못했다. 연결을 확인하고 장 선택에서 다시 들어오자'), 0, 8);
      });
  }

  function announceTradition(): void {
    const book = d.getBook();
    if (book < 1 || book > 6) return;
    const m = d.meta(book, d.getChapter());
    const sources = traditionSources(m?.tags);
    // 전승이 섞이지 않은 장은 알릴 것이 없다 ('성경 본문을 따르는 장이다' 같은 상투 배너는 화면만 가린다)
    if (sources.length === 0) return;
    // 책마다 한 번만, 한 줄 출처 표기로 (장마다 반복하면 화면만 가린다). 장 번호는 장 선택의 번호와 달라 헷갈리므로 싣지 않는다
    if (announcedBooks.has(book)) return;
    announcedBooks.add(book);
    d.toast('tradition-notice', null, `[${tr('전해오는 이야기')} · ${sources.map((t) => tr(t)).join(', ')}]`, 0, 4);
  }

  return { play, cancel: () => { token++; }, announceTradition };
}
