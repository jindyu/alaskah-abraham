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
    { caption: '하란을 떠나 유프라테스를 건넌 아브람은 마침내 약속의 땅, 세겜 모레 상수리나무에 이르렀다.', hold: 4.5, voice: { chapter: '01_the_calling', role: 'narrator', text: '아브람이 하란을 떠난 지 여러 날, 마침내 가나안 땅 세겜 모레 상수리나무에 이르렀다.' } },
    { caption: '아브람: "…여기가, 주께서 보여주신다던 그 땅입니까."', style: 'voice', speaker: '아브람', hold: 4.2, voice: { chapter: '01_the_calling', role: 'abram', text: '…여기가, 주께서 보여주신다던 그 땅입니까.' } },
    { caption: '"내가 이 땅을 네 자손에게 주리라!" 하늘에서 임한 약속의 음성.', style: 'voice', speaker: '여호와', hold: 4.2, voice: { chapter: '01_the_calling', role: 'narrator', text: '여호와께서 아브람에게 나타나 말씀하셨다, 내가 네 자손에게 이 땅을 줄 것이다.' } },
    { caption: '아브람: "여호와여—! 말씀하신 대로, 제가 여기까지 왔습니다!"', style: 'voice', speaker: '아브람', hold: 4.2, voice: { chapter: '01_the_calling', role: 'abram', text: '여호와여—! 말씀하신 대로, 제가 여기까지 왔습니다!' } },
    { caption: '아브람은 주저하지 않고 그 자리에 돌을 쌓아 여호와께 첫 감사의 제단을 봉헌했다.', hold: 4.5, voice: { chapter: '01_the_calling', role: 'narrator', text: '아브람이 그곳에서 자기에게 나타나신 여호와를 위하여 제단을 쌓았다.' } },
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
      c.hud.cinematicTitle = '애굽 국경과 세관\n보석 상자 속의 사래 [전해오는 이야기 · 창세기 라바 40:5]';
      c.renderer.setTilt(28);
      c.setCameraFocus(1.5, 1.5, -2);
      c.player.root.position.set(0, 0, 1.5);
      c.player.face(-Math.PI * 0.2);
      c.audio.playBgm('bgm_shadow_intrigue');
    } },
    { wait: 1.0 },
    { caption: '[전해오는 이야기 · 창세기 라바 40:5] 가나안에 심한 기근이 들자, 아브람 일행은 물이 풍부한 나일강 애굽 국경에 다다랐다.', hold: 4.5, voice: { chapter: '02_the_chest_at_the_border', role: 'narrator', text: '애굽 땅 어귀에 이르렀을 때, 아브람이 사래에게 말했다.' } },
    { caption: '아브람: "그대는 얼굴이 아름다운 여인이오. 애굽 사람이 그대를 보고 나를 해칠까 두렵소."', style: 'voice', speaker: '아브람', hold: 4.6, voice: { chapter: '02_the_chest_at_the_border', role: 'abram', text: '그대는 얼굴이 아름다운 여인이오.' } },
    { caption: '세관 관헌: "이 큰 놋쇠 상자 속에는 무엇이 들었는가? 보석세를 내야 한다!"', hold: 4.2, voice: { chapter: '02_the_chest_at_the_border', role: 'customs', text: '관세를 매겨야 하니 궤를 열라. 곡식이냐, 금이냐, 비단이냐.' } },
    { caption: '상자 뚜껑이 열리자, 찬란한 빛과 함께 사래의 빼어난 아름다움이 온 국경에 드러났다.', hold: 4.8, voice: { chapter: '02_the_chest_at_the_border', role: 'narrator', text: '궤가 열리는 순간, 온 나루가 환해진 듯하였다.' } },
    { caption: '세관 관리: "…이런 얼굴은, 애굽 온 땅에도 없다! 왕궁으로 알려라!"', style: 'voice', hold: 4.5, voice: { chapter: '02_the_chest_at_the_border', role: 'customs', text: '…이런 얼굴은, 애굽 온 땅에도 없다.' } },
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
    { caption: '사래를 취하려던 애굽 왕 바로와 그 집에 여호와께서 큰 재앙을 내리셨다.', hold: 4.5, voice: { chapter: '03_sarai_in_egypt', role: 'narrator', text: '여호와께서 사래의 일로 바로와 그 집에 큰 재앙을 내리셨다.' } },
    { caption: '바로: "어찌하여 그녀를 네 누이라 하여 나로 죄를 짓게 하였느냐! 사래를 데리고 당장 떠나라!"', hold: 4.8, voice: { chapter: '03_sarai_in_egypt', role: 'pharaoh', text: '어찌 내게 이런 일을 행하였느냐! 자, 네 아내가 여기 있으니 데리고 떠나라!' } },
    { caption: '사래: "…돌아가게 되었군요. 우리를 지켜주신 하나님 앞에 감사드립니다."', style: 'voice', speaker: '사래', hold: 4.6, voice: { chapter: '03_sarai_in_egypt', role: 'sarah', text: '…돌아가게 되었군요.' } },
    { caption: '하나님의 크신 손길 아래 아브람과 사래는 수많은 가축과 재물을 얻어 가나안으로 돌아왔다.', hold: 4.5, voice: { chapter: '03_sarai_in_egypt', role: 'narrator', text: '들어올 때는 짐수레 하나가 전부였으나, 나가는 행렬에는 낙타와 가축과 은금이 함께했다.' } },
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
    { caption: '소유가 많아져 아브람의 목자와 롯의 목자들이 우물과 풀을 두고 다투기 시작했다.', hold: 4.5, voice: { chapter: '04_parting_from_lot', role: 'narrator', text: '아브람의 목자와 롯의 목자 사이에 다툼이 일었다.' } },
    { caption: '아브람: "우리는 한 친족이라 다투지 말자. 네가 좌하면 내가 우하고, 네가 우하면 내가 좌하리라."', hold: 5.0, voice: { chapter: '04_parting_from_lot', role: 'abram', text: '우리는 한 친족이라. 너와 나, 네 목자와 내 목자가 서로 다투게 하지 말자.' } },
    { caption: '롯: "…제가 저 요단 온 평야로 가겠습니다."', style: 'voice', speaker: '롯', hold: 4.5, voice: { chapter: '04_parting_from_lot', role: 'lot', text: '…제가 저 요단 지역으로 가겠습니다.' } },
    { caption: '조카 롯은 눈을 들어 물이 넉넉한 여호와의 동산 같은 소돔 평야를 택하여 떠나갔다.', hold: 4.8, voice: { chapter: '04_parting_from_lot', role: 'narrator', text: '롯이 눈을 들어 요단 온 지역을 바라보니, 물이 넉넉하여 마치 여호와의 동산 같았다.' } },
    { caption: '두 사람은 어릴 적부터 함께 걸어온 길에서, 처음으로 서로 다른 방향을 바라보았다.', hold: 4.8, voice: { chapter: '04_parting_from_lot', role: 'narrator', text: '두 사람은 어릴 적부터 함께 걸어온 길에서, 처음으로 서로 다른 방향을 바라보았다.' } },
    { caption: '"눈을 들어 너 있는 곳에서 북쪽과 남쪽, 동쪽과 서쪽을 바라보라. 보이는 땅을 너와 네 자손에게 주리라!"', style: 'voice', speaker: '여호와', hold: 5.2, voice: { chapter: '04_parting_from_lot', role: 'narrator', text: '보이는 땅을 내가 너와 네 자손에게 줄 것이니, 네 자손이 땅의 티끌처럼 많아지게 하겠다.' } },
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
    { caption: '나팔 소리가 진동하고, 시날과 엘람 연합군이 싯딤 골짜기로 노도와 같이 밀려들었다.', hold: 4.8, voice: { chapter: '06_siddim_valley_war', role: 'narrator', text: '나팔이 울리고, 두 대군이 서로를 향해 짓쳐 들어갔다.' } },
    { caption: '싯딤 골짜기에는 역청 구덩이가 많았으니, 소돔과 고모라 왕들이 패하여 달아나다 구덩이에 빠졌다.', hold: 4.8, voice: { chapter: '06_siddim_valley_war', role: 'narrator', text: '소돔 연합의 대열이 무너졌다. 어떤 이는 역청 구덩이에 빠졌고, 나머지는 산지로 달아났다.' } },
    { caption: '연합군은 소돔의 모든 재물과 양식을 빼앗고, 그곳에 살던 아브람의 조카 롯까지 사로잡아 갔다.', hold: 4.8, voice: { chapter: '06_siddim_valley_war', role: 'narrator', text: '롯과 그 재물을 노략하여 끌고 갔다.' } },
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
    { caption: '엘리에셀: "주인이여, 집에서 길리고 훈련된 삼백십팔 명의 용사가 준비되었습니다!"', style: 'voice', speaker: '엘리에셀', hold: 4.8, voice: { chapter: '07_war_and_rescue', role: 'eliezer', text: '주인이여, 삼백십팔 명이 집에서 길리고 훈련되었습니다.' } },
    { caption: '조카 롯이 사로잡혔음을 들은 아브람은 사병들을 거느리고 단까지 밤을 새워 추격했다.', hold: 5.0, voice: { chapter: '07_war_and_rescue', role: 'abram', text: '…내 조카를 그대로 둘 수 없다. 지금 곧 뒤쫓겠다.' } },
    { caption: '어두운 밤, 부대를 나누어 횃불과 함성으로 적진을 기습 공격하니 적들이 무너져 달아났다!', hold: 4.8, voice: { chapter: '07_war_and_rescue', role: 'narrator', text: '아브람은 무리를 둘로 나누어, 자신은 왼쪽에서 엘리에셀은 오른쪽에서, 어둠을 타 대적의 진을 동시에 덮쳤다.' } },
    { caption: '롯: "삼촌… 삼촌이 오실 줄 알았습니다!"', style: 'voice', speaker: '롯', hold: 4.5, voice: { chapter: '07_war_and_rescue', role: 'lot', text: '삼촌… 삼촌이 오실 줄 알았습니다.' } },
    { caption: '다메섹 북쪽 호바까지 추격하여 조카 롯과 부녀들, 빼앗겼던 모든 재물을 온전히 되찾아왔다.', hold: 4.8, voice: { chapter: '07_war_and_rescue', role: 'narrator', text: '아브람이 빼앗겼던 모든 재물과 그의 조카 롯과 그의 재물과 또 부녀와 백성을 다 찾아왔다.' } },
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
    { caption: '승전하고 돌아오는 아브람을 맞이한 이는 지극히 높으신 하나님의 제사장, 살렘 왕 멜기세덱이었다.', hold: 5.0, voice: { chapter: '08_melchizedek_blessing', role: 'narrator', text: '살렘 왕 멜기세덱이 떡과 포도주를 가지고 나왔으니,' } },
    { caption: '멜기세덱은 떡과 포도주를 가지고 나와 아브람을 축복했다.', hold: 4.2, voice: { chapter: '08_melchizedek_blessing', role: 'narrator', text: '그는 지극히 높으신 하나님의 제사장이었다.' } },
    { caption: '멜기세덱: "천지의 주재이시요 지극히 높으신 하나님이여, 아브람에게 복을 주옵소서!"', style: 'voice', speaker: '멜기세덱', hold: 5.0, voice: { chapter: '08_melchizedek_blessing', role: 'melchizedek', text: '천지의 주재이시요 지극히 높으신 하나님이여, 아브람에게 복을 주옵소서.' } },
    { caption: '"너희 대적을 네 손에 붙이신 지극히 높으신 하나님을 찬송할지로다!"', style: 'voice', speaker: '멜기세덱', hold: 5.2, voice: { chapter: '08_melchizedek_blessing', role: 'melchizedek', text: '너희 대적을 네 손에 붙이신 지극히 높으신 하나님을 찬송할지로다!' } },
    { caption: '아브람은 감사의 뜻으로 얻은 전리품의 십분의 일을 멜기세덱에게 드렸다.', hold: 4.5, voice: { chapter: '08_melchizedek_blessing', role: 'narrator', text: '아브람은 그가 얻은 모든 것에서 십분의 일을 멜기세덱에게 주었다.' } },
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
    { caption: '소돔 왕: "사람은 내게 돌려보내고, 전리품은 네가 모두 가지라!"', hold: 4.2, voice: { chapter: '08_melchizedek_blessing', role: 'narrator', text: '소돔 왕이 아브람에게 말했다: 사람은 내게 보내고 물품은 네가 가지라.' } },
    { caption: '아브람: "내가 네 실 한오라기나 들메끈 한 가닥도 가지지 아니하리라! 네가 나로 부자가 되었다 할까 하노라."', hold: 5.2, voice: { chapter: '08_melchizedek_blessing', role: 'abram', text: '네게 속한 것은 실 한 오라기나 들메끈 한 가닥도 내가 가지지 아니하리라.' } },
    { caption: '"아브람아 두려워하지 말라. 나는 네 방패요, 너의 지극히 큰 상급이니라!"', style: 'voice', speaker: '여호와', hold: 5.0, voice: { chapter: '01_covenant_of_stars', role: 'narrator', text: '나는 네 방패요 너의 지극히 큰 상급이다.' } },
    { caption: '전쟁에서 이기고 재물을 마다한 의로운 사람에게도, 밤하늘 아래 채워지지 않는 깊은 갈망이 있었다.', hold: 5.0, voice: { chapter: '09_shield_and_reward', role: 'narrator', text: '전쟁에서 이기고 재물을 마다한 사람에게도, 채워지지 않는 것은 그대로 남아 있었다.' } },
    { do: () => {
      c.hud.cinematicTitle = null;
      c.hud.toast('book2-complete', null, '제2권 <약속의 땅> 완료! 제3권 <별과 언약>으로 나아갈 수 있습니다.');
    } },
  ];
}
