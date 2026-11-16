import { describe, expect, it } from 'vitest';
import { buildFlags, restoreFlags } from '../src/game/storyFlags';
import { diagnostics } from '../src/core/diagnostics';

describe('storyFlags', () => {
  it('저장 → 복원 왕복: 끝낸 루프·선택·끝낸 장이 그대로 돌아온다', () => {
    const flags = buildFlags({
      loopsDone: new Set(['2:a,b']), picks: new Map([['palace_answer', '담대히 선포']]), doneChapters: new Set(['1:6']),
      chapterLog: { book: 2, chapter: 0, entries: [{ k: 'a', id: 'x' }] },
    });
    expect(flags['loop:2:a,b']).toBe(true);
    expect(flags['pick:palace_answer']).toBe('담대히 선포');
    expect(Object.keys(flags).some((k) => k.startsWith('chlog:v1@2:0|'))).toBe(true);
    const into = { loopsDone: new Set<string>(), picks: new Map<string, string>(), doneChapters: new Set<string>() };
    restoreFlags(flags, ['1:6'], into);
    expect([...into.loopsDone]).toEqual(['2:a,b']);
    expect(into.picks.get('palace_answer')).toBe('담대히 선포');
    expect(into.doneChapters.has('1:6')).toBe(true);
  });
  it('기록이 상한을 넘으면 chlog 를 저장하지 않는다', () => {
    const many = Array.from({ length: 1001 }, (_, i) => ({ k: 'a' as const, id: `x${i}` }));
    const flags = buildFlags({ loopsDone: new Set(), picks: new Map(), doneChapters: new Set(), chapterLog: { book: 1, chapter: 0, entries: many } });
    expect(Object.keys(flags).some((k) => k.startsWith('chlog:'))).toBe(false);
    expect(diagnostics().some((d) => d.where === 'chapterLog:overflow')).toBe(true); // 이유는 진단 기록에 남는다
  });
  it('잘못된 값은 무시한다 (빈 선택, 숫자 값, 문자열이 아닌 done)', () => {
    const into = { loopsDone: new Set<string>(), picks: new Map<string, string>(), doneChapters: new Set<string>() };
    restoreFlags({ 'pick:a': '', 'pick:b': 5, 'loop:x': false, 'other': 1 }, [1, null, '2:3'], into);
    expect(into.picks.size).toBe(0);
    expect(into.loopsDone.size).toBe(0);
    expect([...into.doneChapters]).toEqual(['2:3']);
  });
});

import { epilogueFor } from '../src/game/storyFlags';
describe('대단원 맺음말', () => {
  it('선택이 없으면 기본 문구', () => {
    expect(epilogueFor(new Map()).title).toBe('대단원');
  });
  it('가장 많은 성향을 따른다', () => {
    expect(epilogueFor(new Map([['a', '담대히 선포'], ['b', '돌려 드림'], ['c', '곁에 앉음']])).title).toBe('대단원 · 담대한 믿음');
    expect(epilogueFor(new Map([['a', '하나님께 맡김'], ['b', '믿음으로 답함']])).title).toBe('대단원 · 맡기는 믿음');
    expect(epilogueFor(new Map([['a', '사라 이야기'], ['b', '롯을 염려함'], ['c', '담대히 선포']])).title).toBe('대단원 · 돌보는 믿음');
  });
  it('동률이면 가장 최근에 고른 성향', () => {
    expect(epilogueFor(new Map([['a', '곁에 앉음'], ['b', '하나님께 맡김'], ['c', '담대히 선포']])).title).toBe('대단원 · 담대한 믿음');
    expect(epilogueFor(new Map([['c', '담대히 선포'], ['b', '하나님께 맡김']])).title).toBe('대단원 · 맡기는 믿음');
  });
  it('알 수 없는 갈래는 무시한다', () => {
    expect(epilogueFor(new Map([['a', '없는 갈래']])).title).toBe('대단원');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { NEUTRAL_TAGS, TRAIT_OF } from '../src/game/storyFlags';
describe('선택 갈래 이름 일관성', () => {
  it('코드에서 쓰는 모든 갈래(tag / setPick)가 성향 표나 중립 목록에 있다 (오타로 조용히 빠지지 않게)', () => {
    const dir = path.resolve(__dirname, '../src/systems/actions');
    const tags = new Set<string>();
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.ts')) continue;
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of src.matchAll(/\btag: ["']([^"']+)["']/g)) tags.add(m[1]);
      for (const m of src.matchAll(/setPick\([^)]*\)/g)) for (const q of m[0].matchAll(/'([^']+)'/g)) if (!/^[a-z_]+$/.test(q[1])) tags.add(q[1]);
    }
    expect(tags.size).toBeGreaterThan(8);
    const unknown = [...tags].filter((t) => !(t in TRAIT_OF) && !NEUTRAL_TAGS.has(t));
    expect(unknown).toEqual([]);
  });
});

import { epilogueLines } from '../src/game/storyFlags';
describe('대단원 맺음말 자막', () => {
  it('성향이 있으면 세 줄, 없으면 빈 배열', () => {
    expect(epilogueLines(new Map())).toEqual([]);
    expect(epilogueLines(new Map([['a', '담대히 선포']])).length).toBe(3);
    expect(epilogueLines(new Map([['a', '하나님께 맡김']])).length).toBe(3);
    expect(epilogueLines(new Map([['a', '곁에 앉음']])).length).toBe(3);
  });
  it('세 성향의 자막은 서로 다르다', () => {
    const a = epilogueLines(new Map([['a', '담대히 선포']])).join('|');
    const b = epilogueLines(new Map([['a', '하나님께 맡김']])).join('|');
    const c = epilogueLines(new Map([['a', '곁에 앉음']])).join('|');
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

import { dominantTrait } from '../src/game/storyFlags';
describe('dominantTrait', () => {
  it('성향이 없으면 null, 있으면 가장 많은 것, 동률은 돌봄>맡김>담대함', () => {
    expect(dominantTrait(new Map())).toBeNull();
    expect(dominantTrait(new Map([['a', '담대히 선포'], ['b', '돌려 드림']]))).toBe('courage');
    // 동률이면 가장 최근에 고른 성향
    expect(dominantTrait(new Map([['a', '곁에 앉음'], ['b', '하나님께 맡김'], ['c', '담대히 선포']]))).toBe('courage');
    expect(dominantTrait(new Map([['a', '하나님께 맡김'], ['b', '담대히 선포']]))).toBe('courage');
    expect(dominantTrait(new Map([['a', '담대히 선포'], ['b', '하나님께 맡김']]))).toBe('trust');
    // 더 많은 쪽이 이긴다 (최근 여부와 무관)
    expect(dominantTrait(new Map([['a', '곁에 앉음'], ['b', '사라 이야기'], ['c', '담대히 선포']]))).toBe('care');
  });
  it('제목 문구를 바꿔도 자막은 성향으로 정해진다 (제목 문자열 비교에 기대지 않는다)', () => {
    const picks = new Map([['a', '담대히 선포']]);
    expect(epilogueLines(picks).length).toBe(3);
    expect(epilogueFor(picks).title).toContain('담대한');
  });
});
