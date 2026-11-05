import * as THREE from 'three';
import type { Step } from '../../cutscene/cutscene';
import type { SceneContext } from '../book1/book1Scenes';

/** 1. 세겜 모레 상수리나무와 첫 제단 */
export function createShechemAltarSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('shechem_altar');
      c.hud.cinematicTitle = '제2권 · 약속의 땅\n세겜 모레 상수리나무';
      c.renderer.setTilt(24);
      c.setCameraFocus(-2, 1.8, -2);
      c.player.root.position.set(0, 0, 4);
      c.player.face(-Math.PI * 0.75);
      c.audio.playBgm('bgm_peaceful');
      if (c.beam) {
        c.beam.at(-2, -2);
        c.beam.strength = 1.6;
      }
    } },
    { wait: 1.0 },
    { caption: '하란을 떠나 유프라테스를 건넌 아브람은 마침내 약속의 땅, 세겜 모레 상수리나무에 이르렀다.', hold: 4.5 },
    { caption: '"내가 이 땅을 네 자손에게 주리라!" 하늘에서 임한 약속의 음성.', style: 'voice', hold: 4.2 },
    { caption: '아브람은 주저하지 않고 그 자리에 돌을 쌓아 여호와께 첫 감사의 제단을 봉헌했다.', hold: 4.5 },
    { do: () => {
      if (c.beam) c.beam.strength = 0;
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.hud.goalCategory = '제2권 · 약속의 땅';
      c.hud.goal = '세겜과 벧엘 둘러보기\n▪ 첫 제단 앞에서 감사 기도 드리기 (0/1)\n▪ 벧엘 언덕 정상 오르기 (0/1)';
      c.hud.goalProgress = { current: 0, total: 2, label: '0/2' };
      c.hud.hint = '돌 제단과 벧엘 언덕 꼭대기를 둘러보자';
    } },
  ];
}

/** 2. 애굽 국경 세관: 상자 속의 사래 */
export function createEgyptBorderSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('sarai_chest');
      c.hud.cinematicTitle = '애굽 국경과 세관\n보석 상자 속의 사래';
      c.renderer.setTilt(28);
      c.setCameraFocus(1.5, 1.5, -2);
      c.player.root.position.set(0, 0, 1.5);
      c.player.face(-Math.PI * 0.2);
      c.audio.playBgm('bgm_shadow_intrigue');
    } },
    { wait: 1.0 },
    { caption: '가나안에 심한 기근이 들자, 아브람 일행은 물이 풍부한 나일강 애굽 국경에 다다랐다.', hold: 4.5 },
    { caption: '세관 관헌: "이 큰 놋쇠 상자 속에는 무엇이 들었는가? 보석세를 내야 한다!"', hold: 4.2 },
    { caption: '상자 뚜껑이 열리자, 찬란한 빛과 함께 사래의 빼어난 아름다움이 온 국경에 드러났다.', hold: 4.8 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.hud.goalCategory = '제2권 · 애굽 국경';
      c.hud.goal = '애굽 국경 통과하기\n▪ 세관 관리와 담판 짓기 (0/1)\n▪ 나일강 수로 둘러보기 (0/1)';
      c.hud.goalProgress = { current: 0, total: 2, label: '0/2' };
      c.hud.hint = '국경 초소 관리와 대화하여 세관을 통과하자';
    } },
  ];
}

/** 3. 바로의 궁정과 출애굽 */
export function createPharaohPalaceSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.cinematicTitle = '바로의 궁정과 재앙\n하나님의 보호하심';
      c.renderer.setTilt(22);
      c.setCameraFocus(10, 2.0, -6);
      c.audio.playBgm('bgm_nimrod_empire');
    } },
    { wait: 0.8 },
    { caption: '사래를 취하려던 애굽 왕 바로와 그 집에 여호와께서 큰 재앙을 내리셨다.', hold: 4.5 },
    { caption: '바로: "어찌하여 그녀를 네 누이라 하여 나로 죄를 짓게 하였느냐! 사래를 데리고 당장 떠나라!"', hold: 4.8 },
    { caption: '하나님의 크신 손길 아래 아브람과 사래는 수많은 가축과 재물을 얻어 가나안으로 돌아왔다.', hold: 4.5 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 4. 벧엘 언덕에서의 결별 */
export function createLotPartingSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('lot_parting');
      c.hud.cinematicTitle = '벧엘 언덕의 결별\n동서남북을 바라보라';
      c.renderer.toVista();
      c.setCameraFocus(10, 3.0, -10);
      c.player.root.position.set(8, 2.4, -10);
      c.audio.playBgm('bgm_travel');
    } },
    { wait: 1.0 },
    { caption: '소유가 많아져 아브람의 목자와 롯의 목자들이 우물과 풀을 두고 다투기 시작했다.', hold: 4.5 },
    { caption: '아브람: "우리는 한 친족이라 다투지 말자. 네가 좌하면 내가 우하고, 네가 우하면 내가 좌하리라."', hold: 5.0 },
    { caption: '조카 롯은 눈을 들어 물이 넉넉한 여호와의 동산 같은 소돔 평야를 택하여 떠나갔다.', hold: 4.8 },
    { caption: '"눈을 들어 너 있는 곳에서 북쪽과 남쪽, 동쪽과 서쪽을 바라보라. 보이는 땅을 너와 네 자손에게 주리라!"', style: 'voice', hold: 5.2 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.hud.goalCategory = '제2권 · 벧엘 언덕';
      c.hud.goal = '약속의 땅 바라보기\n▪ 벧엘 전망대에서 동서남북 조망 (0/1)';
      c.hud.goalProgress = { current: 0, total: 1, label: '0/1' };
      c.hud.hint = '높은 언덕 바위 위에서 가나안 땅을 조망하자';
    } },
  ];
}

