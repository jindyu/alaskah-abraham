import { describe, expect, it } from 'vitest';
import { createGameState, loopSignature } from '../src/game/gameState';
import { PROTAGONIST_APPEARANCES, appearanceFor } from '../src/game/protagonists';
import { ARRIVE, createWalkState, resolveMove, stopMove, type MoveInput } from '../src/game/playerMotion';
import { torchIntensity } from '../src/game/gameLights';
import { stageForMapId, toStageId } from '../src/game/chapterFlow';
import { buildSnapshot, toOutcome } from '../src/game/saveSession';
import { ChapterLog } from '../src/game/chapterLog';
import type { Interactable } from '../src/systems/interaction';
import type { SaveData } from '../src/systems/save';
import { DEFAULT_APPEARANCE } from '../src/entities/appearance';
import { layoutCaption, maxWidth } from '../src/ui/hudLayout';
import { createCodexEntries } from '../src/ui/hudCodex';

const save = (over: Partial<SaveData['story']> = {}, rest: Partial<SaveData> = {}): SaveData => ({
  version: 1, savedAt: 0, story: { book: 3, chapter: 2, ...over }, ...rest,
});

describe('gameState', () => {
  it('저장이 없으면 1권 0장에서 시작한다', () => {
    const s = createGameState(null);
    expect([s.book, s.chapter, s.playSeconds]).toEqual([1, 0, 0]);
    expect(s.picks.size + s.loopsDone.size + s.doneChapters.size).toBe(0);
  });
  it('저장된 권·장·플레이 시간·선택·끝낸 장을 되살린다', () => {
    const s = createGameState(save({ flags: { 'loop:2:a,b': true, 'pick:2:1': '양보', junk: 1 }, done: ['1:0', 7 as never] }, { playSeconds: 90 }));
    expect([s.book, s.chapter, s.playSeconds]).toEqual([3, 2, 90]);
    expect(s.loopsDone.has('2:a,b')).toBe(true);
    expect(s.picks.get('2:1')).toBe('양보');
    expect([...s.doneChapters]).toEqual(['1:0']);
  });
  it('루프 식별자는 "권:id,id" 이고 비면 "권:"', () => {
    expect(loopSignature(2, ['a', 'b'])).toBe('2:a,b');
    expect(loopSignature(4, [])).toBe('4:');
  });
});

describe('protagonists', () => {
  it('모든 조작 인물에 이름이 있는 겉모습이 있다', () => {
    for (const id of Object.keys(PROTAGONIST_APPEARANCES) as (keyof typeof PROTAGONIST_APPEARANCES)[]) {
      expect(PROTAGONIST_APPEARANCES[id].name).toBeTruthy();
    }
    expect(Object.keys(PROTAGONIST_APPEARANCES).sort()).toEqual(['abraham', 'abram', 'abram_young', 'eliezer', 'esau', 'lot']);
  });
  it('알 수 없는 인물은 기본 겉모습', () => {
    expect(appearanceFor('nobody' as never)).toBe(DEFAULT_APPEARANCE);
  });
});

describe('playerMotion', () => {
  const out = (): MoveInput => ({ x: 9, z: 9, run: true });
  it('키 입력이 방향·달리기를 정하고 클릭 이동을 취소한다', () => {
    const w = createWalkState(); w.on = true; w.x = 5; w.z = 5;
    const o = out();
    resolveMove(new Set(['KeyD', 'KeyW', 'ShiftLeft']), w, 0, 0, o);
    expect(o).toEqual({ x: 1, z: -1, run: true });
    expect(w.on).toBe(false);
  });
  it('클릭 이동은 목적지 쪽 단위 방향으로 걷는다', () => {
    const w = createWalkState(); w.on = true; w.x = 3; w.z = 4;
    const o = out();
    resolveMove(new Set(), w, 0, 0, o);
    expect(o.x).toBeCloseTo(0.6); expect(o.z).toBeCloseTo(0.8); expect(o.run).toBe(false);
    expect(w.on).toBe(true);
  });
  it('도착하면 멈추고 대상 행동을 한 번 실행한다', () => {
    let acts = 0;
    const w = createWalkState();
    w.on = true; w.x = 1; w.z = 0; w.act = { r: 1, act: () => { acts++; } } as unknown as Interactable;
    const o = out();
    resolveMove(new Set(), w, 1 - (ARRIVE + 1) / 2, 0, o);
    expect(acts).toBe(1);
    expect([w.on, w.act, o.x, o.z]).toEqual([false, null, 0, 0]);
  });
  it('stopMove 는 입력을 비운다', () => {
    const o = out(); stopMove(o);
    expect(o).toEqual({ x: 0, z: 0, run: false });
  });
});

