import type { GetPick, SetPick } from './pickTypes';
import { createIshmaelPleaSteps } from './consequenceScenes';
import type { Interactions } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';
import type { Cutscene } from '../cutscene/cutscene';
import type { SceneContext } from '../scenes/book1/book1Scenes';
import { playChapterStaging } from '../scenes/staging/chapterStaging';
import {
  createStarsCovenantSteps,
  createHagarLahairoiSteps,
  createIshmaelArcherSteps,
  createCircumcisionNewNameSteps,
  createAbrahamsLaughterSteps,
} from '../scenes/book3/book3Scenes';

export interface Book3ActionContext {
  /** 지금 들어온 장 번호 (연출 재생에 쓴다 — 목표 문구로 추측하지 않는다) */
  chapterIndex?: number;
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  particles: ParticleManager;
  cutscene: Cutscene;
  sceneCtx: SceneContext;
  onBook3Complete: () => void;
  /** 앞서 한 선택(갈래) 기록 (저장됨) */
  setPick?: SetPick;
  /** 앞서 한 선택 읽기 — 활을 가르쳐 준 아브라함은 장막에서 셋째 대답을 얻는다 */
  getPick?: GetPick;
}

// Module-level position buffers (zero per-frame allocations)
const POS_STARS_VISTA = { x: 7, z: -5 };
const POS_COVENANT_ALTAR = { x: 6, z: 2 };
const POS_ARCHERY_TARGET = { x: 9, z: 6 };
const POS_NEW_NAME_SPOT = { x: 0, z: -2 };
const POS_SARAH_TENT = { x: -8, z: 4 };

