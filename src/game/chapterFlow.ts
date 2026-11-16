import type { Hud } from '../ui/hud';
import type { AudioManager } from '../audio/audioManager';
import type { CrowdManager } from '../entities/crowd';
import type { ParticleManager } from '../renderer/particles';
import type { Interactions } from '../systems/interaction';
import type { Cutscene } from '../systems/cutscene/cutscene';
import type { CutsceneEngine } from '../systems/cutscene/cutsceneEngine';
import type { StageManager, StageId } from '../world/stageManager';
import type { Player } from '../entities/player';
import type { ProtagonistId } from '../entities/cast';
import type { SceneContext } from '../systems/scenes/book1/book1Scenes';
import { createBook1IntroSteps } from '../systems/scenes/book1/book1Scenes';
import { playChapterStaging } from '../systems/scenes/staging/chapterStaging';
import { createShechemAltarSteps, createEgyptBorderSteps, createHobahRescueSteps } from '../systems/scenes/book2/book2Scenes';
import { createStarsCovenantSteps } from '../systems/scenes/book3/book3Scenes';
import { createThreeVisitorsSteps, createSodomRiotSteps } from '../systems/scenes/book4/book4Scenes';
import { createIsaacBirthFeastSteps, createRoadToMoriahSteps, createMountMoriahAkedahSteps } from '../systems/scenes/book5/book5Scenes';
import { createSarahMourningSteps, createEphronBargainSteps, createRebekahWellSteps, createAbrahamPassingSteps } from '../systems/scenes/book6/book6Scenes';
import { BOOKS } from '../data/books';
import { getChapterContext } from '../systems/story';
import { SAFETY_NET_ID } from './guidance';
import { MINIMAP_LABELS, type Region } from './atmosphere';
import { sceneKeyFor, type SceneKey } from './chapterRouter';
import { cancelTimers } from './timers';
import { nextChapterTarget, clampTarget } from './progression';
import { wrapCutscene, wrapHud, wrapQuiet, type ChapterLog } from './chapterLog';
import { wireChapterActions } from './actionWiring';
import { createChapterPlayback } from './chapterPlayback';
import { dominantTrait, epilogueFor, epilogueLines } from './storyFlags';
import { loopSignature, type GameState } from './gameState';

/** 문자열 → StageId (알 수 없는 무대면 즉시 오류: 잘못된 전환이 조용히 넘어가지 않게) */
export function toStageId(id: string): StageId {
  if (Object.prototype.hasOwnProperty.call(MINIMAP_LABELS, id)) return id as StageId;
  throw new Error(`알 수 없는 무대 id: ${id}`);
}

/** 컷신 엔진의 맵 ID → 무대 id */
export function stageForMapId(mapId: string): StageId {
  switch (mapId) {
    case 'PALACE_UR': return 'ur_palace';
    case 'FURNACE': return 'ur_furnace';
    case 'FIELD': return 'shechem_bethel';
    case 'EGYPT': return 'egypt';
    case 'SODOM': return 'sodom';
    case 'BEERSHEBA': return 'beersheba';
    case 'MORIAH': return 'moriah';
    default: return 'ur_workshop';
  }
}

export interface ChapterFlowDeps {
  state: GameState;
  /** 저장에서 이어 시작했나 (1권 인트로는 새 판·플레이 2초 미만에서만 재생) */
  hasSave: boolean;
  hud: Hud;
  audio: AudioManager;
  crowd: CrowdManager;
  particles: ParticleManager;
  interactions: Interactions;
  cutscene: Cutscene;
  cutsceneEngine: CutsceneEngine;
  stageManager: StageManager;
  player: Player;
  chapterLog: ChapterLog;
  sceneCtx: SceneContext;
  applyAtmosphere(region: Region, stageId: StageId): void;
  setHero(hero: ProtagonistId): void;
}

export interface ChapterFlow {
  loadChapter(book: number, chapter: number, forceLoop?: boolean): void;
  advanceChapter(): void;
  setupInteractiveLoop(): void;
  markChapterDone(): void;
}

/**
 * 장 불러오기·상호작용 루프 세우기·다음 장 이동·대단원(에필로그) 흐름.
 * createGame 의 클로저였던 것을 상태 객체(GameState) + 의존성 묶음으로 분리했다.
 */
