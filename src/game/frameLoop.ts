import * as THREE from 'three';
import type { PixelRenderer } from '../renderer/pixelRenderer';
import type { Hud, Prompt } from '../ui/hud';
import type { Interactable, Interactions } from '../systems/interaction';
import type { Cutscene } from '../systems/cutscene/cutscene';
import type { CutsceneEngine } from '../systems/cutscene/cutsceneEngine';
import type { StageManager } from '../world/stageManager';
import type { Player } from '../entities/player';
import type { CrowdManager } from '../entities/crowd';
import type { ParticleManager } from '../renderer/particles';
import type { Beam } from '../entities/beam';
import type { Collision } from '../world/collision';
import type { SaveLifecycle } from './saveLifecycle';
import type { PanelStack } from './panels';
import type { AmbientKind } from './timeOfDay';
import type { GameState } from './gameState';
import { updateEnvironmentWind } from '../renderer/environmentWind';
import { showOverlay } from './fatal';
import { FrameHealth } from './guard';
import { findGuidanceTarget, type GuidanceTarget } from './guidance';
import { anyMenuOpen } from './panelToggles';
import { resolveMove, stopMove, type MoveInput, type WalkState } from './playerMotion';
import { torchIntensity } from './gameLights';
import { tr } from '../i18n/tr';

export const AUTOSAVE_SECONDS = 20;
/** 안내 핀을 갱신하는 간격 (초) */
export const GUIDANCE_INTERVAL = 0.5;
/** 환경 입자를 내는 간격 (초) */
export const AMBIENT_INTERVAL = 0.35;
/** 전역 오류 토스트 최소 간격 (플레이 초) */
export const ERROR_TOAST_GAP = 10;

/**
 * 개발·QA 전용 시계 고정: frozen 이면 프레임이 dt=0·고정 시각으로 돌아 입자·바람·애니메이션이 멈춘 같은 화면을 다시 그린다
 * (병합 전후 픽셀 비교용, devHooks 의 freeze/step). 프로덕션 경로는 이 값을 건드리지 않는다.
 */
export const clockControl = { frozen: false, now: 0 };

/** 입력이 쓰는 공유 상태: 눌린 키, 클릭 이동, 지금 조준 중인 대상 */
/** 카메라 초점이 지도 가장자리에서 물러나는 거리 (남쪽=화면 아래는 더 많이 보이므로 더 크게) */
const CAM_EDGE_SIDE = 4;
const CAM_EDGE_FAR = 3;
const CAM_EDGE_NEAR = 8;

export interface InputState {
  keys: Set<string>;
  walk: WalkState;
  aimed: Interactable | null;
}

export interface FrameLoopDeps {
  state: GameState;
  pr: PixelRenderer;
  hud: Hud;
  player: Player;
  stageManager: StageManager;
  interactions: Interactions;
  cutscene: Cutscene;
  cutsceneEngine: CutsceneEngine;
  crowd: CrowdManager;
  particles: ParticleManager;
  beam: Beam;
  torchLight: THREE.PointLight;
  cameraFocus: THREE.Vector3;
  panels: PanelStack;
  lifecycle: SaveLifecycle;
  input: InputState;
  /** 터치 단추 (보일 때만 메뉴 동안 숨김) */
  touch: { visible: boolean; suppress(on: boolean): void };
  dummyCol: Collision;
  toUi(x: number, y: number, z: number): { x: number; y: number };
  ambientKind(): AmbientKind | null;
}

/**
 * 프레임 루프 (rAF). 프레임 본문은 할당 없이 돌도록 재사용 버퍼만 쓰고,
 * 한 프레임의 예외가 루프를 멈추지 않게 try/catch + FrameHealth 로 감싼다.
 * 반환된 start() 가 첫 rAF 를 건다.
 */
