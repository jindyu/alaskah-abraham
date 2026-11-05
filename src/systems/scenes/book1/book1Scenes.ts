import * as THREE from 'three';
import type { Step } from '../../cutscene/cutscene';
import type { PixelRenderer } from '../../../renderer/pixelRenderer';
import type { Hud } from '../../../ui/hud';
import type { AudioManager } from '../../../audio/audioManager';
import { Actor } from '../../../entities/actor';
import type { Beam } from '../../../entities/beam';
import type { Player } from '../../../entities/player';
import type { StageManager } from '../../../world/stageManager';
import type { ParticleManager } from '../../../renderer/particles';
import type { FurnaceStage } from '../../../world/stages/furnace';

export interface SceneContext {
  renderer: PixelRenderer;
  hud: Hud;
  audio: AudioManager;
  player: Player | Actor;
  beam?: Beam;
  stageManager?: StageManager;
  particles?: ParticleManager;
  scene?: THREE.Scene;
  lights?: {
    sun: THREE.DirectionalLight;
    hemi: THREE.HemisphereLight;
    torchLight: THREE.PointLight;
  };
  setCameraFocus: (x: number, y: number, z: number) => void;
  setHour?: (hour: number) => void;
}

/** 1. 오프닝 프롤로그: 바벨과 갈대아 우르 */
export function createBook1IntroSteps(c: SceneContext): Step[] {
  return [
    { do: () => {
      c.hud.unlockCodex('babel_nimrod');
      c.hud.cinematicTitle = '제1권 · 불과 팥죽\n갈대아 우르와 니므롯';
      c.renderer.toVista();
      c.setCameraFocus(-36, 6.0, -28); // 원경 거대 지구라트 조망
      c.audio.playBgm('bgm_ancient_memory');
    } },
    { wait: 0.8 },
    { caption: '노아의 방주 이후, 사람들은 시날 평지에 모여 하늘에 닿을 거대한 탑을 쌓기 시작했다.', hold: 4.2 },
    { caption: '"우리의 이름을 내고 온 지면에 흩어짐을 면하자!" 오만한 제국 바벨의 시작이었다.', hold: 4.0 },
    { do: () => {
      c.setCameraFocus(-18, 3.5, -12); // 우르 도시 전경으로 이동
    } },
    { caption: '사냥꾼 니므롯은 스스로 신이 되어 백성들을 억압했고, 온 세상은 우상 숭배로 물들었다.', hold: 4.2 },
    { do: () => {
      c.renderer.resetTilt();
      c.setCameraFocus(0, 1.2, 3.2); // 데라의 공방 마당으로 착지
      c.hud.cinematicTitle = null;
      c.player.root.position.set(0, 0, 3.2);
      c.player.face(Math.PI);
    } },
    { caption: '이곳 갈대아 우르, 왕실 신상을 만드는 장인 데라의 집에도 아침이 밝아왔다.', hold: 3.8 },
    { caption: '그리고 그 집의 맏아들, 청년 아브람.', hold: 3.2 },
    { do: () => {
      c.renderer.resetTilt();
      c.hud.goalCategory = '제1권 · 갈대아 우르';
      c.hud.goal = '우르 거리와 공방 둘러보기\n▪ 식구들과 대화하기 (0/2)\n▪ 공방 작은 우상 살펴보기 (0/3)';
      c.hud.goalProgress = { current: 0, total: 5, label: '0/5' };
      c.hud.hint = '거리의 식구들과 대화하고 공방 안 우상을 조사하자';
      c.hud.toast('start-walk', null, 'WASD나 화살표 키로 움직이고, E키나 클릭으로 대화해보자');
    } },
  ];
}