export function createChapterFlow(d: ChapterFlowDeps): ChapterFlow {
  const { state, hud, audio, crowd, particles, interactions, cutscene, cutsceneEngine, stageManager, player, chapterLog, sceneCtx } = d;

  // 직접 쓴 장면 팩토리 (키는 chapterRouter.ts 의 SceneKey)
  const sceneFactories: Record<SceneKey, () => Parameters<Cutscene['play']>[0]> = {
    book2_shechem: () => createShechemAltarSteps(sceneCtx),
    book2_egypt: () => createEgyptBorderSteps(sceneCtx),
    book2_hobah: () => createHobahRescueSteps(sceneCtx),
    book3_stars: () => createStarsCovenantSteps(sceneCtx),
    book4_visitors: () => createThreeVisitorsSteps(sceneCtx),
    book4_sodom: () => createSodomRiotSteps(sceneCtx),
    book5_isaac_birth: () => createIsaacBirthFeastSteps(sceneCtx),
    book5_moriah_road: () => createRoadToMoriahSteps(sceneCtx),
    book5_moriah_akedah: () => createMountMoriahAkedahSteps(sceneCtx),
    book6_sarah: () => createSarahMourningSteps(sceneCtx),
    book6_ephron: () => createEphronBargainSteps(sceneCtx),
    book6_rebekah: () => createRebekahWellSteps(sceneCtx),
    book6_abraham_death: () => createAbrahamPassingSteps(sceneCtx),
  };

  // ── 챕터 대본(JSON) 대사 재생·전승 안내: chapterPlayback.ts (직접 쓴 장면이 없는 챕터에서만, 해당 권만 동적으로 불러온다) ──
  const playback = createChapterPlayback({
    getBook: () => state.book,
    getChapter: () => state.chapter,
    meta: (b, c) => BOOKS[b]?.chapters[c],
    busy: () => cutscene.running || cutsceneEngine.running,
    stagingRunning: () => cutscene.running && cutscene.tag.startsWith('staging_'),
    playSteps: (steps) => cutsceneEngine.playSequence(steps as never),
    toast: (key, icon, text, count, life) => hud.toast(key, icon, text, count, life),
  });

  function markChapterDone(): void { state.doneChapters.add(`${state.book}:${state.chapter}`); }

  /** 장면별 액션을 등록하고, 아무 상호작용도 없는 장(소프트락)에는 '다음 이야기로' 안전망을 둔다 */
  function setupInteractiveLoop(): void {
    wireActions();
    if (state.book >= 2 && state.book <= 6 && interactions.size > 0) {
      const sig = loopSignature(state.book, idsOf());
      // 이미 끝낸 루프는 반복하지 않는다 (장 선택으로 직접 들어오면 다시 플레이 가능)
      if (!state.forceLoop && state.loopsDone.has(sig)) interactions.clear();
      else state.chapterSigs.add(sig);
    }
    if (state.book >= 1 && state.book <= 6 && interactions.size === 0) addContinueInteraction();
  }

  function* idsOf(): Generator<string> { for (const it of interactions.values()) yield it.id; }

  function addContinueInteraction(): void {
    // 이 장에는 다른 목표가 없으므로 목표 패널도 '이야기 이어가기'로 맞춘다 (이전 장/기본 목표가 남지 않게)
    hud.goalCategory = BOOKS[state.book]?.title ?? null;
    hud.goal = `${BOOKS[state.book]?.chapters[state.chapter]?.title ?? ''}\n▪ 이야기를 읽고 E키로 다음 장으로 이어 가기`;
    hud.goalProgress = null;
    hud.hint = '대사를 모두 읽은 뒤 E키를 누르면 다음 이야기로 넘어간다';
    const st = stageManager.stage;
    const spot = { x: (st ? st.spawn.x : 0) + 2.5, z: st ? st.spawn.z : 0 };
    // 마지막 장이면 '다음 이야기'가 아니라 맺음임을 알린다 (문구는 추가 시점에 한 번 정해 프레임마다 문자열을 만들지 않는다)
    const isLast = nextChapterTarget(BOOKS, state.book, state.chapter).ending === true;
    const netLabel = isLast ? '이야기를 마무리하기' : '다음 이야기로 나아가기';
    interactions.add({
      id: SAFETY_NET_ID,
      pos: () => spot,
      height: 1.4,
      r: 60, // 무대 어디서든 E 로 이어 갈 수 있게 (표식까지 걸어가지 않아도 됨)
      label: () => (cutsceneEngine.running || cutscene.running ? null : netLabel),
      act: () => advanceChapter(),
    });
  }

  function wireActions(): void {
    wireChapterActions({
      book: state.book,
      chapter: state.chapter,
      stage: stageManager.stage,
      interactions,
      hud: wrapHud(hud, chapterLog),
      audio: wrapQuiet(audio, chapterLog),
      particles: wrapQuiet(particles, chapterLog),
      cutscene: wrapCutscene(cutscene, chapterLog),
      sceneCtx,
      advanceChapter: () => advanceChapter(),
      loadChapter: (bk, ch) => { markChapterDone(); loadChapter(bk, ch); },
      getPick: (id) => state.picks.get(id),
      setPick: (id, tag) => { state.picks.set(id, tag); },
      getTrait: () => dominantTrait(state.picks),
      switchStage: (sId) => {
        const newStage = stageManager.loadStage(toStageId(sId));
        d.applyAtmosphere(newStage.region, newStage.id);
        player.root.position.set(newStage.spawn.x, 0, newStage.spawn.z);
        audio.playBgm(newStage.bgm);
        audio.playAmbience(newStage.ambience);
        setupInteractiveLoop();
      },
    });
  }

  function advanceChapter(): void {
    markChapterDone();
    for (const sig of state.chapterSigs) state.loopsDone.add(sig);
    const target = nextChapterTarget(BOOKS, state.book, state.chapter);
    if (target.ending) {
      const ep = epilogueFor(state.picks);
      const lines = epilogueLines(state.picks);
      if (lines.length > 0) {
        // 선택의 성향에 따른 맺음말 자막 세 줄을 보인 뒤 대단원 배너를 띄우고 처음으로 돌아간다
        cutscene.play(lines.map((caption) => ({ caption, hold: 4.6 })), () => {
          hud.celebrate(ep.title, ep.sub);
          loadChapter(target.book, target.chapter);
        }, 'epilogue');
        return;
      }
      hud.celebrate(ep.title, ep.sub);
    }
    loadChapter(target.book, target.chapter);
  }

  function loadChapter(bookIdx: number, chapterIdx: number, forceLoop = false): void {
    playback.cancel(); // 이전 장의 대본 로드 결과는 버린다
    loadChapterCore(bookIdx, chapterIdx, forceLoop);
    playback.announceTradition();
    playback.play();
  }

  function loadChapterCore(bookIdx: number, chapterIdx: number, forceLoop: boolean): void {
    cancelTimers(); // 이전 장에서 걸어 둔 대사·선택지 지연 실행을 무효화
    hud.clearToasts(); // 이전 장의 도감·획득 알림이 새 장 화면에 남지 않게
    state.chapterSigs.clear();
    chapterLog.reset();
    state.forceLoop = forceLoop;
    const target = clampTarget(BOOKS, bookIdx, chapterIdx);
    state.book = target.book;
    state.chapter = target.chapter;
    const bData = BOOKS[state.book];

    interactions.clear();
    // 이전 장의 목표 패널이 남지 않도록 권·장 제목으로 초기화 (각 권 액션이 필요하면 덮어씀)
    hud.goalCategory = bData.title;
    hud.goal = bData.chapters[state.chapter]?.title ?? null;
    hud.goalProgress = null;
    hud.hint = null;
    crowd.clear();
    particles.clear();
    cutsceneEngine.stop();
    cutscene.abort();

    const ctx = getChapterContext(state.book, state.chapter);
    d.setHero(ctx.hero);

    const stage = stageManager.loadStage(ctx.stageId);
    d.applyAtmosphere(stage.region, stage.id);

    player.root.position.set(stage.spawn.x, 0, stage.spawn.z);

    hud.goal = ctx.defaultGoal;
    audio.playBgm(stage.bgm);
    audio.playAmbience(stage.ambience);

    // 1권인 경우: alaskah-noah 스타일의 풍부한 우르 시가지와 액션 루프 구동!
    if (state.book === 1) {
      setupInteractiveLoop();
      // 첫 시작 시 인트로 재생
      // 새 판 인트로는 프롤로그(1권 1장)에서만 — 저장 없이 시작한 판에서 다른 장으로 이동할 때마다 인트로가 되풀이되지 않게 한다
      if ((!d.hasSave || state.playSeconds < 2) && state.chapter === 0) {
        cutscene.play(createBook1IntroSteps(sceneCtx), undefined, 'book1_intro');
      } else {
        // 1권의 각 장도 들어올 때 직접 쓴 연출(staging.json)을 먼저 보인 뒤 원래 대사를 잇는다 (2~6권은 각 권 액션 모듈이 같은 일을 한다)
        playChapterStaging(sceneCtx, cutscene, 1, state.chapter, stage.id, (id) => state.picks.get(id));
      }
      return;
    }

    // 2~6권: 무대별 상호작용 루프를 세우고, 직접 쓴 장면이 있는 장은 그 컷신을 재생한다 (표: chapterRouter.ts).
    // 직접 쓴 장면이 없는 장은 loadChapter 가 챕터 대본(JSON)의 대사를 재생한다 (playChapterScript).
    if (state.book >= 2 && state.book <= 6) {
      setupInteractiveLoop();
      const key = sceneKeyFor(state.book, state.chapter);
      if (key) cutscene.play(sceneFactories[key](), undefined, key);
      return;
    }

    const chData = bData.chapters[state.chapter];
    if (chData && chData.steps && chData.steps.length > 0) {
      cutsceneEngine.playSequence(chData.steps);
    } else {
      setupInteractiveLoop();
    }
  }

  return { loadChapter, advanceChapter, setupInteractiveLoop, markChapterDone };
}
