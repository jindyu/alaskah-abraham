import type { Interactions } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';
import type { Cutscene } from '../cutscene/cutscene';
import type { SceneContext } from '../scenes/book1/book1Scenes';
import {
  createSarahMourningSteps,
  createEphronBargainSteps,
  createEliezerOathSteps,
  createRebekahWellSteps,
  createTwilightMeetingSteps,
  createAbrahamPassingSteps,
} from '../scenes/book6/book6Scenes';

export interface Book6ActionContext {
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  particles: ParticleManager;
  cutscene: Cutscene;
  sceneCtx: SceneContext;
  stageId: string;
  onBook6Complete: () => void;
  onSwitchStage?: (stageId: string) => void;
}

export function setupBook6Actions(ctx: Book6ActionContext): void {
  const { interactions, hud, audio, particles, cutscene, sceneCtx, stageId, onBook6Complete, onSwitchStage } = ctx;
  interactions.clear();

  // ── 1. 헤브론 막벨라 굴 (사라 별세 & 매입 & 안식) ──
  if (stageId === 'hebron_machpelah') {
    let paidSilver = false;
    let mournedSarah = false;

    // 사라의 묘실 석관
    interactions.add({
      id: 'machpelah_tomb',
      pos: () => ({ x: 8, z: -6.5 }),
      height: 1.2,
      r: 2.8,
      label: () => (mournedSarah ? '사라와의 평생 믿음의 동행 묵상하기' : '사라의 별세를 애도하고 매장지 구하기'),
      act: () => {
        mournedSarah = true;
        audio.playSfx('ui_confirm');
        cutscene.play(createSarahMourningSteps(sceneCtx), () => {
          hud.goalProgress = { current: paidSilver ? 2 : 1, total: 2, label: paidSilver ? '2/2' : '1/2' };
        });
      },
    });

    // 헤브론 성문 에브론 계량 탁자
    interactions.add({
      id: 'ephron_scale',
      pos: () => ({ x: -5.5, z: 6.5 }),
      height: 1.2,
      r: 2.6,
      label: () => (paidSilver ? '에브론과의 정당한 매매 증서 확인하기' : '은 400세겔을 달아주고 막벨라 굴 매입하기'),
      act: () => {
        paidSilver = true;
        audio.playSfx('ui_confirm');
        cutscene.play(createEphronBargainSteps(sceneCtx), () => {
          hud.toast('machpelah-bought', null, '상인의 통용 은 400세겔로 막벨라 굴과 밭을 영구 매입하였습니다.');
          hud.goalProgress = { current: mournedSarah ? 2 : 1, total: 2, label: mournedSarah ? '2/2' : '1/2' };
        });
      },
    });

    // 메소포타미아 나홀의 성 파견 길목
    interactions.add({
      id: 'journey_to_nahor',
      pos: () => ({ x: -12, z: 4 }),
      height: 1.4,
      r: 3.0,
      label: () => '엘리에셀에게 맹세시키고 나홀 성으로 파견하기',
      act: () => {
        audio.playVoiceBlip('abraham');
        cutscene.play(createEliezerOathSteps(sceneCtx), () => {
          if (onSwitchStage) {
            onSwitchStage('nahor_well');
          }
        });
      },
    });

    // 아브라함의 마지막 안식
    interactions.add({
      id: 'abraham_resting_place',
      pos: () => ({ x: 8, z: -4 }),
      height: 1.4,
      r: 2.8,
      label: () => '175세의 평안한 안식과 마지막 유업 받기',
      act: () => {
        audio.playSfx('sacred_bell');
        particles.emit('glory_sparkles', 8, 2.5, -4, 50);
        cutscene.play(createAbrahamPassingSteps(sceneCtx), () => {
          onBook6Complete();
        });
      },
    });
  }

  // ── 2. 메소포타미아 나홀의 성 우물가 (엘리에셀 & 리브가) ──
  if (stageId === 'nahor_well') {
    let wateredCamels = false;

    // 우물가 기도와 리브가 테스트
    interactions.add({
      id: 'nahor_well_prayer',
      pos: () => ({ x: 0, z: 0 }),
      height: 1.2,
      r: 2.8,
      label: () => (wateredCamels ? '리브가에게 선사한 금 장신구 바라보기' : '우물가에서 순적한 배필을 구하는 기도 드리기'),
      act: () => {
        wateredCamels = true;
        audio.playSfx('ui_confirm');
        particles.emit('glory_sparkles', 0, 1.2, 0, 30);
        cutscene.play(createRebekahWellSteps(sceneCtx));
      },
    });

    // 가나안 들판으로 귀환 길목
    interactions.add({
      id: 'twilight_return',
      pos: () => ({ x: 8, z: 8 }),
      height: 1.4,
      r: 3.0,
      label: () => '리브가와 함께 가나안 네게브 들판으로 향하기',
      act: () => {
        audio.playSfx('sacred_bell');
        cutscene.play(createTwilightMeetingSteps(sceneCtx), () => {
          if (onSwitchStage) {
            onSwitchStage('hebron_machpelah');
          }
        });
      },
    });
  }
}
