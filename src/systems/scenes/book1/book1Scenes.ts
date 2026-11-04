import * as THREE from 'three';
import type { Step } from '../../cutscene/cutscene';
import type { PixelRenderer } from '../../../renderer/pixelRenderer';
import type { Hud } from '../../../ui/hud';
import type { AudioManager } from '../../../audio/audioManager';
import type { Actor } from '../../../entities/actor';
import type { Beam } from '../../../entities/beam';

import type { Player } from '../../../entities/player';

export interface SceneContext {
  renderer: PixelRenderer;
  hud: Hud;
  audio: AudioManager;
  player: Player | Actor;
  beam?: Beam;
  setCameraFocus: (x: number, y: number, z: number) => void;
  setHour?: (hour: number) => void;
}

/** 1. 오프닝 프롤로그: 바벨과 갈대아 우르 */
export function createBook1IntroSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.cinematicTitle = '제1권 · 불과 팥죽\n갈대아 우르와 니므롯';
      c.renderer.toVista();
      c.setCameraFocus(-36, 6.0, -28); // 원경 거대 지구라트 조망
      c.audio.playBgm('bgm_ancient_memory');
    } },
    { wait: 0.8 },
    { caption: '노아의 방주 이후, 사람들은 시날 평지에 모여 하늘에 닿을 거대한 탑을 쌓기 시작했다.', hold: 4.2 },
    { caption: '"우리의 이름을 내고 온 지면에 흩어짐을 면하자!" 오만한 제국 바벨의 시작이었다.', hold: 4.0 },
    { do: () => {
      c.setCameraFocus(-18, 3.5, -12); // 우르 도시 전경으로 이동
    } },
    { caption: '사냥꾼 니므롯은 스스로 신이 되어 백성들을 억압했고, 온 세상은 우상 숭배로 물들었다.', hold: 4.2 },
    { do: () => {
      c.renderer.resetTilt();
      c.setCameraFocus(0, 1.2, 3.2); // 데라의 공방 마당으로 착지
      c.hud.cinematicTitle = null;
      c.player.root.position.set(0, 0, 3.2);
      c.player.face(Math.PI);
    } },
    { caption: '이곳 갈대아 우르, 왕실 신상을 만드는 장인 데라의 집에도 아침이 밝아왔다.', hold: 3.8 },
    { caption: '그리고 그 집의 맏아들, 청년 아브람.', hold: 3.2 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.goal = '공방과 거리를 둘러보며 아버지 데라와 식구들을 만나보자';
      c.hud.toast('start-walk', null, 'WASD나 화살표 키로 움직이고, E키나 클릭으로 대화해보자');
    } },
  ];
}

/** 2. 밤하늘과 첫 부르심 (옥상 테라스 이벤트) */
export function createNightCallingSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.audio.playBgm('bgm_divine_call');
      c.hud.cinematicTitle = '하나님의 첫 부르심\n사도행전 7:2-3';
      c.setCameraFocus(0, 4.2, -7.0); // 옥상 테라스 클로즈업
      c.player.root.position.set(0, 3.6, -7.0);
      c.player.face(Math.PI);
      if (c.beam) {
        c.beam.at(0, -7.0);
        c.beam.strength = 0;
      }
    } },
    { wait: 1.0 },
    { caption: '우르의 깊은 밤. 도성의 모든 불이 꺼졌으나, 청년 아브람만은 잠들지 못했다.', hold: 4.0 },
    { caption: '옥상에 오른 아브람은 쏟아지는 밤하늘의 무수한 별들을 홀로 올려다보았다.', hold: 4.0 },
    { do: () => {
      if (c.beam) c.beam.strength = 1.0;
      c.audio.playSfx('ui_confirm');
    } },
    { wait: 1.5 },
    { caption: '그때, 영광의 하나님께서 메소포타미아의 아브람에게 나타나 말씀하셨다.', hold: 4.0 },
    { caption: '너는 너의 고향과 친척을 떠나 내가 네게 보여 줄 땅으로 가라.', style: 'voice', hold: 5.0 },
    { caption: '내가 너로 큰 민족을 이루고 네게 복을 주어 네 이름을 창대하게 하리라.', style: 'voice', hold: 5.0 },
    { caption: '땅의 모든 족속이 너로 말미암아 복을 얻을 것이니라.', style: 'voice', hold: 5.0 },
    { wait: 1.2 },
    { do: () => {
      if (c.beam) c.beam.strength = 0;
      c.hud.cinematicTitle = null;
    } },
    { caption: '영광의 광채가 걷힌 뒤에도, 하나님의 말씀은 아브람의 심장에 불꽃처럼 타올랐다.', hold: 4.2 },
    { caption: '아브람: "사람이 손으로 깎아 만든 거짓된 우상들을 더 이상 두고 볼 수 없다!"', hold: 4.2 },
    { do: () => {
      c.player.root.position.set(0, 0, 1.0); // 공방 바닥으로 내려옴
      c.setCameraFocus(0, 1.2, -5.0);
      c.hud.goal = '공방으로 들어가 도끼를 챙기고 우상들을 깨뜨리자';
    } },
  ];
}

