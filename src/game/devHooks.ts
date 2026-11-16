import type { Hud } from '../ui/hud';
import type { Cutscene } from '../systems/cutscene/cutscene';
import type { CutsceneEngine } from '../systems/cutscene/cutsceneEngine';
import type { Interactions } from '../systems/interaction';
import type { SceneContext } from '../systems/scenes/book1/book1Scenes';
import type { StageManager, StageId } from '../world/stageManager';
import { clockControl } from './frameLoop';
import { mergeConfig } from '../world/staticMerge';
import { voxelConfig } from '../world/voxel';
import {
  createFurnaceMiracleSteps,
  createNightCallingSteps,
  createHaranSteps,
  createNimrodTrialSteps,
  createEsauLentilStewSteps,
} from '../systems/scenes/book1/book1Scenes';

export interface DevHookDeps {
  cutscene: Cutscene;
  cutsceneEngine: CutsceneEngine;
  hud: Hud;
  sceneCtx: SceneContext;
  stageManager: StageManager;
  interactions: Interactions;
  /** 지금 권·장·무대 */
  state: () => { book: number; chapter: number; stage: string | null };
  goto: (book: number, chapter: number, force?: boolean) => void;
  advance: () => void;
}

/**
 * 개발 모드 전용 훅 (createGame 이 import.meta.env.DEV 안에서만 부른다 → 프로덕션 번들에는 들어가지 않음).
 * - window.__abraham: 헤드리스 QA 용 (상태·상호작용 목록·장 이동·상호작용 실행·컷신 정리)
 * - window.__AGY_DEBUG__ / __GAME__: 장면 즉시 재생 등 수동 디버깅용
 */
export function installDevHooks(d: DevHookDeps): void {
  const { cutscene, cutsceneEngine, hud, sceneCtx, stageManager, interactions } = d;
  const w = window as unknown as Record<string, unknown>;

  w.__abraham = {
    state: d.state,
    interactionIds: () => Array.from(interactions.values(), (it) => it.id),
    goto: d.goto,
    advance: d.advance,
    activate: (id: string) => { interactions.get(id)?.act(); return !!interactions.get(id); },
    /** QA 용: 마지막 프레임의 드로우콜·삼각형·GPU 지오메트리/텍스처 수 (renderer.info) */
    renderStats: () => sceneCtx.renderer.renderStats(),
    /** QA 용: 현재 장면 그래프의 메시·그룹 수 (병합 효과 확인) */
    sceneStats: () => {
      let meshes = 0, nodes = 0;
      sceneCtx.scene?.traverse((o) => { nodes++; if ((o as { isMesh?: boolean }).isMesh) meshes++; });
      return { meshes, nodes, merge: stageManager.mergeStats };
    },
    /** QA 용: 정적 병합 켜기/끄기 (끄고 다시 장에 들어가면 병합 전 상태 — 전후 비교용) */
    setMergeStatic: (on: boolean) => { stageManager.mergeStatic = on; },
    /** QA·튜닝용: 병합 타일·그림자 컷 반지름 (다음 무대부터 적용) */
    mergeConfig,
    /** QA 용: 그림자 컷(작은 메시 그림자 빼기)을 켜고(true)/되살리기(false) */
    setShadowCull: (on: boolean) => stageManager.setShadowCull(on),
    /** QA 용: 그림자 맵 갱신 주기 (프레임 수, 1 = 매 프레임) */
    setShadowRate: (n: number) => { sceneCtx.renderer.shadowRate = n; },
    /** QA 용: 병합 관찰이 끝났나 */
    mergeReady: () => stageManager.mergeReady,
    /** QA 용: 병합 메시를 켜고(true) 원본을 보이게(false) — 같은 상태 전후 픽셀 비교용 */
    setMergeActive: (on: boolean) => stageManager.setMergeActive(on),
    /** QA 용: 시계 고정 (dt=0·고정 시각: 입자·바람·애니메이션 정지, 렌더는 계속) */
    freeze: (on: boolean, at?: number) => { clockControl.now = at ?? performance.now(); clockControl.frozen = on; },
    /** QA 용: 마주 붙은 안쪽 면 제거 켜기/끄기 (다음에 짓는 무대부터) */
    setCullInterior: (on: boolean) => { voxelConfig.cullInterior = on; },
    /** QA 용: 다음 N 프레임이 지나면 resolve (rAF 기준) */
    frames: (n: number) => new Promise<void>((res) => { const t = () => (--n <= 0 ? res() : requestAnimationFrame(t)); requestAnimationFrame(t); }),
    skipCutscenes: () => { cutscene.abort(); cutsceneEngine.stop(); },
    /** QA 용: 끝낸 장·한 선택을 채워 넣는다 (장 선택 화면의 ✓·선택 요약을 증거 스크린샷에 담기 위해) */
    setProgress: (done: string[], picks: Record<string, string>) => {
      for (const k of done) (hud.doneChapters as Set<string>).add(k);
      for (const [id, tag] of Object.entries(picks)) (hud.picks as Map<string, string>).set(id, tag);
    },
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
    toggleHelp: () => {
      hud.help.open = !hud.help.open;
    },
    advanceCutscene: () => cutscene.key(new KeyboardEvent('keydown', { code: 'Space' })),
    loadStage: (stageId: StageId) => stageManager.loadStage(stageId),
    sceneCtx,
    stageManager,
    hud,
    cutscene,
  };
  w.__AGY_DEBUG__ = debugApi;
  w.__GAME__ = debugApi;
}