function setupBook3ActionsCore(ctx: Book3ActionContext): void {
  const { interactions, hud, audio, particles, cutscene, sceneCtx, onBook3Complete, setPick } = ctx;
  interactions.clear();

  let starsCounted = false;
  let covenantPassed = false;
  let archeryDone = false;
  let newNameReceived = false;

  const updateGoal = () => {
    hud.goalCategory = '제3권 · 별과 언약';
    if (!starsCounted) {
      hud.goal = '밤하늘의 뭇별을 바라보며 자손의 언약 묵상하기 (0/1)';
      hud.goalProgress = { current: 0, total: 5, label: '0/5' };
      hud.hint = '동북쪽 언덕에서 밤하늘의 뭇별을 올려다보자';
    } else if (!covenantPassed) {
      hud.goal = '쪼갠 제물과 활활 타는 횃불 언약 조사하기 (0/1)';
      hud.goalProgress = { current: 1, total: 5, label: '1/5' };
      hud.hint = '동쪽 제단으로 다가가 횃불 언약을 확인하자';
    } else if (!archeryDone) {
      hud.goal = '소년 이스마엘과 활쏘기 과녁 살펴보기 (0/1)';
      hud.goalProgress = { current: 2, total: 5, label: '2/5' };
      hud.hint = '남동쪽 짚단 과녁 앞으로 다가가자';
    } else if (!newNameReceived) {
      hud.goal = '상수리나무 아래서 아브라함의 새 이름 언약 받기 (0/1)';
      hud.goalProgress = { current: 3, total: 5, label: '3/5' };
      hud.hint = '중앙 상수리나무 앞마당으로 다가가자';
    } else {
      hud.goal = '장막 안 사라와 대화하고 이삭의 약속 나누기 (4/5)';
      hud.goalProgress = { current: 4, total: 5, label: '4/5' };
      hud.hint = '서남쪽 사라의 장막 문 앞으로 다가가자';
    }
  };

  updateGoal();

  // 1. 밤하늘 뭇별 관측 터
  interactions.add({
    id: 'stars_vista',
    pos: () => POS_STARS_VISTA,
    height: 1.4,
    r: 2.5,
    label: () => (starsCounted ? '셀 수 없는 밤하늘 뭇별 묵상하기' : '하늘의 뭇별을 우러러 세어보기'),
    act: () => {
      starsCounted = true;
      audio.playSfx('ui_confirm');
      particles.emit('glory_sparkles', 7, 2.0, -5, 30);
      hud.toast('stars-promise', null, '“하늘을 우러러 뭇별을 셀 수 있나 보라. 네 자손이 이와 같으리라!”');
      updateGoal();
    },
  });

  // 2. 횃불 언약 제단
  interactions.add({
    id: 'altar_covenant',
    pos: () => POS_COVENANT_ALTAR,
    height: 1.2,
    r: 2.5,
    label: () => (covenantPassed ? '타는 횃불과 뭇별 언약 묵상하기' : '쪼갠 제물과 타는 횃불 조사하기'),
    act: () => {
      if (!starsCounted) {
        hud.toast('stars-first', null, '먼저 밤하늘의 뭇별을 우러러 하나님의 언약을 마음에 품으십시오.');
        return;
      }
      covenantPassed = true;
      audio.playSfx('fire_burst');
      hud.unlockCodex('covenant_flaming_torch');
      hud.toast('covenant-torch', null, '연기 나는 화로와 활활 타는 횃불이 제물 사이로 지나갔습니다!');
      particles.emit('fire_ember', 6, 1.5, 2, 30);
      updateGoal();
    },
  });

  // 3. 소년 이스마엘 활쏘기 과녁
  interactions.add({
    id: 'archery_target',
    pos: () => POS_ARCHERY_TARGET,
    height: 1.4,
    r: 2.2,
    label: () => (archeryDone ? '이스마엘의 활쏘기 과녁 관찰하기' : '이스마엘의 활 과녁 조사하기'),
    act: () => {
      if (!covenantPassed) {
        hud.toast('covenant-first', null, '먼저 제단에서 횃불 언약을 묵상하십시오.');
        return;
      }
      if (archeryDone) return; // 한 번만 고른다
      hud.showChoice('활을 겨누는 이스마엘에게 아브라함은 무엇을 건넬까?', [
        { text: '곁에서 활 쏘는 법을 직접 가르쳐 준다' },
        { text: '먼저 멀리서 지켜보고 칭찬해 준다' },
      ], (idx: number) => {
        if (setPick) setPick('archery_target', idx === 0 ? '활을 가르침' : '지켜봐 줌');
        archeryDone = true;
        audio.playSfx('arrow_release');
        particles.emit('impact_dust', 9, 1.2, 6, 15);
        hud.unlockCodex('ishmael_archer');
        cutscene.play(createIshmaelArcherSteps(sceneCtx));
        updateGoal();
      });
    },
  });

  // 4. 상수리나무 아래 새 이름과 할례 언약 의식
  interactions.add({
    id: 'new_name_ceremony',
    pos: () => POS_NEW_NAME_SPOT,
    height: 1.2,
    r: 2.5,
    label: () => (newNameReceived ? '열국의 아비 아브라함의 부르심 묵상하기' : '상수리나무 아래서 새 이름 언약 받기'),
    act: () => {
      if (!archeryDone) {
        hud.toast('archery-first', null, '먼저 이스마엘의 활쏘기 터를 둘러보십시오.');
        return;
      }
      newNameReceived = true;
      audio.playSfx('fx_name_proclamation');
      particles.emit('glory_sparkles', 0, 1.5, -2, 30);
      hud.unlockCodex('abraham_new_name');
      hud.toast('new-name', null, '“이제 네 이름은 아브라함이라! 너를 여러 민족의 아버지가 되게 하리라.”');
      updateGoal();
    },
  });

  // 5. 아브라함/사라의 장막 대화 (할례와 새 이름, 이삭의 약속)
  interactions.add({
    id: 'sarah_tent',
    pos: () => POS_SARAH_TENT,
    height: 1.5,
    r: 3.0,
    label: () => (newNameReceived ? '장막에서 언약의 말씀 나누기' : '새 이름을 받은 후 장막으로 가기'),
    act: () => {
      if (!newNameReceived) {
        hud.toast('name-first', null, '먼저 상수리나무 아래서 하나님의 새 이름 언약을 받아야 합니다.');
        return;
      }
      audio.playVoiceBlip('sarah');
      // 이스마엘에게 활을 가르쳐 준 아브라함에게만 열리는 셋째 선택 (선택 → 선택지 자체가 바뀐다)
      const taughtIshmael = ctx.getPick ? ctx.getPick('archery_target') === '활을 가르침' : false;
      const options = [
        { text: '하나님께서 내 이름을 "아브라함", 당신을 "사라"라 부르셨소 (할례 언약).' },
        { text: '내년 이맘때에 우리에게 아들이 있으리라 약속하셨소 (이삭의 웃음).' },
      ];
      if (taughtIshmael) options.push({ text: '이스마엘도 하나님 앞에 살게 해 달라고 아뢰었소 (이스마엘을 위한 간구).' });
      hud.choice = {
        prompt: '하나님의 언약과 새 이름 (창세기 17장)',
        options,
        selectedIndex: 0,
        onSelect: (idx: number) => {
          hud.choice = null;
          if (setPick) setPick('sarah_tent', idx === 0 ? '할례 언약' : idx === 2 ? '이스마엘을 위한 간구' : '이삭의 웃음');
          if (idx === 2) {
            cutscene.play(createIshmaelPleaSteps(), () => {
              onBook3Complete();
            });
          } else if (idx === 0) {
            cutscene.play(createCircumcisionNewNameSteps(sceneCtx), () => {
              onBook3Complete();
            });
          } else {
            hud.unlockCodex('abraham_laughter');
            cutscene.play(createAbrahamsLaughterSteps(sceneCtx), () => {
              onBook3Complete();
            });
          }
        },
      };
    },
  });
}

/**
 * 3권 장면별 액션을 건다. 직접 쓴 장면이 없는 장(src/data/staging.json)은 들어올 때 연출 장면을 먼저 재생한다.
 * (장 번호는 wireChapterActions 가 chapterIndex 로 명시해서 넘긴다)
 */
export function setupBook3Actions(ctx: Book3ActionContext): void {
  const chapter = ctx.chapterIndex;
  const stageId = ctx.sceneCtx.stageManager?.stage?.id ?? '';
  setupBook3ActionsCore(ctx);
  playChapterStaging(ctx.sceneCtx, ctx.cutscene, 3, chapter, stageId, ctx.getPick);
}