describe('gameLights / chapterFlow 보조', () => {
  it('횃불은 풀무·소돔 무대에서만 켜진다', () => {
    expect(torchIntensity('ur_furnace', 1000)).toBeGreaterThan(1);
    expect(torchIntensity('sodom', 5)).toBeGreaterThan(1);
    expect(torchIntensity('mamre', 1000)).toBe(0);
    expect(torchIntensity(null, 0)).toBe(0);
  });
  it('맵 ID 를 무대로 바꾸고 모르는 ID 는 우르 공방', () => {
    expect(stageForMapId('FURNACE')).toBe('ur_furnace');
    expect(stageForMapId('MORIAH')).toBe('moriah');
    expect(stageForMapId('???')).toBe('ur_workshop');
  });
  it('toStageId 는 모르는 무대에 즉시 오류', () => {
    expect(toStageId('sodom')).toBe('sodom');
    expect(() => toStageId('atlantis')).toThrow(/알 수 없는 무대/);
  });
});

describe('saveSession', () => {
  it('스냅샷은 권·장·위치·플레이 시간(내림)·끝낸 장을 담는다', () => {
    const s = createGameState(null);
    s.book = 2; s.chapter = 5; s.playSeconds = 12.9; s.doneChapters.add('1:0'); s.picks.set('2:1', '양보');
    const snap = buildSnapshot(s, new ChapterLog(), 1.5, -2, 'mamre');
    expect(snap.story.book).toBe(2);
    expect(snap.story.chapter).toBe(5);
    expect(snap.story.done).toEqual(['1:0']);
    expect(snap.player).toEqual({ x: 1.5, z: -2 });
    expect(snap.playSeconds).toBe(12);
    expect(snap.stageId).toBe('mamre');
    expect(snap.story.flags?.['pick:2:1']).toBe('양보');
  });
  it('쓰기 결과를 WriteOutcome 으로 바꾼다', () => {
    expect(toOutcome({ result: 'ok' })).toBe(true);
    expect(toOutcome({ result: 'conflict', reason: 'conflict' })).toBe('conflict');
    expect(toOutcome({ result: 'fail', reason: 'quota' })).toBe('quota');
  });
});

describe('HUD 배치 보조', () => {
  const fakeHud = { w: 1000, txt: (s: string) => ({ width: s.length * 10, height: 10, len: s.length }), tw: (c: { width: number }) => c.width } as never;
  it('maxWidth 는 스프레드 없이 최댓값을 구하고 빈 배열은 0', () => {
    expect(maxWidth([3, 9, 4])).toBe(9);
    expect(maxWidth([])).toBe(0);
  });
  it('짧은 자막은 한 줄, 폭 정보를 돌려준다', () => {
    const l = layoutCaption(fakeHud, { text: '안녕하세요' } as never, 14, false, false);
    expect(l.lines).toEqual(['안녕하세요']);
    expect(l.widths).toEqual([50]);
    expect(l.maxW).toBe(50);
  });
  it('긴 음성 자막은 가운데 공백에서 두 줄로 나눈다', () => {
    const text = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const l = layoutCaption(fakeHud, { text } as never, 14, true, false);
    expect(l.lines.length).toBe(2);
  });
  it('도감 항목은 호출마다 새 사본이고 id 가 중복되지 않는다', () => {
    const a = createCodexEntries(), b = createCodexEntries();
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
    expect(new Set(a.map((e) => e.id)).size).toBe(a.length);
    expect(a.length).toBeGreaterThan(30);
  });
});
