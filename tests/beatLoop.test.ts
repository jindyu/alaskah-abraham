import { describe, expect, it } from 'vitest';
import { Interactions } from '../src/systems/interaction';
import { addBeatLoop } from '../src/systems/actions/beatLoop';
import type { Hud } from '../src/ui/hud';
import type { AudioManager } from '../src/audio/audioManager';

describe('beatLoop', () => {
  it('앞 단계를 끝내야 다음이 열리고, 모두 끝나면 마무리로 완료된다', () => {
    const interactions = new Interactions();
    const toasts: string[] = [];
    const hud = { goal: '', goalProgress: null, toast: (_k: string, _i: unknown, m: string) => toasts.push(m) } as unknown as Hud;
    const audio = { playVoiceBlip: () => undefined } as unknown as AudioManager;
    let completed = 0;
    addBeatLoop({
      interactions, hud, audio, goalTitle: 't',
      beats: [
        { id: 'a', x: 0, z: 0, label: 'A', toast: 'ta', goalItem: 'ga' },
        { id: 'b', x: 1, z: 1, label: 'B', toast: 'tb', goalItem: 'gb' },
      ],
      finishLabel: 'F', finishX: 0, finishZ: 0, onComplete: () => { completed++; },
    });
    expect(interactions.get('b')!.label()).toBeNull();
    expect(interactions.get('b_end')!.label()).toBeNull();
    interactions.get('b')!.act(); // 순서 어김: 무시
    expect(toasts).toEqual([]);
    interactions.get('a')!.act();
    expect(interactions.get('b')!.label()).toBe('B');
    interactions.get('b')!.act();
    expect(hud.goalProgress).toEqual({ current: 2, total: 2, label: '2/2' });
    interactions.get('b_end')!.act();
    expect(completed).toBe(1);
  });
});

import { setupBook1Beats } from '../src/systems/actions/book1Beats';
describe('book1Beats', () => {
  it('궁정·풀무불·하란·에서 진영 장에 루프를 걸고 그 밖의 장은 걸지 않는다', () => {
    const mk = () => ({
      interactions: new Interactions(),
      hud: { goal: '', goalProgress: null, toast: () => undefined } as unknown as Hud,
      audio: { playVoiceBlip: () => undefined } as unknown as AudioManager,
      onComplete: () => undefined,
    });
    for (const [stage, ch] of [['ur_palace', 6], ['ur_furnace', 7], ['haran', 9], ['esau_camp', 11]] as const) {
      const d = mk();
      expect(setupBook1Beats({ ...d, stageId: stage, chapterIndex: ch })).toBe(true);
      expect(d.interactions.size).toBe(5);
    }
    expect(setupBook1Beats({ ...mk(), stageId: 'esau_camp', chapterIndex: 12 })).toBe(false);
  });
});

describe('beatLoop 선택지 단계', () => {
  it('틀린 답은 답만 보여 주고 단계를 끝내지 않으며, 맞는 답을 골라야 끝난다', () => {
    const interactions = new Interactions();
    const toasts: string[] = [];
    let cb: ((i: number) => void) | null = null;
    const hud = {
      goal: '', goalProgress: null,
      toast: (_k: string, _i: unknown, m: string) => toasts.push(m),
      showChoice: (_p: string, _o: unknown[], f: (i: number) => void) => { cb = f; },
    } as unknown as Hud;
    const audio = { playVoiceBlip: () => undefined } as unknown as AudioManager;
    addBeatLoop({
      interactions, hud, audio, goalTitle: 't',
      beats: [{
        id: 'c', x: 0, z: 0, label: 'C', toast: '끝', goalItem: 'g',
        choice: { prompt: 'q', options: [{ text: '틀림', reply: 'no', ok: false }, { text: '맞음', reply: 'yes', ok: true }] },
      }],
      finishLabel: 'F', finishX: 0, finishZ: 0, onComplete: () => undefined,
    });
    interactions.get('c')!.act();
    cb!(0);
    expect(toasts).toEqual(['no']);
    expect(interactions.get('c_end')!.label()).toBeNull(); // 아직 안 끝남
    expect(interactions.get('c')!.label()).toBe('C');
    interactions.get('c')!.act();
    cb!(1);
    expect(toasts).toEqual(['no', 'yes', '끝']);
    expect(interactions.get('c_end')!.label()).toBe('F');
  });
});

