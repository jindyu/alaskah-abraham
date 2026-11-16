import type { GetPick, SetPick } from './pickTypes';
import { addBeatLoop } from './beatLoop';
import type { Interactions } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';
import type { Cutscene } from '../cutscene/cutscene';
import type { SceneContext } from '../scenes/book1/book1Scenes';
import { playChapterStaging } from '../scenes/staging/chapterStaging';
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
  /** 현재 장 번호(0부터). 같은 무대를 쓰는 장을 가르는 데 쓴다 */
  chapterIndex?: number;
  /** 앞서 한 선택(갈래) 읽기/기록 (저장됨) */
  getPick?: GetPick;
  setPick?: SetPick;
  onBook2Complete: () => void;
}

// Module-level position buffers (zero per-frame allocations)
const POS_SHECHEM_ALTAR = { x: -2, z: -2 };
const POS_STONE_1 = { x: -3, z: -7 };
const POS_STONE_2 = { x: 4, z: -4 };
const POS_STONE_3 = { x: -7, z: 6 };
const POS_BETHEL_VISTA = { x: 10, z: -10 };
const POS_NPC_LOT = { x: 2, z: 2 };

const POS_EGYPT_CUSTOMS = { x: 0, z: -2 };
const POS_EGYPT_CHEST = { x: 1.5, z: -2 };
const POS_EGYPT_PALACE = { x: 10, z: -6 };

const POS_TORCH_1 = { x: -5, z: 0 };
const POS_TORCH_2 = { x: 5, z: 0 };
const POS_RESCUE_LOT = { x: 0, z: -9 };
const POS_MELCHIZEDEK = { x: 0, z: 6 };

