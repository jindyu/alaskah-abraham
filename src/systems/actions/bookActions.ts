import type { Interactions, Interactable } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';

export interface ActionContext {
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  bookIndex: number;
  chapterIndex: number;
  onLoopComplete: () => void;
}

export function setupChapterActions(ctx: ActionContext): void {
  const { interactions, hud, audio, bookIndex, chapterIndex, onLoopComplete } = ctx;
  interactions.clear();

  // ── Book 1 ──
  if (bookIndex === 1) {
    // 020_idol_workshop (제2장: 우상 공방)
    if (chapterIndex === 3) {
      let examined = 0;
      const idolInteractable: Interactable = {
        id: 'inspect_idols',
        pos: () => ({ x: -4, z: -7 }),
        height: 1.2,
        r: 1.8,
        label: () => (examined < 3 ? '우상 조사하기' : '데라와 대화하기'),
        act: () => {
          if (examined < 3) {
            examined++;
            audio.playSfx('ui_click');
            hud.toast('idol', null, `우상을 살펴보았다 (${examined}/3) — 눈이 있어도 보지 못한다`);
            if (examined === 3) {
              hud.goal = '아버지 데라에게 우상의 헛됨을 말하자';
            }
          } else {
            hud.toast('terah', null, '데라: "우리는 대대로 왕의 신상을 만들어 온 가문이다!"');
            hud.celebrate('첫 갈등', '우상의 헛됨에 대한 첫 의문');
            onLoopComplete();
          }
        },
      };
      interactions.add(idolInteractable);
      return;
    }

    // 030_the_axe (제4장: 도끼와 우상 파괴)
    if (chapterIndex === 5) {
      let hasAxe = false;
      let smashed = 0;
      let placedOnBigIdol = false;

      const axeSpot: Interactable = {
        id: 'axe_spot',
        pos: () => ({ x: 4, z: -7 }),
        height: 1.0,
        r: 1.5,
        label: () => (hasAxe ? null : '작업대에서 도끼 들기'),
        act: () => {
          hasAxe = true;
          audio.playSfx('fx_equip');
          hud.toast('axe', null, '작업대에서 무거운 도끼를 집어 들었다');
          hud.goal = '도끼로 작은 우상들을 부수자 (0/3)';
        },
      };

      const smallIdolSpot: Interactable = {
        id: 'smash_idols',
        pos: () => ({ x: -4, z: -7 }),
        height: 1.2,
        r: 1.8,
        label: () => (hasAxe && smashed < 3 ? '우상 부수기' : null),
        act: () => {
          smashed++;
          audio.playSfx('fx_stone_break');
          hud.toast('smash', null, `도끼로 우상을 내리쳐 부수었다! (${smashed}/3)`);
          if (smashed >= 3) {
            hud.goal = '큰 우상의 손에 도끼를 쥐여주자';
          }
        },
      };

      const bigIdolSpot: Interactable = {
        id: 'big_idol',
        pos: () => ({ x: 0, z: -5 }),
        height: 2.0,
        r: 2.0,
        label: () => (smashed >= 3 && !placedOnBigIdol ? '큰 우상 손에 도끼 쥐여주기' : null),
        act: () => {
          placedOnBigIdol = true;
          audio.playSfx('ui_click');
          hud.celebrate('우상 파괴', '가장 큰 우상의 손에 도끼를 쥐여주었다');
          hud.toast('done', null, '아브람: "저 큰 우상이 화가 나서 작은 것들을 다 부수었나 봅니다!"');
          onLoopComplete();
        },
      };

      interactions.add(axeSpot, smallIdolSpot, bigIdolSpot);
      return;
    }

    // 060_night_escape (제7장: 밤중의 탈출)
    if (chapterIndex === 8) {
      let packed = false;
      const packInteractable: Interactable = {
        id: 'pack_supplies',
        pos: () => ({ x: 0, z: 0 }),
        height: 1.2,
        r: 1.8,
        label: () => (!packed ? '여행 봇짐 꾸리기' : '성문 밖으로 출발하기'),
        act: () => {
          if (!packed) {
            packed = true;
            audio.playSfx('ui_click');
            hud.toast('pack', null, '데라, 사래, 어린 롯과 함께 갈대아 우르를 떠날 채비를 마쳤다');
            hud.goal = '우르 성문 밖으로 나아가자';
          } else {
            hud.celebrate('탈출', '약속을 향한 첫 발걸음');
            onLoopComplete();
          }
        },
      };
      interactions.add(packInteractable);
      return;
    }

    // 100_lentil_stew (제12장: 장막과 팥죽)
    if (chapterIndex === 12) {
      const potInteractable: Interactable = {
        id: 'lentil_pot',
        pos: () => ({ x: 0, z: 0 }),
        height: 1.0,
        r: 1.6,
        label: () => '붉은 팥죽과 장자권 맹세하기',
        act: () => {
          audio.playSfx('ui_click');
          hud.toast('stew', null, '에서: "내가 굶어 죽게 되었으니, 이 장자권이 내게 무엇이 유익하리요!"');
          hud.celebrate('팥죽과 장자권', '장자권을 야곱에게 넘기다');
          onLoopComplete();
        },
      };
      interactions.add(potInteractable);
      return;
    }
  }

  // ── Book 2 ──
  if (bookIndex === 2) {
    // 01_the_calling (제1장: 부르심과 첫 제단)
    if (chapterIndex === 0) {
      let stones = 0;
      const stoneSpot: Interactable = {
        id: 'gather_stone',
        pos: () => ({ x: 4, z: 2 }),
        height: 0.8,
        r: 1.8,
        label: () => (stones < 3 ? '들판에서 자연석 모으기' : null),
        act: () => {
          stones++;
          audio.playSfx('ui_click');
          hud.toast('stone', null, `들판의 자연석을 주웠다 (${stones}/3)`);
          if (stones === 3) hud.goal = '세겜 상수리나무 아래 여호와를 위한 첫 제단을 쌓자';
        },
      };

      const altarSpot: Interactable = {
        id: 'build_altar',
        pos: () => ({ x: 0, z: -2 }),
        height: 1.4,
        r: 2.0,
        label: () => (stones >= 3 ? '첫 제단 쌓기' : null),
        act: () => {
          audio.playSfx('fx_altar_built');
          hud.celebrate('첫 제단', '가나안 땅에서 여호와의 이름을 부르다');
          hud.toast('altar', null, '아브람이 자기에게 나타나신 여호와께 그곳에 제단을 쌓았다');
          onLoopComplete();
        },
      };

      interactions.add(stoneSpot, altarSpot);
      return;
    }

    // 04_parting_from_lot (제4장: 롯과의 결별)
    if (chapterIndex === 3) {
      const vistaSpot: Interactable = {
        id: 'bethel_vista',
        pos: () => ({ x: 6, z: -6 }),
        height: 1.4,
        r: 2.0,
        label: () => '벧엘 전망대에서 요단 들판 바라보기',
        act: () => {
          audio.playSfx('ui_click');
          hud.toast('parting', null, '아브람: "네가 좌하면 나는 우하고, 네가 우하면 나는 좌하리라"');
          hud.celebrate('롯과의 결별', '롯은 소돔으로, 아브람은 헤브론으로');
          onLoopComplete();
        },
      };
      interactions.add(vistaSpot);
      return;
    }

    // 07_war_and_rescue (제7장: 롯 구출 전쟁)
    if (chapterIndex === 6) {
      let armed = false;
      const armSpot: Interactable = {
        id: 'arm_servants',
        pos: () => ({ x: 0, z: 2 }),
        height: 1.2,
        r: 2.0,
        label: () => (!armed ? '318 가신들에게 창과 횃불 나눠주기' : '호바 야간 기습 돌격하기'),
        act: () => {
          if (!armed) {
            armed = true;
            audio.playSfx('fx_equip');
            hud.toast('arm', null, '집에서 길리고 훈련된 삼백십팔 명을 소집했다');
            hud.goal = '밤의 호바 전장에서 좌우익 협공으로 기습하자';
          } else {
            audio.playSfx('bgm_battle_deliverance');
            hud.celebrate('구출 승리', '롯과 모든 소유를 되찾아오다');
            onLoopComplete();
          }
        },
      };
      interactions.add(armSpot);
      return;
    }
  }

  // ── Book 3 ──
  if (bookIndex === 3) {
    // 01_covenant_of_stars (제1장: 별과 언약)
    if (chapterIndex === 0) {
      let shooed = 0;
      const skySpot: Interactable = {
        id: 'count_stars',
        pos: () => ({ x: 0, z: 0 }),
        height: 1.2,
        r: 2.0,
        label: () => (shooed < 2 ? '밤하늘의 별을 올려다보고 제물의 솔개 쫓기' : '타는 횃불의 언약 목격하기'),
        act: () => {
          if (shooed < 2) {
            shooed++;
            audio.playSfx('ui_click');
            hud.toast('stars', null, `하늘을 우러러 뭇별을 세어 보라… 네 자손이 이와 같으리라 (${shooed}/2)`);
            if (shooed === 2) hud.goal = '깊은 잠 속에서 연기 나는 화로와 타는 횃불을 보자';
          } else {
            audio.playSfx('fx_covenant_chime');
            hud.celebrate('횃불 언약', '내가 이 땅을 네 자손에게 주리라');
            onLoopComplete();
          }
        },
      };
      interactions.add(skySpot);
      return;
    }
  }

  // ── Book 4 ──
  if (bookIndex === 4) {
    // 01_three_visitors (제1장: 세 나그네 환대)
    if (chapterIndex === 0) {
      let step = 0;
      const hospitalitySpot: Interactable = {
        id: 'hospitality',
        pos: () => ({ x: 2, z: 0 }),
        height: 1.2,
        r: 2.0,
        label: () => {
          if (step === 0) return '우물에서 발 씻을 물 길어오기';
          if (step === 1) return '사라에게 고운 가루 세 스아 반죽 부탁하기';
          if (step === 2) return '송아지 요리와 엉긴 젖 상에 차려 대접하기';
          return '소돔을 향해 50명부터 10명까지 중보기도하기';
        },
        act: () => {
          step++;
          audio.playSfx('ui_click');
          if (step === 1) hud.toast('water', null, '물을 가져다가 발을 씻기셨다');
          else if (step === 2) hud.toast('flour', null, '사라가 고운 가루 세 스아로 떡을 구웠다');
          else if (step === 3) hud.toast('feast', null, '기름지고 좋은 송아지 요리와 엉긴 젖을 나무 아래에 차려놓았다');
          else {
            hud.celebrate('중보기도', '의인 열 명이 있어도 멸하지 아니하리라');
            onLoopComplete();
          }
        },
      };
      interactions.add(hospitalitySpot);
      return;
    }

    // 03_fall_of_sodom (제3장: 소돔 탈출)
    if (chapterIndex === 2) {
      const escapeSpot: Interactable = {
        id: 'sodom_escape',
        pos: () => ({ x: 0, z: -4 }),
        height: 1.2,
        r: 2.0,
        label: () => '가족의 손을 잡고 소돔 성문 밖으로 탈출하기',
        act: () => {
          audio.playSfx('fx_stone_break');
          hud.toast('escape', null, '천사들이 롯과 그 아내와 두 딸의 손을 잡아 인도하여 성 밖에 두었다');
          hud.celebrate('소돔의 멸망', '유황불 심판과 소금 기둥');
          onLoopComplete();
        },
      };
      interactions.add(escapeSpot);
      return;
    }
  }

  // ── Book 5 ──
  if (bookIndex === 5) {
    // 04_well_of_beersheba (제4장: 브엘세바 우물)
    if (chapterIndex === 3) {
      let phase = 0;
      const wellCovenantSpot: Interactable = {
        id: 'well_covenant',
        pos: () => ({ x: 0, z: 0 }),
        height: 1.4,
        r: 2.0,
        label: () => (phase === 0 ? '암양 새끼 일곱 마리를 따로 세우기' : '에셀나무 심고 여호와의 이름을 부르기'),
        act: () => {
          if (phase === 0) {
            phase = 1;
            audio.playSfx('ui_click');
            hud.toast('covenant', null, '아비멜렉 앞에서 암양 일곱으로 우물 판 증거를 삼았다');
            hud.goal = '브엘세바에 에셀나무를 심자';
          } else {
            audio.playSfx('ui_click');
            hud.celebrate('브엘세바의 맹세', '맹세의 우물과 영원하신 여호와');
            onLoopComplete();
          }
        },
      };
      interactions.add(wellCovenantSpot);
      return;
    }

    // 07_mount_moriah (제7장: 모리아산)
    if (chapterIndex === 6) {
      let altarBuilt = false;
      let ramFound = false;

      const moriahSpot: Interactable = {
        id: 'moriah_altar',
        pos: () => ({ x: 0, z: 0 }),
        height: 1.4,
        r: 2.2,
        label: () => {
          if (!altarBuilt) return '돌로 제단을 쌓고 나무를 벌여놓기';
          if (!ramFound) return '수풀에 뿔이 걸린 숫양 찾아보기';
          return '숫양을 번제로 드리고 여호와 이레 찬양하기';
        },
        act: () => {
          if (!altarBuilt) {
            altarBuilt = true;
            audio.playSfx('fx_altar_built');
            hud.toast('moriah', null, '이삭: "번제할 어린 양은 어디 있나이까" — "하나님이 친히 준비하시리라"');
            hud.toast('angel', null, '천사: "아브라함아, 아브라함아! 그 아이에게 네 손을 대지 말라!"');
            hud.goal = '뒤를 돌아 수풀에 걸린 숫양을 발견하자';
          } else if (!ramFound) {
            ramFound = true;
            audio.playSfx('ui_click');
            hud.toast('ram', null, '수풀에 뿔이 걸린 숫양을 발견했다');
            hud.goal = '이삭 대신 숫양을 가져다가 번제로 드리자';
          } else {
            audio.playBgm('bgm_divine_call');
            hud.celebrate('여호와 이레', '여호와의 산에서 준비되리라');
            onLoopComplete();
          }
        },
      };
      interactions.add(moriahSpot);
      return;
    }
  }

  // ── Book 6 ──
  if (bookIndex === 6) {
    // 02_ephrons_bargain (제2장: 에브론의 흥정)
    if (chapterIndex === 1) {
      const machpelahSpot: Interactable = {
        id: 'buy_machpelah',
        pos: () => ({ x: 0, z: -4 }),
        height: 1.4,
        r: 2.0,
        label: () => '은 사백 세겔을 달아주고 막벨라 굴 매입하기',
        act: () => {
          audio.playSfx('ui_click');
          hud.toast('silver', null, '상인이 통용하는 은 사백 세겔을 달아 에브론에게 주었다');
          hud.celebrate('막벨라 굴 매입', '약속의 땅에 산 영원한 기업');
          onLoopComplete();
        },
      };
      interactions.add(machpelahSpot);
      return;
    }

    // 05_labans_house (제5장: 라반의 집과 리브가)
    if (chapterIndex === 4) {
      let watered = false;
      const wellSpot: Interactable = {
        id: 'rebekah_well',
        pos: () => ({ x: 0, z: 0 }),
        height: 1.4,
        r: 2.0,
        label: () => (!watered ? '리브가에게 물을 청하고 낙타 10필 물 먹이기' : '금 코걸이와 손목고리 건네기'),
        act: () => {
          if (!watered) {
            watered = true;
            audio.playSfx('ui_click');
            hud.toast('water', null, '리브가: "내 주여 마시소서… 당신의 낙타를 위하여서도 물을 길어 배불리 마시게 하리이다"');
            hud.goal = '리브가에게 금 코걸이와 금 손목고리를 건네자';
          } else {
            audio.playSfx('ui_click');
            hud.celebrate('이삭의 신부', '여호와께서 인도하신 순적한 만남');
            onLoopComplete();
          }
        },
      };
      interactions.add(wellSpot);
      return;
    }
  }
}
