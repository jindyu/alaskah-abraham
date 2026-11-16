import * as THREE from 'three';
import type { Step } from '../../cutscene/cutscene';
import type { SceneContext } from '../book1/book1Scenes';

/** 1. 이삭의 출생과 큰 잔치 */
export function createIsaacBirthFeastSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('isaac_birth');
      c.hud.cinematicTitle = '제5권 · 모리아\n이삭의 출생과 큰 잔치';
      c.renderer.setTilt(24);
      c.setCameraFocus(6, 1.2, -5);
      c.player.root.position.set(4, 0, -3);
      c.audio.playBgm('bgm_feast_celebration');
    } },
    { wait: 1.0 },
    { caption: '여호와께서 말씀하신 대로 사라를 돌보셨고, 아브라함이 백 세에 아들 이삭을 낳았다.', hold: 4.8, voice: { chapter: '01_birth_of_isaac', role: 'narrator', text: '여호와께서 말씀하신 대로 사라를 돌보셨으니, 노년의 아브라함에게 아들을 낳았다.' } },
    { caption: '아브라함: "…그의 이름을 하나님이 명하신 대로 이삭이라 부르리라."', style: 'voice', speaker: '아브라함', hold: 4.8, voice: { chapter: '01_birth_of_isaac', role: 'abraham', text: '…그의 이름을 이삭이라 하리라.' } },
    { caption: '사라: "하나님이 나로 크게 웃게 하시니, 듣는 자가 다 나와 함께 웃으리로다!"', style: 'voice', speaker: '사라', hold: 5.0, voice: { chapter: '01_birth_of_isaac', role: 'sarah', text: '하나님이 나를 웃게 하시니, 듣는 자가 다 나와 함께 웃으리로다.' } },
    { caption: '아이가 자라 젖을 떼는 날, 아브라함은 온 이웃을 불러 큰 잔치를 베풀었다.', hold: 4.5, voice: { chapter: '01_birth_of_isaac', role: 'narrator', text: '아이가 자라매 젖을 떼고 이삭이 젖을 떼는 날에 아브라함이 큰 잔치를 베풀었더라' } },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.hud.goalCategory = '제5권 · 브엘세바';
      c.hud.goal = '브엘세바 언약 세우기\n▪ 맹세의 우물 둘러보기 (0/1)\n▪ 아비멜렉과 화친하고 에셀나무 심기 (0/1)';
      c.hud.goalProgress = { current: 0, total: 2, label: '0/2' };
      c.hud.hint = '중앙 돌 우물과 서북쪽 에셀나무 터로 가보자';
    } },
  ];
}

/** 2. 브엘세바 우물과 에셀나무 */
export function createBeershebaCovenantSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('beersheba_covenant');
      c.hud.cinematicTitle = '브엘세바 우물\n일곱 암양의 언약과 에셀나무';
      c.renderer.setTilt(26);
      c.setCameraFocus(0, 1.2, 0);
      c.audio.playBgm('bgm_peaceful');
    } },
    { wait: 0.8 },
    { caption: '아비멜렉 왕이 찾아와 화친을 청하자, 아브라함은 암양 새끼 일곱을 따로 떼어 우물의 증거로 삼았다.', hold: 5.2, voice: { chapter: '04_well_of_beersheba', role: 'narrator', text: '아브라함이 일곱 암양 새끼를 따로 놓으니' } },
    { caption: '아브라함: "내가 맹세하노니, 이 암양 새끼 일곱을 받아 내가 이 우물 판 증거를 삼으라."', style: 'voice', speaker: '아브라함', hold: 5.0, voice: { chapter: '04_well_of_beersheba', role: 'abraham', text: '너는 내 손에서 이 암양 새끼 일곱을 받아 내가 이 우물 판 증거를 삼으라' } },
    { caption: '두 사람이 거기서 맹세하였으므로 그곳을 "브엘세바(일곱의 우물 / 맹세의 우물)"라 불렀다.', hold: 4.8, voice: { chapter: '04_well_of_beersheba', role: 'narrator', text: '두 사람이 거기서 서로 맹세하였으므로 그 곳을 브엘세바라 이름하였더라' } },
    { caption: '아브라함은 브엘세바에 에셀나무를 심고, 거기서 영원하신 여호와의 이름을 불렀다.', hold: 4.5, voice: { chapter: '04_well_of_beersheba', role: 'narrator', text: '아브라함은 브엘세바에 에셀 나무를 심고 거기서 영원하신 여호와의 이름을 불렀으며' } },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 3. 모리아 산 사흘 길의 침묵 */
