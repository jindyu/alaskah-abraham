import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Interactions } from '../src/systems/interaction';
import { setupBook2Actions } from '../src/systems/actions/book2Actions';
import { setupBook3Actions } from '../src/systems/actions/book3Actions';
import { setupBook4Actions } from '../src/systems/actions/book4Actions';
import { setupBook5Actions } from '../src/systems/actions/book5Actions';
import { setupBook6Actions } from '../src/systems/actions/book6Actions';
import { cancelTimers } from '../src/game/timers';

/** 어떤 속성·호출도 받아 주는 만능 목 (HUD·오디오·파티클·장면 컨텍스트용) */
function universal(): any {
  return new Proxy(function () {}, {
    get: (_t, p) => (p === 'then' || p === Symbol.toPrimitive ? undefined : universal()),
    apply: () => universal(),
    set: () => true,
  });
}

/** HUD 목: 선택지(choice)가 설정되면 첫 번째 항목을 자동으로 고른다 */
function makeHud(): any {
  const base: Record<string, unknown> = {
    toast() {}, celebrate() {}, unlockCodex() {}, goal: '', hint: '', goalCategory: '', goalProgress: null,
    // showChoice 도 첫 번째 항목을 자동으로 고른다 (hud.choice 와 같은 방식)
    showChoice(_prompt: unknown, _options: unknown, onSelect: (i: number) => void) { setTimeout(() => onSelect(0), 0); },
  };
  let choice: any = null;
  return new Proxy(base, {
    get: (t, p) => {
      if (p === 'choice') return choice;
      return p in t ? t[p as string] : universal();
    },
    set: (t, p, v) => {
      if (p === 'choice') {
        choice = v;
        if (v && typeof v.onSelect === 'function') setTimeout(() => { choice = null; v.onSelect(0); }, 0);
        return true;
      }
      t[p as string] = v;
      return true;
    },
  });
}

/** 컷신 목: 재생 요청 즉시 끝난 것으로 보고 onDone 을 부른다 */
const cutsceneMock = () => ({ running: false, play(_steps: unknown, onDone?: () => void) { if (onDone) onDone(); }, key() {}, abort() {} });

type Setup = (ctx: any) => void;
const RUNNERS: Array<{ name: string; setup: Setup; completeKey: string; stages: string[] }> = [
  { name: '2권', setup: setupBook2Actions, completeKey: 'onBook2Complete', stages: ['shechem_bethel', 'egypt', 'siddim_hobah'] },
  { name: '3권', setup: setupBook3Actions, completeKey: 'onBook3Complete', stages: ['mamre'] },
  { name: '4권', setup: setupBook4Actions, completeKey: 'onBook4Complete', stages: ['mamre', 'sodom'] },
  { name: '5권', setup: setupBook5Actions, completeKey: 'onBook5Complete', stages: ['beersheba', 'moriah', 'shechem_bethel'] },
  { name: '6권', setup: setupBook6Actions, completeKey: 'onBook6Complete', stages: ['hebron_machpelah', 'nahor_well'] },
];

/** 한 무대의 루프를 실제로 구동해 완료 콜백까지 가는지 본다 (무대 전환 콜백은 새 무대로 다시 세팅) */
function drive(setup: Setup, completeKey: string, startStage: string): { completed: boolean; trail: string[] } {
  const interactions = new Interactions();
  let completed = false;
  const trail: string[] = [];
  let stage = startStage;
  const init = (): void => {
    setup({
      interactions, hud: makeHud(), audio: universal(), particles: universal(), cutscene: cutsceneMock(),
      sceneCtx: universal(), stageId: stage,
      [completeKey]: () => { completed = true; },
      onSwitchStage: (id: string) => { stage = id; init(); },
    });
  };
  init();
  // 이동 상호작용(무대 전환)은 자발적 분기다: 그 무대의 다른 일을 몇 바퀴 해도 끝나지 않을 때만 쓴다
  const TRAVEL = new Set(['journey_to_nahor', 'journey_to_moriah', 'twilight_return']);
  let done = new Set<string>();
  let cycles = 0;
  let lastStage = stage;
  for (let step = 0; step < 120 && !completed; step++) {
    if (stage !== lastStage) { lastStage = stage; done = new Set(); cycles = 0; }
    const ids = Array.from(interactions.values(), (it) => it.id);
    const work = ids.filter((i) => !TRAVEL.has(i));
    let id = work.find((i) => !done.has(i));
    if (!id) {
      cycles++;
      done = new Set();
      id = cycles > 6 ? ids.find((i) => TRAVEL.has(i)) ?? work[0] : work[0];
    }
    if (!id) break;
    done.add(id);
    trail.push(stage + ':' + id);
    interactions.get(id)?.act();
    vi.advanceTimersByTime(5000); // after()/setTimeout 체인(대사·선택지)을 흘려보냄
  }
  return { completed, trail };
}

describe('2~6권 액션 루프 런타임 (목 객체로 실제 구동)', () => {
  beforeEach(() => { vi.useFakeTimers(); cancelTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  for (const r of RUNNERS) {
    for (const stage of r.stages) {
      it(`${r.name} ${stage}: 상호작용이 등록되고 루프를 끝내면 완료 콜백이 불린다`, () => {
        const probe = new Interactions();
        r.setup({ interactions: probe, hud: makeHud(), audio: universal(), particles: universal(), cutscene: cutsceneMock(), sceneCtx: universal(), stageId: stage, [r.completeKey]: () => {}, onSwitchStage: () => {} });
        expect(probe.size, `${r.name} ${stage} 상호작용 없음`).toBeGreaterThan(0);
        const { completed, trail } = drive(r.setup, r.completeKey, stage);
        // 무대 전환으로만 이어지는 중간 무대(예: 2권 egypt→, 6권 nahor→hebron)는 전환·완료 둘 중 하나는 일어나야 한다
        expect(completed || trail.some((t) => !t.startsWith(stage + ':')), `${r.name} ${stage} 진행 불가: ${trail.slice(-6).join(' > ')}`).toBe(true);
      });
    }
  }

  for (const r of RUNNERS) {
    it(`${r.name}: 적어도 한 무대에서 루프를 끝내면 실제로 완료 콜백(${r.completeKey})에 도달한다`, () => {
      const results = r.stages.map((st) => ({ st, ...drive(r.setup, r.completeKey, st) }));
      const ok = results.filter((x) => x.completed).map((x) => x.st);
      expect(ok.length, results.map((x) => `${x.st}:${x.completed ? 'OK' : 'x'} [${x.trail.slice(-4).join(' > ')}]`).join(' | ')).toBeGreaterThan(0);
    });
  }
});
