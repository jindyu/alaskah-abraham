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
  createNimrodTrialSteps,
  createEsauLentilStewSteps,
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
  const talkedPeople = new Set<string>();
  let metOldCustomer = false;
  let hasFlourBowl = false;
  let placedFlourBowl = false;
  let hasAxe = false;
  let smashedIdols = 0;
  let placedAxeOnBigIdol = false;
  let furnaceTriggered = false;
  let confrontedTerah = false;

  const WX = 0, WZ = -7;

  /** 우상단 퀘스트 패널의 목표 텍스트와 진행상황 실시간 동기화 */
  const updateGoal = () => {
    hud.goalCategory = '제1권 · 갈대아 우르';

    // 1) 데라와 담판 후 -> 동쪽 성문 회랑 출구
    if (confrontedTerah) {
      hud.goal = '동쪽 성문 회랑으로 나아가기\n▪ 니므롯 왕의 궁정 소환에 응하기 (0/1)';
      hud.goalProgress = { current: 0, total: 1, label: '0/1' };
      hud.hint = '성문 회랑(동쪽)을 향해 걸어가자';
      return;
    }

    // 2) 큰 우상 손에 도끼 쥐여준 후 -> 아버지 데라와 대면
    if (placedAxeOnBigIdol) {
      hud.goal = '공방 앞마당 데라와 담판 짓기\n▪ 아버지 데라에게 우상의 헛됨 증명 (0/1)';
      hud.goalProgress = { current: 0, total: 1, label: '0/1' };
      hud.hint = '공방 앞마당으로 나가 데라와 대화하자';
      return;
    }

    // 3) 도끼 쥐고 우상 파괴 진행
    if (hasAxe || smashedIdols > 0) {
      if (smashedIdols >= 3) {
        hud.goal = '큰 우상의 손에 도끼 쥐여주기\n▪ 가장 큰 중앙 신상에 도끼 걸기 (0/1)';
        hud.goalProgress = { current: 1, total: 2, label: '1/2' };
        hud.hint = '미드라시: 우상들이 다툰 것처럼 꾸미자';
      } else {
        hud.goal = `우상의 헛됨 증명하기\n▪ 작은 우상들 내리쳐 부수기 (${smashedIdols}/3)`;
        hud.goalProgress = { current: smashedIdols, total: 3, label: `${smashedIdols}/3` };
        hud.hint = 'E키로 작은 우상들을 내리쳐 부수자';
      }
      return;
    }

    // 4) 제물 사발 배치 후 -> 도끼 챙기기
    if (placedFlourBowl) {
      hud.goal = '공방 작업대에서 도끼 챙기기\n▪ 청동 도끼 집어 들기 (0/1)';
      hud.goalProgress = { current: 0, total: 1, label: '0/1' };
      hud.hint = '작업대 앞 도끼 거치대 (! 표시)';
      return;
    }

    // 5) 제물 사발 들었을 때 -> 큰 우상 앞 배치
    if (hasFlourBowl) {
      hud.goal = '큰 우상 앞에 밀가루 사발 놓기\n▪ 중앙 거대 우상 발치에 제물 바치기 (0/1)';
      hud.goalProgress = { current: 0, total: 1, label: '0/1' };
      hud.hint = '중앙의 큰 우상 제단으로 다가가 E키를 누르자';
      return;
    }

    // 6) 식구 대화 및 우상 조사 완료 -> 옥상 별밤 부르심 유도
    const familyCount = talkedPeople.size;
    if (examinedIdols >= 3 && familyCount >= 2) {
      hud.goal = '공방 옥상 테라스로 올라가기\n▪ 서쪽 돌계단으로 옥상 이동 (0/1)\n▪ 테라스 돗자리에서 밤하늘 관측';
      hud.goalProgress = { current: 1, total: 2, label: '1/2' };
      hud.hint = '공방 서쪽 외벽 돌계단을 오르자';
      return;
    }

    // 7) 초기 우르 탐색: 식구들과 인사 + 우상 조사
    const subFamily = familyCount >= 2
      ? `✓ 식구들과 대화 완료 (${familyCount}/2)`
      : `▪ 식구들과 대화하기 (${familyCount}/2)`;
    const subIdol = examinedIdols >= 3
      ? `✓ 공방 작은 우상 관찰 (${examinedIdols}/3)`
      : `▪ 공방 작은 우상 살펴보기 (${examinedIdols}/3)`;

    const totalSteps = 2 + 3;
    const currentSteps = Math.min(2, familyCount) + examinedIdols;

    hud.goal = `우르 거리와 공방 둘러보기\n${subFamily}\n${subIdol}`;
    hud.goalProgress = { current: currentSteps, total: totalSteps, label: `${currentSteps}/${totalSteps}` };
    hud.hint = '거리의 식구들과 대화하고 공방 안 우상을 조사하자';
  };

  // 초기 퀘스트 상태 등록
  updateGoal();

  // 대화 시 NPC와 아브람이 서로를 정면으로 바라봄 ("대화를 하면 캐릭터 쪽으로 돌아보기")
  const faceEachOther = (actorId: string, emote?: '!' | '?' | '...' | 'heart' | 'anger' | 'sweat') => {
    const actor = urStage.actors.find((a) => a.id === actorId);
    const p = sceneCtx.player;
    if (actor) {
      actor.face({ x: p.root.position.x, z: p.root.position.z });
      if (emote) actor.showBubble(emote, 2.5);
    }
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
        hud.toast('terah', null, '데라: "아들아, 이게 대체 무슨 해괴한 짓이냐! 우상들이 다 깨져 나뒹굴고, 가장 큰 신상의 손에 도끼가 들려있지 않느냐!"');

        hud.showChoice(
          '아버지 데라에게 건넬 대답 (아브람의 선택)',
          [
            {
              badge: '미드라시 전승 풍자',
              badgeColor: '#b85422',
              text: '1. "제물을 두고 서로 다투더니, 큰 우상이 도끼로 작은 것들을 부쉈습니다!"',
            },
            {
              badge: '성경적 직언 선포',
              badgeColor: '#25588e',
              text: '2. "보지도 듣지도 못하는 우상은 헛된 거짓이며, 살아계신 하나님만이 참신이십니다!"',
            },
          ],
          (index: number) => {
            confrontedTerah = true;
            if (index === 0) {
              // Midrash Satire route
              hud.toast('abram', null, '아브람: "어떤 여인이 고운 밀가루 한 그릇을 바쳤는데, 저들이 서로 먼저 먹겠다고 다투더니 가장 큰 우상이 도끼를 들어 작은 것들을 쳐부수었습니다!"');
              setTimeout(() => {
                faceEachOther('terah', 'anger');
                hud.toast('terah', null, '데라: "네 놈이 아비를 조롱하느냐! 저것들이 어찌 스스로 움직이며 먹고 싸운단 말이냐!"');
                setTimeout(() => {
                  hud.toast('abram', null, '아브람: "아버지께서 스스로 말씀하셨습니다. 보지도, 걷지도, 먹지도 못하는 것을 어찌 신이라 부르며 절하십니까?"');
                  setTimeout(() => {
                    faceEachOther('terah', 'sweat');
                    hud.toast('terah', null, '데라: "고약한 놈! 바벨의 군주 니므롯 왕과 온 도성이 섬기는 주신을 능멸하다니, 어서 성문 밖으로 피해 왕의 재판에 서거라!"');
                    updateGoal();
                    hud.celebrate('미드라시 논쟁 완성', '데라의 우상 숭배를 논파하였다!', true);
                  }, 2400);
                }, 2400);
              }, 2200);
            } else {
              // Direct Faith Witness route
              hud.toast('abram', null, '아브람: "아버지, 사람이 손으로 빚은 돌과 나무는 결코 신이 아닙니다. 눈이 있어도 보지 못하고 귀가 있어도 듣지 못하는 헛된 우상을 버리십시오!"');
              setTimeout(() => {
                faceEachOther('terah', 'anger');
                hud.toast('terah', null, '데라: "닥쳐라, 아브람! 온 나라가 숭배하는 신들을 거역하다니, 니므롯 왕이 알면 우리 집안 전체가 살아남지 못한다!"');
                setTimeout(() => {
                  hud.toast('abram', null, '아브람: "하늘과 땅을 지으신 살아계신 하나님 한 분만이 참신이십니다. 사람을 두려워하지 마십시오!"');
                  setTimeout(() => {
                    faceEachOther('terah', 'sweat');
                    hud.toast('terah', null, '데라: "더는 감싸줄 수 없다. 네 발칙한 행동은 니므롯 왕의 불같은 심판을 면치 못할 것이다!"');
                    updateGoal();
                    hud.celebrate('믿음의 직언 선포', '우상의 허망함과 하나님의 살아계심을 증언하였다!', true);
                  }, 2400);
                }, 2400);
              }, 2200);
            }
          },
        );
        return;
      }

      talkedPeople.add('terah');
      faceEachOther('terah', '...');
      audio.playSfx('ui_confirm');
      hud.toast('terah', null, '데라: "아들아, 오늘은 저 큰 우상 곁에 세울 작은 신상들을 손질하거라."');
      hud.goalFlash = 1.0;
      checkIntroProgress();
    },
  });

  // 미드라시 50세 노인 손님 (창세기 라바 38:13 명장면)
  interactions.add({
    id: 'npc_old_customer',
    pos: () => ({ x: -5.5, z: 1.2 }),
    height: 1.1,
    r: 1.8,
    label: () => (metOldCustomer ? '돌아서는 노인 손님' : '우상 사러 온 노인 손님과 대화'),
    act: () => {
      audio.playSfx('ui_confirm');
      if (metOldCustomer) {
        hud.toast('customer', null, '노인 손님: "참으로 부끄럽도다... 어찌 하루살이 우상을 신이라 섬기려 했던가..."');
        return;
      }
      hud.toast('customer', null, '노인 손님: "젊은이, 내 집안을 지켜줄 크고 영험한 신상을 하나 골라주시게."');
      hud.showChoice(
        '우상을 사러 온 50세 노인 손님에게 건넬 말 (창세기 라바 38:13)',
        [
          {
            badge: '미드라시 일침',
            badgeColor: '#b85422',
            text: '1. "어르신, 연세가 어떻게 되십니까?"',
          },
        ],
        () => {
          setTimeout(() => {
            hud.toast('customer', null, '노인 손님: "내 올해로 꼭 쉰 살이 되었소만, 그건 왜 묻는가?"');
            setTimeout(() => {
              hud.showChoice(
                '노인 손님에게 건넬 아브람의 일침',
                [
                  {
                    badge: '창조주 신앙',
                    badgeColor: '#28629e',
                    text: '1. "쉰 살이나 되신 어르신께서 어제 아버지가 빚은 하루살이 신상에 절하려 하십니까?"',
                  },
                ],
                () => {
                  metOldCustomer = true;
                  hud.unlockCodex('old_customer');
                  setTimeout(() => {
                    hud.toast('customer', null, '노인 손님: "내 쉰 평생 살면서 이토록 부끄러운 일은 처음이로다... 스스로 서지도 못하는 것을 복의 근원이라 섬기려 했다니!"');
                    hud.celebrate('미드라시 전승 완수', '우상의 헛됨을 깨달은 손님이 빈손으로 돌아갔다!', true);
                    talkedPeople.add('old_customer');
                    checkIntroProgress();
                  }, 800);
                },
              );
            }, 800);
          }, 600);
        },
      );
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
      talkedPeople.add('lot');
      faceEachOther('lot', '!');
      audio.playSfx('ui_confirm');
      hud.toast('lot', null, '롯: "삼촌! 성문 밖 낙타 대상들이 싣고 온 신기한 물건들을 보셨어요? 세상 너머엔 무엇이 있을까요?"');
      hud.goalFlash = 1.0;
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
      talkedPeople.add('sarai');
      faceEachOther('sarai', '...');
      audio.playSfx('ui_confirm');
      hud.toast('sarai', null, '사래: "아브람, 마을 사람들은 보지도 듣지도 못하는 우상이 복을 준다고 믿는 걸까요... 우리에겐 아직 자식도 없는데..."');
      hud.goalFlash = 1.0;
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

  // 장터 낙타 상호작용
  interactions.add({
    id: 'animal_camel',
    pos: () => ({ x: 5.5, z: 12.0 }),
    height: 1.5,
    r: 2.2,
    label: () => '짐실은 낙타 쓰다듬기',
    act: () => {
      audio.playSfx('camel_bells');
      hud.toast('camel', null, '낙타가 방울을 짤랑이며 느긋하게 눈을 껌벅인다.');
    },
  });

  // 안채 아기 염소 상호작용
  interactions.add({
    id: 'animal_goat',
    pos: () => ({ x: 9.8, z: -4.8 }),
    height: 0.8,
    r: 1.8,
    label: () => '아기 염소 쓰다듬기',
    act: () => {
      audio.playSfx('goat_bleat');
      hud.toast('goat', null, '아기 염소가 반가운 듯 메에에 울며 꼬리를 살랑거린다.');
    },
  });

  function checkIntroProgress() {
    updateGoal();
    if (examinedIdols >= 3 && talkedPeople.size >= 2) {
      hud.celebrate('탐색 완료', '식구들과 대화하고 우상을 모두 살펴보았다!', true);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. 우상 조사 및 옥상 부르심 이벤트 (Ch.2 & Ch.3)
  // ─────────────────────────────────────────────────────────────
  // 미드라시 제물 그릇 (공방 우측 선반)
  interactions.add({
    id: 'offering_bowl',
    pos: () => ({ x: WX + 3.8, z: WZ - 1.5 }),
    height: 1.0,
    r: 1.8,
    label: () => (!hasFlourBowl && !placedFlourBowl && examinedIdols >= 3 ? '미드라시 제물: 여인이 바친 고운 밀가루 사발 들기' : null),
    act: () => {
      hasFlourBowl = true;
      audio.playSfx('ui_confirm');
      if (urStage.idols.offeringBowl) {
        urStage.idols.offeringBowl.visible = false;
      }
      particles.emit('glory_sparkles', WX + 3.8, 1.0, WZ - 1.5, 16);
      hud.toast('bowl', null, '여인이 우상들에게 바치라며 가져온 고운 밀가루 사발을 집어 들었다!');
      hud.goalFlash = 1.0;
      updateGoal();
    },
  });

  // 공방 작업대 위 작은 우상들 조사 & 분쇄
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
        smashedIdols++;
        if ('playAction' in sceneCtx.player) {
          (sceneCtx.player as any).playAction();
        }
        audio.playSfx('axe_swing');

        setTimeout(() => {
          const smashSounds = ['idol_break_01', 'idol_break_02', 'idol_break_03'];
          audio.playSfx(smashSounds[(smashedIdols - 1) % smashSounds.length]);

          // Screen Shake
          sceneCtx.renderer.shake(0.35, 0.28);

          // 24 Flying Stone Debris + 20 Impact Dust
          const ix = WX - 4.5 + (smashedIdols - 1) * 1.0;
          particles.emit('stone_debris', ix, 1.0, WZ - 2.5, 24);
          particles.emit('impact_dust', ix, 0.8, WZ - 2.5, 20);

          // 복셀 메쉬 숨기기
          if (urStage.idols.smallIdols[smashedIdols - 1]) {
            urStage.idols.smallIdols[smashedIdols - 1].visible = false;
          }

          hud.toast('smash', null, `도끼로 우상을 강타하여 산산조각 내었다! (${smashedIdols}/3)`);
          hud.goalFlash = 1.0;

          if (smashedIdols >= 3) {
            hud.celebrate('우상 분쇄 완료', '모든 작은 우상들을 부수어 파편이 사방에 흩어졌다!', true);
          }
          updateGoal();
        }, 120);
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
        hud.goalFlash = 1.0;
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
        updateGoal();
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
    label: () => (!hasAxe && placedFlourBowl ? '작업대에서 청동 도끼 집어 들기' : null),
    act: () => {
      hasAxe = true;
      audio.playSfx('axe_pickup');
      if ('setHeld' in sceneCtx.player) {
        (sceneCtx.player as any).setHeld('axe');
      }
      particles.emit('glory_sparkles', WX + 2.2, 1.0, WZ - 1.2, 16);
      hud.toast('axe', null, '작업대에서 묵직한 청동 도끼를 쥐었다!');
      hud.goalFlash = 1.0;
      updateGoal();
    },
  });

  // 큰 우상 (중앙 거대 신상) - 제물 그릇 놓기 & 도끼 쥐여주기
  interactions.add({
    id: 'big_idol_pedestal',
    pos: () => ({ x: WX, z: WZ - 2.2 }),
    height: 2.2,
    r: 2.2,
    label: () => {
      if (hasFlourBowl && !placedFlourBowl) return '큰 우상 발치에 밀가루 사발 바치기';
      if (smashedIdols >= 3 && !placedAxeOnBigIdol) return '큰 우상 손에 도끼 쥐여주기';
      return null;
    },
    act: () => {
      // 1) 제물 사발 배치
      if (hasFlourBowl && !placedFlourBowl) {
        hasFlourBowl = false;
        placedFlourBowl = true;
        audio.playSfx('ui_confirm');
        if (urStage.idols.offeringBowl) {
          urStage.idols.offeringBowl.position.set(WX, 0.42, WZ - 1.5);
          urStage.idols.offeringBowl.visible = true;
        }
        particles.emit('glory_sparkles', WX, 0.6, WZ - 1.5, 16);
        hud.toast('abram', null, '아브람: "여인이 바친 음식을 가장 큰 우상의 발치 앞에 차려놓았다. 이제 도끼를 집어 들자!"');
        hud.goalFlash = 1.0;
        updateGoal();
        return;
      }

      // 2) 도끼 쥐여주기
      if (smashedIdols >= 3 && !placedAxeOnBigIdol) {
        placedAxeOnBigIdol = true;
        audio.playSfx('ui_confirm');
        hud.unlockCodex('the_axe');
        if ('setHeld' in sceneCtx.player) {
          (sceneCtx.player as any).setHeld(null);
        }
        particles.emit('glory_sparkles', WX, 1.8, WZ - 2.2, 24);

        // 큰 우상 손에 도끼 장착
        if (urStage.idols.axeMesh) {
          urStage.idols.axeMesh.visible = true;
        }

        hud.celebrate('미드라시 완성', '가장 큰 우상의 손에 도끼를 쥐여주었다!', true);
        hud.toast('abram', null, '아브람: "저 큰 우상이 음식을 두고 다투다 작은 것들을 다 부순 것처럼 보이겠군!"');
        hud.goalFlash = 1.0;
        updateGoal();
        return;
      }
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 성문 회랑 & 니므롯 왕궁·풀무불·하란·팥죽 코다 이동 (Ch.5 ~ Ch.Coda)
  // ─────────────────────────────────────────────────────────────
  interactions.add({
    id: 'city_gate_exit',
    pos: () => (furnaceTriggered ? { x: 0, z: 7.0 } : { x: 22.0, z: 3.5 }),
    height: 1.5,
    r: 3.0,
    label: () => {
      if (!placedAxeOnBigIdol) return '우르 동쪽 성문 (바깥으로 통하는 길)';
      if (!confrontedTerah) return '먼저 아버지 데라와 담판을 지어야 한다';
      if (!furnaceTriggered) return '성문을 지나 니므롯 왕궁으로 나아가기';
      return '데라, 사래, 롯과 함께 하란으로 출발하기';
    },
    act: () => {
      if (!placedAxeOnBigIdol || !confrontedTerah) {
        hud.toast('gate', null, '아직 공방에서 데라와 마쳐야 할 일이 남아있다');
        return;
      }

      if (!furnaceTriggered) {
        furnaceTriggered = true;
        audio.playSfx('ui_confirm');
        // 1) 먼저 니므롯 왕궁 심문 및 신학 재판 컷신 실행
        cutscene.play(
          createNimrodTrialSteps(sceneCtx, () => {
            // 2) 신학 재판 종료 후 즉시 풀무불 가마 기적 클라이맥스로 연결!
            cutscene.play(
              createFurnaceMiracleSteps(sceneCtx),
              () => {
                hud.celebrate('풀무불의 승리', '불길 속에서 살아나온 아브람!');
              },
              'furnace_miracle',
            );
          }),
          undefined,
          'nimrod_trial',
        );
        return;
      }

      // 하란 이동 및 데라 임종 -> 에서 팥죽 코다 피날레로 연결!
      audio.playSfx('ui_confirm');
      cutscene.play(
        createHaranSteps(sceneCtx),
        () => {
          // 하란 임종 및 75세 소명 후 -> 에서와 붉은 팥죽 코다로 연결!
          cutscene.play(
            createEsauLentilStewSteps(sceneCtx, () => {
              hud.celebrate('제1권 완주', '불과 팥죽 — 믿음의 조상 아브람의 첫 발걸음!');
              onBook1Complete();
            }),
            undefined,
            'esau_coda',
          );
        },
        'haran_journey',
      );
    },
  });
}
