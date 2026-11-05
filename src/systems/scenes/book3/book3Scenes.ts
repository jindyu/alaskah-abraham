import * as THREE from 'three';
import type { Step } from '../../cutscene/cutscene';
import type { SceneContext } from '../book1/book1Scenes';

/** 1. 하늘의 별과 횃불 언약 */
export function createStarsCovenantSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('covenant_flaming_torch');
      c.hud.cinematicTitle = '제3권 · 별과 언약\n하늘의 뭇별을 세어보라';
      c.renderer.setTilt(18);
      c.setCameraFocus(6, 2.0, 2);
      c.player.root.position.set(4, 0, 3);
      c.player.face(-Math.PI * 0.25);
      c.audio.playBgm('bgm_covenant_stars');
      if (c.beam) {
        c.beam.at(6, 2);
        c.beam.strength = 1.8;
      }
    } },
    { wait: 1.0 },
    { caption: '"장막 밖으로 나와 하늘을 우러러 뭇별을 셀 수 있나 보라. 네 자손이 이와 같으리라!"', style: 'voice', hold: 5.0 },
    { caption: '아브람이 여호와를 믿으니, 여호와께서 이를 그의 의로 여기셨다.', hold: 4.2 },
    { caption: '해 질 무렵 솔개들이 제물 위로 내릴 때 아브람이 쫓아내며 깊은 잠에 들었다.', hold: 4.5 },
    { caption: '해가 져서 어둘 때에 연기 나는 화로가 보이며 타는 횃불이 쪼갠 고기 사이로 지나갔다.', style: 'voice', hold: 5.2 },
    { do: () => {
      if (c.beam) c.beam.strength = 0;
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.hud.goalCategory = '제3권 · 별과 언약';
      c.hud.goal = '마므레 장막 둘러보기\n▪ 횃불 언약 제단 살펴보기 (0/1)\n▪ 소년 이스마엘의 활 연습 보기 (0/1)';
      c.hud.goalProgress = { current: 0, total: 2, label: '0/2' };
      c.hud.hint = '제단과 남동쪽 활쏘기 과녁을 둘러보자';
    } },
  ];
}

/** 2. 하갈의 광야 방랑과 브엘라해로이 */
export function createHagarLahairoiSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('hagar_lahairoi');
      c.hud.cinematicTitle = '광야의 샘물\n나를 살피시는 하나님';
      c.audio.playBgm('bgm_desert_exile');
    } },
    { wait: 0.8 },
    { caption: '사래의 학대를 견디지 못해 광야 길로 도망친 여종 하갈이 샘물 곁에서 울고 있었다.', hold: 4.5 },
    { caption: '주의 천사: "사래의 여종 하갈아, 네 여주인에게로 돌아가 복종하라. 네 자손을 번성케 하리니 그 이름을 이스마엘이라 하라."', hold: 5.2 },
    { caption: '하갈이 "나를 살피시는 하나님을 내가 뵈었다" 고백하여 그 샘을 브엘라해로이라 불렀다.', hold: 4.8 },
    { do: () => {
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 3. 들사람 이스마엘의 활쏘기 */
export function createIshmaelArcherSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('ishmael_archer');
      c.hud.cinematicTitle = '들사람 이스마엘\n바란 광야의 활쏘기';
      c.renderer.setTilt(26);
      c.setCameraFocus(9, 1.2, 6);
      c.audio.playBgm('bgm_pastoral_home');
    } },
    { wait: 0.8 },
    { caption: '이스마엘이 자라나매 하나님이 그 아이와 함께하시니 광야에 거주하며 활 쏘는 자가 되었다.', hold: 4.8 },
    { caption: '거칠고 당당한 들사람으로 자라난 이스마엘은 장막 주변의 들짐승들을 용맹하게 쫓아냈다.', hold: 4.5 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 4. 99세의 부르심과 할례, 아브라함의 새 이름 */
export function createCircumcisionNewNameSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('abraham_new_name');
      c.hud.cinematicTitle = '99세의 부르심\n아브라함과 사라의 새 이름';
      c.audio.playBgm('bgm_divine');
      if (c.beam) {
        c.beam.at(0, -2);
        c.beam.strength = 1.8;
      }
    } },
    { wait: 1.0 },
    { caption: '"나는 전능한 하나님이라. 너는 내 앞에서 행하여 완전하라!"', style: 'voice', hold: 4.8 },
    { caption: '"이제 네 이름을 아브람이라 하지 아니하고 아브라함이라 하리니, 이는 내가 너를 여러 민족의 아버지가 되게 함이라."', style: 'voice', hold: 5.5 },
    { caption: '"네 아내 사래는 이름을 사라라 하라. 내가 그에게 복을 주어 민족들의 어머니가 되게 하리라."', style: 'voice', hold: 5.2 },
    { caption: '아브라함은 온 집안의 남자들과 함께 몸에 거룩한 할례의 표징을 행하여 언약을 확증했다.', hold: 4.8 },
    { do: () => {
      if (c.beam) c.beam.strength = 0;
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 5. 아브라함의 웃음과 이삭의 약속 */
export function createAbrahamsLaughterSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('abraham_laughter');
      c.hud.cinematicTitle = '아브라함의 웃음\n이삭(기쁨)의 약속';
      c.audio.playBgm('bgm_pastoral_home');
    } },
    { wait: 0.8 },
    { caption: '아브라함이 엎드려 웃으며 심중에 이르되, "백 세 된 사람이 어찌 자식을 낳을까, 사라는 구십 세니 어찌 출산하리요!"', hold: 5.2 },
    { caption: '하나님이 이르시되, "아니라 네 아내 사라가 정녕 네게 아들을 낳으리니 그 이름을 이삭(웃음)이라 하라."', style: 'voice', hold: 5.5 },
    { caption: '"내가 그와 영원한 언약을 세우리니 그의 후손에게 영원한 언약이 되리라!"', style: 'voice', hold: 4.8 },
    { do: () => {
      c.hud.cinematicTitle = null;
      c.hud.toast('book3-complete', null, '제3권 <별과 언약> 완료! 제4권 <소돔의 불>로 나아갈 수 있습니다.');
    } },
  ];
}
