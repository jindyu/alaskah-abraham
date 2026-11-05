import * as THREE from 'three';
import type { Step } from '../../cutscene/cutscene';
import type { SceneContext } from '../book1/book1Scenes';

/** 1. 사라의 죽음과 헤브론의 애도 */
export function createSarahMourningSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('sarah_death');
      c.hud.cinematicTitle = '제6권 · 막벨라\n사라의 별세와 헤브론의 애도';
      c.renderer.setTilt(24);
      c.setCameraFocus(8, 1.2, -6.5);
      c.player.root.position.set(5, 0, -4);
      c.audio.playBgm('bgm_lament');
    } },
    { wait: 1.0 },
    { caption: '사라가 일백이십칠 세를 살았으니 이것이 곧 사라가 누린 햇수라.', hold: 4.8 },
    { caption: '사라가 가나안 땅 기럇아르바 곧 헤브론에서 죽으매, 아브라함이 들어가 슬퍼하며 애통하였다.', hold: 5.0 },
    { caption: '아브라함: "나는 당신들 중에 나그네요 거류하는 자이니, 내 죽은 자를 내어 장사할 매장지를 내게 주소서."', style: 'voice', hold: 5.5 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.hud.goalCategory = '제6권 · 헤브론';
      c.hud.goal = '막벨라 굴 매입과 안장\n▪ 성문 계량대에서 은 400세겔 달아주기 (0/1)\n▪ 막벨라 동굴에 사라 안장하기 (0/1)';
      c.hud.goalProgress = { current: 0, total: 2, label: '0/2' };
      c.hud.hint = '서남쪽 성문 앞 에브론과 장로들의 계량대로 가보자';
    } },
  ];
}