/** 2. 밤하늘과 첫 부르심 (옥상 테라스 석양 → 별밤 점진적 조명 전환 이벤트) */
export function createNightCallingSteps(c: SceneContext): Step[] {
  return [
    // 1막: 해질녘 옥상 오름 (붉은 석양과 지구라트 원경)
    { do: () => {
      c.hud.unlockCodex('ur_night_call');
      c.audio.playBgm('bgm_divine_call');
      c.hud.cinematicTitle = '하나님의 첫 부르심\n사도행전 7:2-3';
      c.renderer.setTilt(26);
      c.setCameraFocus(0, 3.8, -6.5);
      c.player.root.position.set(0, 3.6, -7.0);
      c.player.face(Math.PI);

      if (c.beam) {
        c.beam.at(0, -7.0);
        c.beam.strength = 0;
      }

      // 석양 조명 설정
      if (c.scene && c.scene.background instanceof THREE.Color) {
        c.scene.background.setHex(0x76384a); // 보랏빛 섞인 석양 하늘
      }
      if (c.lights) {
        c.lights.sun.color.setHex(0xff6e32);
        c.lights.sun.intensity = 1.6;
        c.lights.hemi.color.setHex(0xd08a70);
        c.lights.hemi.groundColor.setHex(0x3a2234);
        c.lights.hemi.intensity = 1.0;
        c.lights.torchLight.intensity = 0;
      }
    } },
    { wait: 1.0 },
    { caption: '우르의 태양이 지구라트 너머 붉은 노을로 저물 무렵, 청년 아브람은 공방 옥상에 올랐다.', hold: 4.2 },

    // 2막: 석양에서 깊은 밤으로의 점진적 조명 전환 (별들의 밤하늘)
    { do: () => {
      if (c.scene && c.scene.background instanceof THREE.Color) {
        c.scene.background.setHex(0x0a1024); // 깊은 군청색 밤하늘
      }
      if (c.lights) {
        c.lights.sun.color.setHex(0x4a629e); // 푸른 달빛
        c.lights.sun.intensity = 0.35;
        c.lights.hemi.color.setHex(0x182442);
        c.lights.hemi.groundColor.setHex(0x0a1220);
        c.lights.hemi.intensity = 0.65;
        // 옥상 횃불과 창문 램프 점등
        c.lights.torchLight.position.set(0, 3.8, -7.0);
        c.lights.torchLight.color.setHex(0xffaa44);
        c.lights.torchLight.intensity = 1.6;
      }
      if (c.particles) {
        c.particles.emit('desert_dust', 0, 4.0, -7.0, 16);
      }
    } },
    { wait: 1.2 },
    { caption: '도성의 모든 불이 꺼지고 쏟아지는 밤하늘의 무수한 별들을 우러러보며, 아브람은 깊은 고뇌에 잠겼다.', hold: 4.5 },
    { caption: '아브람: "저 끝없는 하늘과 별들을 지으신 분이 계실 텐데... 어찌 사람이 깎아 만든 돌과 나무가 신이란 말인가?"', hold: 4.5 },

    // 3막: 영광의 하나님 강림 (빛기둥 & 음성)
    { do: () => {
      if (c.beam) c.beam.strength = 1.0;
      if (c.particles) {
        c.particles.emit('glory_sparkles', 0, 4.2, -7.0, 32);
        c.particles.emit('divine_beam_motes', 0, 8.0, -7.0, 24);
      }
      c.audio.playSfx('ui_confirm');
      c.hud.cinematicTitle = null;
    } },
    { wait: 1.4 },
    { caption: '그때, 영광의 하나님께서 메소포타미아의 아브람에게 나타나 말씀하셨다.', hold: 4.0 },
    { caption: '너는 너의 고향과 친척과 아버지의 집을 떠나 내가 네게 보여 줄 땅으로 가라.', style: 'voice', hold: 5.2 },
    { caption: '내가 너로 큰 민족을 이루고 네게 복을 주어 네 이름을 창대하게 하리니 너는 복이 될지라.', style: 'voice', hold: 5.2 },
    { caption: '땅의 모든 족속이 너로 말미암아 복을 얻을 것이니라.', style: 'voice', hold: 5.2 },
    { wait: 1.2 },

    // 4막: 여명(새벽) 복귀 및 결단
    { do: () => {
      if (c.beam) c.beam.strength = 0;
      // 아침 여명 조명으로 부드럽게 복구
      if (c.scene && c.scene.background instanceof THREE.Color) {
        c.scene.background.setHex(0xd0e8f8);
      }
      if (c.lights) {
        c.lights.sun.color.setHex(0xfff0d0);
        c.lights.sun.intensity = 2.2;
        c.lights.hemi.color.setHex(0xcfe4f0);
        c.lights.hemi.groundColor.setHex(0x8a6440);
        c.lights.hemi.intensity = 1.1;
        c.lights.torchLight.intensity = 0;
      }
      c.renderer.resetTilt();
    } },
    { caption: '영광의 광채가 걷힌 뒤에도, 하나님의 거룩한 말씀은 아브람의 심장에 불꽃처럼 타올랐다.', hold: 4.2 },
    { caption: '아브람: "사람의 손으로 빚은 거짓 우상들을 깨뜨려, 아버지와 온 도성의 눈을 열어야 한다!"', hold: 4.2 },
    { do: () => {
      c.player.root.position.set(0, 0, 1.0); // 공방 바닥으로 내려옴
      c.setCameraFocus(0, 1.2, -5.0);
      c.hud.goal = '공방 우측 선반에서 밀가루 제물 그릇 챙기기\n▪ 여인의 밀가루 제물 그릇 들기 (0/1)';
      c.hud.goalProgress = { current: 0, total: 1, label: '0/1' };
      c.hud.hint = '공방 우측 선반의 밀가루 사발 (! 표시)';
      c.hud.goalFlash = 1.0;
    } },
  ];
}

