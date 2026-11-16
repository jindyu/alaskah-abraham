import * as THREE from 'three';
import { PixelRenderer } from '../renderer/pixelRenderer';
import { GraphicsInitError, GRAPHICS_FATAL_TEXT, showFatal } from './fatal';
import { PAL } from '../world/palette';
import { Hud } from '../ui/hud';
import { mountTouchControls } from '../ui/touchControls';
import { Interactions, type Interactable } from '../systems/interaction';
import { PanelStack } from './panels';
import { bindInput, type ClickApi } from './input';
import { groundPoint, ndcOf, pickInteractable } from './worldClick';
import { activeSlot, readSave } from '../systems/save';
import { AudioManager } from '../audio/audioManager';
import { StageManager } from '../world/stageManager';
import { Player } from '../entities/player';
import { DEFAULT_APPEARANCE } from '../entities/appearance';
import { Collision } from '../world/collision';
import { Cutscene } from '../systems/cutscene/cutscene';
import { Beam } from '../entities/beam';
import type { SceneContext } from '../systems/scenes/book1/book1Scenes';
import { CutsceneEngine } from '../systems/cutscene/cutsceneEngine';
import { CrowdManager } from '../entities/crowd';
import type { ProtagonistId } from '../entities/cast';
import { installMenus } from './menus';
import { installDevHooks } from './devHooks';
import { ambientFor, type AmbientKind } from './timeOfDay';
import { createAtmosphere } from './atmosphere';
import { ChapterLog } from './chapterLog';
import { anyModalOpen, toggleChapterSelect, toggleCodex, toggleHelp, togglePause } from './panelToggles';
import { ParticleManager } from '../renderer/particles';
import { tr } from '../i18n/tr';
import { createGameState } from './gameState';
import { createLights } from './gameLights';
import { appearanceFor } from './protagonists';
import { createChapterFlow, stageForMapId, type ChapterFlow } from './chapterFlow';
import { createSaveSession, hasSeenHelp, markHelpSeen, resumeFromSave } from './saveSession';
import { createWalkState } from './playerMotion';
import { createFrameLoop, type InputState } from './frameLoop';