export function createRoadToMoriahSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('moriah_journey');
      c.hud.cinematicTitle = '모리아 산 사흘 길\n침묵과 절대 순종';
      c.renderer.setTilt(28);
      c.setCameraFocus(-3, 1.2, 8);
      c.player.root.position.set(0, 0, 8);
      c.audio.playBgm('bgm_sacred_trial');
    } },
    { wait: 1.0 },
    { caption: '"네 아들 네 사랑하는 독자 이삭을 데리고 모리아 땅으로 가서 그를 번제로 드리라!"', style: 'voice', speaker: '여호와', hold: 5.2, voice: { chapter: '06_road_to_moriah', role: 'narrator', text: '네 아들 네 사랑하는 독자 이삭을 데리고 모리아 땅으로 가서 내가 네게 일러 준 한 산 거기서 그를 번제로 드리라' } },
    { caption: '아브라함은 아침 일찍 일어나 나귀에 안장을 얹고, 번제에 쓸 나무를 쪼개어 사흘 길을 걸어갔다.', hold: 5.0, voice: { chapter: '06_road_to_moriah', role: 'narrator', text: '아브라함이 아침 일찍이 일어나 나귀에 안장을 지우고, 이삭과 두 종을 데리고 번제에 쓸 나무를 쪼개어 모리아로 향하였다.' } },
    { caption: '제삼일에 아브라함이 눈을 들어 그곳을 멀리 바라보았다.', hold: 4.8, voice: { chapter: '06_road_to_moriah', role: 'narrator', text: '제삼일에 아브라함이 눈을 들어 그곳을 멀리 바라보았다.' } },
    { caption: '아브라함: "너희는 나귀와 함께 여기서 기다리라. 나와 아이는 저기 가서 예배하고 너희에게로 돌아오리라."', style: 'voice', speaker: '아브라함', hold: 5.5, voice: { chapter: '06_road_to_moriah', role: 'abraham', text: '…너희는 나귀와 함께 여기서 기다리라. 나와 아이는 저기 가서 경배하고 우리가 너희에게로 돌아오리라.' } },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.hud.goalCategory = '제5권 · 모리아 산';
      c.hud.goal = '모리아 산 정상 오르기\n▪ 번제단 바위로 나아가기 (0/1)';
      c.hud.goalProgress = { current: 0, total: 1, label: '0/1' };
      c.hud.hint = '북쪽 바위 계단을 따라 산 정상으로 올라가자';
    } },
  ];
}

