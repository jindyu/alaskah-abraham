import { describe, expect, it } from 'vitest';
import { ChapterLog, parseLog, serializeLog, wrapHud } from '../src/game/chapterLog';

describe('chapterLog', () => {
  it('직렬화/역직렬화 왕복', () => {
    const s = serializeLog(2, 1, [{ k: 'a', id: 'x' }, { k: 'c', i: 1 }]);
    expect(parseLog(s)).toEqual({ book: 2, chapter: 1, entries: [{ k: 'a', id: 'x' }, { k: 'c', i: 1 }] });
  });
  it('옛 판 번호의 기록은 버린다', () => {
    expect(parseLog('2:1|a:x')).toBeNull();
    expect(parseLog('v0@2:1|a:x')).toBeNull();
  });
  it('깨진 입력은 null', () => {
    expect(parseLog('zzz')).toBeNull();
    expect(parseLog('v1@1:2|q:3')).toBeNull();
    expect(parseLog(5)).toBeNull();
  });
  it('재생 중에는 기록하지 않고 선택지는 기록값으로 응답한다', () => {
    const log = new ChapterLog();
    const calls: string[] = [];
    const hud = { toast: (m: string) => calls.push(m), showChoice: (_p: string, _o: string[], cb: (i: number) => void) => cb(0) };
    const w = wrapHud(hud, log);
    const picked: number[] = [];
    w.showChoice('q', ['a', 'b'], (i) => picked.push(i));
    expect(log.entries).toEqual([{ k: 'c', i: 0 }]);
    const saved = [{ k: 'c', i: 1 }] as const;
    log.startReplay(saved);
    w.toast('조용히');
    w.showChoice('q', ['a', 'b'], (i) => picked.push(i));
    log.endReplay(saved);
    expect(calls).toEqual([]);
    expect(picked).toEqual([0, 1]);
  });
});

describe('chapterLog 상한', () => {
  it('상한을 넘으면 앞을 자르지 않고 저장하지 않는다', () => {
    const many = Array.from({ length: 1001 }, (_, i) => ({ k: 'a' as const, id: `x${i}` }));
    expect(serializeLog(1, 0, many)).toBe('');
    expect(parseLog(serializeLog(1, 0, many.slice(0, 5)))?.entries.length).toBe(5);
  });
});