/** 조립 루트: 서브시스템을 만들고 서로 연결만 한다. 규칙·상태·루프는 각 모듈(gameState·chapterFlow·saveSession·frameLoop 등)에 있다. */
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
  const { sun, hemi, torchLight } = createLights(scene);

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
  const chapterLog = new ChapterLog();
  interactions.onAct = (id) => chapterLog.recordAct(id);
  const panels = new PanelStack();
  const cutscene = new Cutscene();

  // ── 저장 불러오기 + 진행 상태 ──
  const slot = activeSlot();
  const loaded = readSave(slot);
  const state = createGameState(loaded);

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
  hud.doneChapters = state.doneChapters;
  hud.picks = state.picks;
  pr.resized(() => hud.resize(pr.size.w, pr.size.h, pr.size.scale));
  const touch = mountTouchControls();
  hud.touch = touch.visible;
  if (touch.visible) touch.show();

  // ── 플레이어 (alaskah-noah 정통 복셀 플레이어) ──
  const player = new Player(DEFAULT_APPEARANCE);
  scene.add(player.root);
  const setHero = (hero: ProtagonistId): void => {
    state.hero = hero;
    player.setAppearance(appearanceFor(hero));
  };
  setHero(state.hero);

  // ── 4대 지역 팔레트 기반 대기 조명 & 하늘 + 환경 입자 종류 ──
  const applyBaseAtmosphere = createAtmosphere({
    scene, sun, hemi,
    setMinimapLabel: (name) => hud.setMinimapLabel(name),
    currentBook: () => state.book,
  });
  let ambientKind: AmbientKind | null = null;
  const applyAtmosphere: typeof applyBaseAtmosphere = (region, stageId) => {
    applyBaseAtmosphere(region, stageId);
    ambientKind = ambientFor(state.book, stageId);
  };

  // ── 카메라 조망 및 씬 컨텍스트 ──
  const cameraFocus = new THREE.Vector3();
  const sceneCtx: SceneContext = {
    renderer: pr, hud, audio, player, beam, stageManager, particles, scene,
    lights: { sun, hemi, torchLight },
    setCameraFocus: (x: number, y: number, z: number) => { cameraFocus.set(x, y, z); },
  };

  // ── 컷신 엔진 (장 흐름과는 지연 참조로 이어진다: flow 는 아래에서 만들어진다) ──
  let flow: ChapterFlow;
  const cutsceneEngine = new CutsceneEngine({
    scene, renderer: pr, hud, audio, crowd, particles,
    onMapChange: (mapId, _loc) => {
      const st = stageManager.loadStage(stageForMapId(mapId));
      applyAtmosphere(st.region, st.id);
    },
    onChapterComplete: () => flow.setupInteractiveLoop(), // 컷신 종료 후 플레이어블 액션 연결
  });

  // ── 챕터 로딩·전환·에필로그 (chapterFlow.ts) ──
  flow = createChapterFlow({
    state, hasSave: !!loaded, hud, audio, crowd, particles, interactions, cutscene, cutsceneEngine,
    stageManager, player, chapterLog, sceneCtx, applyAtmosphere, setHero,
  });

  // ── 저장 수명주기 (saveSession.ts) ──
  const lifecycle = createSaveSession({
    state, slot, hud, player, stageManager, chapterLog,
    busyCutscene: () => cutsceneEngine.running || cutscene.running,
    panelsOpen: () => panels.anyOpen(),
  });

  // ── 키보드 / 입력 라우팅 (menus.ts): 선택지·권/장 선택·도감·도움말·일시정지·컷신 넘기기 ──
  installMenus({
    audio, hud, panels, cutscene, cutsceneEngine, loadChapter: flow.loadChapter,
    getBook: () => state.book,
    getChapter: () => state.chapter,
    lifecycle: () => lifecycle,
    advance: () => flow.advanceChapter(),
  });

  // ── 월드 클릭 및 이동 바인딩 ──
  const input: InputState = { keys: new Set<string>(), walk: createWalkState(), aimed: null };
  const walk = input.walk;
  const skipOrAdvance = (): void => {
    if (cutscene.running) cutscene.key(new KeyboardEvent('keydown', { code: 'Space' }));
    else cutsceneEngine.advance();
  };
  const click: ClickApi = {
    ground: (cx, cy) => {
      const r = pr.renderer.domElement.getBoundingClientRect();
      const n = ndcOf(cx, cy, r);
      return groundPoint(pr.camera, n.x, n.y);
    },
    pick: (x, z) => pickInteractable(interactions.values(), x, z),
    walkTo: (x, z) => {
      if (cutsceneEngine.running || cutscene.running) { skipOrAdvance(); return; }
      walk.on = true; walk.x = x; walk.z = z; walk.act = null;
    },
    walkToAct: (a: Interactable) => {
      if (cutsceneEngine.running || cutscene.running) { skipOrAdvance(); return; }
      const p = a.pos(); walk.on = true; walk.x = p.x; walk.z = p.z; walk.act = a;
    },
    cancel: () => { walk.on = false; walk.act = null; },
  };

  hud.onBlip = (speaker) => { audio.playVoiceBlip(speaker); };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC' && toggleCodex(hud, cutsceneEngine.running || cutscene.running)) audio.playSfx('ui_confirm');
  });

  bindInput(window, {
    hud, keys: input.keys, panels, click,
    panelOpen: () => panels.anyOpen() || anyModalOpen(hud),
    transitioning: () => false,
    aim: () => input.aimed,
    onAct: (a) => {
      const p = a.pos();
      player.faceTo(p.x, p.z);
    },
    onActError: () => hud.toast('act-error', null, tr('문제가 생겨 행동을 마치지 못했다'), 0, 5),
    openChapterSelect: () => toggleChapterSelect(hud, state.book, state.chapter),
    openPause: () => togglePause(hud),
    openHelp: () => toggleHelp(hud, cutsceneEngine.running || cutscene.running),
  });

  if (!hasSeenHelp()) {
    hud.help.open = true;
    markHelpSeen();
  }

  // ── 첫 챕터 로딩 ──
  // 개발 모드 전용 훅 (devHooks.ts) — 프로덕션 번들에서는 이 호출째 제거된다
  if (import.meta.env.DEV) {
    installDevHooks({
      cutscene, cutsceneEngine, hud, sceneCtx, stageManager, interactions,
      state: () => ({ book: state.book, chapter: state.chapter, stage: stageManager.stage?.id ?? null }),
      goto: (book, chapter, force = true) => flow.loadChapter(book, chapter, force),
      advance: () => flow.advanceChapter(),
    });
  }

  flow.loadChapter(state.book, state.chapter);
  if (loaded) resumeFromSave(loaded, state, player, interactions, chapterLog, hud);

  // ── 프레임 루프 (frameLoop.ts) ──
  createFrameLoop({
    state, pr, hud, player, stageManager, interactions, cutscene, cutsceneEngine, crowd, particles, beam,
    torchLight, cameraFocus, panels, lifecycle, input, touch,
    dummyCol: new Collision(),
    toUi,
    ambientKind: () => ambientKind,
  }).start();
}
