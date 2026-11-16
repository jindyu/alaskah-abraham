import type { GetPick, SetPick, GetTrait } from './pickTypes';
import { traitFromGetPick } from '../../game/storyFlags';
import { createBook6EpilogueSteps, epilogueSubOf } from './consequenceScenes';
import { addBeatLoop } from './beatLoop';
import type { Interactions } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';
import type { Cutscene } from '../cutscene/cutscene';
import type { SceneContext } from '../scenes/book1/book1Scenes';
import { playChapterStaging } from '../scenes/staging/chapterStaging';
import {
  createSarahMourningSteps,
  createEphronBargainSteps,
  createEliezerOathSteps,
  createRebekahWellSteps,
  createTwilightMeetingSteps,
  createAbrahamPassingSteps,
} from '../scenes/book6/book6Scenes';

export interface Book6ActionContext {
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
  /** 지금까지 한 선택에서 가장 많은 성향 (없으면 null) — 아브라함의 마지막 장면의 끝 문장이 달라진다 */
  getTrait?: GetTrait;
  onBook6Complete: () => void;
  onSwitchStage?: (stageId: string) => void;
}

// Module-level position buffers (zero per-frame allocations)
const POS_MACHPELAH_TOMB = { x: 8, z: -6.5 };
const POS_EPHRON_SCALE = { x: -5.5, z: 6.5 };
const POS_JOURNEY_NAHOR = { x: -12, z: 4 };
const POS_ABRAHAM_REST = { x: 8, z: -4 };

const POS_NAHOR_WELL = { x: 0, z: 0 };
const POS_TROUGH_LEFT = { x: -4, z: 0 };
const POS_TROUGH_RIGHT = { x: 4, z: 0 };
const POS_TWILIGHT_RETURN = { x: 8, z: 8 };

const LEGACY_LINE: Record<'courage' | 'trust' | 'care', string> = {
  courage: '그는 두려움 앞에서도 먼저 입을 열던 사람으로 기억되었다.',
  trust: '그는 알지 못하는 길을 하나님께 맡기고 걷던 사람으로 기억되었다.',
  care: '그는 곁에 있는 사람들의 마음을 먼저 살피던 사람으로 기억되었다.',
};