/** 3. 풀무불의 기적 클라이맥스 (바벨의 심판과 장미꽃 동산의 기적) */
export function createFurnaceMiracleSteps(c: SceneContext): Step[] {
  const cutsceneActors: Actor[] = [];
  let cutsceneGroup: THREE.Group | null = null;
  let furnaceStage: FurnaceStage | null = null;

  let abramActor: Actor | null = null;
  let nimrodActor: Actor | null = null;
  let angelActor: Actor | null = null;
  let execGuard1: Actor | null = null;
  let execGuard2: Actor | null = null;
  let guard1: Actor | null = null;
  let guard2: Actor | null = null;
  let terahActor: Actor | null = null;
  let saraiActor: Actor | null = null;
  let lotActor: Actor | null = null;

  const cleanupActors = () => {
    if (cutsceneGroup && c.scene) {
      c.scene.remove(cutsceneGroup);
    }
    for (const a of cutsceneActors) {
      a.dispose();
    }
    cutsceneActors.length = 0;
    cutsceneGroup = null;
  };

  return [
    // ── 1. 오프닝 셋업 & 왕실 테라스 니므롯과 풀무불 가마 ──
    { do: () => {
      // 1) 풀무불 전용 스테이지 로드
      c.stageManager?.loadStage('ur_furnace');
      furnaceStage = c.stageManager?.stage?.furnaceDetails ?? null;

      // 2) 플레이어 숨김 및 연출 그룹 생성
      c.player.root.visible = false;
      cutsceneGroup = new THREE.Group();
      cutsceneGroup.name = 'furnace_cutscene_actors';
      if (c.scene) c.scene.add(cutsceneGroup);

      // 3) 등장인물 생성 및 배치 (북쪽 높은 테라스 니므롯과 전면 개방 가마)
      nimrodActor = new Actor('nimrod', 'nimrod');
      nimrodActor.root.position.set(0, 4.4, -11.4);
      nimrodActor.face(0); // 남쪽 광장 및 화로를 내려다봄
      nimrodActor.attachProp('scepter');
      nimrodActor.setPose('command');

      guard1 = new Actor('guard1', 'guard');
      guard1.root.position.set(2.0, 4.4, -10.5);
      guard1.face(0);
      guard1.attachProp('spear');

      guard2 = new Actor('guard2', 'guard');
      guard2.root.position.set(-2.0, 4.4, -10.5);
      guard2.face(0);
      guard2.attachProp('spear');

      execGuard1 = new Actor('exec1', 'guard');
      execGuard1.root.position.set(4.2, 2.4, -2.8);
      execGuard1.face(-Math.PI / 2);
      execGuard1.attachProp('spear');

      execGuard2 = new Actor('exec2', 'guard');
      execGuard2.root.position.set(3.4, 2.4, -4.2);
      execGuard2.face(0);

      abramActor = new Actor('abram', 'abram_young');
      abramActor.root.position.set(3.4, 2.4, -3.5);
      abramActor.face(-Math.PI * 0.65);
      abramActor.setPose('bound'); // 결박된 상태

      terahActor = new Actor('terah', 'terah');
      terahActor.root.position.set(-9.2, 1.2, -0.4);
      terahActor.face(Math.PI * 0.35);
      terahActor.setPose('pray');

      saraiActor = new Actor('sarai', 'sarai');
      saraiActor.root.position.set(-9.2, 1.2, 0.6);
      saraiActor.face(Math.PI * 0.35);
      saraiActor.setPose('pray');

      lotActor = new Actor('lot', 'lot_young');
      lotActor.root.position.set(-9.2, 1.2, 1.6);
      lotActor.face(Math.PI * 0.35);
      lotActor.setPose('kneel');

      angelActor = new Actor('angel', 'angel');
      angelActor.root.position.set(0, 10.0, -3.5); // 하늘 대기
      angelActor.face(0);
      angelActor.root.visible = false;

      const actorList = [
        nimrodActor, guard1, guard2, execGuard1, execGuard2,
        abramActor, terahActor, saraiActor, lotActor, angelActor,
      ];
      for (const a of actorList) {
        cutsceneGroup.add(a.root);
        cutsceneActors.push(a);
      }

      // 4) 카메라 & 오디오 초기화 (노아 정통 3D 비스타 투시각)
      c.renderer.setTilt(24);
      c.renderer.setFraming(1.1);
      c.setCameraFocus(0, 4.4, -11.0); // 니므롯 왕실 테라스 조망
      c.audio.playBgm('bgm_nimrod_empire');
      c.audio.playSfx('war_drum_stinger');
      c.hud.cinematicTitle = '풀무불의 기적\n바벨의 심판과 하나님의 영광';
    } },
    { wait: 1.2 },
    { do: () => {
      c.hud.cinematicTitle = null; // 타이틀 띠 해제하여 전경 개방
    } },

    // ── 2. 대면과 니므롯의 심판 ──
    { caption: '바벨의 통치자 니므롯은 우상을 깨뜨린 아브람을 체포하여 칠 배나 뜨거운 풀무불 가마 앞으로 끌고 왔다.', hold: 4.8 },
    { do: () => {
      nimrodActor?.showBubble('anger');
    } },
    { caption: '니므롯: "갈대아 우르의 신들을 모독한 가증한 자여! 이제 네가 섬기는 여호와가 너를 구원하는지 보리라!"', hold: 5.0 },
    { do: () => {
      c.renderer.setTilt(26);
      c.setCameraFocus(3.4, 2.4, -3.5); // 투척 램프의 결박된 아브람 클로즈업
    } },
    { caption: '아브람: "우리의 생명은 손으로 만든 우상이 아닌, 하늘과 땅을 지으신 참되신 하나님의 손에 있나이다!"', hold: 5.0 },
    { do: () => {
      c.setCameraFocus(-9.2, 1.4, 0.6); // 관람석의 가족들
      saraiActor?.showBubble('sweat');
    } },
    { caption: '두려움에 떨며 기도하는 가족들과 수많은 군중들 앞에서, 니므롯의 서슬 퍼런 명령이 떨어졌다.', hold: 4.2 },

    // ── 3. 가마 속으로 투척 & 화염 분출 ──
    { do: () => {
      c.renderer.setTilt(24);
      c.setCameraFocus(0, 4.4, -11.0);
      nimrodActor?.showBubble('!');
      c.audio.playBgm('bgm_judgment_fire');
    } },
    { caption: '니므롯: "저 패역자를 타오르는 불길 속으로 던져 넣어라!"', hold: 3.5 },
    {
      animate: 1.6,
      frame: (p) => {
        if (abramActor) {
          abramActor.root.position.set(
            3.4 + (0 - 3.4) * p,
            2.4 + (0.6 - 2.4) * p,
            -3.5,
          );
          abramActor.updateAnimation(0.016, true);
        }
        if (execGuard1) {
          execGuard1.root.position.x = 4.2 - 0.6 * p;
          execGuard1.updateAnimation(0.016, true);
        }
        c.renderer.setTilt(26);
        c.setCameraFocus(3.4 * (1 - p), 2.4 - 1.2 * p, -3.5);
        if (Math.random() < 0.3) {
          c.particles?.emit('inferno_flame', 0, 1.5, -3.5, 6);
        }
      },
    },
    { do: () => {
      // 화염 대폭발 & 군사 쓰러짐
      c.audio.playSfx('kindling_fire');
      c.audio.playSfx('battle_shout');
      c.particles?.emit('inferno_flame', 0, 2.0, -3.5, 40);
      c.particles?.emit('furnace_smoke', 0, 6.4, -6.4, 35);
      execGuard1?.setPose('fallen');
      execGuard2?.setPose('fallen');
    } },
    { caption: '군사들이 결박된 아브람을 맹렬한 가마 속으로 밀어 넣었으나, 치솟는 화염의 열기에 군사들조차 쓰러지고 말았다!', hold: 4.8 },

    // ── 4. 불길 속의 아브람 & 천사의 강림 ──
    { do: () => {
      c.renderer.setTilt(28);
      c.setCameraFocus(0, 1.2, -3.5); // 가마 내부 클로즈업 (완전 개방 시야)
      abramActor?.root.position.set(0, 0.6, -3.5);
      abramActor?.setPose('pray');
      c.particles?.emit('embers', 0, 1.0, -3.5, 30);
    } },
    { caption: '칠 배나 달구어진 화염 속, 죽음의 잿더미에 삼켜진 줄 알았던 바로 그 순간...', hold: 4.0 },
    { do: () => {
      c.audio.playSfx('fx_divine_presence');
      c.audio.playSfx('fx_angel_appear');
      c.audio.playBgm('bgm_battle_deliverance');
      if (c.beam) {
        c.beam.at(0, -3.5);
        c.beam.strength = 1.0;
      }
      if (angelActor) angelActor.root.visible = true;
      c.particles?.emit('divine_beam_motes', 0, 6.5, -3.5, 45);
    } },
    {
      animate: 2.0,
      frame: (p) => {
        if (angelActor) {
          angelActor.root.position.set(-0.9, 10.0 + (0.6 - 10.0) * p, -3.5);
          angelActor.updateAnimation(0.016, true);
        }
        if (abramActor) abramActor.updateAnimation(0.016, false);
        c.setCameraFocus(0, 1.2, -3.5);
        if (Math.random() < 0.25) {
          c.particles?.emit('divine_beam_motes', (Math.random() - 0.5) * 1.5, 5.0, -3.5 + (Math.random() - 0.5) * 1.5, 4);
        }
      },
    },
    { do: () => {
      // 밧줄 소멸 및 아브람 기립
      c.audio.playSfx('fx_test_release');
      c.particles?.emit('dissolve_sparks', 0, 1.0, -3.5, 45);
      abramActor?.setPose('stand');
      abramActor?.face(0);
    } },
    { caption: '하늘에서 하나님의 거룩한 천사가 영광의 광채 속에 강림하여 아브람의 결박을 풀어 주었다!', hold: 4.6 },
    { caption: '아브람을 묶었던 밧줄만이 불타 사라졌을 뿐, 그의 옷자락조차 불에 그을리지 않았다.', hold: 4.4 },

    // ── 5. 장미꽃 동산의 기적 (Genesis Rabbah 38:13 / Talmud Pesachim 118a) ──
    { do: () => {
      angelActor?.setPose('offer');
      c.audio.playSfx('fx_covenant_chime');
      furnaceStage?.garden.show();
      c.hud.unlockCodex('furnace_roses');
      if (furnaceStage?.garden.group) {
        furnaceStage.garden.group.scale.set(1, 0.05, 1);
      }
      c.particles?.emit('miracle_dew', 0, 1.4, -3.5, 45);
      c.particles?.emit('rose_petals', 0, 4.0, -3.5, 50);
    } },
    {
      animate: 1.5,
      frame: (p) => {
        if (furnaceStage?.garden.group) {
          furnaceStage.garden.group.scale.set(1, Math.min(1, Math.max(0.05, p)), 1);
        }
      },
    },
    { caption: '천사가 손을 펴자 맹렬하던 불길이 시원한 아침 이슬바람으로 바뀌었다!', hold: 4.5 },
    { caption: '타오르던 숯불은 푸른 풀밭과 향기로운 장미꽃 동산으로 피어났고, 맑은 시냇물이 솟아올랐다.', hold: 4.8 },
    {
      animate: 2.2,
      frame: (p) => {
        if (abramActor) {
          abramActor.root.position.z = -3.5 + 1.2 * p;
          abramActor.updateAnimation(0.016, true);
        }
        if (angelActor) {
          angelActor.root.position.z = -3.5 + 1.2 * p;
          angelActor.updateAnimation(0.016, true);
        }
        c.setCameraFocus(0, 1.2, -3.0 + 0.8 * p);
        if (Math.random() < 0.3) {
          c.particles?.emit('rose_petals', (Math.random() - 0.5) * 3.0, 3.5, -3.5 + (Math.random() - 0.5) * 2.0, 3);
        }
      },
    },
    { caption: '아브람과 주의 천사는 만발한 장미꽃 사이를 유유히 함께 거닐었다.', hold: 4.2 },

    // ── 6. 니므롯의 경악과 공포 ──
    { do: () => {
      c.renderer.setTilt(22);
      c.setCameraFocus(0, 4.4, -11.0);
      nimrodActor?.showBubble('!');
      nimrodActor?.detachProp(); // 홀을 떨어뜨림
      nimrodActor?.setPose('cower');
      guard1?.setPose('kneel');
      guard2?.setPose('kneel');
      c.audio.playSfx('fx_ominous_sting');
      c.audio.playSfx('crowd_murmur');
    } },
    { caption: '왕실 테라스에서 화로를 내려다보던 니므롯은 경악하여 왕권을 상징하는 황금 홀을 떨어뜨렸다!', hold: 4.8 },
    { caption: '니므롯: "우리가 결박하여 불 속에 던진 자는 한 사람이 아니었느냐? 어찌하여 네 사람이 자유롭게 거닐고 있느냐!"', hold: 5.2 },
    { caption: '니므롯: "그 넷째의 모습은... 신들의 아들과 같도다...!"', hold: 4.2 },

    // ── 7. 가족의 찬양과 아브람의 당당한 개선 ──
    { do: () => {
      c.renderer.setTilt(26);
      c.setCameraFocus(-9.2, 1.4, 0.6);
      terahActor?.setPose('offer');
      saraiActor?.showBubble('heart');
      lotActor?.showBubble('!');
      c.audio.playSfx('crowd_cheer');
    } },
    { caption: '아버지 데라와 사래, 롯은 살아계신 하나님의 위대한 권능 앞에 눈물 흘리며 찬양을 드렸다.', hold: 4.6 },
    { do: () => {
      c.renderer.setTilt(28);
      c.setCameraFocus(0, 1.2, 0.5);
      if (angelActor) angelActor.root.position.set(-1.0, 0.6, -1.8);
      if (abramActor) abramActor.root.position.set(0, 0, -1.2);
      c.audio.playBgm('bgm_hope_legacy');
      c.audio.playSfx('ending_resolve');
    } },
    {
      animate: 2.4,
      frame: (p) => {
        if (abramActor) {
          abramActor.root.position.set(0, 0, -1.2 + (1.8 - (-1.2)) * p);
          abramActor.updateAnimation(0.016, true);
        }
        if (angelActor) {
          angelActor.root.position.y = 0.6 + 6.0 * p;
          angelActor.updateAnimation(0.016, true);
        }
        c.setCameraFocus(0, 1.2, -0.5 + 2.3 * p);
        if (Math.random() < 0.25) {
          c.particles?.emit('glory_sparkles', 0, 2.5, -2.0, 4);
        }
      },
    },
    { do: () => {
      if (angelActor) angelActor.root.visible = false;
      if (c.beam) c.beam.strength = 0;
    } },
    { caption: '아브람이 천사의 전송을 받으며 영광의 승리를 품고 풀무불 밖으로 걸어 나왔다!', hold: 4.5 },
    { caption: '바벨의 모든 권력과 거짓 신들은 살아계신 하나님 앞에 굴복하였다.', hold: 4.2 },
    { caption: '아브람: "이제 주의 언약을 따라, 고향과 친척을 떠나 약속의 땅으로 떠나자!"', hold: 4.6 },

    // ── 8. 마무리 정리 및 퀘스트 상태 갱신 ──
    { do: () => {
      cleanupActors();
      c.renderer.resetTilt();
      c.hud.cinematicTitle = null;
      c.player.root.position.set(0, 0, 1.8);
      c.player.root.visible = true;
      c.player.face(Math.PI);
      c.setCameraFocus(0, 1.2, 1.8);

      c.hud.goalCategory = '제1권 · 불과 팥죽';
      c.hud.goal = '풀무불의 시험 승리!\n[✓] 우상의 공방 파괴 (3/3)\n[✓] 풀무불의 시험 승리\n▪ 성문 밖으로 나가 하란으로 대장정 출발하기';
      c.hud.goalProgress = { current: 3, total: 3, label: '3/3 승리' };
      c.hud.goalFlash = 1.0;
      c.hud.celebrate('풀무불의 대승리', '살아계신 하나님께서 아브람을 건지셨습니다!');
    } },
  ];
}

