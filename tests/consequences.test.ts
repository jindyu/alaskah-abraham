import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { StageManager, type StageId } from '../src/world/stageManager';
import { Interactions } from '../src/systems/interaction';
import { setupBook2Actions } from '../src/systems/actions/book2Actions';
import { setupBook3Actions } from '../src/systems/actions/book3Actions';
import { setupBook4Actions } from '../src/systems/actions/book4Actions';
import { setupBook5Actions } from '../src/systems/actions/book5Actions';
import { setupBook6Actions } from '../src/systems/actions/book6Actions';
import { createBook6EpilogueSteps, createMoriahAftermathSteps, epilogueSubOf, type EpilogueSub } from '../src/systems/actions/consequenceScenes';
import { TRAIT_OF, NEUTRAL_TAGS, traitFromGetPick } from '../src/game/storyFlags';
import type { Trait } from '../src/systems/actions/pickTypes';
import en from '../src/i18n/en.json';
import extra from '../src/i18n/en_extra.json';

function noop(): any {
  return new Proxy(function () {}, { get: (_t, p) => (p === 'then' || p === Symbol.toPrimitive ? undefined : noop()), apply: () => noop(), set: () => true });
}
/** 대입한 값을 기억하는 hud — goalProgress, choice 를 읽을 수 있다 */
function makeHud(): any {
  const store: Record<string | symbol, unknown> = {};
  return new Proxy(store, {
    get: (t, p) => (p in t ? t[p] : noop()),
    set: (t, p, v) => { t[p] = v; return true; },
  });
}
interface Played { steps: Array<Record<string, unknown>> }
function makeCutscene(log: Played[]): any {
  return { play(steps: Array<Record<string, unknown>>, cb?: () => void) { log.push({ steps }); cb?.(); } };
}
const picksOf = (m: Record<string, string>) => (id: string) => m[id];
const captions = (p: Played[]): string[] => p.flatMap((x) => x.steps.filter((s) => typeof s.caption === 'string').map((s) => s.caption as string));

function base(stageId: string, chapterIndex: number, picks: Record<string, string>, extraCtx: object = {}) {
  const hud = makeHud();
  const interactions = new Interactions();
  const played: Played[] = [];
  const ctx: any = { interactions, hud, audio: noop(), particles: noop(), cutscene: makeCutscene(played), sceneCtx: noop(), stageId, chapterIndex, getPick: picksOf(picks), setPick: () => undefined, ...extraCtx };
  return { hud, interactions, played, ctx };
}
const ids = (i: Interactions): string[] => [...i.values()].map((v) => v.id);
const reachable = (stageId: StageId, i: Interactions, only: string[]): void => {
  const stage = new StageManager(new THREE.Scene()).loadStage(stageId);
  for (const it of i.values()) {
    if (!only.includes(it.id)) continue;
    const p = it.pos();
    let ok = !stage.col.blocked(p.x, p.z, 0.35);
    for (let a = 0; a < 16 && !ok; a++) for (const rad of [1, 2]) {
      const ang = (a / 16) * Math.PI * 2;
      if (rad <= it.r && !stage.col.blocked(p.x + Math.cos(ang) * rad, p.z + Math.sin(ang) * rad, 0.35)) ok = true;
    }
    expect(ok, `${it.id} 가 막힌 곳에 있다`).toBe(true);
  }
};

