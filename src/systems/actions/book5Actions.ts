import type { GetPick, SetPick, GetTrait } from './pickTypes';
import { traitFromGetPick } from '../../game/storyFlags';
import { createMoriahAftermathSteps } from './consequenceScenes';
import type { Interactions } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';
import type { Cutscene } from '../cutscene/cutscene';
import type { SceneContext } from '../scenes/book1/book1Scenes';
import { BOOKS } from '../../data/books';
import { playChapterStaging } from '../scenes/staging/chapterStaging';
import {
  createIsaacBirthFeastSteps,
  createBeershebaCovenantSteps,
  createMountMoriahAkedahSteps,
  createJehovahJirehSteps,
} from '../scenes/book5/book5Scenes';

export interface Book5ActionContext {
  /** 지금 들어온 장 번호 (연출 재생에 쓴다 — 목표 문구로 추측하지 않는다) */
  chapterIndex?: number;
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  particles: ParticleManager;
  cutscene: Cutscene;
  sceneCtx: SceneContext;
  stageId: string;
  onBook5Complete: () => void;
  onSwitchStage?: (stageId: string) => void;
  /** 앞서 한 선택(갈래) 읽기/기록 (저장됨) */
  getPick?: GetPick;
  setPick?: SetPick;
  /** 지금까지의 지배 성향 (없으면 getPick 으로 다시 계산) — 모리아 뒤 장면이 달라진다 */
  getTrait?: GetTrait;
}

// Module-level position buffers (zero per-frame allocations)
const POS_FEAST_TABLE = { x: 6, z: -5 };
const POS_HAGAR_WATER = { x: -4, z: 3 };
const POS_ISHMAEL_BOW = { x: -6, z: 1 };
const POS_WELL_BEERSHEBA = { x: 0, z: 0 };
const POS_TAMARISK = { x: -6, z: -4 };
const POS_JOURNEY_MORIAH = { x: 10, z: -10 };

const POS_LAMB_1 = { x: 6, z: 6 };
const POS_LAMB_2 = { x: 8, z: 7 };
const POS_LAMB_3 = { x: 7, z: 8 };
const POS_LAMB_4 = { x: 4, z: 5 };
const POS_LAMB_5 = { x: 9, z: 5 };
const POS_LAMB_6 = { x: 5, z: 9 };
const POS_LAMB_7 = { x: 8, z: 9 };

const POS_DONKEY_BASECAMP = { x: -3, z: 8 };
const POS_WOOD_PILE = { x: 0, z: 8 };
const POS_TRAIL_CLIMB = { x: 0, z: 1 };
const POS_AKEDAH_ALTAR = { x: 0, z: -7 };
const POS_RAM_THICKET = { x: 3.2, z: -7.5 };

const POS_SATAN_ELDER = { x: -4, z: -3 };
const POS_SATAN_RIVER = { x: 4, z: -4 };
const POS_SATAN_ISAAC = { x: -1, z: 5 };
const POS_SATAN_ROAD = { x: 2, z: -8 };

/** 3권 활쏘기 터에서 한 선택(archery_target)에 따라 하갈을 전송하는 대사가 달라진다 (''=선택 없음). 각 문장이 번역 키다 */
const HAGAR_TAIL = '가죽부대에 물을 채우고 떡을 취하여 하갈의 어깨에 메워주며 전송했습니다.';
const HAGAR_SENDOFF: Record<string, string> = {
  '': HAGAR_TAIL,
  '활을 가르침': `활쏘기를 가르쳐 주던 날의 이스마엘을 떠올리며, ${HAGAR_TAIL}`,
  '지켜봐 줌': `멀리서 지켜보며 칭찬해 주던 날의 이스마엘을 떠올리며, ${HAGAR_TAIL}`,
};