/** 4. 우르 출향 캐러밴과 하란 도착, 데라의 임종 (피날레 컷신) */
export function createHaranSteps(c: SceneContext): Step[] {
  const cutsceneActors: Actor[] = [];
  let cutsceneGroup: THREE.Group | null = null;
  let abramActor: Actor | null = null;
  let saraiActor: Actor | null = null;
  let lotActor: Actor | null = null;
  let terahActor: Actor | null = null;

  const cleanupActors = () => {
    if (cutsceneGroup && c.scene) {
      c.scene.remove(cutsceneGroup);
      cutsceneActors.forEach((a) => a.dispose());
      cutsceneActors.length = 0;
      cutsceneGroup = null;
    }
  };

  return [
    // ── 1막: 갈대아 우르 성문 출향 캐러밴 ──
    { do: () => {
      cleanupActors();
      cutsceneGroup = new THREE.Group();
      cutsceneGroup.name = 'haran_departure_group';
      c.scene?.add(cutsceneGroup);

      c.audio.playBgm('bgm_nimrod_empire');
      c.hud.cinematicTitle = '갈대아 우르 탈출\n창세기 11:31';
      c.renderer.setTilt(24);
      c.setCameraFocus(22.0, 1.4, 3.5);

      // 캐러밴 대열 (성문 밖으로 전진하는 아브람 가족)
      abramActor = new Actor('dep_abram', 'abram');
      abramActor.root.position.set(21.0, 0, 3.5);
      abramActor.face(Math.PI * 0.5);

      saraiActor = new Actor('dep_sarai', 'sarai');
      saraiActor.root.position.set(18.5, 0, 4.2);
      saraiActor.face(Math.PI * 0.5);

      lotActor = new Actor('dep_lot', 'lot');
      lotActor.root.position.set(17.0, 0, 2.8);
      lotActor.face(Math.PI * 0.5);

      terahActor = new Actor('dep_terah', 'terah');
      terahActor.root.position.set(15.5, 0, 3.5);
      terahActor.face(Math.PI * 0.5);

      cutsceneActors.push(abramActor, saraiActor, lotActor, terahActor);
      cutsceneGroup.add(abramActor.root, saraiActor.root, lotActor.root, terahActor.root);

      if (c.player && 'root' in c.player) {
        c.player.root.visible = false;
      }
    } },
    {
      animate: 2.8,
      frame: (p) => {
        const stepOffset = p * 4.5;
        if (abramActor) {
          abramActor.root.position.x = 21.0 + stepOffset;
          abramActor.updateAnimation(0.016, true);
        }
        if (saraiActor) {
          saraiActor.root.position.x = 18.5 + stepOffset;
          saraiActor.updateAnimation(0.016, true);
        }
        if (lotActor) {
          lotActor.root.position.x = 17.0 + stepOffset;
          lotActor.updateAnimation(0.016, true);
        }
        if (terahActor) {
          terahActor.root.position.x = 15.5 + stepOffset;
          terahActor.updateAnimation(0.016, true);
        }
        c.setCameraFocus(22.0 + stepOffset * 0.8, 1.4, 3.5);
      },
    },
    { caption: '풀무불의 기적으로 니므롯의 손에서 벗어난 아브람은, 온 집안과 가축을 이끌고 우르 성문을 나섰다.', hold: 4.8 },
    { caption: '거대한 지구라트와 갈대아 우르의 도성이 석양 너머로 아득히 작아져 갔다.', hold: 4.5 },

    // ── 2막: 하란 오아시스 도착과 아버지 데라의 임종 ──
    { do: () => {
      cleanupActors();
      cutsceneGroup = new THREE.Group();
      cutsceneGroup.name = 'haran_scene_group';
      c.scene?.add(cutsceneGroup);

      c.stageManager?.loadStage('haran');
      c.audio.playBgm('bgm_lament');
      c.hud.cinematicTitle = '하란의 장막\n아버지 데라의 안식 (창 11:32)';
      c.hud.unlockCodex('terah_peace');
      c.renderer.setTilt(26);
      c.setCameraFocus(0, 1.2, 0);

      // 하란 장막 앞 모닥불 주위로 모인 가족들
      abramActor = new Actor('h_abram', 'abram');
      abramActor.root.position.set(-1.2, 0, 1.2);
      abramActor.face(-Math.PI * 0.25);
      abramActor.setPose('kneel');

      saraiActor = new Actor('h_sarai', 'sarai');
      saraiActor.root.position.set(-2.2, 0, 0.8);
      saraiActor.face(0);
      saraiActor.setPose('kneel');

      lotActor = new Actor('h_lot', 'lot');
      lotActor.root.position.set(1.2, 0, 1.2);
      lotActor.face(-Math.PI * 0.75);
      lotActor.setPose('cower');

      terahActor = new Actor('h_terah', 'terah');
      terahActor.root.position.set(0, 0, -1.0);
      terahActor.face(Math.PI);
      terahActor.setPose('fallen'); // 장막 침상에 평안히 누운 데라

      cutsceneActors.push(abramActor, saraiActor, lotActor, terahActor);
      cutsceneGroup.add(abramActor.root, saraiActor.root, lotActor.root, terahActor.root);
    } },
    { wait: 1.2 },
    { caption: '아브람 일행은 유프라테스 강을 거슬러 오아시스 하란에 이르렀으나, 연로한 데라는 깊은 병에 걸렸다.', hold: 4.6 },
    { do: () => {
      terahActor?.setPose('offer');
      terahActor?.showBubble('...');
      c.audio.playSfx('ui_confirm');
    } },
    { caption: '데라는 장막에서 마지막 숨을 몰아쉬며, 아들 아브람의 손을 굳게 잡았다.', hold: 4.2 },
    { caption: '데라: "아브람아... 네가 만난 살아계신 하나님을... 결코 의심하지 말고 끝까지 따라가거라..."', hold: 5.0 },
    { caption: '향년 205세로 데라가 평안히 눈을 감았다. 아브람과 사래, 롯은 깊이 애도하며 돌무덤을 쌓았다.', hold: 4.6 },
    { wait: 1.0 },

    // ── 3막: 75세의 재소명과 약속의 땅으로의 결단 ──
    { do: () => {
      c.audio.playBgm('bgm_divine_call');
      c.hud.cinematicTitle = null;
      c.renderer.setTilt(24);
      c.setCameraFocus(0, 1.4, 1.0);

      if (abramActor) {
        abramActor.root.position.set(0, 0, 1.0);
        abramActor.face(Math.PI * 0.5); // 가나안이 있는 서쪽을 향해 일어섬
        abramActor.setPose('stand');
      }
      if (saraiActor) {
        saraiActor.setPose('stand');
        saraiActor.face(Math.PI * 0.5);
      }
      if (lotActor) {
        lotActor.setPose('stand');
        lotActor.face(Math.PI * 0.5);
      }

      if (c.beam) {
        c.beam.at(0, 1.0);
        c.beam.strength = 1.0;
      }
      c.particles?.emit('glory_sparkles', 0, 3.0, 1.0, 32);
      c.particles?.emit('divine_beam_motes', 0, 7.0, 1.0, 24);
      c.audio.playSfx('ui_confirm');
    } },
    { wait: 1.4 },
    { caption: '데라가 별세한 후, 여호와께서 하란의 아브람에게 다시금 임하여 말씀하셨다.', hold: 4.2 },
    { caption: '너는 너의 고향과 친척과 아버지의 집을 떠나 내가 네게 보여 줄 땅으로 가라! (창세기 12:1)', style: 'voice', hold: 5.4 },
    { caption: '내가 너로 큰 민족을 이루고 네게 복을 주어 네 이름을 창대하게 하리라! (창세기 12:2)', style: 'voice', hold: 5.4 },
    { do: () => {
      if (c.beam) c.beam.strength = 0;
      c.audio.playSfx('ending_resolve');
    } },
    { caption: '슬픔을 딛고 일어선 75세의 아브람은, 마침내 약속의 땅 가나안을 향해 첫 발을 내딛었다.', hold: 4.8 },
    { caption: '제1권 [불과 팥죽]의 모든 여정이 감동 속에 완주되었습니다.', hold: 4.5 },
    { do: () => {
      cleanupActors();
      c.renderer.resetTilt();
      if (c.player && 'root' in c.player) {
        c.player.root.visible = true;
      }
      c.hud.cinematicTitle = '하란의 안식과 대소명\n약속의 땅으로의 결단';
      c.hud.celebrate('하란 여정 완료', '약속의 땅으로 부르심을 받은 아브람!');
    } },
  ];
}