/** 단계형 루프: 선택에 따라 단계가 더해지고(총 단계 수 +1), 마무리 지점은 그 단계를 끝내야 열린다 */
describe('중반 선택 → 단계형 루프의 새 단계 (beatLoop when)', () => {
  const cases: Array<{ name: string; setup: (c: any) => void; stage: StageId; ch: number; pick: Record<string, string>; added: string; absent: Record<string, string> }> = [
    { name: '2권 5장 궁정 · 담대히 선포 → 선포의 메아리', setup: setupBook2Actions, stage: 'ur_palace', ch: 4, pick: { palace_answer: '담대히 선포' }, added: 'war_boast', absent: {} },
    { name: '2권 5장 궁정 · 침묵으로 맞섬 → 침묵의 불안', setup: setupBook2Actions, stage: 'ur_palace', ch: 4, pick: { palace_answer: '침묵으로 맞섬' }, added: 'war_hush', absent: {} },
    { name: '4권 5장 그랄 · 활을 가르침 → 이스마엘 안부', setup: setupBook4Actions, stage: 'beersheba', ch: 4, pick: { archery_target: '활을 가르침' }, added: 'heal_ishmael', absent: { archery_target: '지켜봐 줌' } },
    { name: '4권 5장 그랄 · 롯을 염려함 → 롯의 소식', setup: setupBook4Actions, stage: 'beersheba', ch: 4, pick: { war_envoy: '롯을 염려함' }, added: 'heal_lot', absent: { war_envoy: '하나님께 맡김' } },
    { name: '6권 3장 · 모리아 길의 대답 → 모리아의 날', setup: setupBook6Actions, stage: 'beersheba', ch: 2, pick: { satan_elder: '믿음으로 답함' }, added: 'isaac_ram', absent: {} },
    { name: '6권 4장 · 활을 가르침 → 이스마엘에게 소식', setup: setupBook6Actions, stage: 'beersheba', ch: 3, pick: { archery_target: '활을 가르침' }, added: 'oath_ishmael', absent: { archery_target: '지켜봐 줌' } },
    { name: '6권 6장 · 활을 가르침 → 이스마엘의 몫', setup: setupBook6Actions, stage: 'beersheba', ch: 5, pick: { archery_target: '활을 가르침' }, added: 'dusk_ishmael', absent: { archery_target: '지켜봐 줌' } },
    { name: '6권 6장 · 롯을 염려함 → 롯에게 안부', setup: setupBook6Actions, stage: 'beersheba', ch: 5, pick: { war_envoy: '롯을 염려함' }, added: 'dusk_lot', absent: { war_envoy: '하나님께 맡김' } },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const yes = base(c.stage, c.ch, c.pick, { onBook2Complete: () => undefined, onBook4Complete: () => undefined, onBook6Complete: () => undefined });
      c.setup(yes.ctx);
      const no = base(c.stage, c.ch, c.absent, { onBook2Complete: () => undefined, onBook4Complete: () => undefined, onBook6Complete: () => undefined });
      c.setup(no.ctx);
      expect(ids(yes.interactions)).toContain(c.added);
      expect(ids(no.interactions)).not.toContain(c.added);
      // 단계가 하나 더 생겨 해야 할 일이 늘어난다
      expect(yes.hud.goalProgress.total).toBe(no.hud.goalProgress.total + 1);
      reachable(c.stage, yes.interactions, [c.added]);
    });
  }
  it('같은 장에서 서로 다른 선택은 서로 다른 단계 묶음을 만든다 (궁정: 선포/침묵/무선택 = 3가지)', () => {
    const sets = ['담대히 선포', '침묵으로 맞섬', ''].map((t) => {
      const b = base('ur_palace', 4, t ? { palace_answer: t } : {}, { onBook2Complete: () => undefined });
      setupBook2Actions(b.ctx);
      return ids(b.interactions).join(',');
    });
    expect(new Set(sets).size).toBe(3);
  });
});

