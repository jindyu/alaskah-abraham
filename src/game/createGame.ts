import * as THREE from 'three';
import { PixelRenderer } from '../renderer/pixelRenderer';
import { GraphicsInitError, GRAPHICS_FATAL_TEXT, showFatal } from './fatal';
import { PAL, PAL_REGION } from '../world/palette';
import { Hud, type Prompt } from '../ui/hud';
import { mountTouchControls } from '../ui/touchControls';
import { Interactions, type Interactable } from '../systems/interaction';
import { PanelStack } from './panels';
import { bindInput, type ClickApi } from './input';
import { groundPoint, ndcOf, pickInteractable } from './worldClick';
import { SaveLifecycle, saveFailText, type WriteOutcome } from './saveLifecycle';
import { activeSlot, readSave, writeSaveDetail, type SaveData } from '../systems/save';
import { AudioManager } from '../audio/audioManager';
import { StageManager, type StageId } from '../world/stageManager';
import { Player } from '../entities/player';
import { DEFAULT_APPEARANCE } from '../entities/appearance';
import { Collision } from '../world/collision';
import { Cutscene } from '../systems/cutscene/cutscene';
import { Beam } from '../entities/beam';
import { setupBook1Actions } from '../systems/actions/book1Actions';
import { setupBook2Actions } from '../systems/actions/book2Actions';
import { setupBook3Actions } from '../systems/actions/book3Actions';
import { setupBook4Actions } from '../systems/actions/book4Actions';
import { setupBook5Actions } from '../systems/actions/book5Actions';
import {
  createBook1IntroSteps,
  createFurnaceMiracleSteps,
  createNightCallingSteps,
  createHaranSteps,
  createNimrodTrialSteps,
  createEsauLentilStewSteps,
  type SceneContext,
} from '../systems/scenes/book1/book1Scenes';
import {
  createShechemAltarSteps,
  createEgyptBorderSteps,
  createHobahRescueSteps,
} from '../systems/scenes/book2/book2Scenes';
import {
  createStarsCovenantSteps,
} from '../systems/scenes/book3/book3Scenes';
import {
  createThreeVisitorsSteps,
  createSodomRiotSteps,
} from '../systems/scenes/book4/book4Scenes';
import {
  createIsaacBirthFeastSteps,
  createRoadToMoriahSteps,
  createMountMoriahAkedahSteps,
} from '../systems/scenes/book5/book5Scenes';
import { CutsceneEngine } from '../systems/cutscene/cutsceneEngine';
import { CrowdManager } from '../entities/crowd';
import { Actor } from '../entities/actor';
import type { ProtagonistId } from '../entities/cast';
import { BOOKS } from '../data/books';
import { getChapterContext } from '../systems/story';
import { setupChapterActions } from '../systems/actions/bookActions';
import { ParticleManager } from '../renderer/particles';
import { updateEnvironmentWind } from '../renderer/environmentWind';

const SPEED = 4.2;
const AUTOSAVE_SECONDS = 20;
const ARRIVE = 0.18;

