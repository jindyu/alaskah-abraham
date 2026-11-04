import type { Interactions, Interactable } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';
import type { Cutscene } from '../cutscene/cutscene';
import {
  createBook1IntroSteps,
  createNightCallingSteps,
  createFurnaceMiracleSteps,
  createHaranSteps,
  type SceneContext,
} from '../scenes/book1/book1Scenes';
import type { Actor } from '../../entities/actor';
import type { Beam } from '../../entities/beam';
import type { UrStage } from '../../world/stages/ur';

export interface Book1ActionContext {
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  particles: ParticleManager;
  cutscene: Cutscene;
  sceneCtx: SceneContext;
  urStage: UrStage;
  onBook1Complete: () => void;
}

export function setupBook1Actions(ctx: Book1ActionContext): void {
  const { interactions, hud, audio, particles, cutscene, sceneCtx, urStage, onBook1Complete } = ctx;
  interactions.clear();

  // 상태 플래그
  let examinedIdols = 0;
  let talkedToFamily = 0;
  let hasAxe = false;
  let smashedIdols = 0;
  let placedAxeOnBigIdol = false;
  let furnaceTriggered = false;

  const WX = 0, WZ = -7;

  // 대화 시 NPC와 아브람이 서로를 정면으로 바라봄 ("대화를 하면 캐릭터 쪽으로 돌아보기")
  const faceEachOther = (actorId: string, emote?: '!' | '?' | '...' | 'heart' | 'anger' | 'sweat') => {
    const actor = urStage.actors.find((a) => a.id === actorId);
    const p = sceneCtx.player;
    if (actor) {
      // 1) NPC가 아브람(주인공) 쪽으로 돌아봄!
      actor.face({ x: p.root.position.x, z: p.root.position.z });
      if (emote) actor.showBubble(emote, 2.5);
    }
    // 2) 아브람(주인공)도 NPC 쪽으로 돌아봄!
    if (actor && 'faceTo' in p) {
      p.faceTo(actor.root.position.x, actor.root.position.z);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. 공방 및 시가지 NPC들 (데라, 롯, 사래, 시장 상인)
  // ─────────────────────────────────────────────────────────────
  // 아버지 데라 (공방 앞마당)
  interactions.add({
    id: 'npc_terah',
    pos: () => ({ x: -2.5, z: 0.8 }),
    height: 1.2,
    r: 1.8,
    label: () => (placedAxeOnBigIdol ? '데라와 담판 짓기' : '아버지 데라와 대화'),
    act: () => {
      if (placedAxeOnBigIdol) {
        faceEachOther('terah', 'anger');
        audio.playSfx('ui_confirm');
        hud.toast('terah', null, '데라: "네 놈이 나를 놀리느냐! 우상이 어떻게 움직이며 어떻게 도끼를 든단 말이냐!"');
        setTimeout(() => {
          hud.toast('abram', null, '아브람: "그런데 어찌 스스로 움직이지도, 말하지도 못하는 것을 신이라 부르며 절하십니까?"');
          hud.goal = '성문 회랑(동쪽)을 통해 니므롯 왕의 궁정으로 가자';
        }, 1800);
        return;
      }

      talkedToFamily++;
      faceEachOther('terah', '...');
      audio.playSfx('ui_confirm');
      hud.toast('terah', null, '데라: "아들아, 오늘은 저 큰 우상 곁에 세울 작은 신상들을 손질하거라."');
      checkIntroProgress();
    },
  });

  // 조카 어린 롯 (우물가 쉼터)
  interactions.add({
    id: 'npc_lot',
    pos: () => ({ x: -8.5, z: 3.5 }),
    height: 1.0,
    r: 1.8,
    label: () => '조카 롯과 대화',
    act: () => {
      talkedToFamily++;
      faceEachOther('lot', '!');
      audio.playSfx('ui_confirm');
      hud.toast('lot', null, '롯: "삼촌! 성문 밖 낙타 대상들이 싣고 온 신기한 물건들을 보셨어요?"');
      checkIntroProgress();
    },
  });

  // 아내 사래 (동쪽 안채 앞마당)
  interactions.add({
    id: 'npc_sarai',
    pos: () => ({ x: 12.0, z: -1.5 }),
    height: 1.1,
    r: 1.8,
    label: () => '사래와 대화',
    act: () => {
      talkedToFamily++;
      faceEachOther('sarai', '...');
      audio.playSfx('ui_confirm');
      hud.toast('sarai', null, '사래: "아브람, 마을 사람들은 보지도 듣지도 못하는 우상이 복을 준다고 믿는 걸까요..."');
      checkIntroProgress();
    },
  });

  // 수메르 장터 상인
  interactions.add({
    id: 'npc_merchant',
    pos: () => ({ x: 4.0, z: 7.8 }),
    height: 1.1,
    r: 1.8,
    label: () => '장터 상인과 대화',
    act: () => {
      faceEachOther('merchant', '!');
      audio.playSfx('ui_confirm');
      hud.toast('merchant', null, '상인: "티그리스와 유프라테스의 단 대추야자와 석류가 방금 들어왔소!"');
    },
  });

  function checkIntroProgress() {
    if (examinedIdols >= 3 && talkedToFamily >= 2) {
      hud.goal = '공방 서쪽 계단으로 올라가 옥상 테라스에서 밤하늘을 올려다보자';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. 우상 조사 및 옥상 부르심 이벤트 (Ch.2 & Ch.3)
  // ─────────────────────────────────────────────────────────────
  // 공방 작업대 위 작은 우상들 조사
  interactions.add({
    id: 'inspect_small_idols',
    pos: () => ({ x: WX - 3.5, z: WZ - 2.5 }),
    height: 1.0,
    r: 1.8,
    label: () => {
      if (hasAxe && smashedIdols < 3) return `도끼로 우상 내리치기 (${smashedIdols}/3)`;
      if (examinedIdols < 3) return `작은 우상들 살펴보기 (${examinedIdols}/3)`;
      return null;
    },
    act: () => {
      if (hasAxe && smashedIdols < 3) {
        // 도끼로 우상 타격 파괴!
        smashedIdols++;
        if ('playAction' in sceneCtx.player) {
          (sceneCtx.player as any).playAction();
        }
        audio.playSfx('idol_break_01');
        particles.emit('impact_dust', WX - 4.5 + smashedIdols * 1.0, 1.0, WZ - 2.5, 28);

        // 복셀 메쉬 제거
        if (urStage.idols.smallIdols[smashedIdols - 1]) {
          urStage.idols.smallIdols[smashedIdols - 1].visible = false;
        }

        hud.toast('smash', null, `도끼로 우상을 내리쳐 산산조각 내었다! (${smashedIdols}/3)`);

        if (smashedIdols >= 3) {
          hud.celebrate('우상 타격', '모든 작은 우상들을 부수었다!');
          hud.goal = '가장 큰 중앙 우상의 손에 도끼를 쥐여주자';
        }
        return;
      }

      if (examinedIdols < 3) {
        examinedIdols++;
        audio.playSfx('ui_confirm');
        const comments = [
          '말도 못 하고 숨도 쉬지 못하는 나무 조각상이다.',
          '눈이 있어도 보지 못하고 귀가 있어도 듣지 못하는 청동 형상이다.',
          '스스로 서지도 못하는 흙과 돌덩이일 뿐이다.',
        ];
        hud.toast('idol', null, `우상을 살펴보았다 (${examinedIdols}/3) — ${comments[examinedIdols - 1]}`);
        checkIntroProgress();
      }
    },
  });

  // 공방 옥상 테라스 (밤하늘 부르심 이벤트)
  interactions.add({
    id: 'rooftop_stars',
    pos: () => ({ x: WX, z: WZ }),
    height: 3.8,
    r: 2.2,
    label: () => (examinedIdols >= 3 && !hasAxe && smashedIdols === 0 ? '옥상에서 밤하늘 별 올려다보기' : null),
    act: () => {
      audio.playSfx('ui_confirm');
      cutscene.play(createNightCallingSteps(sceneCtx), () => {
        hud.goal = '공방 작업대로 들어가 도끼를 챙기자';
      }, 'night_calling');
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 3. 도끼 챙기기 & 큰 우상 손에 도끼 꽂기 (Ch.4)
  // ─────────────────────────────────────────────────────────────
  // 도끼 거치대
  interactions.add({
    id: 'axe_rack',
    pos: () => ({ x: WX + 2.2, z: WZ - 1.2 }),
    height: 1.0,
    r: 1.6,
    label: () => (!hasAxe && examinedIdols >= 3 ? '작업대에서 청동 도끼 집어 들기' : null),
    act: () => {
      hasAxe = true;
      audio.playSfx('axe_pickup');
      if ('setHeld' in sceneCtx.player) {
        (sceneCtx.player as any).setHeld('axe');
      }
      particles.emit('glory_sparkles', WX + 2.2, 1.0, WZ - 1.2, 16);
      hud.toast('axe', null, '작업대에서 묵직한 청동 도끼를 쥐었다!');
      hud.goal = '도끼로 작은 우상 3개를 차례로 내리쳐 부수자 (0/3)';
    },
  });

  // 큰 우상 (중앙 거대 신상)
  interactions.add({
    id: 'big_idol_pedestal',
    pos: () => ({ x: WX, z: WZ - 2.2 }),
    height: 2.2,
    r: 2.2,
    label: () => {
      if (smashedIdols >= 3 && !placedAxeOnBigIdol) return '큰 우상 손에 도끼 쥐여주기';
      return null;
    },
    act: () => {
      placedAxeOnBigIdol = true;
      audio.playSfx('ui_confirm');
      if ('setHeld' in sceneCtx.player) {
        (sceneCtx.player as any).setHeld(null);
      }
      particles.emit('glory_sparkles', WX, 1.8, WZ - 2.2, 24);

      // 큰 우상 손에 도끼 장착
      if (urStage.idols.axeMesh) {
        urStage.idols.axeMesh.visible = true;
      }

      hud.celebrate('미드라시 퍼즐 완성', '가장 큰 우상의 손에 도끼를 쥐여주었다!');
      hud.toast('abram', null, '아브람: "저 큰 우상이 음식을 두고 다투다 작은 것들을 다 부순 것처럼 보이겠군!"');
      hud.goal = '공방 앞마당으로 나가 아버지 데라와 대면하자';
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 성문 회랑 & 니므롯 왕궁·풀무불·하란 이동 (Ch.5 ~ Ch.7)
  // ─────────────────────────────────────────────────────────────
  interactions.add({
    id: 'city_gate_exit',
    pos: () => ({ x: 22.0, z: 3.5 }),
    height: 1.5,
    r: 2.5,
    label: () => {
      if (!placedAxeOnBigIdol) return '우르 동쪽 성문 (바깥으로 통하는 길)';
      if (!furnaceTriggered) return '성문을 지나 니므롯 왕궁으로 나아가기';
      return '데라, 사래, 롯과 함께 하란으로 출발하기';
    },
    act: () => {
      if (!placedAxeOnBigIdol) {
        hud.toast('gate', null, '아직 공방에서 해야 할 일이 남아있다');
        return;
      }

      if (!furnaceTriggered) {
        furnaceTriggered = true;
        audio.playSfx('ui_confirm');
        // 풀무불 기적 클라이맥스 연출
        cutscene.play(createFurnaceMiracleSteps(sceneCtx), () => {
          hud.celebrate('풀무불의 승리', '불길 속에서 살아나온 아브람!');
        }, 'furnace_miracle');
        return;
      }

      // 하란 이동 및 데라 임종
      audio.playSfx('ui_confirm');
      cutscene.play(createHaranSteps(sceneCtx), () => {
        hud.celebrate('제1권 완주', '믿음의 조상 아브람의 첫 발걸음!');
        onBook1Complete();
      }, 'haran_journey');
    },
  });
}