/** 2. 에브론의 흥정과 은 400세겔 매입 */
export function createEphronBargainSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('machpelah_purchase');
      c.hud.cinematicTitle = '에브론의 흥정과 막벨라 굴\n상인의 통용 은 400세겔';
      c.renderer.setTilt(26);
      c.setCameraFocus(-5.5, 1.2, 6.5);
      c.audio.playBgm('bgm_shadow_intrigue');
    } },
    { wait: 0.8 },
    { caption: '에브론: "내 주여, 들으소서. 밭머리에 있는 막벨라 굴뿐 아니라 그 밭도 당신께 드리겠나이다."', hold: 5.2 },
    { caption: '아브라함: "아니라, 그 밭값을 내게서 받으소서. 내가 정당한 값을 치르고 내 죽은 자를 장사하겠노라."', style: 'voice', hold: 5.5 },
    { caption: '에브론: "땅값은 은 사백 세겔이나, 그것이 나와 당신 사이에 무슨 문제가 되리이까?"', hold: 5.0 },
    { do: () => {
      c.audio.playSfx('ui_confirm');
      if (c.particles) c.particles.emit('glory_sparkles', -5.5, 1.2, 6.5, 30);
    } },
    { caption: '아브라함이 에브론의 말을 듣고 상인의 통용하는 은 사백 세겔을 달아 에브론에게 주었다!', hold: 5.2 },
    { caption: '이로써 막벨라 굴과 밭과 둘레의 모든 나무가 아브라함의 확정된 영구 매장 소유지가 되었다.', hold: 5.2 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 3. 엘리에셀의 거룩한 맹세 */
export function createEliezerOathSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('eliezer_oath');
      c.hud.cinematicTitle = '엘리에셀의 거룩한 맹세\n이삭의 신부를 구하라';
      c.renderer.setTilt(24);
      c.audio.playBgm('bgm_nomad_journey');
    } },
    { wait: 0.8 },
    { caption: '아브라함: "내 허벅지 아래 손을 넣고 하늘의 하나님 여호와를 가리켜 맹세하라."', style: 'voice', hold: 5.0 },
    { caption: '"이 가나안 족속의 딸이 아닌 내 고향, 내 족속에게로 가서 내 아들 이삭을 위하여 아내를 택하라!"', style: 'voice', hold: 5.5 },
    { caption: '엘리에셀: "주인의 하나님 여호와께서 순적한 길을 주실 줄 믿고 길을 떠나나이다."', hold: 4.8 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 4. 나홀의 성 우물가의 리브가 */
export function createRebekahWellSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('rebekah_well');
      c.hud.cinematicTitle = '나홀 성 우물가의 리브가\n기도와 순적한 만남';
      c.renderer.setTilt(22);
      c.setCameraFocus(0, 1.2, 0);
      c.player.root.position.set(-2, 0, 2);
      c.audio.playBgm('bgm_peaceful');
    } },
    { wait: 1.0 },
    { caption: '엘리에셀: "내가 물을 청할 때 나뿐 아니라 낙타에게도 마시우게 하는 여인이 주께서 정하신 배필이 되게 하옵소서."', style: 'voice', hold: 5.5 },
    { caption: '기도를 마치기도 전에 리브가가 물동이를 어깨에 메고 나오매, "내 주여 마시소서" 하고 급히 물동이를 기울였다.', hold: 5.2 },
    { caption: '"당신의 낙타를 위하여서도 물을 길어 배불리 마시게 하리이다!" 부지런히 구유에 물을 부어 낙타 모두를 마시웠다.', hold: 5.5 },
    { do: () => {
      c.audio.playSfx('sacred_bell');
      if (c.particles) c.particles.emit('glory_sparkles', 0, 1.5, 0, 35);
      c.audio.playBgm('bgm_divine');
    } },
    { caption: '엘리에셀이 감격하여 금 코걸이와 손목고리를 선사하며, 순적한 길을 인도하신 하나님을 찬송하였다.', hold: 5.5 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 5. 황혼 들판의 만남 (이삭과 리브가) */
export function createTwilightMeetingSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.cinematicTitle = '황혼 들판의 만남\n이삭과 리브가';
      c.renderer.setTilt(24);
      c.audio.playBgm('bgm_hope_legacy');
    } },
    { wait: 1.0 },
    { caption: '해 질 무렵 이삭이 들에 나가 묵상하다가 눈을 들어 보매, 낙타들이 오고 있었다.', hold: 5.0 },
    { caption: '리브가가 눈을 들어 이삭을 보고 낙타에서 내려 너울로 얼굴을 가리니, 순결한 신부의 영접이었다.', hold: 5.2 },
    { caption: '이삭이 리브가를 인도하여 어머니 사라의 장막으로 들이고 그를 사랑하였으니, 비로소 큰 위로를 얻었다.', hold: 5.2 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 6. 아브라함의 평안한 안식과 유업 */
export function createAbrahamPassingSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('abraham_death');
      c.hud.cinematicTitle = '아브라함의 평안한 안식\n열조에게로 돌아가다';
      c.renderer.setTilt(20);
      c.setCameraFocus(8, 2.0, -6.5);
      c.audio.playBgm('bgm_hope_legacy');
      if (c.beam) {
        c.beam.at(8, -6.5);
        c.beam.strength = 2.5;
      }
    } },
    { wait: 1.2 },
    { caption: '아브라함의 향년이 일백칠십오 세라. 그의 나이가 높고 늙어서 기운이 다하여 평안히 열조에게로 돌아갔다.', hold: 5.5 },
    { caption: '그의 아들들인 이삭과 이스마엘이 함께 손을 잡고 막벨라 굴 사라의 곁에 아버지를 정중히 안장하였다.', hold: 5.5 },
    { caption: '갈대아 우르에서 시작된 믿음의 여정, 칠 배나 뜨거운 풀무불과 모리아 산의 순종을 지나 영원한 본향에 이르렀다.', hold: 5.8 },
    { caption: '"내가 너로 큰 민족을 이루고 네게 복을 주어 네 이름을 창대하게 하리니, 땅의 모든 족속이 너로 말미암아 복을 얻으리라!"', style: 'voice', hold: 6.5 },
    { do: () => {
      if (c.beam) c.beam.strength = 0;
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.hud.celebrate('믿음의 조상 아브라함', '모든 여정을 완수하였습니다!');
      c.hud.toast('book6-complete', null, '제6권 <막벨라> 완료! 아브라함의 대서사가 완성되었습니다.');
    } },
  ];
}
