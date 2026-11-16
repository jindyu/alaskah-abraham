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
    { caption: '아브람: "주 여호와여, 무엇을 내게 주시려 하나이까. 내 상속자는 다메섹 사람 엘리에셀이니이다."', style: 'voice', speaker: '아브람', hold: 5.0, voice: { chapter: '01_covenant_of_stars', role: 'abram', text: '주 여호와여, 무엇을 내게 주시려 하나이까. 나는 자식이 없나이다…' } },
    { caption: '"장막 밖으로 나와 하늘을 우러러 뭇별을 셀 수 있나 보라. 네 자손이 이와 같으리라!"', style: 'voice', speaker: '여호와', hold: 5.0, voice: { chapter: '01_covenant_of_stars', role: 'narrator', text: '하늘을 우러러 뭇 별을 셀 수 있나 보라. 네 자손이 이와 같을 것이다.' } },
    { caption: '아브람: "…셀 수 없다면, 하늘의 별처럼 셀 수 없는 대로 믿겠습니다."', style: 'voice', speaker: '아브람', hold: 4.8, voice: { chapter: '01_covenant_of_stars', role: 'abram', text: '…셀 수 없다면, 셀 수 없는 대로 믿겠습니다.' } },
    { caption: '아브람이 여호와를 믿으니, 여호와께서 이를 그의 의로 여기셨다.', hold: 4.2, voice: { chapter: '01_covenant_of_stars', role: 'narrator', text: '아브람이 여호와를 믿으니, 여호와께서 이를 그의 의로 여기셨다.' } },
    { caption: '해 질 무렵 솔개들이 제물 위로 내릴 때 아브람이 쫓아내며 깊은 잠에 들었다.', hold: 4.5, voice: { chapter: '01_covenant_of_stars', role: 'narrator', text: '솔개가 그 사체 위에 내릴 때에는 아브람이 쫓았더라.' } },
    { caption: '해가 져서 어둘 때에 연기 나는 화로가 보이며 타는 횃불이 쪼갠 고기 사이로 지나갔다.', style: 'voice', hold: 5.2, voice: { chapter: '01_covenant_of_stars', role: 'narrator', text: '해가 져서 어두울 때에 연기 나는 화로가 보이며 타는 횃불이 쪼갠 고기 사이로 지나더라.' } },
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
    { caption: '사래: "여호와께서 나의 출산을 허락지 아니하시니, 원하건대 내 여종에게 들어가 자식을 얻으소서."', style: 'voice', speaker: '사래', hold: 5.0, voice: { chapter: '02_hagar_and_ishmael', role: 'sarah', text: '여호와께서 나의 출산을 허락하지 아니하시니, 원하건대 내 여종에게 들어가시오.' } },
    { caption: '사래의 학대를 견디지 못해 광야 길로 도망친 여종 하갈이 샘물 곁에서 울고 있었다.', hold: 4.5, voice: { chapter: '02_hagar_and_ishmael', role: 'narrator', text: '사래가 하갈을 학대하니, 하갈이 사래 앞에서 도망하였다.' } },
    { caption: '주의 천사: "사래의 여종 하갈아, 네 여주인에게로 돌아가 복종하라. 네 자손을 번성케 하리니 그 이름을 이스마엘이라 하라."', hold: 5.2, voice: { chapter: '02_hagar_and_ishmael', role: 'narrator', text: '네 여주인에게로 돌아가서 그 수하에 복종하라.' } },
    { caption: '하갈: "…주께서는 정녕 나를 살피시는 살아계신 하나님이시로다."', style: 'voice', speaker: '하갈', hold: 4.8, voice: { chapter: '02_hagar_and_ishmael', role: 'hagar', text: '…주께서는 나를 살피시는 하나님이시로다.' } },
    { caption: '하갈이 "나를 살피시는 하나님을 내가 뵈었다" 고백하여 그 샘을 브엘라해로이라 불렀다.', hold: 4.8, voice: { chapter: '02_hagar_and_ishmael', role: 'narrator', text: '하갈은 그 샘을 브엘라해로이 — "나를 살피시는 살아계신 분의 우물" — 이라 불렀다.' } },
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
    { caption: '세월이 흘러 소년이 된 이스마엘은 활을 메고 광야를 힘차게 누비며 자라났다.', hold: 4.8, voice: { chapter: '03_ishmael_of_the_wild', role: 'narrator', text: '세월이 흘러 이스마엘은 소년이 되었다. 활을 메고 광야를 누비며 자랐다.' } },
    { caption: '아브람: "…네가 자라서 무엇이 되고 싶으냐, 내 아들아."', style: 'voice', speaker: '아브람', hold: 4.2, voice: { chapter: '03_ishmael_of_the_wild', role: 'abram', text: '…네가 자라서 무엇이 되고 싶으냐.' } },
    { caption: '이스마엘: "아버지처럼 자유로운 사람이 되고 싶습니다, 누구에게도 매이지 않는 들사람으로!"', style: 'voice', speaker: '이스마엘', hold: 4.8, voice: { chapter: '03_ishmael_of_the_wild', role: 'ishmael', text: '아버지처럼, 자유로운 사람이 되고 싶습니다. 누구에게도 매이지 않는.' } },
    { caption: '이스마엘이 자라나매 하나님이 그 아이와 함께하시니 광야에 거주하며 활 쏘는 자가 되었다.', hold: 4.8, voice: { chapter: '03_ishmael_of_the_wild', role: 'narrator', text: '하나님이 그 아이와 함께 계시매 그가 자라 광야에서 거주하며 활 쏘는 자가 되었더니' } },
    { caption: '거칠고 당당한 들사람으로 자라난 이스마엘은 장막 주변의 들짐승들을 용맹하게 쫓아냈다.', hold: 4.5, voice: { chapter: '03_ishmael_of_the_wild', role: 'narrator', text: '그가 바란 광야에 거주할 때에 그의 어머니가 그를 위하여 애굽 땅에서 아내를 얻어 주었더라.' } },
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
    { caption: '"나는 전능한 하나님이라. 너는 내 앞에서 행하여 완전하라!"', style: 'voice', speaker: '여호와', hold: 4.8, voice: { chapter: '04_circumcision_and_new_name', role: 'narrator', text: '나는 전능한 하나님이다. 너는 내 앞에서 행하여 완전하라.' } },
    { caption: '"이제 네 이름을 아브람이라 하지 아니하고 아브라함이라 하리니, 이는 내가 너를 여러 민족의 아버지가 되게 함이라."', style: 'voice', speaker: '여호와', hold: 5.5, voice: { chapter: '04_circumcision_and_new_name', role: 'narrator', text: '이는 내가 너를 여러 민족의 아비가 되게 하기 때문이다.' } },
    { caption: '아브라함: "…아브라함. 여러 민족의 아비라 부르시니 그대로 순종하겠나이다."', style: 'voice', speaker: '아브라함', hold: 4.8, voice: { chapter: '04_circumcision_and_new_name', role: 'abraham', text: '…아브라함.' } },
    { caption: '"네 아내 사래는 이름을 사라라 하라. 내가 그에게 복을 주어 민족들의 어머니가 되게 하리라."', style: 'voice', speaker: '여호와', hold: 5.2, voice: { chapter: '04_circumcision_and_new_name', role: 'narrator', text: '네 아내 사래는 이름을 사라라 하라. 그가 열국의 어미가 될 것이다.' } },
    { caption: '사라: "…열국의 어미 사라. 은혜의 이름을 가슴에 품겠나이다."', style: 'voice', speaker: '사라', hold: 4.8, voice: { chapter: '04_circumcision_and_new_name', role: 'sarah', text: '…사라.' } },
    { caption: '아브라함은 온 집안의 남자들과 함께 몸에 거룩한 할례의 표징을 행하여 언약을 확증했다.', hold: 4.8, voice: { chapter: '04_circumcision_and_new_name', role: 'narrator', text: '너희 중 남자는 다 할례를 받으라. 이것이 나와 너희 사이의 언약의 표징이다.' } },
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
    { caption: '아브라함이 엎드려 웃으며 심중에 이르되, "백 세 된 사람이 어찌 자식을 낳을까, 사라는 구십 세니 어찌 출산하리요!"', hold: 5.2, voice: { chapter: '05_abrahams_laughter', role: 'abraham', text: '…백 세 된 사람이 어찌 자식을 낳을까. 사라는 구십 세인데 어찌 낳을까.' } },
    { caption: '아브라함: "…이스마엘이나 하나님 앞에 복을 받으며 살기를 원하나이다."', style: 'voice', speaker: '아브라함', hold: 4.8, voice: { chapter: '05_abrahams_laughter', role: 'abraham', text: '…이스마엘이나 하나님 앞에 살기를 원하나이다.' } },
    { caption: '하나님이 이르시되, "아니라 네 아내 사라가 정녕 네게 아들을 낳으리니 그 이름을 이삭(웃음)이라 하라."', style: 'voice', speaker: '여호와', hold: 5.5, voice: { chapter: '05_abrahams_laughter', role: 'narrator', text: '네 아내 사라가 네게 아들을 낳을 것이니 그 이름을 이삭이라 하라.' } },
    { caption: '"내가 그와 영원한 언약을 세우리니 그의 후손에게 영원한 언약이 되리라!"', style: 'voice', speaker: '여호와', hold: 4.8, voice: { chapter: '05_abrahams_laughter', role: 'narrator', text: '내가 그와 내 언약을 세워 그 후손에게 영원한 언약이 되게 하겠다.' } },
    { do: () => {
      c.hud.cinematicTitle = null;
      c.hud.toast('book3-complete', null, '제3권 <별과 언약> 완료! 제4권 <소돔의 불>로 나아갈 수 있습니다.');
    } },
  ];
}
