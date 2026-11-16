import type { Step } from '../cutscene/cutscene';
import type { Trait } from './pickTypes';
import type { SceneContext } from '../scenes/book1/book1Scenes';
import { Actor } from '../../entities/actor';
import { buildStagingProp } from '../scenes/staging/chapterStaging';
import data from '../../data/consequences.json';

/**
 * 앞서 한 선택이 결과를 바꾸는 짧은 장면들 (자막 단계만 쓴다 — 기존 Cutscene 단계 형식 그대로).
 * 자막 본문은 코드에 두지 않고 src/data/consequences.json (ko/en)에서 읽는다.
 * 성경 본문과 이 게임이 덧붙인 성찰(선택에 따른 맺음)은 구분해 쓴다: 맺음 줄은 "당신의 아브라함은…" 으로 시작해 본문이 아님을 드러낸다.
 */
export interface ConsequenceLine { ko: string; en: string; hold?: number }

const DEFAULT_HOLD = 5.5;
const TRAITS: ReadonlyArray<Trait> = ['courage', 'trust', 'care'];

function toStep(l: ConsequenceLine): Step {
  return { caption: l.ko, hold: l.hold ?? DEFAULT_HOLD };
}

/** 데이터 파일의 모든 자막 줄 (테스트·번역 점검용) */
export function allConsequenceLines(): ConsequenceLine[] {
  const out: ConsequenceLine[] = [];
  for (const t of TRAITS) {
    out.push(...(data.moriah[t] as ConsequenceLine[]));
    out.push(data.epilogueOpen[t] as ConsequenceLine, data.epilogueClose[t] as ConsequenceLine);
    for (const sub of Object.values(data.epilogueSub[t])) out.push(sub as ConsequenceLine);
  }
  for (const t of TRAITS) out.push(data.finale[t] as ConsequenceLine);
  out.push(...(data.ishmaelPlea as ConsequenceLine[]));
  return out;
}

/** 모리아 산 뒤의 장면: 여호와 이레 장면 직후, 성향에 따라 산을 내려오는 아브라함이 달라진다 */
export function createMoriahAftermathSteps(trait: Trait | null): Step[] {
  return trait ? (data.moriah[trait] as ConsequenceLine[]).map(toStep) : [];
}

/** 대단원 변형의 둘째 갈래를 가르는 선택(6권 3장 이삭 곁의 저녁) */
export type EpilogueSub = '곁에 앉음' | '사라 이야기' | 'none';

export function epilogueSubOf(tag: string | undefined): EpilogueSub {
  return tag === '곁에 앉음' || tag === '사라 이야기' ? tag : 'none';
}

type Pt = [number, number];
interface FinaleActor { id: string; at: Pt }
interface FinaleLayout { focus: Pt; tilt: number; prop: string; propAt: Pt; actors: FinaleActor[] }

/**
 * 6권 대단원 장면의 성향별 배치 (헤브론 막벨라 무대, 굴 어귀 앞 열린 잔디 x 7~10, z 1~3 — 나무에 가리지 않는 자리).
 * 성향마다 카메라가 보는 곳·소품·등장인물이 다르다: 담대함=활과 두 아들(넓게 서서 바깥을 봄), 맡김=제단 등불과 홀로 앉은 이삭,
 * 돌봄=둥근 떡과 둘러앉은 세 사람(이삭·이스마엘·리브가).
 */
export const FINALE_LAYOUT: Readonly<Record<Trait, FinaleLayout>> = {
  courage: { focus: [8.2, 1.4], tilt: 17, prop: 'bow_rest', propAt: [8.2, 1.0], actors: [{ id: 'ishmael', at: [7.2, 2.0] }, { id: 'isaac', at: [9.2, 2.0] }] },
  trust: { focus: [8.6, 1.9], tilt: 26, prop: 'altar_lamp', propAt: [9.3, 2.5], actors: [{ id: 'isaac', at: [8.0, 2.0] }] },
  care: { focus: [8.0, 1.7], tilt: 22, prop: 'bread_basket', propAt: [8.0, 1.5], actors: [{ id: 'isaac', at: [6.9, 2.0] }, { id: 'ishmael', at: [9.1, 2.0] }, { id: 'rebekah', at: [8.0, 2.7] }] },
};

/**
 * 대단원 장면 자체가 성향에 따라 달라지게 하는 단계들 (소품 + 등장인물 + 카메라 이동, 마지막에 성향별 설명 자막 한 줄).
 * 기존 Cutscene 단계(do / animate / caption)만 쓰고, 프레임 콜백은 숫자만 만진다.
 */
export function createBook6FinaleTableauSteps(c: SceneContext, trait: Trait): Step[] {
  const L = FINALE_LAYOUT[trait];
  let fx0 = 8;
  let fz0 = -6.5;
  return [
    { do: () => {
      c.renderer.setTilt(L.tilt);
      if (c.beam) c.beam.strength = 0;
      const root = c.stageManager?.stage?.root ?? null;
      const prop = buildStagingProp(L.prop);
      prop.position.set(L.propAt[0], 0, L.propAt[1]);
      root?.add(prop);
      for (const m of L.actors) {
        const a = new Actor(m.id);
        a.root.position.set(m.at[0], 0, m.at[1]);
        a.face({ x: L.propAt[0], z: L.propAt[1] });
        root?.add(a.root);
      }
      c.audio.playSfx('ui_confirm');
    } },
    { animate: 1.6, frame: (p: number) => {
      const e = p * p * (3 - 2 * p);
      c.setCameraFocus(fx0 + (L.focus[0] - fx0) * e, 1.2, fz0 + (L.focus[1] - fz0) * e);
      if (p >= 1) { fx0 = L.focus[0]; fz0 = L.focus[1]; }
    } },
    toStep(data.finale[trait] as ConsequenceLine),
  ];
}

/**
 * 6권 마지막 장면(아브라함의 안식) 뒤에 이어지는 대단원 변형: 성향 3가지 × 이삭 곁의 저녁 3가지 = 9가지 자막.
 * 장면 컨텍스트(c)를 넘기면 성향별 장면(소품·등장인물·카메라)이 자막 앞에 붙는다 (c 없이는 자막만 — 테스트·미리보기용).
 */
export function createBook6EpilogueSteps(trait: Trait | null, sub: EpilogueSub, c?: SceneContext): Step[] {
  if (!trait) return [];
  const steps: Step[] = c ? createBook6FinaleTableauSteps(c, trait) : [];
  steps.push(
    toStep(data.epilogueOpen[trait] as ConsequenceLine),
    toStep(data.epilogueSub[trait][sub] as ConsequenceLine),
    toStep(data.epilogueClose[trait] as ConsequenceLine),
  );
  return steps;
}

/** 3권: 이스마엘을 가르쳐 준 아브라함에게만 열리는 셋째 대답 (창 17:18-21) */
export function createIshmaelPleaSteps(): Step[] {
  return (data.ishmaelPlea as ConsequenceLine[]).map(toStep);
}
