import type { Interactions } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';
import type { Cutscene } from '../cutscene/cutscene';
import type { SceneContext } from '../scenes/book1/book1Scenes';
import {
  createShechemAltarSteps,
  createEgyptBorderSteps,
  createPharaohPalaceSteps,
  createLotPartingSteps,
  createSiddimWarSteps,
  createHobahRescueSteps,
  createMelchizedekSteps,
  createShieldRewardSteps,
} from '../scenes/book2/book2Scenes';

export interface Book2ActionContext {
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  particles: ParticleManager;
  cutscene: Cutscene;
  sceneCtx: SceneContext;
  stageId: string;
  onBook2Complete: () => void;
}

export function setupBook2Actions(ctx: Book2ActionContext): void {
  const { interactions, hud, audio, particles, cutscene, sceneCtx, stageId, onBook2Complete } = ctx;
  interactions.clear();

  // ── 1. 세겜 & 벧엘 상수리나무 언덕 ──
  if (stageId === 'shechem_bethel') {
    let prayedAtAltar = false;
    let visitedBethelCliff = false;

    const updateGoal = () => {
      hud.goalCategory = '제2권 · 약속의 땅';
      if (!prayedAtAltar) {
        hud.goal = '세겜 상수리나무 첫 제단에 감사 기도 드리기 (0/1)';
        hud.goalProgress = { current: 0, total: 2, label: '0/2' };
        hud.hint = '돌 제단 앞으로 다가가 E키를 누르자';
      } else if (!visitedBethelCliff) {
        hud.goal = '벧엘 언덕 정상에서 동서남북 조망하기 (0/1)';
        hud.goalProgress = { current: 1, total: 2, label: '1/2' };
        hud.hint = '북동쪽 높은 바위 절벽 정상으로 올라가자';
      } else {
        hud.goal = '약속의 땅 여정 완수\n▪ 다음 챕터로 나아갈 준비 완료 (2/2)';
        hud.goalProgress = { current: 2, total: 2, label: '2/2' };
        hud.hint = '조카 롯과 대화를 나누거나 장막을 둘러보자';
      }
    };

    updateGoal();

    // 첫 제단 기도 인터랙션
    interactions.add({
      id: 'altar_shechem',
      pos: () => ({ x: -2, z: -2 }),
      height: 1.2,
      r: 2.5,
      label: () => (prayedAtAltar ? '제단 번제 불꽃 묵상하기' : '돌 제단에서 감사 기도 드리기'),
      act: () => {
        prayedAtAltar = true;
        audio.playSfx('ui_confirm');
        hud.unlockCodex('shechem_altar');
        hud.toast('altar-pray', null, '하나님께 첫 제단을 쌓고 감사의 번제를 올렸습니다.');
        particles.emit('glory_sparkles', -2, 1.2, -2, 25);
        updateGoal();
      },
    });

    // 벧엘 언덕 정상 전망대
    interactions.add({
      id: 'bethel_vista',
      pos: () => ({ x: 10, z: -10 }),
      height: 1.8,
      r: 3.0,
      label: () => '벧엘 언덕 꼭대기에서 조망하기',
      act: () => {
        visitedBethelCliff = true;
        cutscene.play(createLotPartingSteps(sceneCtx));
        updateGoal();
      },
    });

    // 조카 롯과의 대화
    interactions.add({
      id: 'npc_lot',
      pos: () => ({ x: 2, z: 2 }),
      height: 1.2,
      r: 2.2,
      label: () => '조카 롯과 대화하기',
      act: () => {
        audio.playVoiceBlip('lot');
        hud.choice = {
          prompt: '조카 롯과의 대화 (갈등의 중재)',
          options: [
            { text: '우리는 한 친족이니 다투지 말자. 네가 원하는 땅을 먼저 택하거라.' },
            { text: '하나님이 우리에게 주실 땅은 넉넉하니 넓은 가나안 들판을 둘러보자.' },
          ],
          selectedIndex: 0,
          onSelect: (idx: number) => {
            hud.choice = null;
            if (idx === 0) {
              hud.toast('lot-peace', null, '롯에게 먼저 선택권을 양보했습니다. 롯은 기름진 소돔을 택했습니다.');
            } else {
              hud.toast('lot-canaan', null, '롯과 함께 언덕 위를 둘러보며 평화를 약속했습니다.');
            }
          },
        };
      },
    });
  }

  // ── 2. 애굽 국경 세관 및 바로 궁정 ──
  if (stageId === 'egypt') {
    // 세관 보석 상자 인터랙션
    interactions.add({
      id: 'border_chest',
      pos: () => ({ x: 1.5, z: -2 }),
      height: 1.0,
      r: 2.2,
      label: () => '세관 보석 상자 조사하기',
      act: () => {
        audio.playSfx('wood_creak');
        hud.unlockCodex('sarai_chest');
        hud.choice = {
          prompt: '애굽 세관 관헌과의 심문',
          options: [
            { text: '정직하게 뚜껑을 열어보시오. 숨긴 재물은 없소.' },
            { text: '세금을 넉넉히 낼 터이니 상자를 열지 않고 통과하게 해주시오.' },
          ],
          selectedIndex: 0,
          onSelect: (idx: number) => {
            hud.choice = null;
            if (idx === 0) {
              particles.emit('glory_sparkles', 1.5, 1.0, -2, 30);
              hud.toast('chest-reveal', null, '상자가 열리자 사래의 찬란한 빛과 아름다움이 온 국경을 비추었습니다!');
              cutscene.play(createPharaohPalaceSteps(sceneCtx));
            } else {
              audio.playVoiceBlip('narrator');
              hud.toast('chest-tax', null, '관리들이 더욱 의심하여 결국 상자를 열어보았습니다.');
              cutscene.play(createPharaohPalaceSteps(sceneCtx));
            }
          },
        };
      },
    });
  }

  // ── 3. 싯딤 골짜기 전장 및 호바 야간 기습 ──
  if (stageId === 'siddim_hobah') {
    let litTorches = 0;
    let rescuedLot = false;

    const updateWarGoal = () => {
      hud.goalCategory = '제2권 · 롯 구출 작전';
      if (litTorches < 2) {
        hud.goal = `적진 야영지 횃불 밝히기 (${litTorches}/2)`;
        hud.goalProgress = { current: litTorches, total: 3, label: `${litTorches}/3` };
        hud.hint = '어두운 적진 곳곳의 횃불을 밝혀 군사들을 지휘하자';
      } else if (!rescuedLot) {
        hud.goal = '사로잡힌 조카 롯 구출하기 (0/1)';
        hud.goalProgress = { current: 2, total: 3, label: '2/3' };
        hud.hint = '북쪽 적진 야영지 텐트 앞 롯을 만나자';
      } else {
        hud.goal = '살렘 왕 멜기세덱의 축복 받기 (1/1)';
        hud.goalProgress = { current: 3, total: 3, label: '3/3' };
        hud.hint = '남쪽 석조 단상 위의 멜기세덱에게 다가가자';
      }
    };

    updateWarGoal();

    // 횃불 인터랙션 1
    interactions.add({
      id: 'torch_1',
      pos: () => ({ x: -5, z: 0 }),
      height: 1.5,
      r: 2.0,
      label: () => '횃불 피워올리기',
      act: () => {
        litTorches++;
        audio.playSfx('torch_fire');
        particles.emit('fire_ember', -5, 1.8, 0, 20);
        updateWarGoal();
      },
    });

    // 횃불 인터랙션 2
    interactions.add({
      id: 'torch_2',
      pos: () => ({ x: 5, z: 0 }),
      height: 1.5,
      r: 2.0,
      label: () => '횃불 피워올리기',
      act: () => {
        litTorches++;
        audio.playSfx('torch_fire');
        particles.emit('fire_ember', 5, 1.8, 0, 20);
        updateWarGoal();
      },
    });

    // 롯 구출
    interactions.add({
      id: 'rescue_lot',
      pos: () => ({ x: 0, z: -9 }),
      height: 1.2,
      r: 2.8,
      label: () => '조카 롯 구출하기',
      act: () => {
        rescuedLot = true;
        audio.playVoiceBlip('lot');
        hud.unlockCodex('hobah_night_raid');
        hud.toast('lot-rescued', null, '조카 롯과 포로들을 무사히 구출했습니다!');
        particles.emit('glory_sparkles', 0, 1.2, -9, 30);
        updateWarGoal();
      },
    });

    // 멜기세덱의 떡과 포도주 축복 단상
    interactions.add({
      id: 'melchizedek_altar',
      pos: () => ({ x: 0, z: 6 }),
      height: 1.2,
      r: 2.5,
      label: () => '멜기세덱의 떡과 포도주 축복 받기',
      act: () => {
        audio.playVoiceBlip('melchizedek');
        cutscene.play(createMelchizedekSteps(sceneCtx), () => {
          cutscene.play(createShieldRewardSteps(sceneCtx), () => {
            onBook2Complete();
          });
        });
      },
    });
  }
}