/** 5. 니므롯 왕궁 심문과 4단계 신학 논쟁 (Ch.5 신학 재판) */
export function createNimrodTrialSteps(c: SceneContext, onTrialComplete?: () => void): Step[] {
  const cutsceneActors: Actor[] = [];
  let cutsceneGroup: THREE.Group | null = null;
  let nimrodActor: Actor | null = null;
  let abramActor: Actor | null = null;
  let guard1: Actor | null = null;
  let guard2: Actor | null = null;
  let terahActor: Actor | null = null;

  const cleanupActors = () => {
    if (cutsceneGroup && c.scene) {
      c.scene.remove(cutsceneGroup);
    }
    for (const a of cutsceneActors) {
      a.dispose();
    }
    cutsceneActors.length = 0;
    cutsceneGroup = null;
  };

  return [
    // 1막: 바벨 이슈타르 왕궁 진입
    { do: () => {
      c.stageManager?.loadStage('ur_palace');
      c.player.root.visible = false;

      cutsceneGroup = new THREE.Group();
      cutsceneGroup.name = 'nimrod_palace_actors';
      c.scene?.add(cutsceneGroup);

      // 니므롯 왕좌에 앉음
      nimrodActor = new Actor('nimrod', 'nimrod');
      nimrodActor.root.position.set(0, 1.4, -10.5);
      nimrodActor.face(0);
      nimrodActor.attachProp('scepter');
      nimrodActor.setPose('sit_throne');

      guard1 = new Actor('g1', 'guard');
      guard1.root.position.set(-2.8, 0, -8.0);
      guard1.face(0);
      guard1.attachProp('spear');

      guard2 = new Actor('g2', 'guard');
      guard2.root.position.set(2.8, 0, -8.0);
      guard2.face(0);
      guard2.attachProp('spear');

      abramActor = new Actor('p_abram', 'abram_young');
      abramActor.root.position.set(0, 0, -2.5);
      abramActor.face(Math.PI);
      abramActor.setPose('bound');

      terahActor = new Actor('p_terah', 'terah');
      terahActor.root.position.set(-2.2, 0, -1.8);
      terahActor.face(Math.PI * 0.8);
      terahActor.setPose('cower');

      const actors = [nimrodActor, guard1, guard2, abramActor, terahActor];
      for (const a of actors) {
        cutsceneGroup.add(a.root);
        cutsceneActors.push(a);
      }

      c.renderer.setTilt(24);
      c.setCameraFocus(0, 2.2, -10.0);
      c.audio.playBgm('bgm_nimrod_empire');
      c.audio.playSfx('war_drum_stinger');
      c.hud.cinematicTitle = '니므롯의 궁정과 신학 재판\n창세기 라바 38:13 / 탈무드 페사힘 118a';
      c.hud.unlockCodex('nimrod_court');
    } },
    { wait: 1.2 },
    { do: () => { c.hud.cinematicTitle = null; } },
    { caption: '우상을 부순 죄목으로 체포된 아브람은, 바벨의 황제 니므롯의 푸른 유약벽돌 궁정으로 끌려왔다.', hold: 4.5 },
    { do: () => {
      nimrodActor?.showBubble('anger');
      c.setCameraFocus(0, 2.8, -10.5);
    } },
    { caption: '니므롯: "갈대아 우르의 신들을 깨뜨린 오만한 자여! 너는 세상의 모든 것을 삼키는 거룩한 불을 경배하라!"', hold: 5.2 },
    { do: () => {
      c.setCameraFocus(0, 1.2, -2.5);
      abramActor?.face(Math.PI);
    } },
    { caption: '아브람: "불을 꺼뜨리는 물을 섬기오리까? 아니면 물을 품어 나르는 구름을 섬기오리까?"', hold: 5.0 },
    { do: () => {
      c.setCameraFocus(0, 2.8, -10.5);
      nimrodActor?.showBubble('!');
    } },
    { caption: '니므롯: "그렇다면 구름을 흩뜨리는 거센 바람을 섬기라!"', hold: 4.2 },
    { do: () => {
      c.setCameraFocus(0, 1.2, -2.5);
      abramActor?.showBubble('resolve');
    } },
    { caption: '아브람: "바람에 맞서는 사람을 섬기오리까? 오직 하늘과 땅을 지으신 살아계신 여호와 하나님만이 참신이십니다!"', hold: 5.2 },
    { do: () => {
      nimrodActor?.setPose('point_accuse');
      nimrodActor?.showBubble('anger');
      c.setCameraFocus(0, 2.8, -10.5);
      c.renderer.shake(0.3, 0.25);
      c.audio.playSfx('war_drum_stinger');
    } },
    { caption: '니므롯: "네가 요사스러운 말로 짐을 조롱하는구나! 어디 네가 말하는 신이 맹렬한 불길 속에서 너를 구원하는지 보리라!"', hold: 5.4 },
    { caption: '니므롯: "저 불경한 자를 풀무불 가마 앞으로 끌고 가라! 칠 배나 뜨겁게 달구어라!"', hold: 4.8 },
    { do: () => {
      cleanupActors();
      c.renderer.resetTilt();
      if (onTrialComplete) onTrialComplete();
    } },
  ];
}

