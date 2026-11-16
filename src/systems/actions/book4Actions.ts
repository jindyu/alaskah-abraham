import type { GetPick, SetPick } from './pickTypes';
import { addBeatLoop } from './beatLoop';
import type { Interactions } from '../interaction';
import { after } from '../../game/timers';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';
import type { Cutscene } from '../cutscene/cutscene';
import type { SceneContext } from '../scenes/book1/book1Scenes';
import { playChapterStaging } from '../scenes/staging/chapterStaging';
import {
  createThreeVisitorsSteps,
  createIntercessionSteps,
  createSodomRiotSteps,
  createSodomEscapeSteps,
  createAbrahamsDawnSteps,
} from '../scenes/book4/book4Scenes';

export interface Book4ActionContext {
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
  onBook4Complete: () => void;
}

// Module-level position buffers (zero per-frame allocations)
const POS_WELL_WASH = { x: 7, z: -5 };
const POS_HEARTH_BREAD = { x: -3, z: 3 };
const POS_DINING_TABLE = { x: 1.5, z: 0 };
const POS_INTERCESSION = { x: 6, z: -4 };

const POS_LOT_DOOR = { x: -3.4, z: 2 };
const POS_LOT_COURTYARD = { x: -5, z: 4 };
const POS_SODOM_GATE = { x: 0, z: -10 };
const POS_SALT_PILLAR_ESCAPE = { x: 8, z: 7 };

