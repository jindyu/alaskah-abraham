import { noteError } from '../core/diagnostics';

/**
 * 첫 플레이 안내: 몇 줄짜리 힌트가 차례로 떴다가 저절로 사라진다 (순수 상태 기계 + 저장 표시).
 * 안내는 '조용한 때'(대사·메뉴·컷신 없음)에만 흐르고, 한 번 끝까지 보이면 다시 뜨지 않는다.
 */
export const ONBOARD_STEP_SECONDS = 4.5;
export const ONBOARD_START_DELAY = 1.2;
const KEY = 'abraham.onboard.v1';

export interface OnboardStep { ko: string; touch: string }
export const ONBOARD_STEPS: readonly OnboardStep[] = [
  { ko: '방향키·WASD 로 움직여 보자', touch: '왼쪽 스틱으로 움직여 보자' },
  { ko: '말풍선이 뜨면 E 또는 Space 로 행동하자', touch: '말풍선이 뜨면 행동 단추를 누르자' },
  { ko: '오른쪽 위 할 일을 따라가면 이야기가 이어진다 (H: 도움말)', touch: '오른쪽 위 할 일을 따라가면 이야기가 이어진다 (? 도움말)' },
];

export interface OnboardState { step: number; age: number; delay: number; done: boolean }
export const newOnboard = (done = false): OnboardState => ({ step: 0, age: 0, delay: ONBOARD_START_DELAY, done });

/** 한 프레임 진행. quiet=false 면 멈춤. 끝나면 true 를 돌려준다 (한 번만) */
export function advanceOnboard(s: OnboardState, dt: number, quiet: boolean): boolean {
  if (s.done || !quiet) return false;
  if (s.delay > 0) { s.delay -= dt; return false; }
  s.age += dt;
  if (s.age >= ONBOARD_STEP_SECONDS) {
    s.age = 0; s.step++;
    if (s.step >= ONBOARD_STEPS.length) { s.done = true; return true; }
  }
  return false;
}

/** 지금 보일 단계 (없으면 -1) 와 투명도 (들어올 때·나갈 때 0.4 초 흐림) */
export function onboardAlpha(s: OnboardState): number {
  if (s.done || s.delay > 0 || s.step >= ONBOARD_STEPS.length) return 0;
  const fadeIn = Math.min(1, s.age / 0.4), fadeOut = Math.min(1, (ONBOARD_STEP_SECONDS - s.age) / 0.4);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

export function onboardSeen(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1'; } catch (e) { noteError('onboard:1', e); return false; }
}
export function markOnboardSeen(): void {
  try { localStorage.setItem(KEY, '1'); } catch (e) { noteError('onboard:2', e); /* 저장소를 못 써도 이번 실행에는 한 번만 */ }
}
