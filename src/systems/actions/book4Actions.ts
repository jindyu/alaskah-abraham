import type { Interactions } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';
import type { Cutscene } from '../cutscene/cutscene';
import type { SceneContext } from '../scenes/book1/book1Scenes';
import {
  createThreeVisitorsSteps,
  createIntercessionSteps,
  createSodomRiotSteps,
  createSodomEscapeSteps,
  createAbrahamsDawnSteps,
} from '../scenes/book4/book4Scenes';

export interface Book4ActionContext {
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  particles: ParticleManager;
  cutscene: Cutscene;
  sceneCtx: SceneContext;
  stageId: string;
  onBook4Complete: () => void;
}

export function setupBook4Actions(ctx: Book4ActionContext): void {
  const { interactions, hud, audio, particles, cutscene, sceneCtx, stageId, onBook4Complete } = ctx;
  interactions.clear();

  // ── 1. 마므레 상수리 장막 (아브라함 시점) ──
  if (stageId === 'mamre') {
    let servedVisitors = false;

    interactions.add({
      id: 'dining_table',
      pos: () => ({ x: 1.5, z: 0 }),
      height: 1.2,
      r: 2.5,
      label: () => (servedVisitors ? '세 손님과의 약속 묵상하기' : '세 나그네에게 오찬 대접하기'),
      act: () => {
        servedVisitors = true;
        audio.playSfx('ui_confirm');
        particles.emit('glory_sparkles', 1.5, 1.2, 0, 25);
        cutscene.play(createThreeVisitorsSteps(sceneCtx));
      },
    });

    interactions.add({
      id: 'intercession_spot',
      pos: () => ({ x: 6, z: -4 }),
      height: 1.4,
      r: 2.8,
      label: () => '소돔을 향한 중보 기도 드리기',
      act: () => {
        audio.playVoiceBlip('abraham');
        cutscene.play(createIntercessionSteps(sceneCtx));
      },
    });
  }

  // ── 2. 소돔 성문 및 거리 (롯 시점) ──
  if (stageId === 'sodom') {
    let defendedDoor = false;

    // 롯의 가옥 문 인터랙션
    interactions.add({
      id: 'lot_door',
      pos: () => ({ x: -3.4, z: 2 }),
      height: 1.2,
      r: 2.5,
      label: () => (defendedDoor ? '폭도들이 눈이 멀어 문을 찾지 못함' : '가옥 문 앞 폭도들 막아서기'),
      act: () => {
        defendedDoor = true;
        audio.playSfx('wood_creak');
        particles.emit('glory_sparkles', -3.4, 1.5, 2, 25);
        hud.toast('blind-mob', null, '천사들이 손을 내밀어 롯을 들이고 문밖의 폭도들을 눈멀게 하였습니다!');
        cutscene.play(createSodomRiotSteps(sceneCtx));
      },
    });

    // 소금 기둥 탈출로 인터랙션
    interactions.add({
      id: 'salt_pillar_escape',
      pos: () => ({ x: 8, z: 7 }),
      height: 1.6,
      r: 3.0,
      label: () => '소알을 향해 언덕길 탈출하기',
      act: () => {
        audio.playSfx('fire_ember');
        particles.emit('fire_ember', 8, 2.5, 7, 30);
        cutscene.play(createSodomEscapeSteps(sceneCtx), () => {
          cutscene.play(createAbrahamsDawnSteps(sceneCtx), () => {
            onBook4Complete();
          });
        });
      },
    });
  }
}