function setupBook2ActionsCore(ctx: Book2ActionContext): void {
  const { interactions, hud, audio, particles, cutscene, sceneCtx, stageId, onBook2Complete } = ctx;
  interactions.clear();

  // 직접 쓴 상호작용이 없던 장: 단계형 짧은 루프 (5장)
  if (ctx.chapterIndex === 4 && stageId === "ur_palace") {
    addBeatLoop({
      interactions, hud, audio, goalTitle: "시날 연합군의 출정을 지켜보자",
      beats: [
      { id: "war_council", x: 0, z: 2, label: "전략 회의 탁자 살피기", toast: "니므롯의 장수들이 지도를 펴 놓고 서쪽 왕들을 칠 길을 짚는다.", goalItem: "장수들의 전략 회의 살피기" },
      { id: "war_banner", x: -4, z: -1, label: "출정 깃발 바라보기", toast: "전해 오는 이야기에 따르면, 시날 연합군은 아브람을 얕잡아 보며 “그 사람 하나쯤이야” 하고 비웃었다고 한다.", goalItem: "출정 깃발 바라보기" },
      { id: "war_boast", x: -2, z: 5, label: "궁정에 남은 담대한 선포의 메아리 듣기", toast: "아브람이 왕 앞에서 담대히 선포하던 소리가 궁정 벽에 아직 맴돈다. 대신들은 이제 시날의 군대가 그 ‘한 사람’을 어떻게 칠지 입을 모은다.", goalItem: "궁정에 남은 담대한 선포 듣기", when: (pick) => pick("palace_answer") === "담대히 선포" },
      { id: "war_hush", x: -2, z: 5, label: "침묵 속에 남은 궁정의 불안 살피기", toast: "아브람이 말없이 왕을 마주하던 날의 침묵이 궁정에 아직 무겁다. 대신들은 그 침묵이 무슨 뜻이었는지 서로 묻는다.", goalItem: "궁정에 남은 침묵의 불안 살피기", when: (pick) => pick("palace_answer") === "침묵으로 맞섬" },
      { id: "war_envoy", x: 3, z: 2, label: "서쪽으로 가는 전령 지켜보기", toast: "전령이 말을 달려 서쪽 왕들에게 연합의 소식을 전한다. 그 길 끝에 롯이 사는 소돔이 있다.", goalItem: "서쪽으로 가는 전령 지켜보기", choice: { prompt: "전령을 바라보며 아브람은 마음속으로 무엇을 정할까?", options: [{ text: "롯에게 경고를 전하러 사람을 보내야겠다", reply: "아브람은 마음속으로 롯의 얼굴을 떠올리며 사람을 보낼 방도를 헤아렸다.", ok: true, tag: "롯을 염려함" }, { text: "전쟁도 하나님께 맡기고 기다린다", reply: "아브람은 손을 모으고 이 모든 일을 하나님께 맡겼다.", ok: true, tag: "하나님께 맡김" }] } },
      { id: "war_gate", x: 4, z: -1, label: "궁정 문으로 나서는 군대 지켜보기", toast: "북소리와 함께 군대가 문을 나선다. 서쪽에서 불어올 전쟁의 바람이 이 궁정까지 닿는다.", goalItem: "문을 나서는 군대 지켜보기" },
      ],
      finishLabel: "궁정을 나와 다음 이야기로 가기", finishX: 0, finishZ: -5,
      onComplete: ctx.onBook2Complete,
      getPick: ctx.getPick, setPick: ctx.setPick,
    });
    return;
  }

  // 직접 쓴 상호작용이 없던 장: 단계형 짧은 루프 (9장)
  if (ctx.chapterIndex === 8 && stageId === "mamre") {
    addBeatLoop({
      interactions, hud, audio, goalTitle: "언약의 방패이신 하나님의 위로를 듣자",
      beats: [
      { id: "shield_vision", x: 0, z: -3, label: "환상 중에 임하는 말씀을 기다리기", toast: "성경: “이 일 후에 여호와의 말씀이 환상 중에 아브람에게 임하여 이르시되…”", goalItem: "환상 중에 임하는 말씀 기다리기", voice: "abraham" },
      { id: "shield_fear", x: -6, z: 2, label: "두려움으로 뒤척이는 장막 앞에 서기", toast: (pick) => { const t = pick("war_envoy"); if (t === "롯을 염려함") return "롯을 위해 마음 졸이던 아브람은 전쟁에서 돌아온 뒤에도 보복이 두려워 쉬이 잠들지 못한다."; if (t === "하나님께 맡김") return "모든 일을 하나님께 맡겼다고 되뇌면서도 아브람은 전쟁에서 돌아온 뒤에도 보복이 두려워 쉬이 잠들지 못한다."; return "아브람은 전쟁에서 돌아온 뒤에도 보복이 두려워 쉬이 잠들지 못한다."; }, goalItem: "두려움을 안은 장막 앞에 서기", voice: "abraham" },
      { id: "shield_word", x: 3, z: -2, label: "“두려워 말라” 하시는 음성에 귀 기울이기", toast: "여호와의 말씀: “아브람아, 두려워하지 말라. 나는 네 방패요 너의 지극히 큰 상급이니라.”", goalItem: "“두려워 말라”는 음성 듣기", voice: "abraham" },
      { id: "shield_lot", x: -3, z: -4, label: "롯을 위한 기도를 올리기", toast: "아브람은 소돔에 있는 롯과 그 가족을 위해 오래도록 기도했다. 경고를 전하려던 마음이 기도로 이어졌다.", goalItem: "롯을 위해 기도하기", voice: "abraham", when: (pick) => pick("war_envoy") === "롯을 염려함" },
      { id: "shield_trust", x: -3, z: -4, label: "맡긴 마음으로 하늘을 올려다보기", toast: "아브람은 모든 것을 하나님께 맡기겠다던 다짐을 되새기며 별이 돋는 하늘을 올려다보았다.", goalItem: "맡긴 마음으로 하늘 올려다보기", voice: "abraham", when: (pick) => pick("war_envoy") === "하나님께 맡김" },
      { id: "shield_heir", x: 8, z: -6, label: "상속자를 걱정하는 마음 털어놓기", toast: "아브람: “주여, 나는 자식이 없으니 다메섹 엘리에셀이 내 상속자가 되겠나이다.”", goalItem: "상속자에 대한 걱정 아뢰기", voice: "abraham", choice: { prompt: "상속자 걱정을 어떻게 아뢸까?", options: [{ text: "“저는 두려움에 아무 말도 못 하겠습니다.”", reply: "아브람은 입을 다물었으나 하나님은 마음속 걱정을 아신다. 다시 아뢰어 보자.", ok: false }, { text: "“주여, 나는 자식이 없으니 다메섹 엘리에셀이 내 상속자가 되겠나이다.”", reply: "여호와께서 대답하셨다. “그가 네 상속자가 아니요 네 몸에서 날 자가 네 상속자가 되리라.”", ok: true }] } },
      ],
      finishLabel: "장막으로 돌아가 다음 이야기로 가기", finishX: 0, finishZ: 0,
      onComplete: ctx.onBook2Complete,
      getPick: ctx.getPick, setPick: ctx.setPick,
    });
    return;
  }


  // ── 1. 세겜 & 벧엘 상수리나무 언덕 ──
  if (stageId === 'shechem_bethel') {
    let collectedStones = 0;
    let gatheredStone1 = false;
    let gatheredStone2 = false;
    let gatheredStone3 = false;
    let altarBuilt = false;
    let prayedAtAltar = false;
    let visitedBethelCliff = false;

    const updateShechemGoal = () => {
      hud.goalCategory = '제2권 · 약속의 땅';
      if (collectedStones < 3) {
        hud.goal = `세겜 들판에서 제단 돌 3개 수집하기 (${collectedStones}/3)`;
        hud.goalProgress = { current: collectedStones, total: 5, label: `${collectedStones}/5` };
        hud.hint = '주변 바위터에서 제단에 쌓을 거친 돌을 주우러 가자';
      } else if (!altarBuilt) {
        hud.goal = '모은 돌로 상수리나무 아래 첫 제단 쌓기 (0/1)';
        hud.goalProgress = { current: 3, total: 5, label: '3/5' };
        hud.hint = '상수리나무 앞 제단 터로 다가가 돌을 쌓자';
      } else if (!prayedAtAltar) {
        hud.goal = '세겜 상수리나무 첫 제단에 감사 기도 드리기 (0/1)';
        hud.goalProgress = { current: 3, total: 5, label: '3/5' };
        hud.hint = '돌 제단 앞으로 다가가 E키를 누르자';
      } else if (!visitedBethelCliff) {
        hud.goal = '벧엘 언덕 정상에서 동서남북 조망하기 (0/1)';
        hud.goalProgress = { current: 4, total: 5, label: '4/5' };
        hud.hint = '북동쪽 높은 바위 절벽 정상으로 올라가자';
      } else {
        hud.goal = '약속의 땅 여정 완수\n▪ 다음 챕터로 나아갈 준비 완료 (5/5)';
        hud.goalProgress = { current: 5, total: 5, label: '5/5' };
        hud.hint = '조카 롯과 대화를 나누어 땅을 나누고 평화를 맺자';
      }
    };

    updateShechemGoal();

    // 돌 1 수집
    interactions.add({
      id: 'stone_pickup_1',
      pos: () => POS_STONE_1,
      height: 1.0,
      r: 2.2,
      label: () => (gatheredStone1 ? null : '제단용 돌 줍기 (1)'),
      act: () => {
        if (gatheredStone1) return;
        gatheredStone1 = true;
        collectedStones++;
        audio.playSfx('stone_altar_stack');
        particles.emit('impact_dust', -3, 0.5, -7, 15);
        hud.toast('stone-1', null, `거친 바위돌을 주웠습니다 (${collectedStones}/3)`);
        // 1권 하란을 떠나던 때의 선택이 이 땅의 첫 돌 앞에서 이어진다
        const leave = ctx.getPick ? ctx.getPick('haran_depart') : undefined;
        if (leave === '아버지를 기리며') hud.toast('stone-1-memory', null, '아버지의 무덤에 올렸던 흙 한 줌이 손끝에 떠올랐다. 이 땅에서도 첫 제단을 쌓으리라.');
        else if (leave === '새벽에 서둘러') hud.toast('stone-1-memory', null, '새벽길을 서둘러 떠나온 그날의 숨결이 아직 남아 있다. 이 땅에서 첫 제단을 쌓으리라.');
        updateShechemGoal();
      },
    });

    // 돌 2 수집
    interactions.add({
      id: 'stone_pickup_2',
      pos: () => POS_STONE_2,
      height: 1.0,
      r: 2.2,
      label: () => (gatheredStone2 ? null : '제단용 돌 줍기 (2)'),
      act: () => {
        if (gatheredStone2) return;
        gatheredStone2 = true;
        collectedStones++;
        audio.playSfx('stone_altar_stack');
        particles.emit('impact_dust', 4, 0.5, -4, 15);
        hud.toast('stone-2', null, `단단한 석회석을 주웠습니다 (${collectedStones}/3)`);
        updateShechemGoal();
      },
    });

    // 돌 3 수집
    interactions.add({
      id: 'stone_pickup_3',
      pos: () => POS_STONE_3,
      height: 1.0,
      r: 2.2,
      label: () => (gatheredStone3 ? null : '제단용 돌 줍기 (3)'),
      act: () => {
        if (gatheredStone3) return;
        gatheredStone3 = true;
        collectedStones++;
        audio.playSfx('stone_altar_stack');
        particles.emit('impact_dust', -7, 0.5, 6, 15);
        hud.toast('stone-3', null, `평평한 제단용 판석을 주웠습니다 (${collectedStones}/3)`);
        updateShechemGoal();
      },
    });

    // 제단 쌓기 및 감사 기도
    interactions.add({
      id: 'altar_shechem',
      pos: () => POS_SHECHEM_ALTAR,
      height: 1.2,
      r: 2.5,
      label: () => {
        if (!altarBuilt) return collectedStones >= 3 ? '모은 돌 3개로 제단 쌓기' : '제단 터 살펴보기 (돌 3개 필요)';
        return prayedAtAltar ? '제단 번제 불꽃 묵상하기' : '돌 제단에서 감사 기도 드리기';
      },
      act: () => {
        if (!altarBuilt) {
          if (collectedStones < 3) {
            hud.toast('need-stones', null, `제단을 쌓으려면 돌이 더 필요합니다 (${collectedStones}/3)`);
            return;
          }
          altarBuilt = true;
          audio.playSfx('stone_altar_stack');
          particles.emit('glory_sparkles', -2, 1.2, -2, 25);
          hud.toast('altar-built', null, '주워 모은 세 개의 돌로 거룩한 첫 제단을 정성껏 쌓았습니다.');
          updateShechemGoal();
          return;
        }

        prayedAtAltar = true;
        audio.playSfx('ui_confirm');
        hud.unlockCodex('shechem_altar');
        hud.toast('altar-pray', null, '하나님께 첫 제단을 쌓고 감사의 번제를 올렸습니다.');
        particles.emit('glory_sparkles', -2, 1.2, -2, 25);
        updateShechemGoal();
      },
    });

    // 벧엘 언덕 정상 전망대
    interactions.add({
      id: 'bethel_vista',
      pos: () => POS_BETHEL_VISTA,
      height: 1.8,
      r: 3.0,
      label: () => '벧엘 언덕 꼭대기에서 조망하기',
      act: () => {
        visitedBethelCliff = true;
        cutscene.play(createLotPartingSteps(sceneCtx));
        updateShechemGoal();
      },
    });

    // 조카 롯과의 대화
    interactions.add({
      id: 'npc_lot',
      pos: () => POS_NPC_LOT,
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
            // 제단 쌓기, 기도, 벧엘 조망을 마친 뒤 롯과 화해하면 챕터 완료
            if (altarBuilt && prayedAtAltar && visitedBethelCliff) {
              onBook2Complete();
            }
          },
        };
      },
    });
  }

  // ── 2. 애굽 국경 세관 및 바로 궁정 ──
  if (stageId === 'egypt') {
    let customsInspected = false;
    let chestInspected = false;

    const updateEgyptGoal = () => {
      hud.goalCategory = '제2권 · 애굽 국경';
      if (!customsInspected) {
        hud.goal = '애굽 국경 세관 관리와 입국 심문 나누기 (0/1)';
        hud.goalProgress = { current: 0, total: 3, label: '0/3' };
        hud.hint = '세관 초소 탁자 앞 관리에게 다가가자';
      } else if (!chestInspected) {
        hud.goal = '세관 보석 상자 조사 및 결단하기 (0/1)';
        hud.goalProgress = { current: 1, total: 3, label: '1/3' };
        hud.hint = '탁자 옆 보석 상자를 조사하자';
      } else {
        hud.goal = '바로의 궁정 옥좌 단상으로 나아가기 (0/1)';
        hud.goalProgress = { current: 2, total: 3, label: '2/3' };
        hud.hint = '동북쪽 황금 옥좌 단상으로 나아가자';
      }
    };

    updateEgyptGoal();

    // 1단계: 세관 관리 심문
    interactions.add({
      id: 'border_customs_desk',
      pos: () => POS_EGYPT_CUSTOMS,
      height: 1.1,
      r: 2.2,
      label: () => (customsInspected ? '세관 관리의 통과 지시 듣기' : '애굽 세관 관리와 입국 심문 나누기'),
      act: () => {
        customsInspected = true;
        audio.playSfx('ui_confirm');
        hud.choice = {
          prompt: '애굽 국경 세관원의 입국 심문',
          options: [
            { text: '가나안 땅에 기근이 심하여 잠시 우거하러 왔소.' },
            { text: '우리는 평화로운 유목민이며 통행세를 낼 준비가 되었소.' },
          ],
          selectedIndex: 0,
          onSelect: () => {
            hud.choice = null;
            hud.toast('customs-permit', null, '세관원: "짐승과 가솔들은 통과할 수 있으나, 저 큰 궤짝은 반드시 조사해야겠소!"');
            updateEgyptGoal();
          },
        };
      },
    });

    // 2단계: 세관 보석 상자 인터랙션
    interactions.add({
      id: 'border_chest',
      pos: () => POS_EGYPT_CHEST,
      height: 1.0,
      r: 2.2,
      label: () => (chestInspected ? '열린 보석 상자 확인하기' : '세관 보석 상자 조사하기'),
      act: () => {
        audio.playSfx('wood_chest_open');
        hud.unlockCodex('sarai_chest');
        hud.choice = {
          prompt: '애굽 세관 관헌과의 심문 (보석 상자의 결단)',
          options: [
            { text: '정직하게 뚜껑을 열어보시오. 숨긴 재물은 없소.' },
            { text: '세금을 넉넉히 낼 터이니 상자를 열지 않고 통과하게 해주시오.' },
          ],
          selectedIndex: 0,
          onSelect: (idx: number) => {
            hud.choice = null;
            chestInspected = true;
            if (idx === 0) {
              particles.emit('glory_sparkles', 1.5, 1.0, -2, 30);
              hud.toast('chest-reveal', null, '상자가 열리자 사래의 찬란한 빛과 아름다움이 온 국경을 비추었습니다!');
            } else {
              audio.playVoiceBlip('narrator');
              hud.toast('chest-tax', null, '관리들이 더욱 의심하여 결국 상자를 열어보았습니다.');
            }
            updateEgyptGoal();
          },
        };
      },
    });

    // 3단계: 바로 궁정 황금 옥좌로 나아가기
    interactions.add({
      id: 'pharaoh_palace_dais',
      pos: () => POS_EGYPT_PALACE,
      height: 1.4,
      r: 2.8,
      label: () => (chestInspected ? '바로 궁정 보좌 앞으로 나아가기' : '세관 통과 후 궁정으로 가기'),
      act: () => {
        if (!chestInspected) {
          hud.toast('chest-first', null, '먼저 세관에서 상자 검문을 마쳐야 합니다.');
          return;
        }
        audio.playVoiceBlip('narrator');
        cutscene.play(createPharaohPalaceSteps(sceneCtx), () => onBook2Complete());
      },
    });
  }

  // ── 3. 싯딤 골짜기 전장 및 호바 야간 기습 ──
  if (stageId === 'siddim_hobah') {
    let litTorch1 = false;
    let litTorch2 = false;
    let rescuedLot = false;

    const updateWarGoal = () => {
      hud.goalCategory = '제2권 · 롯 구출 작전';
      const litTorches = (litTorch1 ? 1 : 0) + (litTorch2 ? 1 : 0);
      if (litTorches < 2) {
        hud.goal = `적진 야영지 횃불 밝히기 (${litTorches}/2)`;
        hud.goalProgress = { current: litTorches, total: 3, label: `${litTorches}/3` };
        hud.hint = '어두운 적진 곳곳의 횃불을 밝혀 군사들을 지휘하자';
      } else if (!rescuedLot) {
        hud.goal = '사로잡힌 조카 롯 구출하기 (0/1)';
        hud.goalProgress = { current: 2, total: 3, label: '2/3' };
        hud.hint = '북쪽 적진 야영지 텐트 앞 롯을 만나자';
      } else {
        hud.goal = '살렘 왕 멜기세덱의 떡과 포도주 축복 받기 (1/1)';
        hud.goalProgress = { current: 3, total: 3, label: '3/3' };
        hud.hint = '남쪽 석조 단상 위의 멜기세덱에게 다가가자';
      }
    };

    updateWarGoal();

    // 횃불 인터랙션 1
    interactions.add({
      id: 'torch_1',
      pos: () => POS_TORCH_1,
      height: 1.5,
      r: 2.0,
      label: () => (litTorch1 ? '타오르는 서쪽 횃불' : '서쪽 횃불 피워올리기'),
      act: () => {
        if (litTorch1) return;
        litTorch1 = true;
        audio.playSfx('fire_ignite');
        particles.emit('fire_ember', -5, 1.8, 0, 20);
        hud.toast('torch-1', null, '서쪽 봉화에 불을 밝혀 아브람의 사병들에게 신호를 보냈습니다.');
        updateWarGoal();
      },
    });

    // 횃불 인터랙션 2
    interactions.add({
      id: 'torch_2',
      pos: () => POS_TORCH_2,
      height: 1.5,
      r: 2.0,
      label: () => (litTorch2 ? '타오르는 동쪽 횃불' : '동쪽 횃불 피워올리기'),
      act: () => {
        if (litTorch2) return;
        litTorch2 = true;
        audio.playSfx('fire_ignite');
        particles.emit('fire_ember', 5, 1.8, 0, 20);
        hud.toast('torch-2', null, '동쪽 봉화에 불을 놓아 적진을 포위했습니다.');
        updateWarGoal();
      },
    });

    // 롯 구출
    interactions.add({
      id: 'rescue_lot',
      pos: () => POS_RESCUE_LOT,
      height: 1.2,
      r: 2.8,
      label: () => (rescuedLot ? '구출된 조카 롯 확인' : '조카 롯 구출하기'),
      act: () => {
        if (rescuedLot) return;
        const litTorches = (litTorch1 ? 1 : 0) + (litTorch2 ? 1 : 0);
        if (litTorches < 2) {
          hud.toast('need-torches', null, '먼저 야영지 좌우의 횃불을 모두 밝혀야 기습에 성공할 수 있습니다.');
          return;
        }
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
      pos: () => POS_MELCHIZEDEK,
      height: 1.2,
      r: 2.5,
      label: () => (rescuedLot ? '멜기세덱의 떡과 포도주 축복 받기' : '승전 후 멜기세덱을 알현하기'),
      act: () => {
        if (!rescuedLot) {
          hud.toast('rescue-first', null, '먼저 롯을 구출하고 승전하여 돌아와야 합니다.');
          return;
        }
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

/**
 * 2권 장면별 액션을 건다. 직접 쓴 장면이 없는 장(src/data/staging.json)은 들어올 때 연출 장면을 먼저 재생한다.
 * (장 번호는 wireChapterActions 가 chapterIndex 로 명시해서 넘긴다)
 */
export function setupBook2Actions(ctx: Book2ActionContext): void {
  const chapter = ctx.chapterIndex;
  const stageId = ctx.stageId;
  setupBook2ActionsCore(ctx);
  playChapterStaging(ctx.sceneCtx, ctx.cutscene, 2, chapter, stageId, ctx.getPick);
}