export function createFrameLoop(d: FrameLoopDeps): { start(): void; frameBody(now: number): void } {
  const { state, pr, hud, player, stageManager, interactions, cutscene, cutsceneEngine, crowd, particles, beam, torchLight, cameraFocus, panels, lifecycle, input, touch } = d;
  const prompt: Prompt = { x: 0, y: 0, label: '' };
  const targetPinObj = { x: 0, z: 0, label: '' };
  const targetMarkerObj = { x: 0, y: 0, z: 0 };
  const guideOut: GuidanceTarget = { x: 0, z: 0, height: 1, label: '' };
  const focus = new THREE.Vector3();
  const moveInput: MoveInput = { x: 0, z: 0, run: false };
  const EMPTY: { x: number; z: number; r: number }[] = [];
  // 클로저에 잡힌 let 숫자는 쓸 때마다 힙 숫자를 새로 만들므로, 타이머는 고정 Float64Array 에 둔다 (프레임당 할당 0)
  const T_GUIDE = 0, T_AMBIENT = 1, T_SAVE = 2, T_LAST = 3;
  const tm = new Float64Array(4);
  tm[T_LAST] = performance.now();

  const frameBody = (realNow: number): void => {
    const frozen = clockControl.frozen;
    const now = frozen ? clockControl.now : realNow;
    const dt = frozen ? 0 : Math.min(0.05, (realNow - tm[T_LAST]) / 1000);
    tm[T_LAST] = realNow;
    state.playSeconds += dt;
    tm[T_SAVE] += dt;
    if (tm[T_SAVE] >= AUTOSAVE_SECONDS) { tm[T_SAVE] = 0; lifecycle.save(); }
    // 전체 화면 메뉴가 열려 있는 동안은 터치 단추가 메뉴 위에 떠서 잘못 눌리지 않게 숨긴다 (닫기는 메뉴 안의 ✕·바깥 탭)
    if (touch.visible) touch.suppress(anyMenuOpen(hud));

    // 컷신 및 군중 업데이트
    if (cutsceneEngine.running) cutsceneEngine.update(dt);
    if (cutscene.running) {
      cutscene.update(dt);
      hud.caption = cutscene.caption;
    } else if (!cutsceneEngine.running) {
      hud.caption = null;
    }
    crowd.update(dt);
    particles.update(dt);
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
      const actors = st.urDetails.actors;
      for (let i = 0; i < actors.length; i++) actors[i].updateAnimation(dt, false);
      const animals = st.urDetails.animals;
      if (animals) {
        for (let i = 0; i < animals.length; i++) animals[i].update(dt, now * 0.001, p.x, p.z);
      }
    }

    // 고대 우르 대기 중 미세 모래 먼지(Dust Motes) 방출
    const inAnyCutscene = cutsceneEngine.running || cutscene.running;
    if (st && st.urDetails && !inAnyCutscene) {
      if (dt > 0 && Math.random() < 0.22) {
        particles.emit('desert_dust', p.x - 12 + Math.random() * 24, 0.4 + Math.random() * 2.2, p.z - 12 + Math.random() * 24, 1);
      }
    }

    // 동적 횃불/화로 조명 깜빡임
    torchLight.intensity = torchIntensity(st ? st.id : null, now);
    if (torchLight.intensity > 0) torchLight.position.set(p.x, 2.0, p.z);

    // 플레이어 이동 (컷신·메뉴 중이 아닐 때만)
    const col = st?.col ?? d.dummyCol;
    if (!inAnyCutscene && !hud.chapterSelect.open && !hud.pauseMenu.open && !hud.codex.open && !hud.help.open && !hud.choice) {
      resolveMove(input.keys, input.walk, p.x, p.z, moveInput);
      player.update(dt, moveInput, col, EMPTY);
      input.aimed = interactions.nearest(p.x, p.z, player.facing);
    } else {
      input.aimed = null;
      stopMove(moveInput);
      player.update(dt, moveInput, col, EMPTY);
    }

    // ── 환경 입자: 약 0.35초마다 플레이어 주변에 한두 알갱이 (컷신·메뉴 중에는 쉼) ──
    tm[T_AMBIENT] += dt;
    if (tm[T_AMBIENT] >= AMBIENT_INTERVAL) {
      tm[T_AMBIENT] = 0;
      const kind = d.ambientKind();
      if (kind && !inAnyCutscene) {
        particles.emit(kind, p.x + (Math.random() - 0.5) * 12, 0.6 + Math.random() * 2.2, p.z + (Math.random() - 0.5) * 9, 1);
      }
    }

    // ── 목표 안내 (약 0.5초마다 가장 가까운 활성 상호작용 위치로 타겟 핀 갱신) ──
    const inMenu = panels.anyOpen() || hud.chapterSelect.open || hud.pauseMenu.open || hud.codex.open || hud.help.open || !!hud.choice;
    if (inAnyCutscene || inMenu) {
      hud.minimap.targetPin = null;
      hud.targetMarker = null;
      tm[T_GUIDE] = GUIDANCE_INTERVAL;
    } else {
      tm[T_GUIDE] += dt;
      if (tm[T_GUIDE] >= GUIDANCE_INTERVAL) {
        tm[T_GUIDE] = 0;
        if (findGuidanceTarget(interactions, p.x, p.z, guideOut)) {
          targetPinObj.x = guideOut.x;
          targetPinObj.z = guideOut.z;
          targetPinObj.label = guideOut.label;
          hud.minimap.targetPin = targetPinObj;
          targetMarkerObj.x = guideOut.x;
          targetMarkerObj.y = guideOut.height;
          targetMarkerObj.z = guideOut.z;
          hud.targetMarker = targetMarkerObj;
        } else {
          hud.minimap.targetPin = null;
          hud.targetMarker = null;
        }
      }
    }

    // 빛기둥: 컷신이 끝났는데 켜진 채 남은 기둥(컷신 건너뛰기 등)은 서서히 거둔다. 평소 안내는 바닥 고리 + (가만히 있을 때만) 가는 줄기
    if (!inAnyCutscene && beam.strength > 0) beam.strength = Math.max(0, beam.strength - dt * 1.2);
    beam.update(dt);
    const tmk = hud.targetMarker;
    const guideOn = !inAnyCutscene && !inMenu && !hud.dialogue && !hud.activeDialogue && !hud.letterbox && !hud.caption;
    beam.updateGuide(dt, guideOn, tmk !== null, tmk ? tmk.x : 0, tmk ? tmk.z : 0, p.x, p.z);

    let pp: Prompt | null = null;
    const aimed = input.aimed;
    if (aimed) {
      const at = aimed.pos();
      const s = d.toUi(at.x, aimed.height, at.z);
      prompt.x = s.x; prompt.y = s.y; prompt.label = aimed.label() ?? '';
      pp = prompt;
    }

    if (cutscene.running && cameraFocus.lengthSq() > 0) focus.copy(cameraFocus);
    else {
      focus.set(p.x, 0.7, p.z);
      // 지도 가장자리에서는 카메라가 지도 밖(빈 지평선)까지 비추지 않도록 초점을 안쪽으로 붙잡는다
      const cb = st ? st.bounds : null;
      if (cb && cb.maxZ - cb.minZ > 24 && cb.maxX - cb.minX > 24) {
        focus.x = Math.min(Math.max(focus.x, cb.minX + CAM_EDGE_SIDE), cb.maxX - CAM_EDGE_SIDE);
        focus.z = Math.min(Math.max(focus.z, cb.minZ + CAM_EDGE_FAR), cb.maxZ - CAM_EDGE_NEAR);
      }
    }
    pr.follow(focus);
    pr.render();
    hud.draw(dt, pp);
  };

  // 한 프레임의 예외가 루프를 영구히 멈추지 않게 한다: 예외는 기록하고, rAF 는 항상 다시 건다.
  // 연속 실패가 이어지면 '문제가 생겼다' 안내 화면을 띄운다 (guard.ts FrameHealth).
  const frameHealth = new FrameHealth();
  const frame = (now: number): void => {
    try {
      frameBody(now);
      frameHealth.ok();
    } catch (err) {
      console.error('[frame] 프레임 처리 중 오류', err);
      if (frameHealth.fail()) {
        showOverlay(document, {
          id: 'abraham-frame-fatal',
          text: '게임을 계속 진행할 수 없는 문제가 생겼다. 새로고침하면 마지막 저장에서 이어진다',
          button: { label: '새로고침', onClick: () => location.reload() },
        });
      }
    } finally {
      requestAnimationFrame(frame);
    }
  };

  // 전역 오류도 조용히 삼키지 않고 기록한다 (토스트는 10초에 한 번만)
  let lastErrorToast = -1e9;
  const reportGlobalError = (what: string, err: unknown): void => {
    console.error('[' + what + ']', err);
    if (state.playSeconds - lastErrorToast > ERROR_TOAST_GAP) {
      lastErrorToast = state.playSeconds;
      hud.toast('global-error', null, tr('문제가 생겼다. 계속 이상하면 새로고침하자'));
    }
  };

  return {
    frameBody,
    start() {
      window.addEventListener('error', (e) => reportGlobalError('error', e.error ?? e.message));
      window.addEventListener('unhandledrejection', (e) => reportGlobalError('unhandledrejection', e.reason));
      requestAnimationFrame(frame);
    },
  };
}
