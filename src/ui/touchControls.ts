/**
 * 터치 컨트롤: 휴대폰·태블릿용 화면 단추. 키보드 이벤트를 만들어 window 로 보내므로
 * 창 우선순위·대화·상점·컷신이 키보드와 똑같이 반응한다 (게임 쪽 코드는 손대지 않음).
 *   왼쪽 아래 스틱 = 방향키(8방향, 메뉴·상점에서는 위아래좌우 고르기)
 *   오른쪽 아래 '행동' = E (대화 넘기기·확인도 같음)
 *   오른쪽 단추줄 = 달리기(토글, Shift) · 가방(I) · 도감(J) · 메뉴(Esc, 열린 창 닫기도 겸함)
 * 보이는 때: 터치 기기(pointer: coarse)이거나 터치가 한 번이라도 들어왔을 때. 물리 키보드를 누르면 숨김.
 * 주소 ?touch=1 은 항상 보임, ?touch=0 은 항상 숨김 (개발·QA용).
 */
import { tr } from '../i18n/tr';
import { onLangChange } from '../i18n/lang';
import { isNativeApp } from '../native/platform';

export type StickCode = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/** 스틱이 가리키는 방향 → 눌린 방향키 목록. 가운데 데드존 안이면 비어 있음 */
export function stickCodes(dx: number, dy: number, radius: number): StickCode[] {
  const d = Math.hypot(dx, dy);
  if (!(radius > 0) || d < radius * 0.3) return [];
  const out: StickCode[] = [];
  const nx = dx / d, ny = dy / d;
  if (ny < -0.38) out.push('ArrowUp'); else if (ny > 0.38) out.push('ArrowDown');
  if (nx < -0.38) out.push('ArrowLeft'); else if (nx > 0.38) out.push('ArrowRight');
  return out;
}

/** 스틱 손잡이 위치: 반지름 안으로 자른 (dx, dy) */
export function clampKnob(dx: number, dy: number, radius: number): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (d <= radius || d === 0) return { x: dx, y: dy };
  return { x: (dx / d) * radius, y: (dy / d) * radius };
}

/** 주소 옵션과 기기 성격으로 처음에 보일지 */
export function wantsTouchUi(search: string, coarse: boolean): boolean {
  const v = new URLSearchParams(search).get('touch');
  if (v === '1') return true;
  if (v === '0') return false;
  return coarse;
}

const KEY: Record<string, string> = {
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
  KeyE: 'e', Escape: 'Escape', KeyI: 'i', KeyJ: 'j', ShiftLeft: 'Shift',
};

// 작은 단추 넷은 2×2 로 행동 단추 위에 모음 (오른쪽 위 시계·안내 패널을 가리지 않게)
const CSS = `
.abraham-touch{position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:none;z-index:5;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;font-family:sans-serif}
.abraham-touch[hidden]{display:none}
.abraham-touch *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.abraham-stick{position:absolute;left:calc(env(safe-area-inset-left,0px) + 20px);bottom:calc(env(safe-area-inset-bottom,0px) + 20px);width:132px;height:132px;border-radius:50%;background:rgba(20,16,28,.34);border:2px solid rgba(240,230,210,.38);pointer-events:auto;touch-action:none}
.abraham-knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(240,230,210,.55);border:2px solid rgba(255,255,255,.6);pointer-events:none}
.abraham-btn{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;background:rgba(20,16,28,.42);border:2px solid rgba(240,230,210,.5);color:#f0e6d2;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.1;font-weight:700;padding:0;margin:0}
.abraham-btn:active,.abraham-btn.on{background:rgba(240,230,210,.6);color:#14101c}
.abraham-touch{--act:92px;--sm:52px;--gap:8px;--edge:22px;--sr:calc(env(safe-area-inset-right,0px) + var(--edge));--sb:calc(env(safe-area-inset-bottom,0px) + 24px)}
.abraham-act{right:var(--sr);bottom:var(--sb);width:var(--act);height:var(--act);font-size:18px}
.abraham-sm{width:var(--sm);height:var(--sm);font-size:13px}
.abraham-touch.abraham-cut .abraham-stick,.abraham-touch.abraham-cut .abraham-sm{display:none}

.abraham-g0{right:calc(var(--sr) + var(--sm) + var(--gap));bottom:calc(var(--sb) + var(--act) + var(--gap) + var(--sm) + var(--gap))}
.abraham-g1{right:var(--sr);bottom:calc(var(--sb) + var(--act) + var(--gap) + var(--sm) + var(--gap))}
.abraham-g2{right:calc(var(--sr) + var(--sm) + var(--gap));bottom:calc(var(--sb) + var(--act) + var(--gap))}
.abraham-g3{right:var(--sr);bottom:calc(var(--sb) + var(--act) + var(--gap))}
@media (orientation:portrait){.abraham-touch{--sb:calc(env(safe-area-inset-bottom,0px) + 64px)}.abraham-stick{bottom:calc(env(safe-area-inset-bottom,0px) + 64px)}}
@media (max-height:480px){.abraham-touch{--act:80px;--sm:46px;--gap:6px;--edge:16px}.abraham-stick{width:116px;height:116px}.abraham-knob{width:50px;height:50px;margin:-25px 0 0 -25px}}
`;