/** 5. 싯딤 골짜기 전쟁과 롯 구출 */
export function createSiddimWarSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.cinematicTitle = '싯딤 골짜기의 전쟁\n엘람 왕 그돌라오멜의 침공';
      c.renderer.setTilt(30);
      c.setCameraFocus(0, 1.2, -4);
      c.audio.playBgm('bgm_tension');
    } },
    { wait: 0.8 },
    { caption: '싯딤 골짜기에는 역청 구덩이가 많았으니, 소돔과 고모라 왕들이 패하여 달아나다 구덩이에 빠졌다.', hold: 4.8 },
    { caption: '연합군은 소돔의 모든 재물과 양식을 빼앗고, 그곳에 살던 아브람의 조카 롯까지 사로잡아 갔다.', hold: 4.8 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 6. 호바 야간 기습 작전 */
export function createHobahRescueSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('hobah_night_raid');
      c.hud.cinematicTitle = '호바 야간 기습\n318명 사병의 진격';
      c.renderer.toVista();
      c.setCameraFocus(0, 2.0, 0);
      c.player.root.position.set(0, 0, 8);
      c.audio.playBgm('bgm_battle_deliverance');
    } },
    { wait: 1.0 },
    { caption: '조카 롯이 사로잡혔음을 들은 아브람은 집에서 훈련받은 사병 318명을 거느리고 단까지 추격했다.', hold: 5.0 },
    { caption: '어두운 밤, 부대를 나누어 횃불과 함성으로 적진을 기습 공격하니 적들이 무너져 달아났다!', hold: 4.8 },
    { caption: '다메섹 북쪽 호바까지 추격하여 조카 롯과 부녀들, 빼앗겼던 모든 재물을 온전히 되찾아왔다.', hold: 4.8 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.hud.goalCategory = '제2권 · 롯 구출 작전';
      c.hud.goal = '적진 잔당 소탕 및 롯 구출\n▪ 전장의 횃불 밝히기 (0/3)\n▪ 조카 롯과 감격의 재회 (0/1)';
      c.hud.goalProgress = { current: 0, total: 4, label: '0/4' };
      c.hud.hint = '전장의 횃불을 밝히고 롯을 만나자';
    } },
  ];
}

/** 7. 살렘 왕 멜기세덱의 축복과 십일조 */
export function createMelchizedekSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('melchizedek_bread_wine');
      c.hud.cinematicTitle = '살렘 왕 멜기세덱의 축복\n떡과 포도주';
      c.renderer.setTilt(24);
      c.setCameraFocus(0, 1.4, 6);
      c.player.root.position.set(0, 0, 4);
      c.player.face(0);
      c.audio.playBgm('bgm_divine');
    } },
    { wait: 1.0 },
    { caption: '승전하고 돌아오는 아브람을 맞이한 이는 지극히 높으신 하나님의 제사장, 살렘 왕 멜기세덱이었다.', hold: 5.0 },
    { caption: '멜기세덱은 떡과 포도주를 가지고 나와 아브람을 축복했다.', hold: 4.2 },
    { caption: '"천지의 주재시요 지극히 높으신 하나님이여, 대적을 네 손에 붙이신 하나님을 찬송할지로다!"', style: 'voice', hold: 5.2 },
    { caption: '아브람은 감사의 뜻으로 얻은 전리품의 십분의 일을 멜기세덱에게 드렸다.', hold: 4.5 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 8. 언약의 방패와 소돔 왕의 제안 거절 */
export function createShieldRewardSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('shield_reward');
      c.hud.cinematicTitle = '언약의 방패\n소돔 왕의 제안 거절';
      c.audio.playBgm('bgm_hope_legacy');
    } },
    { wait: 0.8 },
    { caption: '소돔 왕: "사람은 내게 돌려보내고, 전리품은 네가 모두 가지라!"', hold: 4.2 },
    { caption: '아브람: "내가 네 실 한오라기나 들메끈 한 가닥도 가지지 아니하리라! 네가 나로 부자가 되었다 할까 하노라."', hold: 5.2 },
    { caption: '"아브람아 두려워하지 말라. 나는 네 방패요, 너의 지극히 큰 상급이니라!"', style: 'voice', hold: 5.0 },
    { do: () => {
      c.hud.cinematicTitle = null;
      c.hud.toast('book2-complete', null, '제2권 <약속의 땅> 완료! 제3권 <별과 언약>으로 나아갈 수 있습니다.');
    } },
  ];
}