export function createGame(): void {
  const host = document.getElementById('game');
  if (!host) return;

  let pr: PixelRenderer;
  try {
    pr = new PixelRenderer(host);
  } catch (e) {
    showFatal(document, e instanceof GraphicsInitError ? GRAPHICS_FATAL_TEXT : undefined);
    return;
  }

  const { scene } = pr;
  scene.background = new THREE.Color(PAL.skyGrad[2]);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
  sun.position.set(-8, 14, 6);
  const hemi = new THREE.HemisphereLight(0xcfe4f0, 0x8a6440, 1.1);
  const torchLight = new THREE.PointLight(0xff6611, 0, 16);
  scene.add(sun, hemi, torchLight);

  // ── 파티클 및 빛기둥 시스템 ──
  const particles = new ParticleManager();
  scene.add(particles.group);
  const beam = new Beam();
  scene.add(beam.group);

  // ── 서브시스템 초기화 ──
  const audio = new AudioManager();
  const stageManager = new StageManager(scene);
  const crowd = new CrowdManager();
  scene.add(crowd.group);
  const interactions = new Interactions();
  const panels = new PanelStack();
  const cutscene = new Cutscene();

  // ── 저장 불러오기 ──
  const slot = activeSlot();
  const loaded = readSave(slot);
  let curBook = loaded?.story?.book ?? 1;
  let curChapter = loaded?.story?.chapter ?? 0;
  let playSeconds = loaded?.playSeconds ?? 0;

  // ── UI ──
  const ui = { x: 0, y: 0 };
  const proj = new THREE.Vector3();
  const toUi = (x: number, y: number, z: number) => {
    proj.set(x, y, z).project(pr.camera);
    ui.x = (proj.x * 0.5 + 0.5) * hud.uiW;
    ui.y = (1 - (proj.y * 0.5 + 0.5)) * hud.uiH;
    return ui;
  };
  const hud = new Hud(host, toUi);
  pr.resized(() => hud.resize(pr.size.w, pr.size.h, pr.size.scale));
  const touch = mountTouchControls();
  hud.touch = touch.visible;
  if (touch.visible) touch.show();

  // ── 컷신 엔진 ──
  const cutsceneEngine = new CutsceneEngine({
    scene,
    renderer: pr,
    hud,
    audio,
    crowd,
    particles,
    onMapChange: (mapId, _loc) => {
      // 맵 ID와 StageId 매핑
      let targetStage: StageId = 'ur_workshop';
      if (mapId === 'PALACE_UR') targetStage = 'ur_palace';
      else if (mapId === 'FURNACE') targetStage = 'ur_furnace';
      else if (mapId === 'FIELD') targetStage = 'shechem_bethel';
      else if (mapId === 'EGYPT') targetStage = 'egypt';
      else if (mapId === 'SODOM') targetStage = 'sodom';
      else if (mapId === 'BEERSHEBA') targetStage = 'beersheba';
      else if (mapId === 'MORIAH') targetStage = 'moriah';
      const st = stageManager.loadStage(targetStage);
      applyAtmosphere(st.region, st.id);
    },
    onChapterComplete: () => {
      // 컷신 종료 후 플레이어블 액션 연결
      setupInteractiveLoop();
    },
  });

  // ── 플레이어 (alaskah-noah 정통 복셀 플레이어) ──
  const dummyCol = new Collision();
  let currentHero: ProtagonistId = 'abram_young';
  const player = new Player(DEFAULT_APPEARANCE);
  scene.add(player.root);

  function setPlayableProtagonist(hero: ProtagonistId): void {
    currentHero = hero;
  }

  // ── 4대 지역 팔레트 기반 대기 조명 & 하늘 동적 튜닝 ──
  function applyAtmosphere(region: 'MESOPOTAMIA' | 'CANAAN' | 'EGYPT' | 'SODOM_NEGEV', stageId: StageId): void {
    scene.fog = null; // 선명한 3D 복셀 픽셀 아트를 위해 안개 제거 (소돔 제외)
    switch (region) {
      case 'MESOPOTAMIA':
        scene.background = new THREE.Color(PAL.skyGrad[0]); // 0x8cc8e8 따뜻하고 청명한 푸른 하늘
        sun.color.setHex(0xfff6e4);
        sun.intensity = 2.4;
        hemi.color.setHex(0xfff8f0);
        hemi.groundColor.setHex(0x8a6440);
        hemi.intensity = 1.3;
        break;

      case 'CANAAN':
        scene.background = new THREE.Color(PAL_REGION.CANAAN.sky[1]);
        sun.color.setHex(0xfff2d8);
        sun.intensity = 2.4;
        hemi.color.setHex(0xcfe4f0);
        hemi.groundColor.setHex(0x6f874e);
        hemi.intensity = 1.3;
        break;

      case 'EGYPT':
        scene.background = new THREE.Color(PAL_REGION.EGYPT.sky[1]);
        sun.color.setHex(0xfff8e0);
        sun.intensity = 2.6;
        hemi.color.setHex(0x8ec8e0);
        hemi.groundColor.setHex(0xd8b472);
        hemi.intensity = 1.3;
        break;

      case 'SODOM_NEGEV':
        if (stageId === 'sodom') {
          // 소돔: 종말론적 유황불빛 붉은 안개
          scene.background = new THREE.Color(0x502820);
          scene.fog = new THREE.FogExp2(0x803828, 0.015);
          sun.color.setHex(0xf36820);
          sun.intensity = 2.3;
          hemi.color.setHex(0xddc438);
          hemi.groundColor.setHex(0xba7c52);
        } else {
          // 브엘세바 & 모리아: 메마른 광야 & 장엄한 산지
          scene.background = new THREE.Color(0xa67450);
          sun.color.setHex(0xffe8c0);
          sun.intensity = 2.4;
          hemi.color.setHex(0xe8d0b0);
          hemi.groundColor.setHex(0x9a7452);
          hemi.intensity = 1.3;
        }
        break;
    }
  }

  // ── 카메라 조망 및 씬 컨텍스트 ──
  const cameraFocus = new THREE.Vector3();
  const sceneCtx: SceneContext = {
    renderer: pr,
    hud,
    audio,
    player,
    beam,
    stageManager,
    particles,
    scene,
    lights: {
      sun,
      hemi,
      torchLight,
    },
    setCameraFocus: (x: number, y: number, z: number) => {
      cameraFocus.set(x, y, z);
    },
  };

  // ── 챕터 로딩 및 전환 라이프사이클 ──
  function setupInteractiveLoop(): void {
    if (curBook === 1) {
      const st = stageManager.stage;
      if (st && st.urDetails) {
        setupBook1Actions({
          interactions,
          hud,
          audio,
          particles,
          cutscene,
          sceneCtx,
          urStage: st.urDetails,
          onBook1Complete: () => {
            advanceChapter();
          },
        });
        return;
      }
    }

    if (curBook === 2) {
      const st = stageManager.stage;
      if (st) {
        setupBook2Actions({
          interactions,
          hud,
          audio,
          particles,
          cutscene,
          sceneCtx,
          stageId: st.id,
          onBook2Complete: () => {
            advanceChapter();
          },
        });
        return;
      }
    }

    if (curBook === 3) {
      setupBook3Actions({
        interactions,
        hud,
        audio,
        particles,
        cutscene,
        sceneCtx,
        onBook3Complete: () => {
          advanceChapter();
        },
      });
      return;
    }

    if (curBook === 4) {
      const st = stageManager.stage;
      if (st) {
        setupBook4Actions({
          interactions,
          hud,
          audio,
          particles,
          cutscene,
          sceneCtx,
          stageId: st.id,
          onBook4Complete: () => {
            advanceChapter();
          },
        });
        return;
      }
    }

    if (curBook === 5) {
      const st = stageManager.stage;
      if (st) {
        setupBook5Actions({
          interactions,
          hud,
          audio,
          particles,
          cutscene,
          sceneCtx,
          stageId: st.id,
          onBook5Complete: () => {
            advanceChapter();
          },
          onSwitchStage: (sId: string) => {
            const newStage = stageManager.loadStage(sId as any);
            applyAtmosphere(newStage.region, newStage.id);
            player.root.position.set(newStage.spawn.x, 0, newStage.spawn.z);
            audio.playBgm(newStage.bgm);
            audio.playAmbience(newStage.ambience);
            setupInteractiveLoop();
          },
        });
        return;
      }
    }

    setupChapterActions({
      interactions,
      hud,
      audio,
      particles,
      bookIndex: curBook,
      chapterIndex: curChapter,
      onLoopComplete: () => {
        advanceChapter();
      },
    });
  }

  function advanceChapter(): void {
    const bookData = BOOKS[curBook];
    if (!bookData) return;

    if (curChapter + 1 < bookData.chapters.length) {
      loadChapter(curBook, curChapter + 1);
    } else if (curBook + 1 < BOOKS.length) {
      loadChapter(curBook + 1, 0);
    } else {
      hud.celebrate('대단원', '아브라함의 모든 여정을 마쳤습니다');
      loadChapter(7, 0); // 아우트로
    }
  }

  function loadChapter(bookIdx: number, chapterIdx: number): void {
    curBook = Math.max(0, Math.min(BOOKS.length - 1, bookIdx));
    const bData = BOOKS[curBook];
    curChapter = Math.max(0, Math.min(bData.chapters.length - 1, chapterIdx));

    interactions.clear();
    crowd.clear();
    particles.clear();
    cutsceneEngine.stop();
    cutscene.abort();

    const ctx = getChapterContext(curBook, curChapter);
    setPlayableProtagonist(ctx.hero);

    const stage = stageManager.loadStage(ctx.stageId);
    applyAtmosphere(stage.region, stage.id);

    player.root.position.set(stage.spawn.x, 0, stage.spawn.z);

    hud.goal = ctx.defaultGoal;
    audio.playBgm(stage.bgm);
    audio.playAmbience(stage.ambience);

    // 1권인 경우: alaskah-noah 스타일의 풍부한 우르 시가지와 액션 루프 구동!
    if (curBook === 1) {
      setupInteractiveLoop();
      // 첫 시작 시 인트로 재생
      if (!loaded || playSeconds < 2) {
        cutscene.play(createBook1IntroSteps(sceneCtx), undefined, 'book1_intro');
      }
      return;
    }

    // 2권인 경우: 세겜, 애굽, 롯 구출의 가나안 대장정 액션 루프 구동!
    if (curBook === 2) {
      setupInteractiveLoop();
      if (curChapter === 0) {
        cutscene.play(createShechemAltarSteps(sceneCtx), undefined, 'book2_shechem');
      } else if (curChapter === 1) {
        cutscene.play(createEgyptBorderSteps(sceneCtx), undefined, 'book2_egypt');
      } else if (curChapter === 6) {
        cutscene.play(createHobahRescueSteps(sceneCtx), undefined, 'book2_hobah');
      }
      return;
    }

    // 3권인 경우: 별과 횃불 언약, 할례와 새 이름의 마므레 장막 액션 루프 구동!
    if (curBook === 3) {
      setupInteractiveLoop();
      if (curChapter === 0) {
        cutscene.play(createStarsCovenantSteps(sceneCtx), undefined, 'book3_stars');
      }
      return;
    }

    // 4권인 경우: 마므레 세 천사 영접과 소돔 멸망 탈출(롯 시점) 액션 루프 구동!
    if (curBook === 4) {
      setupInteractiveLoop();
      if (curChapter === 0) {
        cutscene.play(createThreeVisitorsSteps(sceneCtx), undefined, 'book4_visitors');
      } else if (curChapter === 1 || curChapter === 2) {
        cutscene.play(createSodomRiotSteps(sceneCtx), undefined, 'book4_sodom');
      }
      return;
    }

    // 5권인 경우: 브엘세바 우물과 모리아 산 아케다(이삭 결박 및 여호와 이레) 액션 루프 구동!
    if (curBook === 5) {
      setupInteractiveLoop();
      if (curChapter === 0) {
        cutscene.play(createIsaacBirthFeastSteps(sceneCtx), undefined, 'book5_isaac_birth');
      } else if (curChapter === 4 || curChapter === 5) {
        cutscene.play(createRoadToMoriahSteps(sceneCtx), undefined, 'book5_moriah_road');
      } else if (curChapter === 6) {
        cutscene.play(createMountMoriahAkedahSteps(sceneCtx), undefined, 'book5_moriah_akedah');
      }
      return;
    }

    const chData = bData.chapters[curChapter];
    if (chData && chData.steps && chData.steps.length > 0) {
      cutsceneEngine.playSequence(chData.steps);
    } else {
      setupInteractiveLoop();
    }
  }

  // ── 키보드 / 입력 라우팅 ──
  // 0. 대화 2지선다 선택지 모달 [↑/↓, 1/2, Enter/Space/E]
  panels.addKey({
    get open() { return !!hud.choice; },
    key(e) {
      if (!hud.choice) return false;
      const ch = hud.choice;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        ch.selectedIndex = Math.max(0, ch.selectedIndex - 1);
        audio.playSfx('ui_confirm');
        return true;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        ch.selectedIndex = Math.min(ch.options.length - 1, ch.selectedIndex + 1);
        audio.playSfx('ui_confirm');
        return true;
      }
      if (e.code === 'Digit1') {
        ch.selectedIndex = 0;
        audio.playSfx('ui_confirm');
        hud.choice = null;
        ch.onSelect(0);
        return true;
      }
      if (e.code === 'Digit2' && ch.options.length > 1) {
        ch.selectedIndex = 1;
        audio.playSfx('ui_confirm');
        hud.choice = null;
        ch.onSelect(1);
        return true;
      }
      if (e.code === 'Digit3' && ch.options.length > 2) {
        ch.selectedIndex = 2;
        audio.playSfx('ui_confirm');
        hud.choice = null;
        ch.onSelect(2);
        return true;
      }
      if (e.code === 'Digit4' && ch.options.length > 3) {
        ch.selectedIndex = 3;
        audio.playSfx('ui_confirm');
        hud.choice = null;
        ch.onSelect(3);
        return true;
      }
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        const idx = ch.selectedIndex;
        audio.playSfx('ui_confirm');
        hud.choice = null;
        ch.onSelect(idx);
        return true;
      }
      return true;
    },
    pointer(ev) {
      if (!hud.choice || ev.kind !== 'down') return false;
      return hud.handleChoiceClick(ev.x, ev.y);
    },
  }, 2);

  // 1. 권/장 선택 오버레이 [Tab]
  panels.addKey({
    get open() { return hud.chapterSelect.open; },
    key(e) {
      if (e.code === 'Tab' || e.code === 'Escape') {
        hud.chapterSelect.open = false;
        return true;
      }
      if (e.code === 'ArrowLeft') {
        hud.chapterSelect.bookIndex = (hud.chapterSelect.bookIndex + BOOKS.length - 1) % BOOKS.length;
        hud.chapterSelect.chapterIndex = 0;
        return true;
      }
      if (e.code === 'ArrowRight') {
        hud.chapterSelect.bookIndex = (hud.chapterSelect.bookIndex + 1) % BOOKS.length;
        hud.chapterSelect.chapterIndex = 0;
        return true;
      }
      const chCount = BOOKS[hud.chapterSelect.bookIndex]?.chapters.length || 1;
      if (e.code === 'ArrowUp') {
        hud.chapterSelect.chapterIndex = (hud.chapterSelect.chapterIndex + chCount - 1) % chCount;
        return true;
      }
      if (e.code === 'ArrowDown') {
        hud.chapterSelect.chapterIndex = (hud.chapterSelect.chapterIndex + 1) % chCount;
        return true;
      }
      if (e.code === 'Enter') {
        const b = hud.chapterSelect.bookIndex;
        const c = hud.chapterSelect.chapterIndex;
        hud.chapterSelect.open = false;
        loadChapter(b, c);
        return true;
      }
      return true;
    },
  }, 10);

  // 1-2. 성경 & 미드라시 도감 오버레이 [C]
  panels.addKey({
    get open() { return hud.codex.open; },
    key(e) {
      if (e.code === 'KeyC' || e.code === 'Escape') {
        hud.codex.open = false;
        return true;
      }
      const count = hud.codex.entries.length;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        hud.codex.selectedIndex = (hud.codex.selectedIndex + count - 1) % count;
        audio.playSfx('ui_confirm');
        return true;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        hud.codex.selectedIndex = (hud.codex.selectedIndex + 1) % count;
        audio.playSfx('ui_confirm');
        return true;
      }
      return true;
    },
    pointer(ev) {
      if (!hud.codex.open || ev.kind !== 'down') return false;
      return hud.handleCodexClick(ev.x, ev.y);
    },
  }, 10);

  // 2. 일시정지 메뉴 [Esc]
  panels.addKey({
    get open() { return hud.pauseMenu.open; },
    key(e) {
      if (e.code === 'Escape') {
        hud.pauseMenu.open = false;
        return true;
      }
      if (e.code === 'ArrowUp') {
        hud.pauseMenu.selectedItem = (hud.pauseMenu.selectedItem + 4) % 5;
        return true;
      }
      if (e.code === 'ArrowDown') {
        hud.pauseMenu.selectedItem = (hud.pauseMenu.selectedItem + 1) % 5;
        return true;
      }
      if (e.code === 'Enter') {
        const idx = hud.pauseMenu.selectedItem;
        if (idx === 0 || idx === 4) {
          hud.pauseMenu.open = false;
        } else if (idx === 1) {
          audio.bgmVol = audio.bgmVol > 0.1 ? 0 : 0.7;
          hud.toast('audio', null, `BGM 볼륨: ${Math.round(audio.bgmVol * 100)}%`);
        } else if (idx === 2) {
          audio.sfxVol = audio.sfxVol > 0.1 ? 0 : 0.8;
          hud.toast('audio', null, `SFX 볼륨: ${Math.round(audio.sfxVol * 100)}%`);
        } else if (idx === 3) {
          audio.voiceVol = audio.voiceVol > 0.1 ? 0 : 0.9;
          hud.toast('audio', null, `보이스 볼륨: ${Math.round(audio.voiceVol * 100)}%`);
        }
        return true;
      }
      return true;
    },
  }, 10);

  // 3. 컷신 대사 넘기기 [Space / Enter / E]
  panels.addKey({
    get open() { return cutsceneEngine.running || cutscene.running; },
    key(e) {
      if (cutscene.running) {
        cutscene.key(e);
        return true;
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        cutsceneEngine.advance();
        return true;
      }
      return false;
    },
  }, 20);

  // ── 월드 클릭 및 이동 바인딩 ──
  const keys = new Set<string>();
  const walk = { on: false, x: 0, z: 0, act: null as Interactable | null };
  let aimed: Interactable | null = null;

  const click: ClickApi = {
    ground: (cx, cy) => {
      const r = pr.renderer.domElement.getBoundingClientRect();
      const n = ndcOf(cx, cy, r);
      return groundPoint(pr.camera, n.x, n.y);
    },
    pick: (x, z) => pickInteractable(interactions.values(), x, z),
    walkTo: (x, z) => {
      if (cutsceneEngine.running || cutscene.running) {
        if (cutscene.running) cutscene.key(new KeyboardEvent('keydown', { code: 'Space' }));
        else cutsceneEngine.advance();
        return;
      }
      walk.on = true; walk.x = x; walk.z = z; walk.act = null;
    },
    walkToAct: (a) => {
      if (cutsceneEngine.running || cutscene.running) {
        if (cutscene.running) cutscene.key(new KeyboardEvent('keydown', { code: 'Space' }));
        else cutsceneEngine.advance();
        return;
      }
      const p = a.pos(); walk.on = true; walk.x = p.x; walk.z = p.z; walk.act = a;
    },
    cancel: () => { walk.on = false; walk.act = null; },
  };

  hud.onBlip = (speaker) => {
    audio.playVoiceBlip(speaker);
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC' && !cutsceneEngine.running && !cutscene.running && !hud.chapterSelect.open && !hud.pauseMenu.open && !hud.choice) {
      hud.codex.open = !hud.codex.open;
      if (hud.codex.open) audio.playSfx('ui_confirm');
    }
  });

  bindInput(window, {
    hud, keys, panels, click,
    panelOpen: () => panels.anyOpen() || hud.chapterSelect.open || hud.pauseMenu.open || hud.codex.open || !!hud.choice,
    transitioning: () => false,
    aim: () => aimed,
    onAct: (a) => {
      const p = a.pos();
      player.faceTo(p.x, p.z);
    },
    onActError: () => hud.toast('act-error', null, '문제가 생겨 행동을 마치지 못했다', 0, 5),
    openChapterSelect: () => {
      hud.chapterSelect.bookIndex = curBook;
      hud.chapterSelect.chapterIndex = curChapter;
      hud.chapterSelect.open = !hud.chapterSelect.open;
    },
    openPause: () => {
      hud.pauseMenu.open = !hud.pauseMenu.open;
    },
  });

  // ── 첫 챕터 로딩 ──
  loadChapter(curBook, curChapter);
  if (loaded) hud.toast('load', null, `이어서 시작한다 (제${curBook}권 ${curChapter + 1}장)`);

  // ── 저장 라이프사이클 ──
  const snapshot = (): Omit<SaveData, 'version' | 'savedAt'> => ({
    story: { book: curBook, chapter: curChapter, hero: currentHero },
    player: { x: player.root.position.x, z: player.root.position.z },
    playSeconds: Math.floor(playSeconds),
  });
  const write = (): WriteOutcome => {
    const d = writeSaveDetail(snapshot(), slot);
    return d.result === 'ok' ? true : d.result === 'conflict' ? 'conflict' : d.reason ?? false;
  };
  const lifecycle = new SaveLifecycle(
    () => ({ disabled: false, leaving: false, started: true, locked: false, cutscene: cutsceneEngine.running }),
    write,
    (reason) => hud.toast('save-fail', null, saveFailText(reason), 0, 6),
    () => hud.toast('save-conflict', null, '다른 탭에서 저장해 이 탭은 저장을 멈췄다', 0, 8),
  );
  lifecycle.bind(window, document);
  let sinceSave = 0;

  // ── 프레임 렌더 루프 ──
  const prompt: Prompt = { x: 0, y: 0, label: '' };
  const focus = new THREE.Vector3();
  let last = performance.now();

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    playSeconds += dt;
    sinceSave += dt;
    if (sinceSave >= AUTOSAVE_SECONDS) { sinceSave = 0; lifecycle.save(); }

    // 컷신 및 군중 업데이트
    if (cutsceneEngine.running) {
      cutsceneEngine.update(dt);
    }
    if (cutscene.running) {
      cutscene.update(dt);
      hud.caption = cutscene.caption;
    } else if (!cutsceneEngine.running) {
      hud.caption = null;
    }
    crowd.update(dt);
    particles.update(dt);
    beam.update(dt);
    updateEnvironmentWind(now * 0.001, 0, pr.fx);
    stageManager.update(dt, now * 0.001);

    const st = stageManager.stage;
    const p = player.root.position;

    // 미니맵 위치 동기화 및 플레이어 화면 좌표 추적
    hud.minimap.playerX = p.x;
    hud.minimap.playerZ = p.z;
    hud.minimap.playerFacing = player.facing;
    hud.markerFrom.x = p.x;
    hud.markerFrom.z = p.z;

    // NPC 및 동물 애니메이션 업데이트
    if (st && st.urDetails) {
      for (const a of st.urDetails.actors) {
        a.updateAnimation(dt, false);
      }
      if (st.urDetails.animals) {
        for (const an of st.urDetails.animals) {
          an.update(dt, now * 0.001, p.x, p.z);
        }
      }
    }

    // 고대 우르 대기 중 미세 모래 먼지(Dust Motes) 방출
    if (st && st.urDetails && !cutsceneEngine.running && !cutscene.running) {
      if (Math.random() < 0.22) {
        particles.emit(
          'desert_dust',
          p.x - 12 + Math.random() * 24,
          0.4 + Math.random() * 2.2,
          p.z - 12 + Math.random() * 24,
          1,
        );
      }
    }

    // 동적 횃불/화로 조명 깜빡임
    if (st && (st.id === 'ur_furnace' || st.id === 'sodom')) {
      torchLight.intensity = 1.8 + Math.sin(now * 0.015) * 0.35 + Math.cos(now * 0.031) * 0.2;
      torchLight.position.set(p.x, 2.0, p.z);
    } else {
      torchLight.intensity = 0;
    }

    // 플레이어 이동 (컷신 중이 아닐 때만)
    const inAnyCutscene = cutsceneEngine.running || cutscene.running;
    if (!inAnyCutscene && !hud.chapterSelect.open && !hud.pauseMenu.open) {
      let dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      let dz = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);

      if (dx || dz) walk.on = false;
      else if (walk.on) {
        const wx = walk.x - p.x, wz = walk.z - p.z, wd = Math.hypot(wx, wz);
        if (wd < ARRIVE + (walk.act ? walk.act.r : 0)) {
          walk.on = false;
          const a = walk.act; walk.act = null;
          if (a) a.act();
        } else { dx = wx / wd; dz = wz / wd; }
      }

      const isRunning = keys.has('ShiftLeft') || keys.has('ShiftRight');
      player.update(dt, { x: dx, z: dz, run: isRunning }, st?.col ?? dummyCol, []);

      aimed = interactions.nearest(p.x, p.z, player.facing);
    } else {
      aimed = null;
      player.update(dt, { x: 0, z: 0, run: false }, st?.col ?? dummyCol, []);
    }

    let pp: Prompt | null = null;
    if (aimed) {
      const at = aimed.pos();
      const s = toUi(at.x, aimed.height, at.z);
      prompt.x = s.x; prompt.y = s.y; prompt.label = aimed.label() ?? '';
      pp = prompt;
    }

    if (cutscene.running && cameraFocus.lengthSq() > 0) {
      focus.copy(cameraFocus);
    } else {
      focus.set(p.x, 0.7, p.z);
    }
    pr.follow(focus);
    pr.render();
    hud.draw(dt, pp);
    requestAnimationFrame(frame);
  };

  const debugApi = {
    triggerFurnace: () => {
      cutscene.play(
        createFurnaceMiracleSteps(sceneCtx),
        () => {
          hud.celebrate('풀무불의 승리', '불길 속에서 살아나온 아브람!');
        },
        'furnace_miracle',
      );
    },
    triggerNightCalling: () => {
      cutscene.play(
        createNightCallingSteps(sceneCtx),
        undefined,
        'night_calling',
      );
    },
    triggerHaranJourney: () => {
      cutscene.play(
        createHaranSteps(sceneCtx),
        undefined,
        'haran_journey',
      );
    },
    triggerNimrodTrial: () => {
      cutscene.play(
        createNimrodTrialSteps(sceneCtx),
        undefined,
        'nimrod_trial',
      );
    },
    triggerEsauCoda: () => {
      cutscene.play(
        createEsauLentilStewSteps(sceneCtx),
        undefined,
        'esau_coda',
      );
    },
    toggleCodex: () => {
      hud.codex.open = !hud.codex.open;
    },
    advanceCutscene: () => cutscene.key(new KeyboardEvent('keydown', { code: 'Space' })),
    loadStage: (stageId: StageId) => stageManager.loadStage(stageId),
    sceneCtx,
    stageManager,
    hud,
    cutscene,
  };

  (window as any).__AGY_DEBUG__ = debugApi;
  (window as any).__GAME__ = debugApi;

  requestAnimationFrame(frame);
}
