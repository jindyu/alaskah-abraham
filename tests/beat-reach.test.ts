import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { StageManager, type StageId } from '../src/world/stageManager';
import { Interactions } from '../src/systems/interaction';
import { setupBook1Beats } from '../src/systems/actions/book1Beats';
import { setupBook2Actions } from '../src/systems/actions/book2Actions';
import { setupBook4Actions } from '../src/systems/actions/book4Actions';
import { setupBook5Actions } from '../src/systems/actions/book5Actions';
import { setupBook6Actions } from '../src/systems/actions/book6Actions';

function universal(): any {
  return new Proxy(function () {}, {
    get: (_t, p) => (p === 'then' || p === Symbol.toPrimitive ? undefined : universal()),
    apply: () => universal(),
    set: () => true,
  });
}

/** 단계형 루프의 모든 상호작용이 막힌 곳에 갇히지 않고 닿을 수 있는 자리여야 한다 */
describe('단계형 루프 도달 가능성', () => {
  const cases: Array<[number, number, StageId, string?]> = [
    [1, 7, 'ur_furnace', '담대히 선포'], [1, 7, 'ur_furnace', '침묵으로 맞섬'],
    [2, 8, 'mamre', '롯을 염려함'], [2, 8, 'mamre', '하나님께 맡김'], [6, 3, 'beersheba', '곁에 앉음'], [6, 3, 'beersheba', '사라 이야기'],
    [1, 6, 'ur_palace'], [1, 7, 'ur_furnace'], [1, 9, 'haran'], [1, 11, 'esau_camp'],
    [2, 4, 'ur_palace'], [2, 8, 'mamre'], [4, 4, 'beersheba'], [5, 4, 'shechem_bethel'],
    [6, 2, 'beersheba'], [6, 3, 'beersheba'], [6, 5, 'beersheba'],
  ];
  for (const [book, ch, stageId, pickTag] of cases) {
    it(`${book}권 ${ch + 1}장 (${stageId})${pickTag ? ' · ' + pickTag : ''}`, () => {
      const sm = new StageManager(new THREE.Scene());
      const stage = sm.loadStage(stageId);
      const interactions = new Interactions();
      const base = { interactions, hud: universal(), audio: universal(), particles: universal(), cutscene: universal(), sceneCtx: universal(), stageId, chapterIndex: ch };
      const done = () => undefined;
      if (book === 1) setupBook1Beats({ interactions, hud: base.hud, audio: base.audio, stageId, chapterIndex: ch, onComplete: done, getPick: (id) => (id === 'palace_answer' ? pickTag : undefined) });
      else if (book === 2) setupBook2Actions({ ...base, getPick: (id: string) => (id === 'war_envoy' ? pickTag : undefined), onBook2Complete: done });
      else if (book === 4) setupBook4Actions({ ...base, onBook4Complete: done });
      else if (book === 5) setupBook5Actions({ ...base, onBook5Complete: done });
      else setupBook6Actions({ ...base, getPick: (id: string) => (id === 'isaac_field' ? pickTag : undefined), onBook6Complete: done });
      expect(interactions.size).toBeGreaterThan(0);
      for (const it of interactions.values()) {
        const p = it.pos();
        let ok = !stage.col.blocked(p.x, p.z, 0.35);
        for (let a = 0; a < 16 && !ok; a++) {
          const ang = (a / 16) * Math.PI * 2;
          for (const rad of [1, 2]) if (rad <= it.r && !stage.col.blocked(p.x + Math.cos(ang) * rad, p.z + Math.sin(ang) * rad, 0.35)) ok = true;
        }
        expect(ok, `${it.id} @ (${p.x},${p.z}) 가 막힌 곳에 있다`).toBe(true);
      }
    });
  }
});