/** 3. 풀무불의 기적 클라이맥스 */
export function createFurnaceMiracleSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.audio.playBgm('bgm_battle_deliverance');
      c.hud.cinematicTitle = '풀무불의 기적\n타오르는 불길 속에서';
      c.setCameraFocus(0, 2.0, 0); // 풀무불 거대 화로 조망
    } },
    { wait: 1.0 },
    { caption: '니므롯의 하수인들이 밧줄에 묶인 아브람을 맹렬히 타오르는 화로 안으로 던져 넣었다.', hold: 4.4 },
    { caption: '군중들은 비명을 질렀고, 화로의 열기에 하수인들조차 불꽃에 쓰러졌다.', hold: 4.0 },
    { wait: 1.5 },
    { caption: '그러나 불길 속에서 기적이 일어났다!', hold: 3.5 },
    { caption: '아브람을 묶었던 밧줄만이 불타 끊어졌을 뿐, 그의 옷자락조차 그을리지 않았다.', hold: 4.5 },
    { caption: '화로 안에는 하나님의 천사가 함께 거닐고 있었다.', hold: 4.2 },
    { wait: 1.0 },
    { caption: '아브람이 천사의 손을 잡고 유유히 불꽃 밖으로 걸어 나왔다.', hold: 4.0 },
    { caption: '니므롯과 바벨의 모든 제사장들은 공포와 경악에 사로잡혀 떨었다.', hold: 4.2 },
    { do: () => {
      c.hud.cinematicTitle = null;
      c.audio.playBgm('bgm_hope_legacy');
      c.hud.goal = '성문 밖으로 나가 데라, 사래, 롯과 함께 하란으로 출발하자';
    } },
  ];
}

/** 4. 하란 도착과 데라의 임종 */
export function createHaranSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.audio.playBgm('bgm_lament');
      c.hud.cinematicTitle = '하란의 장막\n아버지 데라의 안식';
      c.setCameraFocus(0, 1.4, 0);
    } },
    { wait: 1.0 },
    { caption: '아브람의 일행은 우르를 탈출해 북쪽 유프라테스 강을 거슬러 하란에 이르렀다.', hold: 4.2 },
    { caption: '기력이 다한 아버지 데라는 장막에 누워 아들의 손을 잡았다.', hold: 4.0 },
    { caption: '데라: "아브람아... 네가 만난 참되신 하나님을... 끝까지 따라가거라..."', hold: 4.8 },
    { caption: '향년 205세로 데라가 평안히 눈을 감았다. 아브람과 사래, 롯은 깊이 애도했다.', hold: 4.4 },
    { wait: 1.2 },
    { do: () => {
      c.audio.playBgm('bgm_divine_call');
      c.hud.cinematicTitle = null;
    } },
    { caption: '슬픔을 딛고 일어선 아브람은 마침내 가나안 약속의 땅을 향해 발걸음을 옮겼다.', hold: 4.4 },
    { caption: '제1권 [불과 팥죽]의 대서사가 마무리되었습니다.', hold: 4.0 },
  ];
}
