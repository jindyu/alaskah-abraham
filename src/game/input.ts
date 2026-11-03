import type { Hud } from '../ui/hud';
import type { Interactable } from '../systems/interaction';
import type { PanelStack } from './panels';
import { toUiCoords, type PointerEv } from './pointer';

export interface InputContext {
  hud: Hud;
  keys: Set<string>;
  panels: PanelStack; // 키·마우스 우선순위는 createGame.ts 의 등록(keyRank)이 정함
  panelOpen(): boolean;
  transitioning(): boolean;
  /** 지금 조준 중인 상호작용 대상 */
  aim(): Interactable | null;
  /** 행동 하나를 실행하기 직전 (장별 행동 수 기록) */
  onAct?(target: Interactable): void;
  /** 행동 중 난 오류를 처리 (대화·컷신 멈춤 해제 + 알림) */
  onActError(err: unknown, target: Interactable): void;
  /** Tab: 권/장 선택 오버레이 */
  openChapterSelect(): void;
  /** Esc: 일시정지 메뉴 */
  openPause(): void;
  /** F1: 도움말 */
  openHelp?(): void;
  /** 월드 클릭 연결 (createGame.ts). 없으면 월드 클릭은 하지 않음 */
  click?: ClickApi;
}

/** 월드 클릭이 필요로 하는 것 (카메라 역투영·대상 고르기·걷기 상태) */
export interface ClickApi {
  /** 화면 좌표 → 월드 y=0 평면 위 (x, z) */
  ground(clientX: number, clientY: number): { x: number; z: number } | null;
  /** 그 지점의 상호작용 대상 */
  pick(x: number, z: number): Interactable | null;
  walkTo(x: number, z: number): void;
  /** 대상으로 걸어가 닿으면 행동 */
  walkToAct(a: Interactable): void;
  cancel(): void;
}

/** 상호작용 실행 (키보드 E/Space 와 마우스 클릭이 같이 씀). 행동 하나가 실패해도 게임이 멈춘 채 남지 않게 onActError 로 넘김 */
export function performAct(a: Interactable, c: Pick<InputContext, 'onAct' | 'onActError'>): void {
  c.onAct?.(a);
  try { a.act(); } catch (err) {
    console.error('action error', a.id, err);
    c.onActError(err, a);
  }
}

/** 키보드·폼 요소 위의 이벤트인가 (입력칸·안내 단추 등은 월드 클릭·우클릭 막기에서 제외) */
function onFormControl(t: EventTarget | null): boolean {
  const el = t as { closest?: (s: string) => unknown } | null;
  return !!el && typeof el.closest === 'function' && !!el.closest('input,textarea,select,button,a,[role="dialog"],[data-touch-ui]');
}

/** 브라우저가 처리할 단축키인가: F5·F11·F12, Ctrl/⌘ 조합 (Alt 단독·Shift 단독은 게임 키로 둠) */
export function isBrowserShortcut(e: { code: string; ctrlKey?: boolean; metaKey?: boolean }): boolean {
  return ['F5', 'F11', 'F12'].includes(e.code) || !!e.ctrlKey || !!e.metaKey;
}