function setupBook5ActionsCore(ctx: Book5ActionContext): void {
  const { interactions, hud, audio, particles, cutscene, sceneCtx, stageId, onBook5Complete, onSwitchStage, getPick, setPick } = ctx;
  interactions.clear();

  // 브엘세바 무대의 잔치·하갈·암양·언약·에셀나무 루프는 5권 1장(이삭의 출생)의 것이다. 같은 무대를 쓰는 2·3·4·8장이
  // 이 루프(와 그 목표 문구)를 그대로 물려받아 앞 장의 목표가 남던 문제를 막는다: 그 장들은 자기 장 제목을 목표로 두고
  // 상호작용은 비워 둔다 (chapterFlow 가 '다음 이야기로' 안전망을 단다).
  if (stageId === 'beersheba' && ctx.chapterIndex !== undefined && ctx.chapterIndex !== 0) {
    hud.goalCategory = BOOKS[5]?.title ?? '제5권';
    hud.goal = BOOKS[5]?.chapters[ctx.chapterIndex]?.title ?? null;
    hud.goalProgress = null;
    hud.hint = null;
    return;
  }

  // ── 1. 브엘세바 우물터 (이삭 탄생 잔치 & 아비멜렉 언약) ──
  if (stageId === 'beersheba') {
    let feastCelebrated = false;
    let waterGiven = false;
    let gatheredLambs = 0;
    let gatheredLamb1 = false;
    let gatheredLamb2 = false;
    let gatheredLamb3 = false;
    let gatheredLamb4 = false;
    let gatheredLamb5 = false;
    let gatheredLamb6 = false;
    let gatheredLamb7 = false;
    let covenantDone = false;
    let treePlanted = false;

    const updateBeershebaGoal = () => {
      hud.goalCategory = '제5권 · 브엘세바 언약';
      if (!feastCelebrated) {
        hud.goal = '이삭 출생과 젖 뗀 날 큰 잔치 기념하기 (0/1)';
        hud.goalProgress = { current: 0, total: 5, label: '0/5' };
        hud.hint = '북동쪽 연회 탁자로 다가가 잔치를 열자';
      } else if (!waterGiven) {
        hud.goal = '하갈과 이스마엘에게 물가죽부대와 떡 챙겨주기 (0/1)';
        hud.goalProgress = { current: 1, total: 5, label: '1/5' };
        hud.hint = '장막 앞마당에서 하갈을 전송하자';
      } else if (gatheredLambs < 7) {
        hud.goal = `언약의 증표 암양 새끼 7마리 모으기 (${gatheredLambs}/7)`;
        hud.goalProgress = { current: 2, total: 5, label: '2/5' };
        hud.hint = '동남쪽 울타리 주변의 암양들을 살펴보자';
      } else if (!covenantDone) {
        hud.goal = '브엘세바 우물에서 아비멜렉과 화친 언약 세우기 (0/1)';
        hud.goalProgress = { current: 3, total: 5, label: '3/5' };
        hud.hint = '중앙 맹세의 우물 앞으로 다가가자';
      } else if (!treePlanted) {
        hud.goal = '브엘세바에 에셀나무 심고 여호와의 이름 부르기 (0/1)';
        hud.goalProgress = { current: 4, total: 5, label: '4/5' };
        hud.hint = '서북쪽 빈터에 에셀나무를 심자';
      } else {
        hud.goal = '사흘 길을 걸어 모리아 산으로 향하기 (5/5)';
        hud.goalProgress = { current: 5, total: 5, label: '5/5' };
        hud.hint = '남동쪽 길목으로 나아가 모리아 산으로 출발하자';
      }
    };

    updateBeershebaGoal();

    // 1단계: 이삭 출생 잔치
    interactions.add({
      id: 'feast_table',
      pos: () => POS_FEAST_TABLE,
      height: 1.2,
      r: 2.8,
      label: () => (feastCelebrated ? '이삭의 출생 큰 잔치 회상하기' : '이삭 출생과 젖 뗀 날 큰 잔치 기념하기'),
      act: () => {
        if (feastCelebrated) return;
        feastCelebrated = true;
        audio.playSfx('birth_celebration');
        particles.emit('glory_sparkles', 6, 1.2, -5, 25);
        hud.unlockCodex('isaac_birth');
        cutscene.play(createIsaacBirthFeastSteps(sceneCtx));
        updateBeershebaGoal();
      },
    });

    // 2단계: 하갈 물가죽부대 전송
    interactions.add({
      id: 'hagar_waterskin',
      pos: () => POS_HAGAR_WATER,
      height: 1.2,
      r: 2.4,
      label: () => (waterGiven ? '하갈과 이스마엘을 지키시는 하나님의 은혜' : '하갈에게 물가죽부대와 떡 챙겨주기'),
      act: () => {
        if (!feastCelebrated) {
          hud.toast('feast-first', null, '먼저 이삭의 큰 잔치를 기념하십시오.');
          return;
        }
        if (waterGiven) return;
        waterGiven = true;
        audio.playSfx('waterskin_fill');
        particles.emit('glory_sparkles', -4, 1.2, 3, 20);
        hud.unlockCodex('hagar_lahairoi');
        const archery = getPick ? getPick('archery_target') : undefined;
        hud.toast('hagar-water', null, HAGAR_SENDOFF[archery ?? ''] ?? HAGAR_SENDOFF[''], 0, 6);
        updateBeershebaGoal();
      },
    });

    // 선택 보상: 이스마엘에게 활을 가르쳐 준 아브라함만 하갈을 보낸 뒤 활 한 자루를 따로 건넬 수 있다 (선택 → 새 상호작용)
    if (getPick && getPick('archery_target') === '활을 가르침') {
      let bowGiven = false;
      interactions.add({
        id: 'ishmael_bow_gift',
        pos: () => POS_ISHMAEL_BOW,
        height: 1.1,
        r: 2.4,
        label: () => (waterGiven && !bowGiven ? '이스마엘에게 가르쳐 준 활 건네기' : null),
        act: () => {
          if (!waterGiven || bowGiven) return;
          bowGiven = true;
          audio.playSfx('ui_confirm');
          particles.emit('glory_sparkles', -6, 1.1, 1, 20);
          hud.toast('ishmael-bow', null, '아브라함은 활쏘기를 가르쳐 주던 날의 활을 이스마엘의 손에 쥐여 주었다. 성경: “하나님이 그 아이와 함께 계시매 그가 자라 광야에서 거주하며 활을 쏘는 자가 되었더라.”', 0, 6);
        },
      });
    }

    // 3단계: 암양 7마리 수집 인터랙션
    const createLambInteractable = (
      id: string,
      pos: { x: number; z: number },
      index: number,
      isGathered: () => boolean,
      setGathered: () => void,
    ) => ({
      id,
      pos: () => pos,
      height: 1.0,
      r: 2.0,
      label: () => {
        if (!waterGiven) return null;
        return isGathered() ? null : `언약의 암양 새끼 돌보기 (${index}/7)`;
      },
      act: () => {
        if (!waterGiven) {
          hud.toast('water-first', null, '먼저 하갈에게 물가죽부대를 전송하십시오.');
          return;
        }
        if (isGathered()) return;
        setGathered();
        gatheredLambs++;
        audio.playSfx('sheep_bleat');
        hud.toast('lamb-gather', null, `언약의 암양 새끼를 정성껏 구별했습니다 (${gatheredLambs}/7)`);
        updateBeershebaGoal();
      },
    });

    interactions.add(
      createLambInteractable('lamb_1', POS_LAMB_1, 1, () => gatheredLamb1, () => { gatheredLamb1 = true; }),
      createLambInteractable('lamb_2', POS_LAMB_2, 2, () => gatheredLamb2, () => { gatheredLamb2 = true; }),
      createLambInteractable('lamb_3', POS_LAMB_3, 3, () => gatheredLamb3, () => { gatheredLamb3 = true; }),
      createLambInteractable('lamb_4', POS_LAMB_4, 4, () => gatheredLamb4, () => { gatheredLamb4 = true; }),
      createLambInteractable('lamb_5', POS_LAMB_5, 5, () => gatheredLamb5, () => { gatheredLamb5 = true; }),
      createLambInteractable('lamb_6', POS_LAMB_6, 6, () => gatheredLamb6, () => { gatheredLamb6 = true; }),
      createLambInteractable('lamb_7', POS_LAMB_7, 7, () => gatheredLamb7, () => { gatheredLamb7 = true; }),
    );

    // 4단계: 브엘세바 맹세의 우물
    interactions.add({
      id: 'beersheba_well',
      pos: () => POS_WELL_BEERSHEBA,
      height: 1.2,
      r: 2.6,
      label: () => (covenantDone ? '맹세의 우물 (브엘세바) 묵상하기' : '암양 일곱으로 아비멜렉과 화친 언약 맺기'),
      act: () => {
        if (gatheredLambs < 7) {
          hud.toast('need-lambs', null, `아비멜렉과의 언약을 위해 암양 7마리를 먼저 구별해야 합니다 (${gatheredLambs}/7)`);
          return;
        }
        if (covenantDone) return;
        covenantDone = true;
        audio.playSfx('ui_confirm');
        hud.unlockCodex('beersheba_covenant');
        cutscene.play(createBeershebaCovenantSteps(sceneCtx), () => {
          hud.toast('covenant-ewe-lambs', null, '일곱 암양을 증표로 브엘세바의 맹세를 확정하였습니다.');
          updateBeershebaGoal();
        });
      },
    });

    // 5단계: 에셀나무 심기
    interactions.add({
      id: 'tamarisk_tree',
      pos: () => POS_TAMARISK,
      height: 1.5,
      r: 2.8,
      label: () => (treePlanted ? '영원하신 하나님의 이름 부르기' : '브엘세바에 에셀나무 심기'),
      act: () => {
        if (!covenantDone) {
          hud.toast('covenant-first', null, '먼저 우물가에서 아비멜렉과 화친 언약을 맺으십시오.');
          return;
        }
        if (treePlanted) return;
        treePlanted = true;
        audio.playSfx('fx_covenant_chime');
        particles.emit('glory_sparkles', -6, 2.0, -4, 30);
        hud.toast('tamarisk-planted', null, '에셀나무를 심고 영생하시는 여호와의 이름을 불렀습니다.');
        updateBeershebaGoal();
      },
    });

    // 6단계: 모리아 산 출발 길목
    interactions.add({
      id: 'journey_to_moriah',
      pos: () => POS_JOURNEY_MORIAH,
      height: 1.4,
      r: 3.0,
      label: () => (treePlanted ? '사흘 길을 걸어 모리아 산으로 향하기' : '에셀나무를 심은 후 모리아로 출발하기'),
      act: () => {
        if (!treePlanted) {
          hud.toast('plant-first', null, '먼저 브엘세바에 에셀나무를 심고 하나님의 이름을 부르십시오.');
          return;
        }
        audio.playVoiceBlip('abraham');
        if (onSwitchStage) {
          onSwitchStage('moriah');
        }
      },
    });
  }

  // ── 2. 모리아 산 (번제단과 이삭의 결박) ──
  if (stageId === 'moriah') {
    let campSettled = false;
    let woodCarried = false;
    let trailClimbed = false;
    let boundIsaac = false;

    const updateMoriahGoal = () => {
      hud.goalCategory = '제5권 · 모리아 산 번제';
      if (!campSettled) {
        hud.goal = '산기슭 베이스캠프에서 종들과 나귀에게 대기 명하기 (0/1)';
        hud.goalProgress = { current: 0, total: 5, label: '0/5' };
        hud.hint = '남쪽 산기슭의 나귀와 종들에게 다가가자';
      } else if (!woodCarried) {
        hud.goal = '번제 나무를 쪼개어 이삭의 어깨에 지우기 (0/1)';
        hud.goalProgress = { current: 1, total: 5, label: '1/5' };
        hud.hint = '장작더미 앞으로 다가가 나무를 지우자';
      } else if (!trailClimbed) {
        hud.goal = '이삭과 함께 바위 등산로 오르기 (하나님이 준비하시리라) (0/1)';
        hud.goalProgress = { current: 2, total: 5, label: '2/5' };
        hud.hint = '중앙 바위 등산로를 따라 정상으로 올라가자';
      } else if (!boundIsaac) {
        hud.goal = '번제단에 나무를 벌이고 이삭 결박하기 (아케다) (0/1)';
        hud.goalProgress = { current: 3, total: 5, label: '3/5' };
        hud.hint = '정상 돌 번제단 앞으로 다가가 순종의 결단을 내리자';
      } else {
        hud.goal = '수풀의 숫양을 대신 번제로 드리기 (여호와 이레) (4/5)';
        hud.goalProgress = { current: 4, total: 5, label: '4/5' };
        hud.hint = '제단 뒤편 가시덤불의 숫양에게 다가가자';
      }
    };

    updateMoriahGoal();

    // 1단계: 산기슭 종들과 나귀
    interactions.add({
      id: 'donkey_basecamp',
      pos: () => POS_DONKEY_BASECAMP,
      height: 1.2,
      r: 2.8,
      label: () => (campSettled ? '종들과 나귀가 기다리는 중' : '종들과 나귀에게 기다리라 명하기'),
      act: () => {
        campSettled = true;
        audio.playVoiceBlip('abraham');
        hud.unlockCodex('moriah_journey');
        hud.toast('moriah-camp', null, '“너희는 나귀와 함께 기다리라. 내가 아이와 함께 예배하고 돌아오리라.”');
        updateMoriahGoal();
      },
    });

    // 2단계: 장작 지우기
    interactions.add({
      id: 'wood_pile',
      pos: () => POS_WOOD_PILE,
      height: 1.1,
      r: 2.4,
      label: () => (woodCarried ? '이삭이 번제 나무를 지고 있음' : '번제 나무를 이삭에게 지우기'),
      act: () => {
        if (!campSettled) {
          hud.toast('camp-first', null, '먼저 종들과 나귀에게 산기슭에서 기다리라 명하십시오.');
          return;
        }
        if (woodCarried) return;
        woodCarried = true;
        audio.playSfx('wood_stack_logs');
        particles.emit('impact_dust', 0, 1.0, 8, 20);
        hud.toast('wood-carry', null, '번제 나무를 쪼개어 아들 이삭의 어깨에 지웠습니다.');
        updateMoriahGoal();
      },
    });

    // 3단계: 바위 등산로 오르기
    interactions.add({
      id: 'trail_climb',
      pos: () => POS_TRAIL_CLIMB,
      height: 1.3,
      r: 2.6,
      label: () => (trailClimbed ? '모리아 산 정상 도착' : '이삭과 함께 모리아 산비탈 오르기'),
      act: () => {
        if (!woodCarried) {
          hud.toast('wood-first', null, '먼저 번제 나무 장작을 챙겨야 합니다.');
          return;
        }
        if (trailClimbed) return;
        trailClimbed = true;
        audio.playVoiceBlip('isaac');
        const climbPick = getPick ? getPick('satan_elder') : undefined;
        hud.toast('moriah-climb', null, climbPick === '돌려 드림' ? "길가의 노인에게 “하나님께 돌려 드리겠소” 하고 답했던 아브라함은 아들의 손을 더 꼭 잡았다. 이삭: “불과 나무는 있거니와 번제할 어린 양은 어디 있나이까?” 아브라함: “하나님이 친히 준비하시리라.”" : climbPick === '믿음으로 답함' ? "길가에서 “길을 보이시리라” 하고 답했던 말을 되새기며, 이삭: “불과 나무는 있거니와 번제할 어린 양은 어디 있나이까?” 아브라함: “하나님이 친히 준비하시리라.”" : "이삭: “불과 나무는 있거니와 번제할 어린 양은 어디 있나이까?” 아브라함: “하나님이 친히 준비하시리라.”");
        updateMoriahGoal();
      },
    });

    // 4단계: 번제단 결박 (아케다)
    interactions.add({
      id: 'akedah_altar',
      pos: () => POS_AKEDAH_ALTAR,
      height: 1.5,
      r: 2.8,
      label: () => (boundIsaac ? '여호와의 사자의 음성을 묵상하기' : '나무를 벌이고 이삭을 번제단에 결박하기'),
      act: () => {
        if (!trailClimbed) {
          hud.toast('climb-first', null, '먼저 산길을 올라 제단 정상에 이르러야 합니다.');
          return;
        }
        if (boundIsaac) return;

        hud.choice = {
          prompt: '모리아 산 번제단 (이삭의 결박 - 아케다)',
          options: [
            { text: '말씀대로 이삭을 결박하여 제단 나무 위에 얹는다.' },
            { text: '하나님께서 죽은 자 가운데서도 능히 살리실 것을 믿는다.' },
          ],
          selectedIndex: 0,
          onSelect: () => {
            hud.choice = null;
            boundIsaac = true;
            audio.playSfx('knife_raise_tension');
            particles.emit('glory_sparkles', 0, 4.0, -7, 40);
            hud.unlockCodex('akedah_sacrifice');
            cutscene.play(createMountMoriahAkedahSteps(sceneCtx));
            updateMoriahGoal();
          },
        };
      },
    });

    // 5단계: 수풀의 숫양 (여호와 이레)
    interactions.add({
      id: 'ram_in_thicket',
      pos: () => POS_RAM_THICKET,
      height: 1.4,
      r: 2.8,
      label: () => (boundIsaac ? '수풀의 숫양을 대신 번제로 드리기 (여호와 이레)' : '순종의 결단을 마친 후 숫양 확인하기'),
      act: () => {
        if (!boundIsaac) {
          hud.toast('altar-first', null, '먼저 제단에서 온전한 순종의 결박을 마쳐야 합니다.');
          return;
        }
        audio.playSfx('ram_bush');
        particles.emit('glory_sparkles', 3.2, 4.2, -7.5, 45);
        // 여호와 이레 뒤, 지금까지의 성향에 따라 산을 내려오는 장면이 갈린다 (성향이 없으면 기존 그대로)
        const trait = ctx.getTrait ? ctx.getTrait() : traitFromGetPick(getPick);
        cutscene.play(createJehovahJirehSteps(sceneCtx), () => {
          const after = createMoriahAftermathSteps(trait);
          if (after.length > 0) cutscene.play(after, () => onBook5Complete());
          else onBook5Complete();
        });
      },
    });
  }
  // ── 3. 모리아로 가는 사흘 길 (사탄의 참소: 전해 오는 이야기) ──
  if (stageId === 'shechem_bethel') {
    let heardElder = false;
    let crossedRiver = false;
    let comfortedIsaac = false;
    const goal = (): void => {
      const n = (heardElder ? 1 : 0) + (crossedRiver ? 1 : 0) + (comfortedIsaac ? 1 : 0);
      hud.goal = `모리아 사흘 길에서 사탄의 시험을 물리치자\n${heardElder ? '☑' : '☐'} 길가의 노인의 속삭임에 답하기\n${crossedRiver ? '☑' : '☐'} 길을 막은 강물 건너기\n${comfortedIsaac ? '☑' : '☐'} 불안해하는 이삭 달래기`;
      hud.goalProgress = { current: n, total: 3, label: `${n}/3` };
    };
    goal();

    interactions.add({
      id: 'satan_elder',
      pos: () => POS_SATAN_ELDER,
      height: 1.3,
      r: 2.6,
      label: () => (heardElder ? null : '길가의 노인에게 귀 기울이기'),
      act: () => {
        if (heardElder) return;
        hud.toast('satan-elder', null, '노인: “늙어서 얻은 아들을 정말 바치려 하오? 하나님이 그리 말씀하셨다는 증거가 어디 있소?”');
        hud.showChoice('노인의 속삭임에 아브라함은 어떻게 답할까?', [
          { text: '“듣고 보니 그 말이 옳을지도 모르겠소.”' },
          { text: '“내게 말씀하신 분이 길을 보이시리라.”' },
          { text: '“이 아이는 하나님의 선물이니 하나님께 돌려 드리겠소.”' },
        ], (idx: number) => {
          if (idx !== 1 && idx !== 2) {
            hud.toast('satan-elder-wrong', null, '마음이 흔들렸다. 그러나 이것은 시험이다. 노인의 말을 다시 곱씹어 보자.');
            return;
          }
          heardElder = true;
          if (setPick) setPick('satan_elder', idx === 2 ? '돌려 드림' : '믿음으로 답함');
          audio.playVoiceBlip('abraham');
          hud.toast('satan-elder-ok', null, '노인은 어느새 길가에서 사라지고 없었다. 아브라함의 걸음은 흔들림이 없었다.');
          goal();
        });
      },
    });

    interactions.add({
      id: 'satan_river',
      pos: () => POS_SATAN_RIVER,
      height: 1.2,
      r: 2.8,
      label: () => (crossedRiver ? null : heardElder ? '불어난 강물을 믿음으로 건너기' : null),
      act: () => {
        if (crossedRiver) return;
        crossedRiver = true;
        audio.playSfx('stone_altar_stack');
        particles.emit('impact_dust', 4, 0.4, -4, 18);
        hud.toast('satan-river', null, '전해 오는 이야기에 따르면, 사탄이 강물을 불려 길을 막았으나 아브라함은 “물이 목까지 차오릅니다, 주여!” 하고 외쳤고 물이 물러갔다고 한다.');
        goal();
      },
    });

    interactions.add({
      id: 'satan_isaac',
      pos: () => POS_SATAN_ISAAC,
      height: 1.2,
      r: 2.6,
      label: () => (comfortedIsaac ? null : crossedRiver ? '이삭의 손을 잡아 주기' : null),
      act: () => {
        if (comfortedIsaac) return;
        comfortedIsaac = true;
        audio.playVoiceBlip('isaac');
        hud.toast('satan-isaac', null, '이삭: “아버지, 어머니가 걱정하실 것 같아요.” 아브라함: “아들아, 하나님이 우리와 함께 계신다.”');
        goal();
      },
    });

    interactions.add({
      id: 'satan_road_end',
      pos: () => POS_SATAN_ROAD,
      height: 1.4,
      r: 3.0,
      label: () => (heardElder && crossedRiver && comfortedIsaac ? '모리아 산 쪽으로 계속 걷기' : null),
      act: () => {
        audio.playVoiceBlip('abraham');
        onBook5Complete();
      },
    });
  }
}

/**
 * 5권 장면별 액션을 건다. 직접 쓴 장면이 없는 장(src/data/staging.json)은 들어올 때 연출 장면을 먼저 재생한다.
 * (장 번호는 wireChapterActions 가 chapterIndex 로 명시해서 넘긴다)
 */
export function setupBook5Actions(ctx: Book5ActionContext): void {
  const chapter = ctx.chapterIndex;
  const stageId = ctx.stageId;
  setupBook5ActionsCore(ctx);
  playChapterStaging(ctx.sceneCtx, ctx.cutscene, 5, chapter, stageId, ctx.getPick);
}
