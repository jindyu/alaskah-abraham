import type { Interactable } from '../systems/interaction';

/** 도착으로 치는 거리 (+ 대상 상호작용 반경) */
export const ARRIVE = 0.18;

/** 클릭 이동 상태: 목적지와 도착하면 실행할 상호작용 */
export interface WalkState { on: boolean; x: number; z: number; act: Interactable | null }
/** Player.update 가 받는 이동 입력 (모듈 단위로 하나를 재사용한다) */
export interface MoveInput { x: number; z: number; run: boolean }

export function createWalkState(): WalkState { return { on: false, x: 0, z: 0, act: null }; }

/**
 * 키보드 + 클릭 이동으로 이번 프레임의 이동 입력을 정한다 (out 을 제자리에서 채움 — 할당 없음).
 * 키가 눌리면 클릭 이동은 취소되고, 클릭 목적지에 닿으면 대상 상호작용을 실행한다.
 */
export function resolveMove(keys: ReadonlySet<string>, walk: WalkState, px: number, pz: number, out: MoveInput): void {
  let dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let dz = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  if (dx || dz) walk.on = false;
  else if (walk.on) {
    const wx = walk.x - px, wz = walk.z - pz, wd = Math.hypot(wx, wz);
    if (wd < ARRIVE + (walk.act ? walk.act.r : 0)) {
      walk.on = false;
      const a = walk.act; walk.act = null;
      if (a) a.act();
    } else { dx = wx / wd; dz = wz / wd; }
  }
  out.x = dx;
  out.z = dz;
  out.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
}

/** 멈춘 입력 (컷신·메뉴 중) */
export function stopMove(out: MoveInput): void { out.x = 0; out.z = 0; out.run = false; }