describe('중반 선택 → 손으로 짠 장면의 기계적 변화', () => {
  it('3권: 활을 가르친 아브라함에게만 장막에서 셋째 선택지(이스마엘을 위한 간구)가 열리고, 고르면 그 갈래가 기록되고 장면이 달라진다', () => {
    const run = (taught: boolean, pickIdx?: number) => {
      const picked: Array<[string, string]> = [];
      const b = base('mamre', 0, taught ? { archery_target: '활을 가르침' } : { archery_target: '지켜봐 줌' }, { setPick: (i: string, t: string) => picked.push([i, t]), onBook3Complete: () => undefined });
      setupBook3Actions(b.ctx);
      // 순서대로 앞 단계를 모두 지나 장막에 이른다
      for (const id of ['stars_vista', 'altar_covenant']) b.interactions.get(id)!.act();
      b.hud.showChoice = (_p: string, _o: unknown, cb: (i: number) => void) => cb(0);
      b.interactions.get('archery_target')!.act();
      b.interactions.get('new_name_ceremony')!.act();
      b.interactions.get('sarah_tent')!.act();
      const opts = b.hud.choice.options as Array<{ text: string }>;
      if (pickIdx !== undefined) b.hud.choice.onSelect(pickIdx);
      return { opts, picked, played: b.played };
    };
    const taught = run(true, 2);
    const not = run(false);
    expect(taught.opts.length).toBe(3);
    expect(not.opts.length).toBe(2);
    expect(taught.picked.some(([i, t]) => i === 'sarah_tent' && t === '이스마엘을 위한 간구')).toBe(true);
    expect(captions(taught.played).join('|')).toContain('이스마엘');
    // 새 갈래도 성향(돌봄)을 가진다 — 대단원 계산에 반영된다
    expect(TRAIT_OF['이스마엘을 위한 간구']).toBe('care');
    expect(NEUTRAL_TAGS.has('이스마엘을 위한 간구')).toBe(false);
  });

  it('5권: 활을 가르쳤다면 하갈을 보낸 뒤 활을 건넬 수 있는 새 상호작용이 생긴다 (아니면 없다)', () => {
    const mk = (pk: Record<string, string>) => { const b = base('beersheba', 0, pk, { onBook5Complete: () => undefined }); setupBook5Actions(b.ctx); return b; };
    const yes = mk({ archery_target: '활을 가르침' });
    const no = mk({ archery_target: '지켜봐 줌' });
    expect(ids(yes.interactions)).toContain('ishmael_bow_gift');
    expect(ids(no.interactions)).not.toContain('ishmael_bow_gift');
    const bow = yes.interactions.get('ishmael_bow_gift')!;
    expect(bow.label()).toBeNull(); // 하갈을 보내기 전에는 닿지 않는다
    yes.interactions.get('feast_table')!.act();
    yes.interactions.get('hagar_waterskin')!.act();
    expect(bow.label()).toBeTruthy();
    bow.act();
    expect(bow.label()).toBeNull();
    reachable('beersheba', yes.interactions, ['ishmael_bow_gift']);
  });
});

const TRAITS: Trait[] = ['courage', 'trust', 'care'];
const SUBS: EpilogueSub[] = ['곁에 앉음', '사라 이야기', 'none'];