/** 4. 모리아 산 정상 이삭의 결박 (아케다) */
export function createMountMoriahAkedahSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('akedah_sacrifice');
      c.hud.cinematicTitle = '모리아 산의 번제단\n이삭의 결박 (아케다)';
      c.renderer.setTilt(22);
      c.setCameraFocus(0, 4.2, -7);
      c.player.root.position.set(0, 3.8, -5);
      c.player.face(Math.PI);
      c.audio.playBgm('bgm_sacred_trial');
    } },
    { wait: 1.0 },
    { caption: '이삭: "내 아버지여, 불과 나무는 있거니와 번제할 어린 양은 어디 있나이까?"', hold: 4.8, voice: { chapter: '07_mount_moriah', role: 'isaac', text: '내 아버지여 불과 나무는 있거니와 번제할 어린 양은 어디 있나이까' } },
    { caption: '아브라함: "내 아들아, 번제할 어린 양은 하나님이 자기를 위하여 친히 준비하시리라."', hold: 5.2, voice: { chapter: '07_mount_moriah', role: 'abraham', text: '내 아들아 번제할 어린 양은 하나님이 자기를 위하여 친히 준비하시리라' } },
    { caption: '이삭: "…아버지, 제 손발을 단단히 묶어 주소서. 두려움에 몸부림쳐 흠 있는 제물이 되지 않도록."', style: 'voice', speaker: '이삭', hold: 5.5, voice: { chapter: '07_mount_moriah', role: 'isaac', text: '…아버지, 제 손발을 단단히 묶어 주소서. 두려움에 몸부림쳐 흠 있는 제물이 되지 않도록.' } },
    { caption: '제단을 쌓고 나무를 벌여놓은 후, 아들 이삭을 결박하여 나무 위에 얹고 손을 내밀어 칼을 잡았다!', hold: 5.2, voice: { chapter: '07_mount_moriah', role: 'narrator', text: '아브라함이 손을 내밀어 칼을 잡고 그 아들을 잡으려 하니…' } },
    { do: () => {
      if (c.beam) {
        c.beam.at(0, -7);
        c.beam.strength = 2.0;
      }
    } },
    { caption: '"아브라함아, 아브라함아! 그 아이에게 네 손을 대지 말라! 이제야 네가 하나님을 경외하는 줄을 아노라!"', style: 'voice', speaker: '천사', hold: 6.0, voice: { chapter: '07_mount_moriah', role: 'narrator', text: '사자가 이르시되 그 아이에게 네 손을 대지 말라 그에게 아무 일도 하지 말라 네가 네 아들 네 독자까지도 내게 아끼지 아니하였으니 내가 이제야 네가 하나님을 경외하는 줄을 아노라' } },
    { do: () => {
      c.hud.cinematicTitle = null;
    } },
  ];
}

/** 5. 수풀의 숫양과 여호와 이레 */
export function createJehovahJirehSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.cinematicTitle = '여호와 이레\n수풀에 뿔이 걸린 숫양';
      c.renderer.setTilt(24);
      c.setCameraFocus(3.2, 4.0, -7.5);
      c.audio.playBgm('bgm_hope_legacy');
    } },
    { wait: 1.0 },
    { caption: '아브라함이 눈을 들어 살펴본즉, 한 숫양이 뒤에 있는데 뿔이 수풀에 걸려 있었다.', hold: 5.0, voice: { chapter: '08_the_road_back', role: 'narrator', text: '아브라함이 눈을 들어 살펴본즉 한 숫양이 뒤에 있는데 뿔이 수풀에 걸려 있는지라' } },
    { caption: '아들을 대신하여 그 숫양을 가져다가 번제로 드리니, 그 땅 이름을 "여호와 이레"라 불렀다.', hold: 5.2, voice: { chapter: '08_the_road_back', role: 'narrator', text: '아브라함이 가서 그 숫양을 가져다가 아들을 대신하여 번제로 드렸더라' } },
    { caption: '아브라함: "여호와의 산에서 모든 것이 친히 준비되었도다!"', style: 'voice', speaker: '아브라함', hold: 4.8, voice: { chapter: '08_the_road_back', role: 'abraham', text: '아브라함이 그 땅 이름을 여호와 이레라 하였으므로 오늘날까지 사람들이 이르기를 여호와의 산에서 준비되리라 하더라' } },
    { caption: '"네가 네 아들 네 독자도 아끼지 아니하였은즉, 내가 네게 큰 복을 주고 네 씨가 크게 번성하여 대적의 성문을 차지하리라!"', style: 'voice', speaker: '여호와', hold: 6.2, voice: { chapter: '08_the_road_back', role: 'narrator', text: '내가 네게 큰 복을 주고 네 씨가 크게 번성하여 하늘의 별과 같고 바닷가의 모래와 같게 하리니' } },
    { do: () => {
      if (c.beam) c.beam.strength = 0;
      c.hud.cinematicTitle = null;
      c.hud.toast('book5-complete', null, '제5권 <모리아> 완료! 최종장 제6권 <막벨라>로 나아갈 수 있습니다.');
    } },
  ];
}