/** 6. 에필로그: 에서와 붉은 팥죽 (Ch.Coda - '불과 팥죽'의 완성) */
export function createEsauLentilStewSteps(c: SceneContext, onComplete?: () => void): Step[] {
  const cutsceneActors: Actor[] = [];
  let cutsceneGroup: THREE.Group | null = null;
  let jacobActor: Actor | null = null;
  let esauActor: Actor | null = null;

  const cleanupActors = () => {
    if (cutsceneGroup && c.scene) {
      c.scene.remove(cutsceneGroup);
    }
    for (const a of cutsceneActors) {
      a.dispose();
    }
    cutsceneActors.length = 0;
    cutsceneGroup = null;
  };

  return [
    // 1막: 시대 전환 - 가나안 헤브론 장막
    { do: () => {
      c.stageManager?.loadStage('esau_camp');
      c.player.root.visible = false;

      cutsceneGroup = new THREE.Group();
      cutsceneGroup.name = 'esau_coda_actors';
      c.scene?.add(cutsceneGroup);

      // 야곱이 솥 곁에 앉아 팥죽을 젓고 있음
      jacobActor = new Actor('c_jacob', 'jacob');
      jacobActor.root.position.set(-1.4, 0, 0.5);
      jacobActor.face(-Math.PI * 0.3);
      jacobActor.setPose('stir_pot');
      jacobActor.attachProp('ladle');

      // 에서는 들판에서 걸어옴
      esauActor = new Actor('c_esau', 'esau');
      esauActor.root.position.set(0, 0, 8.5);
      esauActor.face(Math.PI);
      esauActor.attachProp('bow');

      cutsceneActors.push(jacobActor, esauActor);
      cutsceneGroup.add(jacobActor.root, esauActor.root);

      c.renderer.setTilt(24);
      c.setCameraFocus(0, 1.4, 3.5);
      c.audio.playBgm('bgm_lament');
      c.hud.cinematicTitle = '에필로그 · 에서와 붉은 팥죽\n창세기 25:29-34 / 탈무드 바바 바트라 16b';
      c.hud.unlockCodex('lentil_stew');
    } },
    { wait: 1.2 },
    { do: () => { c.hud.cinematicTitle = null; } },
    { caption: '세월이 흘러 먼 훗날 가나안 땅... 조부 아브라함이 별세한 날, 야곱은 장례를 애도하며 붉은 렌즈콩 팥죽을 끓이고 있었다.', hold: 5.2 },
    // 에서가 비틀거리며 장막 솥으로 다가옴
    {
      animate: 2.8,
      frame: (p) => {
        if (esauActor) {
          esauActor.root.position.z = 8.5 + (1.6 - 8.5) * p;
          esauActor.updateAnimation(0.016, true);
        }
        c.setCameraFocus(0, 1.2, 8.5 * (1 - p) + 1.2 * p);
      },
    },
    { do: () => {
      esauActor?.setPose('faint_hunger');
      esauActor?.showBubble('sweat');
      c.audio.playSfx('ui_confirm');
      c.renderer.shake(0.2, 0.2);
    } },
    { caption: '사냥터에서 며칠을 헤매다 굶주림에 쓰러진 맏아들 에서가 비틀거리며 솥 앞에 무릎을 꿇었다.', hold: 4.8 },
    { caption: '에서: "내가 사냥에 지쳐 곤비하여 죽게 되었으니, 저 붉은 팥죽을 내게 먹게 하라!"', hold: 4.8 },
    { do: () => {
      jacobActor?.face(Math.PI * 0.4);
      c.setCameraFocus(-0.8, 1.2, 0.5);
    } },
    { caption: '야곱: "형의 장자의 명분을 오늘 내게 파십시오."', hold: 4.2 },
    { do: () => {
      esauActor?.showBubble('!');
      c.setCameraFocus(1.2, 1.0, 0.8);
    } },
    { caption: '에서: "내가 지금 굶어 죽게 되었으니, 이 장자권이 내게 무슨 유익이 있으리요!"', hold: 5.0 },
    { caption: '에서는 하나님이 아브라함에게 주신 언약의 장자권을 맹세하여 넘기고, 붉은 팥죽 한 그릇을 받아 꿀꺽 삼켰다.', hold: 5.4 },
    { do: () => {
      esauActor?.setPose('stand');
      esauActor?.face(0);
      c.audio.playBgm('bgm_ancient_memory');
      c.audio.playSfx('ending_resolve');
      c.renderer.setTilt(22);
      c.setCameraFocus(0, 1.4, 2.0);
    } },
    { caption: '배를 채운 에서는 곧장 일어나 장막을 떠나갔다. 성경은 "에서가 장자의 명분을 가볍게 여김이었더라" 기록한다.', hold: 5.6 },
    { caption: '갈대아 우르의 풀무불에서 가나안의 붉은 팥죽까지, 믿음의 가문을 세우시는 하나님의 섭리가 이루어졌다.', hold: 5.4 },
    { do: () => {
      cleanupActors();
      c.player.root.visible = true;
      c.renderer.resetTilt();
      c.hud.celebrate('제1권 [불과 팥죽] 완주', '믿음과 언약의 대단원!');
      c.hud.cinematicTitle = '제1권 · 불과 팥죽 완주\n제2권 [약속의 땅]으로 이어집니다';
      if (onComplete) onComplete();
    } },
  ];
}