describe('대단원 변형', () => {
  it('성향 3 × 이삭 곁의 저녁 3 = 9가지 대단원이 모두 서로 다르다 (성향별로 3가지씩)', () => {
    const seen = new Set<string>();
    for (const t of TRAITS) {
      const perTrait = new Set<string>();
      for (const s of SUBS) {
        const key = createBook6EpilogueSteps(t, s).map((x: any) => x.caption).join('|');
        expect(key.length).toBeGreaterThan(0);
        perTrait.add(key); seen.add(key);
      }
      expect(perTrait.size).toBe(3);
    }
    expect(seen.size).toBe(9);
    expect(createBook6EpilogueSteps(null, 'none')).toEqual([]);
  });

  it('모리아 뒤 장면은 성향마다 다르고, 성향이 없으면 기존 흐름 그대로 비어 있다', () => {
    const keys = TRAITS.map((t) => createMoriahAftermathSteps(t).map((x: any) => x.caption).join('|'));
    expect(new Set(keys).size).toBe(3);
    expect(createMoriahAftermathSteps(null)).toEqual([]);
  });

  it('epilogueSubOf: 알 수 없는 갈래는 none', () => {
    expect(epilogueSubOf('곁에 앉음')).toBe('곁에 앉음');
    expect(epilogueSubOf('사라 이야기')).toBe('사라 이야기');
    expect(epilogueSubOf(undefined)).toBe('none');
    expect(epilogueSubOf('엉뚱한')).toBe('none');
  });

  // 성향이 지배하도록 고르는 선택 묶음
  const PICKS: Record<Trait, Record<string, string>> = {
    courage: { palace_answer: '담대히 선포', haran_depart: '새벽에 서둘러', satan_elder: '돌려 드림' },
    trust: { palace_answer: '침묵으로 맞섬', war_envoy: '하나님께 맡김', sarah_tent: '할례 언약' },
    care: { haran_depart: '아버지를 기리며', archery_target: '활을 가르침', isaac_field: '곁에 앉음' },
  };
  for (const t of TRAITS) it(`traitFromGetPick: ${t} 묶음은 ${t} 성향이다`, () => {
    expect(traitFromGetPick(picksOf(PICKS[t]))).toBe(t);
  });
  it('traitFromGetPick: 선택이 없으면 null', () => { expect(traitFromGetPick(picksOf({}))).toBeNull(); expect(traitFromGetPick(undefined)).toBeNull(); });

  /** 6권 헤브론: 안식 장면에서 실제로 재생되는 단계를 모아 본다 */
  const playFinale = (picks: Record<string, string>, getTrait?: () => Trait | null) => {
    const b = base('hebron_machpelah', 0, picks, { onBook6Complete: () => undefined, onSwitchStage: () => undefined, ...(getTrait ? { getTrait } : {}) });
    setupBook6Actions(b.ctx);
    b.interactions.get('machpelah_tomb')!.act();
    b.interactions.get('ephron_scale')!.act();
    b.hud.choice.onSelect(0);
    b.played.length = 0;
    b.interactions.get('abraham_resting_place')!.act();
    return captions(b.played);
  };
  it('6권 안식 장면: 성향×저녁 9가지 조합이 실제로 서로 다른 자막을 재생한다', () => {
    const seen = new Set<string>();
    for (const t of TRAITS) for (const s of SUBS) {
      const picks = { ...PICKS[t] }; delete picks.isaac_field;
      if (s !== 'none') picks.isaac_field = s;
      const caps = playFinale(picks, () => t);
      expect(caps.join('|')).toContain((createBook6EpilogueSteps(t, s)[1] as any).caption);
      seen.add(caps.join('|'));
    }
    expect(seen.size).toBe(9);
  });
  it('6권 안식 장면: 선택이 없으면 성향 맺음을 더하지 않는다 / getTrait 없이도 getPick 으로 같은 성향을 계산한다', () => {
    const none = playFinale({});
    const careCaps = playFinale(PICKS.care);
    expect(careCaps.length).toBe(none.length + 5); // 성향 한 줄 + 대단원 장면 설명 한 줄 + 변형 세 줄
    expect(careCaps.join('|')).toContain('돌봄이 모여');
  });

  /** 5권 모리아: 여호와 이레 뒤 성향별 장면 */
  const playMoriah = (picks: Record<string, string>) => {
    let completed = false;
    const b = base('moriah', 0, picks, { onBook5Complete: () => { completed = true; } });
    setupBook5Actions(b.ctx);
    b.hud.choice = null;
    for (const id of ['donkey_basecamp', 'wood_pile', 'trail_climb', 'akedah_altar']) {
      b.interactions.get(id)!.act();
      if (b.hud.choice && b.hud.choice.onSelect) b.hud.choice.onSelect(0);
    }
    b.interactions.get('ram_in_thicket')!.act();
    return { caps: captions(b.played), completed };
  };
  it('5권 모리아 뒤: 성향별 세 가지 장면이 서로 다르고 끝나면 장이 완료된다', () => {
    const outs = TRAITS.map((t) => playMoriah(PICKS[t]));
    for (const o of outs) expect(o.completed).toBe(true);
    expect(new Set(outs.map((o) => o.caps.join('|'))).size).toBe(3);
    expect(outs[2].caps.join('|')).toContain('손목');
    const none = playMoriah({});
    expect(none.completed).toBe(true);
    expect(none.caps.length).toBe(outs[0].caps.length - 2);
  });
});

describe('새 문자열 영어 번역', () => {
  it('consequenceScenes·새 단계의 한국어 문구가 en_extra/en 에 모두 있다', () => {
    const table = new Set([...Object.keys(en), ...Object.keys(extra)]);
    const need: string[] = [];
    for (const t of TRAITS) {
      for (const s of createMoriahAftermathSteps(t)) need.push((s as any).caption);
      for (const s of SUBS) for (const x of createBook6EpilogueSteps(t, s)) need.push((x as any).caption);
    }
    for (const k of need) expect(table.has(k), `번역 없음: ${k.slice(0, 30)}`).toBe(true);
  });
});