function setupBook4ActionsCore(ctx: Book4ActionContext): void {
  const { interactions, hud, audio, particles, cutscene, sceneCtx, stageId, onBook4Complete } = ctx;
  interactions.clear();

  // 직접 쓴 상호작용이 없던 장: 단계형 짧은 루프 (5장)
  if (ctx.chapterIndex === 4 && stageId === "beersheba") {
    addBeatLoop({
      interactions, hud, audio, goalTitle: "그랄 왕 아비멜렉을 위해 치유의 기도를 드리자",
      beats: [
      { id: "heal_dream", x: -6, z: -4, label: "아비멜렉의 꿈 이야기를 듣기", toast: "하나님이 꿈에 아비멜렉에게 이르셨다: “네가 데려온 여인은 남의 아내이니 너는 죽으리라.”", goalItem: "아비멜렉의 꿈 이야기 듣기" },
      { id: "heal_return", x: 0, z: 0, label: "사라를 돌려보내는 행렬 맞이하기", toast: "아비멜렉이 양과 소와 종들을 아브라함에게 주고 사라를 돌려보내며 “내 땅이 네 앞에 있으니 네 소견에 좋은 대로 거하라” 했다.", goalItem: "사라를 돌려받기", voice: "abraham" },
      { id: "heal_silver", x: 0, z: -4, label: "은 천 개의 변명을 듣기", toast: "아비멜렉이 사라에게 말했다. “내가 네 오라비에게 은 천 개를 주었으니 이는 네 모든 일에 대한 변명이 되리라.”", goalItem: "은 천 개의 변명 듣기" },
      { id: "heal_ishmael", x: -4, z: 3, label: "활을 가르쳐 준 이스마엘의 안부 묻기", toast: "활쏘기를 가르쳐 준 소년 이스마엘의 소식이 그랄 사람들 입에서 전해진다. 광야에서 활 쏘는 사람으로 자라고 있다고 한다. 아브라함의 기도에 그 이름이 하나 더 실렸다.", goalItem: "이스마엘의 안부 묻기", voice: "abraham", when: (pick) => pick("archery_target") === "활을 가르침" },
      { id: "heal_lot", x: 6, z: 0, label: "소돔에서 온 나그네에게 롯의 소식 묻기", toast: "롯을 염려하던 아브라함은 소돔을 오가는 나그네에게 그의 소식을 물었다. 이 기도는 아비멜렉의 집만이 아니라 롯의 집을 위한 기도도 되었다.", goalItem: "롯의 소식 묻기", when: (pick) => pick("war_envoy") === "롯을 염려함" },
      { id: "heal_pray", x: -2, z: -8, label: "아비멜렉의 집을 위해 기도하기", toast: "아브라함이 하나님께 기도하니 하나님이 아비멜렉과 그 아내와 여종들을 고치사 그들이 다시 출산하게 하셨다.", goalItem: "아비멜렉의 집을 위해 기도하기", voice: "abraham", choice: { prompt: "아비멜렉의 집 앞에서 아브라함은 무엇을 구할까?", options: [{ text: "그가 사라를 데려간 일을 따져 묻는다", reply: "아브라함은 분한 마음을 누르고 고개를 저었다. 하나님은 그에게 다른 일을 하라 하셨다.", ok: false }, { text: "하나님께 아비멜렉의 집을 고쳐 달라 기도한다", reply: "아브라함이 기도하자 하나님이 아비멜렉의 집을 고치셨다.", ok: true }] } },
      ],
      finishLabel: "기도를 마치고 다음 이야기로 가기", finishX: 10, finishZ: -10,
      onComplete: ctx.onBook4Complete,
      getPick: ctx.getPick, setPick: ctx.setPick,
    });
    return;
  }


  // ── 1. 마므레 상수리 장막 (아브라함 시점) ──
  if (stageId === 'mamre') {
    let feetWashed = false;
    let breadBaked = false;
    let feastServed = false;

    const updateMamreGoal = () => {
      hud.goalCategory = '제4권 · 마므레 세 나그네';
      if (!feetWashed) {
        hud.goal = '우물에서 시원한 물 길어 세 나그네 발 씻기기 (0/1)';
        hud.goalProgress = { current: 0, total: 4, label: '0/4' };
        hud.hint = '동북쪽 돌 우물가로 다가가 물을 긷자';
      } else if (!breadBaked) {
        hud.goal = '장막 화덕에서 고운 가루 세 스아로 떡 굽기 (0/1)';
        hud.goalProgress = { current: 1, total: 4, label: '1/4' };
        hud.hint = '서쪽 장막 앞 야외 화덕으로 다가가자';
      } else if (!feastServed) {
        hud.goal = '야외 평상에서 살진 송아지와 엉긴 젖 대접하기 (0/1)';
        hud.goalProgress = { current: 2, total: 4, label: '2/4' };
        hud.hint = '중앙 나무 그늘 오찬 탁자로 다가가자';
      } else {
        hud.goal = '소돔을 향한 중보 기도 드리기 (의인 열 명) (3/4)';
        hud.goalProgress = { current: 3, total: 4, label: '3/4' };
        hud.hint = '소돔이 내려다보이는 동남쪽 언덕 끝으로 가자';
      }
    };

    updateMamreGoal();

    // 1단계: 발 씻길 물 긷기
    interactions.add({
      id: 'visitors_wash_feet',
      pos: () => POS_WELL_WASH,
      height: 1.2,
      r: 2.4,
      label: () => (feetWashed ? '시원한 우물물 확인하기' : '우물에서 세 나그네 발 씻길 물 긷기'),
      act: () => {
        if (feetWashed) return;
        feetWashed = true;
        audio.playSfx('water_draw');
        particles.emit('glory_sparkles', 7, 1.0, -5, 20);
        hud.toast('wash-feet', null, '우물에서 맑은 물을 길어 세 나그네의 발을 정성껏 씻겼습니다.');
        updateMamreGoal();
      },
    });

    // 2단계: 떡 굽기
    interactions.add({
      id: 'visitors_bake_bread',
      pos: () => POS_HEARTH_BREAD,
      height: 1.2,
      r: 2.4,
      label: () => (breadBaked ? '따뜻하게 구워진 떡 확인하기' : '장막 화덕에서 고운 가루 세 스아로 떡 굽기'),
      act: () => {
        if (!feetWashed) {
          hud.toast('wash-first', null, '먼저 우물에서 물을 길어 손님들의 발을 씻기십시오.');
          return;
        }
        if (breadBaked) return;
        breadBaked = true;
        audio.playSfx('meal_prepare');
        particles.emit('fire_ember', -3, 1.2, 3, 20);
        const cov = ctx.getPick ? ctx.getPick('sarah_tent') : undefined;
        hud.toast('bake-bread', null, cov === '할례 언약' ? "할례 언약으로 새 이름을 얻은 지 얼마 되지 않은 아브라함은 사라와 함께 고운 가루 세 스아로 갓 구운 따뜻한 떡을 준비했습니다." : cov === '이삭의 웃음' ? "이삭의 웃음 약속이 아직 귓가에 맴도는 가운데, 아브라함은 사라와 함께 고운 가루 세 스아로 갓 구운 따뜻한 떡을 준비했습니다." : cov === '이스마엘을 위한 간구' ? '이스마엘을 위해 간구하던 마음을 안고, 아브라함은 사라와 함께 고운 가루 세 스아로 갓 구운 따뜻한 떡을 준비했습니다.' : '사라와 함께 고운 가루 세 스아로 갓 구운 따뜻한 떡을 준비했습니다.');
        updateMamreGoal();
      },
    });

    // 3단계: 살진 송아지 오찬 대접
    interactions.add({
      id: 'dining_table',
      pos: () => POS_DINING_TABLE,
      height: 1.2,
      r: 2.5,
      label: () => (feastServed ? '세 손님과의 약속 묵상하기' : '세 나그네에게 살진 송아지 오찬 대접하기'),
      act: () => {
        if (!breadBaked) {
          hud.toast('bread-first', null, '먼저 화덕에서 따뜻한 떡을 구워와야 합니다.');
          return;
        }
        if (feastServed) return;
        feastServed = true;
        audio.playSfx('feast_gathering');
        particles.emit('glory_sparkles', 1.5, 1.2, 0, 30);
        hud.unlockCodex('three_visitors');
        cutscene.play(createThreeVisitorsSteps(sceneCtx));
        updateMamreGoal();
      },
    });

    // 4단계: 의인 50명~10명 순차 중보 기도
    interactions.add({
      id: 'intercession_spot',
      pos: () => POS_INTERCESSION,
      height: 1.4,
      r: 2.8,
      label: () => (feastServed ? '소돔을 향한 중보 기도 드리기 (의인 10명)' : '오찬 대접 후 중보 기도로 나아가기'),
      act: () => {
        if (!feastServed) {
          hud.toast('serve-first', null, '먼저 세 나그네에게 오찬을 극진히 대접하십시오.');
          return;
        }

        audio.playVoiceBlip('abraham');

        // 순차 중보 기도: 1단계 50명
        hud.choice = {
          prompt: '소돔을 향한 중보 기도 (1단계: 의인 50명)',
          options: [
            { text: '의인 50명이 있으면 그 성을 용서하시겠습니까?' },
            { text: '의인을 악인과 함께 멸하심은 부당하나이다.' },
          ],
          selectedIndex: 0,
          onSelect: () => {
            hud.choice = null;
            audio.playSfx('fx_divine_presence');
            hud.toast('intercede-50', null, '여호와: “소돔에서 의인 50명을 찾으면 온 지역을 용서하리라.”');

            // 2단계 40명~30명
            after(() => {
              hud.choice = {
                prompt: '소돔을 향한 중보 기도 (2단계: 의인 40명~30명)',
                options: [
                  { text: '티끌 같은 내가 감히 주께 아뢰나이다. 40명이면 어찌하시겠습니까?' },
                  { text: '거기서 30명을 찾으시면 어찌하시겠습니까?' },
                ],
                selectedIndex: 0,
                onSelect: () => {
                  hud.choice = null;
                  audio.playSfx('fx_divine_presence');
                  hud.toast('intercede-30', null, '여호와: “40명으로 말미암아도, 30명을 찾아도 멸하지 아니하리라.”');

                  // 3단계 20명~10명
                  after(() => {
                    hud.choice = {
                      prompt: '소돔을 향한 중보 기도 (3단계: 의인 20명~10명)',
                      options: [
                        { text: '주여 노하지 마옵소서. 이번 한 번만 더... 10명이면 어찌하시겠습니까?' },
                        { text: '의인 10명으로 말미암아 소돔을 구원하소서.' },
                      ],
                      selectedIndex: 0,
                      onSelect: () => {
                        hud.choice = null;
                        audio.playSfx('fx_test_release');
                        hud.unlockCodex('ten_righteous');
                        hud.toast('intercede-10', null, '여호와: “내가 10명으로 말미암아도 멸하지 아니하리라.”');
                        cutscene.play(createIntercessionSteps(sceneCtx), () => onBook4Complete());
                      },
                    };
                  }, 1200);
                },
              };
            }, 1200);
          },
        };
      },
    });
  }

  // ── 2. 소돔 성문 및 거리 (롯 시점) ──
  if (stageId === 'sodom') {
    let defendedDoor = false;
    let familyWarned = false;
    let escapedGate = false;

    const updateSodomGoal = () => {
      hud.goalCategory = '제4권 · 소돔 탈출';
      if (!defendedDoor) {
        hud.goal = '가옥 문 앞 폭도들 막아서기 (0/1)';
        hud.goalProgress = { current: 0, total: 4, label: '0/4' };
        hud.hint = '남서쪽 롯의 가옥 문 앞으로 다가가자';
      } else if (!familyWarned) {
        hud.goal = '안뜰에서 가족과 사위들에게 대피 경고하기 (0/1)';
        hud.goalProgress = { current: 1, total: 4, label: '1/4' };
        hud.hint = '가옥 안뜰로 들어가 가족들에게 위험을 알리자';
      } else if (!escapedGate) {
        hud.goal = '천사의 손에 이끌려 성문 밖으로 급히 대피하기 (0/1)';
        hud.goalProgress = { current: 2, total: 4, label: '2/4' };
        hud.hint = '북쪽 소돔 거대 성문 아치 통로로 달려가자';
      } else {
        hud.goal = '소알을 향해 언덕길 탈출하기 (돌아보지 말라!) (3/4)';
        hud.goalProgress = { current: 3, total: 4, label: '3/4' };
        hud.hint = '남동쪽 언덕 바위 소금 기둥 탈출로로 향하자';
      }
    };

    updateSodomGoal();

    // 1단계: 롯의 가옥 문 막아서기
    interactions.add({
      id: 'lot_door',
      pos: () => POS_LOT_DOOR,
      height: 1.2,
      r: 2.5,
      label: () => (defendedDoor ? '폭도들이 눈이 멀어 문을 찾지 못함' : '가옥 문 앞 폭도들 막아서기'),
      act: () => {
        if (defendedDoor) return;
        defendedDoor = true;
        audio.playSfx('door_pounding');
        particles.emit('glory_sparkles', -3.4, 1.5, 2, 25);
        hud.toast('blind-mob', null, '천사들이 손을 내밀어 롯을 들이고 문밖의 폭도들을 눈멀게 하였습니다!');
        cutscene.play(createSodomRiotSteps(sceneCtx));
        updateSodomGoal();
      },
    });

    // 2단계: 안뜰에서 가족들에게 경고하기
    interactions.add({
      id: 'lot_courtyard_warn',
      pos: () => POS_LOT_COURTYARD,
      height: 1.2,
      r: 2.4,
      label: () => (familyWarned ? '사위들이 농담으로 여김' : '가족과 사위들에게 속히 떠나라 경고하기'),
      act: () => {
        if (!defendedDoor) {
          hud.toast('door-first', null, '먼저 문밖의 폭도들을 막아야 합니다.');
          return;
        }
        if (familyWarned) return;
        familyWarned = true;
        audio.playVoiceBlip('lot');
        hud.toast('lot-warn', null, '“일어나 이곳을 떠나라! 여호와께서 이 성을 멸하실 것이다!” 사위들은 농담으로 여겼습니다.');
        updateSodomGoal();
      },
    });

    // 3단계: 성문 탈출로 천사 인도
    interactions.add({
      id: 'sodom_city_gate',
      pos: () => POS_SODOM_GATE,
      height: 1.4,
      r: 3.0,
      label: () => (escapedGate ? '천사의 인도로 성문 통과함' : '천사의 손을 잡고 성문 밖으로 대피하기'),
      act: () => {
        if (!familyWarned) {
          hud.toast('warn-first', null, '먼저 가족들에게 성의 멸망을 경고해야 합니다.');
          return;
        }
        if (escapedGate) return;
        escapedGate = true;
        audio.playSfx('fx_angel_warning');
        particles.emit('fire_ember', 0, 2.0, -10, 30);
        hud.toast('angels-lead', null, '천사들이 롯과 가족의 손을 잡고 성 밖으로 이끌어 내었습니다!');
        updateSodomGoal();
      },
    });

    // 4단계: 소금 기둥 탈출로
    interactions.add({
      id: 'salt_pillar_escape',
      pos: () => POS_SALT_PILLAR_ESCAPE,
      height: 1.6,
      r: 3.0,
      label: () => (escapedGate ? '소알을 향해 언덕길 탈출하기' : '성문 밖으로 나온 뒤 탈출하기'),
      act: () => {
        if (!escapedGate) {
          hud.toast('gate-first', null, '먼저 천사의 인도로 성문 밖으로 피해야 합니다.');
          return;
        }
        audio.playSfx('brimstone_fall');
        particles.emit('fire_ember', 8, 2.5, 7, 30);
        hud.unlockCodex('sodom_escape');
        hud.unlockCodex('pillar_of_salt');
        cutscene.play(createSodomEscapeSteps(sceneCtx), () => {
          cutscene.play(createAbrahamsDawnSteps(sceneCtx), () => {
            onBook4Complete();
          });
        });
      },
    });
  }
}

/**
 * 4권 장면별 액션을 건다. 직접 쓴 장면이 없는 장(src/data/staging.json)은 들어올 때 연출 장면을 먼저 재생한다.
 * (장 번호는 wireChapterActions 가 chapterIndex 로 명시해서 넘긴다)
 */
export function setupBook4Actions(ctx: Book4ActionContext): void {
  const chapter = ctx.chapterIndex;
  const stageId = ctx.stageId;
  setupBook4ActionsCore(ctx);
  playChapterStaging(ctx.sceneCtx, ctx.cutscene, 4, chapter, stageId, ctx.getPick);
}
