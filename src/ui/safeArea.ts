/** 화면 가장자리 안전 영역(노치·펀치홀·둥근 모서리) 여백. 값은 모두 CSS px 이고 PC 에서는 0. */
export interface Insets { top: number; right: number; bottom: number; left: number }

export const NO_INSETS: Insets = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

/** getComputedStyle 이 돌려준 '44px' 같은 값을 CSS px 숫자로 (비었거나 음수·무한이면 0) */
export function parseInset(v: string | null | undefined): number {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 프로브 요소의 계산된 padding 에서 네 여백을 읽음 */
export function readInsets(cs: { paddingTop: string; paddingRight: string; paddingBottom: string; paddingLeft: string }): Insets {
  return { top: parseInset(cs.paddingTop), right: parseInset(cs.paddingRight), bottom: parseInset(cs.paddingBottom), left: parseInset(cs.paddingLeft) };
}

/**
 * CSS px 여백 → UI 좌표 여백 (UI 한 칸 = cssScale CSS px). 안으로 들어오는 쪽으로 올림해 모서리에 걸치지 않게 하고,
 * 0 은 그대로 0 (PC 화면이 달라지지 않음).
 */
export function toUiInsets(css: Insets, cssScale: number): Insets {
  const f = (v: number) => (v > 0 && cssScale > 0 ? Math.ceil(v / cssScale) : 0);
  return { top: f(css.top), right: f(css.right), bottom: f(css.bottom), left: f(css.left) };
}

/** 두 여백이 같은 값인가 (변했을 때만 새 객체를 돌려주려고) */
export function sameInsets(a: Insets, b: Insets): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

let probe: HTMLElement | null = null;
let current: Insets = NO_INSETS;
let override: Insets | null = null;
let listening = false;

/** 숨은 프로브의 env(safe-area-inset-*) 를 다시 읽음. 값이 바뀌었을 때만 current 가 새 객체가 된다 */
function refresh() {
  if (!probe || !probe.isConnected) return;
  const next = readInsets(getComputedStyle(probe));
  if (!sameInsets(next, current)) current = Object.freeze(next);
}

function ensureProbe() {
  if (probe || typeof document === 'undefined' || !document.body) return;
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
    + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.append(el);
  probe = el;
  refresh();
  if (!listening && typeof window !== 'undefined') {
    listening = true;
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
  }
}

/** 지금 안전 영역 (CSS px). DOM 이 없으면 모두 0. 값이 안 바뀌면 같은 객체라 호출하는 쪽이 참조로 변화를 알 수 있다 */
export function safeAreaCss(): Insets {
  if (override) return override;
  ensureProbe();
  return current;
}

/** 테스트·QA 용: 프로브 값 대신 쓸 여백 (null 이면 되돌림). 헤드리스 Chrome 은 env() 를 못 바꾸므로 ?debug=1 훅이 부른다 */
export function setSafeAreaOverride(v: Insets | null) {
  override = v ? Object.freeze({ top: parseInset(String(v.top)), right: parseInset(String(v.right)), bottom: parseInset(String(v.bottom)), left: parseInset(String(v.left)) }) : null;
}