/** 패널 우선순위와 월드 입력을 한곳에서 다룬다. */
export function bindInput(target: Window, c: InputContext) {
  const { keys, hud } = c;
  target.addEventListener('keydown', (e) => {
    // 브라우저 단축키(새로고침·전체화면·개발자 도구, Ctrl/⌘ 조합)는 열린 창이 삼키지 않게 그대로 통과
    if (isBrowserShortcut(e)) return;
    if (e.repeat && ['Tab', 'Escape', 'F1'].includes(e.code)) { e.preventDefault(); return; }
    // 열린 창에 keyRank 순으로 키를 줌. 처리되면 여기서 끝
    if (c.panels.routeKey(e)) return;
    if (c.transitioning()) return; // 장면 전환 중에는 창을 열지 않음
    if (e.code === 'Tab') { e.preventDefault(); c.openChapterSelect(); return; }
    if (e.code === 'F1') { e.preventDefault(); c.openHelp?.(); return; }
    if (e.code === 'Escape') { c.openPause(); return; }
    keys.add(e.code);
    // 상호작용 (누른 순간만)
    const a = (e.code === 'KeyE' || e.code === 'Space') && !e.repeat ? c.aim() : null;
    if (a) performAct(a, c);
  });
  target.addEventListener('keyup', (e) => keys.delete(e.code));
  target.addEventListener('blur', () => { keys.clear(); c.click?.cancel(); });

  // ── 마우스 ──
  /** 화면 좌표 → UI 좌표 이벤트 (HUD 캔버스가 아직 없거나 크기가 0 이면 null) */
  const toEv = (clientX: number, clientY: number, kind: PointerEv['kind'], button: number, dy: number): PointerEv | null => {
    const rect = hud.canvas.getBoundingClientRect();
    if (!(rect.width > 0) || !(hud.uiW > 0)) return null;
    const { x, y } = toUiCoords(clientX, clientY, rect, hud.uiW);
    return { x, y, kind, button, dy };
  };
  let lastCursor = '';
  const setCursor = (v: string) => {
    if (v === lastCursor) return;
    lastCursor = v;
    try { document.body.style.cursor = v; } catch { /* DOM 이 없는 환경 */ }
  };
  // 우클릭 메뉴 막기 (입력칸·안내 단추 위에서는 그대로)
  target.addEventListener('contextmenu', (e) => { if (!onFormControl(e.target)) e.preventDefault(); });
  // 터치로 목록을 끄는 스크롤 (휠 대신): 창 안에서 누른 손가락이 위아래로 DRAG_STEP_PX 움직일 때마다 휠 한 칸
  const DRAG_STEP_PX = 28;
  let drag: { id: number; y: number; acc: number } | null = null;
  const endDrag = (e: PointerEvent) => { if (drag && drag.id === e.pointerId) drag = null; };
  target.addEventListener('pointerup', endDrag, { passive: true });
  target.addEventListener('pointercancel', endDrag, { passive: true });
  target.addEventListener('pointerdown', (e) => {
    if (e.isPrimary === false || onFormControl(e.target)) return;
    if (c.transitioning()) return;
    const ev = toEv(e.clientX, e.clientY, 'down', e.button, 0);
    if (!ev) return;
    if (c.panels.routePointer(ev)) { if (e.pointerType === 'touch') drag = { id: e.pointerId, y: e.clientY, acc: 0 }; return; } // 열린 창(컷신 포함)이 소비하거나 삼킴
    if (c.panelOpen() || ev.button !== 0) return; // 우클릭·가운데 클릭은 월드에서 아무 것도 하지 않음
    const click = c.click;
    if (!click) return;
    const g = click.ground(e.clientX, e.clientY);
    if (!g) return;
    const it = click.pick(g.x, g.z);
    if (!it) { click.walkTo(g.x, g.z); return; }
    if (c.aim() === it) { click.cancel(); performAct(it, c); } else click.walkToAct(it);
  });
  target.addEventListener('pointermove', (e) => {
    if (e.isPrimary === false || c.transitioning()) { setCursor(''); return; }
    if (onFormControl(e.target)) return;
    if (drag && drag.id === e.pointerId && c.panelOpen()) {
      drag.acc += e.clientY - drag.y; drag.y = e.clientY;
      while (Math.abs(drag.acc) >= DRAG_STEP_PX) {
        const down = drag.acc < 0;                       // 손가락을 위로 끌면 목록은 아래로(휠 +)
        drag.acc += down ? DRAG_STEP_PX : -DRAG_STEP_PX;
        const w = toEv(e.clientX, e.clientY, 'wheel', 0, down ? 1 : -1);
        if (w) c.panels.routePointer(w);
      }
      return;
    }
    const ev = toEv(e.clientX, e.clientY, 'move', 0, 0);
    if (!ev) return;
    // 창이 열려 있으면 호버만 전달하고 기본 커서
    if (c.panels.routePointer(ev) || c.panelOpen()) { setCursor(''); return; }
    const g = c.click?.ground(e.clientX, e.clientY);
    setCursor(g && c.click!.pick(g.x, g.z) ? 'pointer' : '');
  }, { passive: true });
  // 휠: 창이 열려 있으면 그 창에(스크롤 등)
  target.addEventListener('wheel', (e) => {
    if (c.transitioning() || !c.panelOpen()) return;
    const ev = toEv(e.clientX, e.clientY, 'wheel', 0, e.deltaY);
    if (ev) c.panels.routePointer(ev);
  }, { passive: true });
}
