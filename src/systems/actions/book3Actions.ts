import type { Interactions } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';
import type { Cutscene } from '../cutscene/cutscene';
import type { SceneContext } from '../scenes/book1/book1Scenes';
import {
  createStarsCovenantSteps,
  createHagarLahairoiSteps,
  createIshmaelArcherSteps,
  createCircumcisionNewNameSteps,
  createAbrahamsLaughterSteps,
} from '../scenes/book3/book3Scenes';

export interface Book3ActionContext {
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  particles: ParticleManager;
  cutscene: Cutscene;
  sceneCtx: SceneContext;
  onBook3Complete: () => void;
}

export function setupBook3Actions(ctx: Book3ActionContext): void {
  const { interactions, hud, audio, particles, cutscene, sceneCtx, onBook3Complete } = ctx;
  interactions.clear();

  let examinedAltar = false;
  let practicedArchery = false;

  const updateGoal = () => {
    hud.goalCategory = '제3권 · 별과 언약';
    if (!examinedAltar) {
      hud.goal = '횃불 언약 제단에서 뭇별의 약속 묵상하기 (0/1)';
      hud.goalProgress = { current: 0, total: 2, label: '0/2' };
      hud.hint = '동쪽 횃불이 타오르는 제단으로 다가가자';
    } else if (!practicedArchery) {
      hud.goal = '소년 이스마엘과 활쏘기 과녁 살펴보기 (0/1)';
      hud.goalProgress = { current: 1, total: 2, label: '1/2' };
      hud.hint = '남동쪽 짚단 과녁 앞으로 다가가자';
    } else {
      hud.goal = '장막 안 사라와 대화하고 새 이름 언약 받기 (2/2)';
      hud.goalProgress = { current: 2, total: 2, label: '2/2' };
      hud.hint = '서쪽 장막 문 앞으로 다가가자';
    }
  };

  updateGoal();

  // 1. 횃불 언약 제단 인터랙션
  interactions.add({
    id: 'altar_covenant',
    pos: () => ({ x: 6, z: 2 }),
    height: 1.2,
    r: 2.5,
    label: () => (examinedAltar ? '타는 횃불과 뭇별 묵상하기' : '쪼갠 제물과 타는 횃불 조사하기'),
    act: () => {
      examinedAltar = true;
      audio.playSfx('ui_confirm');
      hud.unlockCodex('covenant_flaming_torch');
      hud.toast('covenant-torch', null, '연기 나는 화로와 활활 타는 횃불이 제물 사이로 지나갔습니다!');
      particles.emit('glory_sparkles', 6, 1.5, 2, 30);
      updateGoal();
    },
  });

  // 2. 소년 이스마엘 활쏘기 과녁
  interactions.add({
    id: 'archery_target',
    pos: () => ({ x: 9, z: 6 }),
    height: 1.4,
    r: 2.2,
    label: () => '이스마엘의 활 과녁 조사하기',
    act: () => {
      practicedArchery = true;
      audio.playSfx('wood_creak');
      particles.emit('impact_dust', 9, 1.2, 6, 15);
      cutscene.play(createIshmaelArcherSteps(sceneCtx));
      updateGoal();
    },
  });

  // 3. 아브라함/사라의 장막 대화 (할례와 새 이름, 이삭의 약속)
  interactions.add({
    id: 'sarah_tent',
    pos: () => ({ x: -8, z: 0 }),
    height: 1.5,
    r: 3.0,
    label: () => '장막에서 언약의 말씀 나누기',
    act: () => {
      audio.playVoiceBlip('sarah');
      hud.choice = {
        prompt: '하나님의 언약과 새 이름 (창세기 17장)',
        options: [
          { text: '하나님께서 내 이름을 "아브라함", 당신을 "사라"라 부르셨소 (할례 언약).' },
          { text: '내년 이맘때에 우리에게 아들이 있으리라 약속하셨소 (이삭의 웃음).' },
        ],
        selectedIndex: 0,
        onSelect: (idx: number) => {
          hud.choice = null;
          if (idx === 0) {
            cutscene.play(createCircumcisionNewNameSteps(sceneCtx), () => {
              updateGoal();
            });
          } else {
            cutscene.play(createAbrahamsLaughterSteps(sceneCtx), () => {
              onBook3Complete();
            });
          }
        },
      };
    },
  });
}
