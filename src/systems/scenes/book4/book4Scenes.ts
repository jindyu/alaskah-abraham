import * as THREE from 'three';
import type { Step } from '../../cutscene/cutscene';
import type { SceneContext } from '../book1/book1Scenes';

/** 1. 마므레 세 나그네 영접과 오찬 */
export function createThreeVisitorsSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('three_visitors');
      c.hud.cinematicTitle = '제4권 · 소돔의 불\n마므레 세 나그네 영접';
      c.renderer.setTilt(24);
      c.setCameraFocus(1.5, 1.2, 0);
      c.player.root.position.set(1.5, 0, 2);
      c.player.face(Math.PI);
      c.audio.playBgm('bgm_divine_call');
      if (c.beam) {
        c.beam.at(1.5, 0);
        c.beam.strength = 1.6;
      }
    } },
    { wait: 1.0 },
    { caption: '날이 뜨거울 때에 아브라함이 장막 문에 앉았다가 눈을 들어보니 세 사람이 맞은편에 섰다.', hold: 4.8 },
    { caption: '즉시 달려나가 몸을 땅에 굽히며 청하되, "내 주여 내가 주께 은혜를 입었사오면 종을 떠나 지나가지 마옵소서!"', hold: 5.2 },
    { caption: '발 씻을 물을 드리고, 사라가 구운 고운 떡과 기름진 송아지 고기, 엉긴 젖을 나무 아래 정성껏 차려 올렸다.', hold: 5.0 },
    { caption: '"내년 이맘때 내가 반드시 네게로 돌아오리니 네 아내 사라에게 아들이 있으리라!"', style: 'voice', hold: 5.0 },
    { do: () => {
      if (c.beam) c.beam.strength = 0;
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.hud.goalCategory = '제4권 · 소돔의 불';
      c.hud.goal = '세 손님 섬기기\n▪ 마므레 평상 앞 감사 묵상 (0/1)\n▪ 소돔을 향한 중보 기도 드리기 (0/1)';
      c.hud.goalProgress = { current: 0, total: 2, label: '0/2' };
      c.hud.hint = '평상 앞과 동쪽 언덕길로 나아가자';
    } },
  ];
}

/** 2. 의인 열 명을 위한 중보 기도 */
export function createIntercessionSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('ten_righteous');
      c.hud.cinematicTitle = '의인 열 명의 중보\n소돔을 내려다보는 언덕';
      c.audio.playBgm('bgm_tension');
    } },
    { wait: 0.8 },
    { caption: '아브라함이 주 앞에 서서 간구하되, "주께서 의인을 악인과 함께 멸하려 하시나이까?"', hold: 5.0 },
    { caption: '"그 성중에 의인 오십 명이 있을지라도 그곳을 용서하지 아니하시리이까?"', hold: 4.5 },
    { caption: '오십 명에서 시작하여 마흔다섯, 마흔, 서른, 스물... 마침내 열 명까지.', hold: 4.5 },
    { caption: '"내가 의인 열 명으로 말미암아도 멸하지 아니하리라!" 하나님의 긍휼 어린 응답.', style: 'voice', hold: 5.0 },
    { do: () => {
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 3. 소돔의 죄악과 롯 가옥의 폭도들 (롯 시점) */
export function createSodomRiotSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.cinematicTitle = '소돔의 죄악\n성문과 롯의 가옥';
      c.renderer.setTilt(30);
      c.setCameraFocus(-3.4, 1.5, 2);
      c.player.root.position.set(-2.5, 0, 2);
      c.audio.playBgm('bgm_danger_pursuit');
    } },
    { wait: 0.8 },
    { caption: '저녁때에 두 천사가 소돔에 이르니, 성문에 앉아 있던 롯이 보고 일어나 영접하여 집으로 들였다.', hold: 5.0 },
    { caption: '밤이 깊자 소돔 백성들이 노소를 막론하고 몰려와 롯의 집을 에워싸고 문을 부수려 했다!', hold: 4.8 },
    { caption: '두 천사가 손을 내밀어 롯을 집으로 끌어들이고, 문밖의 무리를 쳐서 눈을 어둡게 하니 문을 찾지 못했다.', hold: 5.2 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.hud.goalCategory = '제4권 · 소돔 탈출 (롯)';
      c.hud.goal = '소돔 탈출 작전\n▪ 가족들의 손을 잡고 성문으로 질주하기 (0/1)';
      c.hud.goalProgress = { current: 0, total: 1, label: '0/1' };
      c.hud.hint = '성문 밖 남동쪽 탈출로를 향해 전력 질주(Shift)하자';
    } },
  ];
}

/** 4. 소돔의 멸망과 소금 기둥 */
export function createSodomEscapeSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('sodom_escape');
      c.hud.unlockCodex('pillar_of_salt');
      c.hud.cinematicTitle = '소돔의 멸망\n하늘의 유황불과 소금기둥';
      c.renderer.toVista();
      c.setCameraFocus(8, 2.5, 7);
      c.audio.playBgm('bgm_judgment_fire');
    } },
    { wait: 1.0 },
    { caption: '천사들이 롯과 그 아내와 두 딸의 손을 잡아 성 밖으로 이끌며 외쳤다. "도망하여 생명을 보존하라! 결코 뒤를 돌아보지 말라!"', hold: 5.2 },
    { caption: '해가 돋아 롯이 소알에 들어갔을 때, 여호와께서 하늘로부터 유황과 불을 비같이 소돔에 내리셨다!', style: 'voice', hold: 5.5 },
    { caption: '그러나 롯의 아내는 뒤를 돌아보았으므로 소금 기둥이 되었더라.', hold: 5.0 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 5. 아브라함의 새벽과 피어오르는 연기 */
export function createAbrahamsDawnSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.cinematicTitle = '아브라함의 새벽\n피어오르는 연기';
      c.renderer.toVista();
      c.setCameraFocus(0, 2.0, -8);
      c.audio.playBgm('bgm_lament');
    } },
    { wait: 1.0 },
    { caption: '아브라함이 그 아침에 일찍이 일어나 여호와 앞에 서 있던 곳에 이르러,', hold: 4.5 },
    { caption: '소돔과 고모라와 온 들을 향하여 눈을 들어보니 그 땅의 연기가 옹기 가마의 연기같이 치솟아 올랐다.', hold: 5.2 },
    { caption: '그러나 하나님이 그 지역의 성을 멸하실 때, 아브라함을 생각하사 롯을 그 엎으시는 중에서 내보내셨더라.', hold: 5.0 },
    { do: () => {
      c.hud.cinematicTitle = null;
      c.hud.toast('book4-complete', null, '제4권 <소돔의 불> 완료! 제5권 <모리아>로 나아갈 수 있습니다.');
    } },
  ];
}
