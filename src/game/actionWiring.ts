import type { GetPick, SetPick, GetTrait } from '../systems/actions/pickTypes';
import type { Interactions } from '../systems/interaction';
import type { Hud } from '../ui/hud';
import type { AudioManager } from '../audio/audioManager';
import type { ParticleManager } from '../renderer/particles';
import type { Cutscene } from '../systems/cutscene/cutscene';
import type { SceneContext } from '../systems/scenes/book1/book1Scenes';
import type { StageInfo } from '../world/stageManager';
import { bookStartTarget } from './progression';
import { setupBook1Actions } from '../systems/actions/book1Actions';
import { setupBook2Actions } from '../systems/actions/book2Actions';
import { setupBook3Actions } from '../systems/actions/book3Actions';
import { setupBook4Actions } from '../systems/actions/book4Actions';
import { setupBook5Actions } from '../systems/actions/book5Actions';
import { setupBook6Actions } from '../systems/actions/book6Actions';
import { setupBook1Beats } from '../systems/actions/book1Beats';
import { setupBook1LentilActions } from '../systems/actions/book1LentilActions';

/** 장 상호작용 루프를 거는 데 필요한 것 (createGame 이 넘겨 줌 — 클로저 상태에 직접 닿지 않는다) */
export interface WireDeps {
  book: number;
  chapter: number;
  stage: StageInfo | null;
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  particles: ParticleManager;
  cutscene: Cutscene;
  sceneCtx: SceneContext;
  advanceChapter: () => void;
  loadChapter: (book: number, chapter: number) => void;
  /** 5·6권이 같은 장 안에서 무대를 바꿀 때 (새 무대를 세우고 루프를 다시 건다) */
  switchStage: (stageId: string) => void;
  /** 앞서 한 선택(갈래)의 읽기/기록 — 저장되어 이후 장의 대사에 반영된다 */
  getPick: GetPick;
  setPick: SetPick;
  /** 지금까지 한 선택에서 가장 많은 성향 (아브라함의 마지막 장면이 읽는다) */
  getTrait: GetTrait;
}

/** (권, 장, 무대) 에 맞는 액션 모듈을 골라 상호작용을 등록한다. 어디에도 해당하지 않으면 1권 팥죽 단일 상호작용 */
export function wireChapterActions(d: WireDeps): void {
  /** 선택(갈래) 읽기/기록 — 액션 모듈마다 같은 두 함수를 넘기므로 한 곳에 모은다 (3권은 기록만 쓰지만 같이 받아도 무해) */
  const picks = { getPick: d.getPick, setPick: d.setPick };
  if (d.book === 1) {
    const st = d.stage;
    if (st && st.urDetails) {
      setupBook1Actions({
        interactions: d.interactions,
        hud: d.hud,
        audio: d.audio,
        particles: d.particles,
        cutscene: d.cutscene,
        sceneCtx: d.sceneCtx,
        urStage: st.urDetails,
        onBook1Complete: () => {
          // 1권은 한 장소에서 전체 서사를 끝내는 통합 루프라 다음 장이 아니라 2권으로 넘어간다
          const target = bookStartTarget(2);
          d.loadChapter(target.book, target.chapter);
        },
      });
      return;
    }
  }

  if (d.book === 2) {
    const st = d.stage;
    if (st) {
      setupBook2Actions({
        interactions: d.interactions,
        hud: d.hud,
        audio: d.audio,
        particles: d.particles,
        cutscene: d.cutscene,
        sceneCtx: d.sceneCtx,
        stageId: st.id,
        chapterIndex: d.chapter,
        ...picks,
        onBook2Complete: () => {
          d.advanceChapter();
        },
      });
      return;
    }
  }

  if (d.book === 3) {
    setupBook3Actions({
      interactions: d.interactions,
      hud: d.hud,
      audio: d.audio,
      particles: d.particles,
      cutscene: d.cutscene,
      sceneCtx: d.sceneCtx,
      chapterIndex: d.chapter,
      ...picks,
      onBook3Complete: () => {
        d.advanceChapter();
      },
    });
    return;
  }

  if (d.book === 4) {
    const st = d.stage;
    if (st) {
      setupBook4Actions({
        interactions: d.interactions,
        hud: d.hud,
        audio: d.audio,
        particles: d.particles,
        cutscene: d.cutscene,
        sceneCtx: d.sceneCtx,
        stageId: st.id,
        chapterIndex: d.chapter,
        ...picks,
        onBook4Complete: () => {
          d.advanceChapter();
        },
      });
      return;
    }
  }

  if (d.book === 5) {
    const st = d.stage;
    if (st) {
      setupBook5Actions({
        interactions: d.interactions,
        hud: d.hud,
        audio: d.audio,
        particles: d.particles,
        cutscene: d.cutscene,
        sceneCtx: d.sceneCtx,
        stageId: st.id,
        chapterIndex: d.chapter,
        ...picks,
        onBook5Complete: () => {
          d.advanceChapter();
        },
        onSwitchStage: (sId: string) => { d.switchStage(sId); },
      });
      return;
    }
  }

  if (d.book === 6) {
    const st = d.stage;
    if (st) {
      setupBook6Actions({
        interactions: d.interactions,
        hud: d.hud,
        audio: d.audio,
        particles: d.particles,
        cutscene: d.cutscene,
        sceneCtx: d.sceneCtx,
        stageId: st.id,
        chapterIndex: d.chapter,
        ...picks,
        getTrait: d.getTrait,
        onBook6Complete: () => {
          d.advanceChapter();
        },
        onSwitchStage: (sId: string) => { d.switchStage(sId); },
      });
      return;
    }
  }

  if (d.book === 1) {
    const st1 = d.stage;
    if (st1 && setupBook1Beats({
      interactions: d.interactions, hud: d.hud, audio: d.audio, stageId: st1.id, chapterIndex: d.chapter,
      onComplete: () => { d.advanceChapter(); },
      ...picks,
    })) return;
  }

  setupBook1LentilActions({
    interactions: d.interactions,
    hud: d.hud,
    audio: d.audio,
    particles: d.particles,
    bookIndex: d.book,
    chapterIndex: d.chapter,
    onLoopComplete: () => {
      d.advanceChapter();
    },
  });
}
