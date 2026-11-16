import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChapterPlayback, type PlaybackDeps } from '../src/game/chapterPlayback';
import { cancelTimers } from '../src/game/timers';

type Script = { default: { chapters: Array<{ steps: unknown[] }> } };
const script = (steps: unknown[]): Script => ({ default: { chapters: [{ steps }, { steps }] } });
const dlg = [{ step_type: 'dialogue', speaker: '아브람', text: '안녕' }];

function mk(over: Partial<PlaybackDeps> = {}) {
  const state = { book: 2, chapter: 0, busy: false };
  const played: unknown[][] = [];
  const toasts: string[] = [];
  const deps: PlaybackDeps = {
    getBook: () => state.book,
    getChapter: () => state.chapter,
    meta: () => ({ title: '제목', summary: '요약', tags: [] }),
    busy: () => state.busy,
    playSteps: (s) => { played.push(s); },
    toast: (k) => { toasts.push(k); },
    loadScript: async () => script(dlg),
    ...over,
  };
  return { state, played, toasts, pb: createChapterPlayback(deps) };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('chapterPlayback', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { cancelTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('대본을 불러와 대사 재생을 요청한다', async () => {
    const t = mk();
    t.pb.play();
    await flush();
    expect(t.played.length).toBe(1);
  });
  it('이미 재생 중(busy)이면 아무것도 하지 않는다', async () => {
    const t = mk();
    t.state.busy = true;
    t.pb.play();
    await flush();
    expect(t.played.length).toBe(0);
  });
  it('연출(staging)이 재생 중이면 끝날 때까지 기다렸다가 원래 대사를 이어서 재생한다 (대사 유실 없음)', async () => {
    const st = { staging: true };
    const t = mk({ stagingRunning: () => st.staging });
    t.state.busy = true;
    t.pb.play();
    await flush();
    expect(t.played.length).toBe(0);
    await vi.advanceTimersByTimeAsync(1200); // 아직 연출 중
    await flush();
    expect(t.played.length).toBe(0);
    t.state.busy = false; st.staging = false; // 연출 끝
    await vi.advanceTimersByTimeAsync(500);
    await flush();
    expect(t.played.length).toBe(1);
  });
  it('연출을 기다리는 사이 장이 바뀌면 이전 장의 대사는 재생하지 않는다', async () => {
    const t = mk({ stagingRunning: () => true });
    t.state.busy = true;
    t.pb.play();
    await flush();
    t.state.chapter = 1; t.state.busy = false;
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(t.played.length).toBe(0);
  });
  it('연출이 아닌 다른 재생(직접 쓴 장면)이 busy 이면 기다리지 않고 건너뛴다', async () => {
    const t = mk({ stagingRunning: () => false });
    t.state.busy = true;
    t.pb.play();
    await flush();
    t.state.busy = false;
    await vi.advanceTimersByTimeAsync(2000);
    await flush();
    expect(t.played.length).toBe(0);
  });
  it('불러오는 사이 장이 바뀌면 결과를 버린다', async () => {
    const t = mk();
    t.pb.play();
    t.state.chapter = 1; // 그 사이 다른 장으로
    await flush();
    expect(t.played.length).toBe(0);
  });
  it('cancel() 하면 진행 중이던 불러오기 결과를 버린다', async () => {
    const t = mk();
    t.pb.play();
    t.pb.cancel();
    await flush();
    expect(t.played.length).toBe(0);
  });
  it('실패하면 한 번 다시 시도하고, 그래도 실패하면 알린다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let calls = 0;
    const t = mk({ loadScript: async () => { calls++; throw new Error('network'); } });
    t.pb.play();
    await flush();
    expect(calls).toBe(1);
    expect(t.toasts).not.toContain('script-load-failed');
    await vi.advanceTimersByTimeAsync(1600);
    await flush();
    expect(calls).toBe(2);
    expect(t.toasts).toContain('script-load-failed');
  });
  it('전승 태그가 없으면 안내를 띄우지 않고, 있으면 출처 안내를 띄운다', () => {
    const none = mk({ meta: () => ({ title: 't', tags: [] }) });
    none.pb.announceTradition();
    expect(none.toasts).toEqual([]);
    const tradition = mk({ meta: () => ({ title: 't', tags: ['미드라시'] }) });
    tradition.pb.announceTradition();
    expect(tradition.toasts).toEqual(['tradition-notice']);
    tradition.pb.announceTradition(); // 같은 권에서는 다시 띄우지 않는다
    expect(tradition.toasts).toEqual(['tradition-notice']);
    tradition.state.book = 3; // 다른 권에서는 다시 한 번
    tradition.pb.announceTradition();
    expect(tradition.toasts.length).toBe(2);
  });
  it('인트로·아우트로(0, 7권)는 대본·안내를 건너뛴다', async () => {
    const t = mk();
    t.state.book = 0;
    t.pb.play();
    t.pb.announceTradition();
    await flush();
    expect(t.played.length).toBe(0);
    expect(t.toasts.length).toBe(0);
  });
});