describe('beatLoop 갈래 선택', () => {
  it('맞는 답이 여럿이면 고른 갈래가 목표 패널에 남는다', () => {
    const interactions = new Interactions();
    let cb: ((i: number) => void) | null = null;
    const hud = { goal: '', goalProgress: null, toast: () => undefined, showChoice: (_p: string, _o: unknown[], f: (i: number) => void) => { cb = f; } } as unknown as Hud;
    const audio = { playVoiceBlip: () => undefined } as unknown as AudioManager;
    addBeatLoop({
      interactions, hud, audio, goalTitle: 't',
      beats: [{ id: 'b', x: 0, z: 0, label: 'B', toast: 'x', goalItem: '결정하기', choice: { prompt: 'q', options: [
        { text: 'a', reply: 'ra', ok: true, tag: '갈래A' }, { text: 'b', reply: 'rb', ok: true, tag: '갈래B' }] } }],
      finishLabel: 'F', finishX: 0, finishZ: 0, onComplete: () => undefined,
    });
    interactions.get('b')!.act();
    cb!(1);
    expect(hud.goal).toContain('결정하기 — 갈래B');
  });
});

describe('선택의 결과가 이후 장에 반영', () => {
  it('궁정에서 담대히 선포했다면 풀무불 장면 대사가 달라진다', () => {
    const run = (tag: string | undefined): string => {
      const interactions = new Interactions();
      const toasts: string[] = [];
      const hud = { goal: '', goalProgress: null, toast: (_k: string, _i: unknown, m: string) => toasts.push(m), showChoice: () => undefined } as unknown as Hud;
      const audio = { playVoiceBlip: () => undefined } as unknown as AudioManager;
      setupBook1Beats({
        interactions, hud, audio, stageId: 'ur_furnace', chapterIndex: 7, onComplete: () => undefined,
        getPick: (id) => (id === 'palace_answer' ? tag : undefined), setPick: () => undefined,
      });
      for (const id of ['furnace_heat', 'furnace_pray', 'furnace_crowd', 'furnace_bold', 'furnace_calm', 'furnace_walk']) interactions.get(id)?.act();
      return toasts[toasts.length - 1];
    };
    expect(run('담대히 선포')).toContain('담대히 선포했던');
    expect(run('침묵으로 맞섬')).toContain('침묵으로 맞섰던');
    expect(run(undefined)).not.toContain('궁정에서');
  });
});

describe('선택이 해야 할 일을 바꾼다', () => {
  it('궁정 선택에 따라 풀무불 장에 서로 다른 추가 단계가 생긴다', () => {
    const mk = (tag: string | undefined) => {
      const interactions = new Interactions();
      const hud = { goal: '', goalProgress: null, toast: () => undefined, showChoice: () => undefined } as unknown as Hud;
      const audio = { playVoiceBlip: () => undefined } as unknown as AudioManager;
      setupBook1Beats({ interactions, hud, audio, stageId: 'ur_furnace', chapterIndex: 7, onComplete: () => undefined,
        getPick: (id) => (id === 'palace_answer' ? tag : undefined), setPick: () => undefined });
      return interactions;
    };
    const bold = mk('담대히 선포'), calm = mk('침묵으로 맞섬'), none = mk(undefined);
    expect(!!bold.get('furnace_bold')).toBe(true);
    expect(!!bold.get('furnace_calm')).toBe(false);
    expect(!!calm.get('furnace_calm')).toBe(true);
    expect(!!calm.get('furnace_bold')).toBe(false);
    expect(!!none.get('furnace_bold') || !!none.get('furnace_calm')).toBe(false);
    expect(bold.size).toBe(none.size + 1);
  });
});