/**
 * 오른쪽 아래 단추 무리(행동 단추 + 작은 단추 두 줄)의 위 끝이 화면 아래 끝에서 몇 CSS px 위인지 (아래 안전 영역 여백은 빼고).
 * 위 CSS 의 --sb + --act + (--gap + --sm) × 2 와 같은 값 — HUD 가 오른쪽 위 패널을 이 위에서 멈출 때 쓴다 (CSS 를 바꾸면 함께)
 */
export function touchClusterTopCss(viewH: number, portrait = false): number {
  const small = viewH <= 480;
  const act = small ? 80 : 92, sm = small ? 46 : 52, gap = small ? 6 : 8, sb = portrait ? 64 : 24;
  return sb + act + (gap + sm) * 2;
}

/**
 * 왼쪽 아래 스틱이 화면 왼쪽 끝에서 차지하는 폭 + 틈 (CSS px, 안전 영역 제외 — 위 CSS 의 left 20 + 지름 132/116).
 * 오른쪽 단추 무리(16 + 46·2 + 6 = 114)보다 넓으므로, 가운데 창이 양옆으로 이만큼 비우면 어느 쪽 조작 단추에도 가리지 않는다
 */
export function touchSideClearCss(viewH: number): number {
  return 20 + (viewH <= 480 ? 116 : 132) + 8;
}

export interface TouchControls {
  readonly visible: boolean;
  show(): void;
  hide(): void;
  /** 메뉴·타이틀 같은 화면에서 잠시 가림 (visible 은 그대로: 터치 안내 문구는 유지) */
  suppress(on: boolean): void;
  /** 컷신 중에는 스틱·작은 단추를 숨기고 행동 단추만 남김 */
  setCutscene(on: boolean): void;
  destroy(): void;
}

