import type { Interactions } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';
import type { Cutscene } from '../cutscene/cutscene';
import type { SceneContext } from '../scenes/book1/book1Scenes';
import {
  createIsaacBirthFeastSteps,
  createBeershebaCovenantSteps,
  createRoadToMoriahSteps,
  createMountMoriahAkedahSteps,
  createJehovahJirehSteps,
} from '../scenes/book5/book5Scenes';

export interface Book5ActionContext {
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  particles: ParticleManager;
  cutscene: Cutscene;
  sceneCtx: SceneContext;
  stageId: string;
  onBook5Complete: () => void;
  onSwitchStage?: (stageId: string) => void;
}

export function setupBook5Actions(ctx: Book5ActionContext): void {
  const { interactions, hud, audio, particles, cutscene, sceneCtx, stageId, onBook5Complete, onSwitchStage } = ctx;
  interactions.clear();

  // ── 1. 브엘세바 우물터 (이삭 탄생 잔치 & 아비멜렉 언약) ──
  if (stageId === 'beersheba') {
    let visitedWell = false;
    let plantedTree = false;

    // 이삭 젖 뗀 날 잔치 평상
    interactions.add({
      id: 'feast_table',
      pos: () => ({ x: 6, z: -5 }),
      height: 1.2,
      r: 2.8,
      label: () => '이삭 출생과 젖 뗀 날 큰 잔치 기념하기',
      act: () => {
        audio.playSfx('ui_confirm');
        particles.emit('glory_sparkles', 6, 1.2, -5, 25);
        cutscene.play(createIsaacBirthFeastSteps(sceneCtx));
      },
    });

    // 맹세의 우물과 일곱 암양
    interactions.add({
      id: 'beersheba_well',
      pos: () => ({ x: 0, z: 0 }),
      height: 1.2,
      r: 2.6,
      label: () => (visitedWell ? '맹세의 우물 (브엘세바) 묵상하기' : '아비멜렉과의 화친 언약 맺기'),
      act: () => {
        visitedWell = true;
        audio.playSfx('ui_confirm');
        cutscene.play(createBeershebaCovenantSteps(sceneCtx), () => {
          hud.toast('covenant-ewe-lambs', null, '일곱 암양을 증표로 브엘세바의 맹세를 확정하였습니다.');
          hud.goalProgress = { current: plantedTree ? 2 : 1, total: 2, label: plantedTree ? '2/2' : '1/2' };
        });
      },
    });

    // 서북쪽 에셀나무 터
    interactions.add({
      id: 'tamarisk_tree',
      pos: () => ({ x: -6, z: -4 }),
      height: 1.5,
      r: 2.8,
      label: () => (plantedTree ? '영원하신 하나님의 이름 부르기' : '브엘세바에 에셀나무 심기'),
      act: () => {
        plantedTree = true;
        audio.playSfx('sacred_bell');
        particles.emit('glory_sparkles', -6, 2.0, -4, 30);
        hud.toast('tamarisk-planted', null, '에셀나무를 심고 영생하시는 여호와의 이름을 불렀습니다.');
        hud.goalProgress = { current: visitedWell ? 2 : 1, total: 2, label: visitedWell ? '2/2' : '1/2' };
      },
    });

    // 모리아 산 출발 길목 (남동쪽)
    interactions.add({
      id: 'journey_to_moriah',
      pos: () => ({ x: 10, z: -10 }),
      height: 1.4,
      r: 3.0,
      label: () => '사흘 길을 걸어 모리아 산으로 향하기',
      act: () => {
        audio.playVoiceBlip('abraham');
        if (onSwitchStage) {
          onSwitchStage('moriah');
        }
      },
    });
  }

  // ── 2. 모리아 산 (번제단과 이삭의 결박) ──
  if (stageId === 'moriah') {
    let boundIsaac = false;

    // 산기슭 종들과 나귀 베이스캠프
    interactions.add({
      id: 'donkey_basecamp',
      pos: () => ({ x: -3, z: 8 }),
      height: 1.2,
      r: 2.8,
      label: () => '종들과 나귀에게 기다리라 명하기',
      act: () => {
        audio.playVoiceBlip('abraham');
        hud.toast('moriah-camp', null, '“너희는 나귀와 함께 기다리라. 내가 아이와 함께 예배하고 돌아오리라.”');
      },
    });

    // 산 정상 번제단 바위 (아케다)
    interactions.add({
      id: 'akedah_altar',
      pos: () => ({ x: 0, z: -7 }),
      height: 1.5,
      r: 2.8,
      label: () => (boundIsaac ? '여호와의 사자의 음성을 묵상하기' : '나무를 벌이고 이삭을 번제단에 결박하기'),
      act: () => {
        boundIsaac = true;
        audio.playSfx('sacred_bell');
        particles.emit('glory_sparkles', 0, 4.0, -7, 40);
        cutscene.play(createMountMoriahAkedahSteps(sceneCtx));
      },
    });

    // 수풀에 뿔이 걸린 숫양 (여호와 이레)
    interactions.add({
      id: 'ram_in_thicket',
      pos: () => ({ x: 3.2, z: -7.5 }),
      height: 1.4,
      r: 2.8,
      label: () => '수풀의 숫양을 대신 번제로 드리기 (여호와 이레)',
      act: () => {
        audio.playSfx('sacred_bell');
        particles.emit('glory_sparkles', 3.2, 4.2, -7.5, 45);
        cutscene.play(createJehovahJirehSteps(sceneCtx), () => {
          onBook5Complete();
        });
      },
    });
  }
}