function setupBook6ActionsCore(ctx: Book6ActionContext): void {
  const { interactions, hud, audio, particles, cutscene, sceneCtx, stageId, onBook6Complete, onSwitchStage } = ctx;
  interactions.clear();

  // 직접 쓴 상호작용이 없던 장: 단계형 짧은 루프 (3장)
  if (ctx.chapterIndex === 2 && stageId === "beersheba") {
    addBeatLoop({
      interactions, hud, audio, goalTitle: "어머니를 그리워하는 이삭의 저녁 묵상을 지켜보자",
      beats: [
      { id: "isaac_field", x: -4, z: 3, label: "들에서 묵상하는 이삭에게 다가가기", toast: "이삭이 저물녘 들에 나가 묵상하다가 고개를 들어 멀리서 오는 낙타들을 본다.", goalItem: "들에서 묵상하는 이삭에게 다가가기", voice: "isaac", choice: { prompt: "들에서 묵상하는 이삭에게 아브라함은 어떻게 다가갈까?", options: [{ text: "말없이 곁에 나란히 앉는다", reply: "아브라함은 아무 말 없이 아들 곁에 앉았다. 침묵이 위로가 되었다.", ok: true, tag: "곁에 앉음" }, { text: "사라의 이야기를 먼저 꺼낸다", reply: "아브라함은 사라가 이삭을 웃으며 안아 주던 날을 이야기했다. 이삭의 어깨가 조금 풀렸다.", ok: true, tag: "사라 이야기" }] } },
      { id: "isaac_camels", x: 6, z: 0, label: "멀리서 오는 낙타 행렬 바라보기", toast: "이삭이 눈을 들어 보니 낙타들이 오고 있었다. 리브가도 눈을 들어 이삭을 보고 낙타에서 내렸다.", goalItem: "멀리서 오는 낙타 행렬 바라보기", voice: "isaac" },
      { id: "isaac_ram", x: 4, z: -4, label: "모리아에서 돌아온 날의 이삭을 떠올리기", toast: "아브라함은 모리아 산길에서 “하나님이 친히 준비하시리라” 하던 자신의 대답을 떠올렸다. 이삭이 들에서 묵상하는 까닭이 그날의 침묵과 이어져 있음을 알았다.", goalItem: "모리아의 날 떠올리기", voice: "abraham", when: (pick) => pick("satan_elder") !== undefined },
      { id: "isaac_tent", x: -6, z: -4, label: "사라의 빈 장막 바라보기", toast: "전해 오는 이야기에 따르면, 사라가 살아 있을 때는 장막 문에 등불이 꺼지지 않았고 반죽이 부풀었고 구름이 장막을 덮었다고 한다.", goalItem: "사라의 빈 장막 바라보기" },
      { id: "isaac_well", x: 0, z: 0, label: "브엘라해로이 우물가에 앉기", toast: "이삭은 브엘라해로이 우물가에 앉아 어머니를 생각한다. 위로가 올 날이 멀지 않다.", goalItem: "우물가에서 어머니를 그리기", voice: "isaac" },
      ],
      finishLabel: "저녁 묵상을 마치고 다음 이야기로 가기", finishX: -2, finishZ: -8,
      onComplete: ctx.onBook6Complete,
      getPick: ctx.getPick, setPick: ctx.setPick,
    });
    return;
  }

  // 직접 쓴 상호작용이 없던 장: 단계형 짧은 루프 (4장)
  if (ctx.chapterIndex === 3 && stageId === "beersheba") {
    addBeatLoop({
      interactions, hud, audio, goalTitle: "늙은 종 엘리에셀에게 이삭의 신부를 구해 오도록 맹세시키자",
      beats: [
      { id: "oath_call", x: -2, z: -8, label: "종 엘리에셀을 장막으로 부르기", toast: (pick) => { const t = pick("isaac_field"); if (t === "곁에 앉음") return "아들 곁에 말없이 앉았던 저녁을 마음에 담은 채, 아브라함이 모든 소유를 맡은 늙은 종 엘리에셀을 불러 “내 허벅지 밑에 손을 넣으라” 한다."; if (t === "사라 이야기") return "사라의 이야기로 풀렸던 아들의 얼굴을 떠올리며, 아브라함이 모든 소유를 맡은 늙은 종 엘리에셀을 불러 “내 허벅지 밑에 손을 넣으라” 한다."; return "아브라함이 모든 소유를 맡은 늙은 종 엘리에셀을 불러 “내 허벅지 밑에 손을 넣으라” 한다."; }, goalItem: "종 엘리에셀 부르기", voice: "abraham" },
      { id: "oath_silence", x: -4, z: -8, label: "이삭과 앉았던 저녁을 떠올리기", toast: "아브라함은 아들 곁에 말없이 앉았던 저녁을 떠올렸다. 그 아이에게는 곁에 있어 줄 사람이 필요하다.", goalItem: "아들과 앉았던 저녁 떠올리기", voice: "abraham", when: (pick) => pick("isaac_field") === "곁에 앉음" },
      { id: "oath_sarah", x: 4, z: -8, label: "사라의 웃음을 떠올리기", toast: "아브라함은 사라가 이삭을 안고 웃던 날을 떠올렸다. 그 웃음을 이어 줄 사람이 이삭에게 필요하다.", goalItem: "사라의 웃음 떠올리기", voice: "abraham", when: (pick) => pick("isaac_field") === "사라 이야기" },
      { id: "oath_ishmael", x: 6, z: 0, label: "이스마엘에게 장례 때 올 것을 전하게 하기", toast: "활을 가르쳐 준 아들 이스마엘에게도 소식이 닿도록, 아브라함은 종 하나를 광야로 보내라 일렀다. 훗날 두 아들이 함께 장례에 서게 되는 길이 이렇게 열린다.", goalItem: "이스마엘에게 소식 전하게 하기", voice: "abraham", when: (pick) => pick("archery_target") === "활을 가르침" },
      { id: "oath_swear", x: -4, z: 3, label: "하늘의 하나님 앞에 맹세시키기", toast: "아브라함: “너는 내 아들을 위하여 가나안 사람의 딸이 아니라 내 고향 내 족속에게서 아내를 택하라.”", goalItem: "고향 족속에서 아내를 찾도록 맹세시키기", voice: "abraham", choice: { prompt: "엘리에셀에게 어떤 맹세를 시킬까?", options: [{ text: "가까운 가나안 사람의 딸 중에서 고르게 한다", reply: "아브라함은 곧 고개를 저었다. 이삭의 아내는 가나안 사람의 딸이 아니라 고향 족속 가운데서 택해야 한다.", ok: false }, { text: "내 고향 내 족속에게서 아내를 택하게 한다", reply: "엘리에셀은 주인의 허벅지 밑에 손을 넣고 맹세했다.", ok: true }] } },
      { id: "oath_blessing", x: -8, z: -8, label: "“사자를 앞서 보내시리라” 약속 듣기", toast: "아브라함: “하늘의 하나님이 그의 사자를 네 앞서 보내어 네가 거기서 내 아들의 아내를 택하게 하시리라.”", goalItem: "사자를 앞서 보내실 약속 듣기", voice: "abraham" },
      { id: "oath_camels", x: 0, z: 0, label: "열 마리 낙타에 예물 싣기", toast: "엘리에셀은 주인의 낙타 열 마리에 온갖 좋은 예물을 싣고 나홀의 성을 향해 떠날 채비를 한다.", goalItem: "낙타 열 마리에 예물 싣기" },
      ],
      finishLabel: "길을 떠나는 종을 배웅하고 다음 이야기로 가기", finishX: 10, finishZ: -10,
      onComplete: ctx.onBook6Complete,
      getPick: ctx.getPick, setPick: ctx.setPick,
    });
    return;
  }

  // 직접 쓴 상호작용이 없던 장: 단계형 짧은 루프 (6장)
  if (ctx.chapterIndex === 5 && stageId === "beersheba") {
    addBeatLoop({
      interactions, hud, audio, goalTitle: "소유를 정리하고 황혼을 맞이하자",
      beats: [
      { id: "dusk_keturah", x: -6, z: -4, label: "그두라와 여섯 아들 만나기", toast: "아브라함은 후처 그두라에게서 낳은 아들들에게도 선물을 주고 이삭에게서 떨어진 동쪽 땅으로 보낸다.", goalItem: "그두라의 아들들 만나기", voice: "abraham" },
      { id: "dusk_isaac", x: 0, z: 0, label: "모든 소유를 이삭에게 넘기기", toast: "성경: “아브라함이 이삭에게 모든 소유를 주었다.”", goalItem: "이삭에게 모든 소유 넘기기", voice: "abraham" },
      { id: "dusk_ishmael", x: -4, z: 3, label: "이스마엘의 몫을 따로 떼어 두기", toast: "아브라함은 이스마엘에게도 선물을 따로 떼어 두었다. 활을 가르쳐 주던 날의 소년은 이제 광야의 주인으로 자라 있다.", goalItem: "이스마엘의 몫 떼어 두기", voice: "abraham", when: (pick) => pick("archery_target") === "활을 가르침" },
      { id: "dusk_lot", x: 6, z: 0, label: "소알의 롯에게 보낼 안부 남기기", toast: "롯을 염려하던 마음은 마지막까지 이어졌다. 아브라함은 소알의 조카에게도 안부와 축복을 전하게 했다.", goalItem: "롯에게 안부 남기기", voice: "abraham", when: (pick) => pick("war_envoy") === "롯을 염려함" },
      { id: "dusk_bless", x: 0, z: -8, label: "모든 이를 축복하며 당부 남기기", toast: "전해 오는 이야기에 따르면, 아브라함은 가족과 종들의 이름을 하나하나 불러 축복하고 이삭에게 하나님의 길을 지키라 당부했다고 한다.", goalItem: "모든 이를 축복하며 당부하기", voice: "abraham" },
      { id: "dusk_sunset", x: -2, z: -8, label: "황혼 속에 서서 지난 날을 돌아보기", toast: "백칠십오 세의 아브라함이 노을 앞에 서서 우르에서 여기까지 걸어온 길을 돌아본다.", goalItem: "황혼을 바라보며 돌아보기", voice: "abraham" },
      ],
      finishLabel: "황혼의 길을 따라 다음 이야기로 가기", finishX: 10, finishZ: -10,
      onComplete: ctx.onBook6Complete,
      getPick: ctx.getPick, setPick: ctx.setPick,
    });
    return;
  }


  // ── 1. 헤브론 막벨라 굴 (사라 별세 & 매입 & 안식) ──
  if (stageId === 'hebron_machpelah') {
    let mournedSarah = false;
    let paidSilver = false;
    let dispatchedEliezer = false;

    const updateHebronGoal = () => {
      hud.goalCategory = '제6권 · 막벨라와 안식';
      if (!mournedSarah) {
        hud.goal = '사라의 별세를 애도하고 매장지 구하기 (0/1)';
        hud.goalProgress = { current: 0, total: 4, label: '0/4' };
        hud.hint = '동북쪽 막벨라 동굴 앞 사라의 석관으로 가자';
      } else if (!paidSilver) {
        hud.goal = '에브론에게 은 400세겔을 달아주고 막벨라 굴 매입하기 (0/1)';
        hud.goalProgress = { current: 1, total: 4, label: '1/4' };
        hud.hint = '서남쪽 성문 앞 에브론의 계량 탁자로 가자';
      } else if (!dispatchedEliezer) {
        hud.goal = '엘리에셀에게 맹세시키고 나홀 성으로 파견하기 (0/1)';
        hud.goalProgress = { current: 2, total: 4, label: '2/4' };
        hud.hint = '서쪽 성문 길목의 엘리에셀에게 다가가자';
      } else {
        hud.goal = '175세의 평안한 안식과 마지막 유업 받기 (3/4)';
        hud.goalProgress = { current: 3, total: 4, label: '3/4' };
        hud.hint = '사라 곁의 안식처로 나아가 평안한 잠에 들자';
      }
    };

    updateHebronGoal();

    // 1단계: 사라의 묘실 석관 애도
    interactions.add({
      id: 'machpelah_tomb',
      pos: () => POS_MACHPELAH_TOMB,
      height: 1.2,
      r: 2.8,
      label: () => (mournedSarah ? '사라와의 평생 믿음의 동행 묵상하기' : '사라의 별세를 애도하고 눈물 흘리기'),
      act: () => {
        if (mournedSarah) return;
        mournedSarah = true;
        audio.playSfx('ui_confirm');
        particles.emit('glory_sparkles', 8, 1.5, -6.5, 25);
        hud.unlockCodex('sarah_death');
        cutscene.play(createSarahMourningSteps(sceneCtx));
        updateHebronGoal();
      },
    });

    // 2단계: 에브론 계량 탁자 (은 400세겔 달아주기)
    interactions.add({
      id: 'ephron_scale',
      pos: () => POS_EPHRON_SCALE,
      height: 1.2,
      r: 2.6,
      label: () => (paidSilver ? '에브론과의 정당한 매매 증서 확인하기' : '에브론에게 은 400세겔을 달아주고 막벨라 굴 매입하기'),
      act: () => {
        if (!mournedSarah) {
          hud.toast('mourn-first', null, '먼저 사라의 묘실 앞에서 애도를 표하십시오.');
          return;
        }
        if (paidSilver) return;

        hud.choice = {
          prompt: '헷 족속 에브론과의 매매 협상',
          options: [
            { text: '상인의 통용 은 400세겔을 정확히 달아주어 영구 소유로 삼는다.' },
            { text: '은혜를 갚는 마음으로 둘레의 모든 나무와 밭까지 정식 매입한다.' },
          ],
          selectedIndex: 0,
          onSelect: () => {
            hud.choice = null;
            paidSilver = true;
            audio.playSfx('silver_weigh');
            particles.emit('glory_sparkles', -5.5, 1.2, 6.5, 30);
            hud.unlockCodex('machpelah_purchase');
            cutscene.play(createEphronBargainSteps(sceneCtx), () => {
              hud.toast('machpelah-bought', null, '상인의 통용 은 400세겔로 막벨라 굴과 밭을 영구 매입하였습니다.');
              updateHebronGoal();
            });
          },
        };
      },
    });

    // 3단계: 나홀의 성 파견 길목
    interactions.add({
      id: 'journey_to_nahor',
      pos: () => POS_JOURNEY_NAHOR,
      height: 1.4,
      r: 3.0,
      label: () => (paidSilver ? '엘리에셀에게 맹세시키고 나홀 성으로 파견하기' : '매장지를 확정한 후 종을 파견하기'),
      act: () => {
        if (!paidSilver) {
          hud.toast('silver-first', null, '먼저 막벨라 굴 매입을 정식으로 마쳐야 합니다.');
          return;
        }
        dispatchedEliezer = true;
        audio.playVoiceBlip('abraham');
        hud.unlockCodex('eliezer_oath');
        cutscene.play(createEliezerOathSteps(sceneCtx), () => {
          if (onSwitchStage) {
            onSwitchStage('nahor_well');
          }
        });
      },
    });

    // 4단계: 아브라함의 마지막 안식
    interactions.add({
      id: 'abraham_resting_place',
      pos: () => POS_ABRAHAM_REST,
      height: 1.4,
      r: 2.8,
      label: () => (paidSilver ? '175세의 평안한 안식과 마지막 유업 받기' : '모든 사명을 완수한 후 안식하기'),
      act: () => {
        if (!paidSilver) {
          hud.toast('task-first', null, '먼저 에브론과 막벨라 굴 매입 흥정을 마쳐야 합니다. 목표 패널의 표식이 가리키는 곳으로 가 보십시오.');
          return;
        }
        audio.playSfx('ending_resolve');
        particles.emit('glory_sparkles', 8, 2.5, -4, 50);
        hud.unlockCodex('abraham_death');
        // 한 선택의 성향에 따라 이 장면의 마지막 문장이 달라진다 (선택이 없으면 그대로)
        // 성향(3) × 이삭 곁의 저녁(3) = 9가지 대단원 변형 (선택이 없으면 기존 그대로)
        const trait = ctx.getTrait ? ctx.getTrait() : traitFromGetPick(ctx.getPick);
        const steps = createAbrahamPassingSteps(sceneCtx).slice();
        if (trait) {
          const finale = steps.pop(); // 마지막 'do'(완료 축하)는 변형 장면 뒤로 미룬다
          steps.push({ caption: LEGACY_LINE[trait], hold: 5 });
          const sub = epilogueSubOf(ctx.getPick ? ctx.getPick('isaac_field') : undefined);
          for (const s of createBook6EpilogueSteps(trait, sub, sceneCtx)) steps.push(s);
          if (finale) steps.push(finale);
        }
        cutscene.play(steps, () => {
          onBook6Complete();
        });
      },
    });
  }

  // ── 2. 메소포타미아 나홀의 성 우물가 (엘리에셀 & 리브가) ──
  if (stageId === 'nahor_well') {
    let prayedAtWell = false;
    let hasWater = false;
    let wateredLeft = false;
    let wateredRight = false;
    let camelsWatered = false;
    let gaveGifts = false;

    const updateNahorGoal = () => {
      hud.goalCategory = '제6권 · 나홀의 우물';
      if (!prayedAtWell) {
        hud.goal = '우물가에서 순적한 배필을 구하는 기도 드리기 (0/1)';
        hud.goalProgress = { current: 0, total: 4, label: '0/4' };
        hud.hint = '중앙 깊은 돌 우물가로 다가가 무릎을 꿇자';
      } else if (!camelsWatered) {
        const stepNum = (wateredLeft ? 1 : 0) + (wateredRight ? 1 : 0);
        hud.goal = hasWater
          ? '물동이를 들고 낙타들의 석조 물구유에 물 붓기'
          : `우물에서 물을 길어 낙타 물구유 채우기 (${stepNum}/2)`;
        hud.goalProgress = { current: 1, total: 4, label: '1/4' };
        hud.hint = hasWater ? '좌우 물구유로 다가가 물을 붓자' : '우물에서 두레박으로 물을 긷자';
      } else if (!gaveGifts) {
        hud.goal = '리브가에게 금 코걸이와 손목고리 선사하기 (0/1)';
        hud.goalProgress = { current: 2, total: 4, label: '2/4' };
        hud.hint = '우물가 리브가에게 다가가 감사 선물을 건네자';
      } else {
        hud.goal = '리브가와 함께 가나안 들판으로 귀환하기 (3/4)';
        hud.goalProgress = { current: 3, total: 4, label: '3/4' };
        hud.hint = '남동쪽 길목으로 나아가 황혼의 귀환길에 오르자';
      }
    };

    updateNahorGoal();

    // 1단계: 우물가 기도 & 물 긷기 & 장신구 선사 (우물 인터랙션)
    interactions.add({
      id: 'nahor_well_spot',
      pos: () => POS_NAHOR_WELL,
      height: 1.2,
      r: 2.8,
      label: () => {
        if (!prayedAtWell) return '우물가에서 순적한 배필을 구하는 기도 드리기';
        if (!camelsWatered) return hasWater ? '물동이에 물을 가득 담았음' : '두레박으로 시원한 우물물 긷기';
        if (!gaveGifts) return '리브가에게 금 코걸이와 손목고리 선사하기';
        return '기쁨으로 물을 마신 우물터 바라보기';
      },
      act: () => {
        // 기도하기
        if (!prayedAtWell) {
          prayedAtWell = true;
          audio.playSfx('fx_covenant_chime');
          particles.emit('glory_sparkles', 0, 1.2, 0, 25);
          hud.toast('eliezer-pray', null, '“내 주인 아브라함의 하나님 여호와여, 오늘 나에게 순적하게 만나게 하사 은혜를 베푸시옵소서.”');
          updateNahorGoal();
          return;
        }

        // 물 긷기
        if (!camelsWatered) {
          if (hasWater) {
            hud.toast('already-water', null, '이미 물동이에 물이 가득합니다. 석조 물구유에 부으십시오.');
            return;
          }
          hasWater = true;
          audio.playSfx('water_draw');
          particles.emit('glory_sparkles', 0, 1.0, 0, 20);
          hud.toast('draw-well', null, '우물에서 두레박으로 시원한 물을 가득 길어 올렸습니다.');
          updateNahorGoal();
          return;
        }

        // 금 장신구 선사
        if (!gaveGifts) {
          gaveGifts = true;
          audio.playSfx('foley_bracelet_gold');
          particles.emit('glory_sparkles', 0, 1.2, 0, 35);
          hud.unlockCodex('rebekah_well');
          cutscene.play(createRebekahWellSteps(sceneCtx));
          updateNahorGoal();
        }
      },
    });

    // 2단계 A: 왼쪽 석조 물구유 물 붓기
    interactions.add({
      id: 'nahor_trough_left',
      pos: () => POS_TROUGH_LEFT,
      height: 1.0,
      r: 2.4,
      label: () => {
        if (!prayedAtWell) return null;
        if (wateredLeft) return '왼쪽 물구유가 가득 차 있음';
        return hasWater ? '왼쪽 물구유에 물 붓기' : '우물에서 물을 먼저 길어오기';
      },
      act: () => {
        if (!hasWater) {
          hud.toast('need-water-left', null, '먼저 우물에서 물동이에 물을 길어와야 합니다.');
          return;
        }
        if (wateredLeft) return;
        wateredLeft = true;
        hasWater = false;
        audio.playSfx('water_pour');
        particles.emit('glory_sparkles', -4, 0.8, 0, 20);
        hud.toast('pour-left', null, '왼쪽 석조 물구유에 시원한 물을 채웠습니다.');
        if (wateredRight) {
          camelsWatered = true;
          hud.toast('rebekah-kindness', null, '리브가가 자청하여 물구유에 물을 부어 낙타 10필 모두를 배불리 마시웠습니다!');
        }
        updateNahorGoal();
      },
    });

    // 2단계 B: 오른쪽 석조 물구유 물 붓기
    interactions.add({
      id: 'nahor_trough_right',
      pos: () => POS_TROUGH_RIGHT,
      height: 1.0,
      r: 2.4,
      label: () => {
        if (!prayedAtWell) return null;
        if (wateredRight) return '오른쪽 물구유가 가득 차 있음';
        return hasWater ? '오른쪽 물구유에 물 붓기' : '우물에서 물을 먼저 길어오기';
      },
      act: () => {
        if (!hasWater) {
          hud.toast('need-water-right', null, '먼저 우물에서 물동이에 물을 길어와야 합니다.');
          return;
        }
        if (wateredRight) return;
        wateredRight = true;
        hasWater = false;
        audio.playSfx('water_pour');
        particles.emit('glory_sparkles', 4, 0.8, 0, 20);
        hud.toast('pour-right', null, '오른쪽 석조 물구유에 시원한 물을 채웠습니다.');
        if (wateredLeft) {
          camelsWatered = true;
          hud.toast('rebekah-kindness', null, '리브가가 자청하여 물구유에 물을 부어 낙타 10필 모두를 배불리 마시웠습니다!');
        }
        updateNahorGoal();
      },
    });

    // 4단계: 가나안 들판으로 귀환 길목
    interactions.add({
      id: 'twilight_return',
      pos: () => POS_TWILIGHT_RETURN,
      height: 1.4,
      r: 3.0,
      label: () => (gaveGifts ? '리브가와 함께 가나안 네게브 들판으로 향하기' : '선물을 전한 후 가나안으로 출발하기'),
      act: () => {
        if (!gaveGifts) {
          hud.toast('gifts-first', null, '먼저 리브가에게 감사의 금 장신구를 선사해야 합니다.');
          return;
        }
        audio.playSfx('betrothal_chime');
        cutscene.play(createTwilightMeetingSteps(sceneCtx), () => {
          if (onSwitchStage) {
            onSwitchStage('hebron_machpelah');
          }
        });
      },
    });
  }
}

/**
 * 6권 장면별 액션을 건다. 직접 쓴 장면이 없는 장(src/data/staging.json)은 들어올 때 연출 장면을 먼저 재생한다.
 * (장 번호는 wireChapterActions 가 chapterIndex 로 명시해서 넘긴다)
 */
export function setupBook6Actions(ctx: Book6ActionContext): void {
  const chapter = ctx.chapterIndex;
  const stageId = ctx.stageId;
  setupBook6ActionsCore(ctx);
  playChapterStaging(ctx.sceneCtx, ctx.cutscene, 6, chapter, stageId, ctx.getPick);
}