/** DOM 이 없는 환경(테스트)에서는 아무것도 하지 않는 껍데기를 돌려줌 */
export function mountTouchControls(win: Window = window): TouchControls {
  const doc = win.document;
  const none: TouchControls = { visible: false, show() {}, hide() {}, suppress() {}, setCutscene() {}, destroy() {} };
  if (!doc || typeof doc.createElement !== 'function') return none;

  // 안드로이드 앱은 WebView 가 pointer: coarse 를 fine 으로 알리는 기기(에뮬레이터 등)가 있어 항상 터치 기기로 봄. 웹은 감지 그대로
  const coarse = isNativeApp() || (typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches);
  const forced = new URLSearchParams(win.location?.search ?? '').get('touch');
  const root = doc.createElement('div');
  root.className = 'abraham-touch';
  root.setAttribute('data-touch-ui', '');
  const style = doc.createElement('style'); style.textContent = CSS;

  const fire = (type: 'keydown' | 'keyup', code: string) => {
    try { win.dispatchEvent(new KeyboardEvent(type, { code, key: KEY[code] ?? code, bubbles: true, cancelable: true })); } catch { /* 키 이벤트를 못 만드는 환경 */ }
  };
  const tap = (code: string) => { fire('keydown', code); fire('keyup', code); };

  // ── 스틱 ──
  const RADIUS = 46;
  const stick = doc.createElement('div'); stick.className = 'abraham-stick'; stick.setAttribute('data-touch-ui', '');
  const knob = doc.createElement('div'); knob.className = 'abraham-knob'; stick.append(knob);
  let held = new Set<string>();
  let stickId = -1;
  const setHeld = (next: StickCode[]) => {
    const n = new Set<string>(next);
    for (const c of held) if (!n.has(c)) fire('keyup', c);
    for (const c of n) if (!held.has(c)) fire('keydown', c);
    held = n;
  };
  const move = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const k = clampKnob(dx, dy, RADIUS);
    knob.style.transform = `translate(${k.x}px,${k.y}px)`;
    setHeld(stickCodes(dx, dy, RADIUS));
  };
  const release = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickId = -1; knob.style.transform = ''; setHeld([]);
  };
  stick.addEventListener('pointerdown', (e) => {
    if (stickId !== -1) return;
    stickId = e.pointerId;
    try { stick.setPointerCapture(e.pointerId); } catch { /* 캡처 못 해도 계속 */ }
    e.preventDefault(); move(e);
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) { e.preventDefault(); move(e); } });
  stick.addEventListener('pointerup', release);
  stick.addEventListener('pointercancel', release);
  stick.addEventListener('lostpointercapture', release);

  // ── 단추 ──
  const labels: Array<[HTMLElement, string]> = [];
  const mk = (cls: string, label: string, onDown: (el: HTMLElement) => void, bottom?: number, onUp?: () => void) => {
    const b = doc.createElement('button'); b.type = 'button'; b.className = `abraham-btn ${cls}`; b.setAttribute('data-touch-ui', '');
    if (bottom !== undefined) b.style.bottom = `calc(env(safe-area-inset-bottom,0px) + ${bottom}px)`;
    b.textContent = tr(label); labels.push([b, label]);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); onDown(b); });
    if (onUp) { b.addEventListener('pointerup', onUp); b.addEventListener('pointercancel', onUp); b.addEventListener('pointerleave', onUp); }
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };
  let running = false;
  const act = mk('abraham-act', '행동', () => fire('keydown', 'KeyE'), undefined, () => fire('keyup', 'KeyE'));
  const run = mk('abraham-sm abraham-g0', '달리기', (b) => { running = !running; b.classList.toggle('on', running); fire(running ? 'keydown' : 'keyup', 'ShiftLeft'); });
  const bag = mk('abraham-sm abraham-g1', '가방', () => tap('KeyI'));
  const journal = mk('abraham-sm abraham-g2', '도감', () => tap('KeyJ'));
  const menu = mk('abraham-sm abraham-g3', '메뉴', () => tap('Escape'));
  root.append(stick, act, run, bag, journal, menu);

  const refreshLabels = () => { for (const [el, ko] of labels) el.textContent = tr(ko); };
  const offLang = onLangChange(refreshLabels);

  // ── 보임/숨김 ──
  let visible = false;
  const show = () => { visible = true; root.hidden = suppressed; };
  const reset = () => {
    stickId = -1; knob.style.transform = ''; setHeld([]);
    if (running) { running = false; run.classList.remove('on'); fire('keyup', 'ShiftLeft'); }
    fire('keyup', 'KeyE');
  };
  const hide = () => { visible = false; root.hidden = true; reset(); };
  let suppressed = false;
  const suppress = (on: boolean) => {
    if (on === suppressed) return;
    suppressed = on;
    if (!visible) return;
    root.hidden = on;
    if (on) reset();
  };
  let cutscene = false;
  const setCutscene = (on: boolean) => {
    if (on === cutscene) return;
    cutscene = on;
    root.classList.toggle('abraham-cut', on);
    if (on && visible) reset(); // 숨는 스틱·달리기가 눌린 채 남지 않게
  };
  const onVisibility = () => { if (doc.hidden) reset(); };
  root.hidden = true;
  doc.head?.append(style); doc.body.append(root);
  if (wantsTouchUi(`?touch=${forced ?? ''}`, coarse)) show();

  const onPointer = (e: PointerEvent) => { if (forced !== '0' && e.pointerType === 'touch' && !visible) show(); };
  // 물리 키보드를 누르면 숨김 (우리가 만든 가짜 키 이벤트는 isTrusted=false)
  const onKey = (e: KeyboardEvent) => {
    if (forced === '1' || !e.isTrusted || ['Shift', 'Control', 'Alt', 'Meta', 'GoBack', 'BrowserBack'].includes(e.key)) return; // 뒤로가기 단추는 키보드가 아님
    if (visible) hide();
  };
  win.addEventListener('blur', reset);
  win.addEventListener('orientationchange', reset);
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pointerdown', onPointer, { passive: true });
  win.addEventListener('keydown', onKey, { passive: true });

  return {
    get visible() { return visible; },
    show, hide, suppress, setCutscene,
    destroy() {
      win.removeEventListener('pointerdown', onPointer); win.removeEventListener('keydown', onKey);
      win.removeEventListener('blur', reset); win.removeEventListener('orientationchange', reset);
      doc.removeEventListener('visibilitychange', onVisibility);
      offLang?.(); hide(); root.remove(); style.remove();
    },
  };
}
