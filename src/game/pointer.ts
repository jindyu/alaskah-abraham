/** 마우스(포인터) 입력 공통 부품. 좌표는 모두 UI 좌표(= hud.uiW × hud.uiH 안의 픽셀)다. */
export interface PointerEv {
  /** UI 좌표 */
  x: number;
  y: number;
  /** move: 움직임(호버), down: 눌림, wheel: 휠 */
  kind: 'move' | 'down' | 'wheel';
  /** down 일 때 0=왼쪽 1=가운데 2=오른쪽 */
  button: number;
  /** wheel 일 때 위(-)·아래(+) */
  dy: number;
}

export interface HitRect {
  x: number; y: number; w: number; h: number;
  /** 눌렀을 때 (왼쪽 버튼). 오른쪽 버튼은 onRight 가 있을 때만 */
  onClick?: () => void;
  onRight?: () => void;
  /** 위에 올렸을 때 (움직일 때마다 불림) */
  onHover?: () => void;
}

/**
 * 한 창의 클릭 영역 모음. draw() 시작에서 clear() 하고 그리면서 add() 하면
 * 해상도가 바뀌어도 항상 직전 화면과 같은 좌표를 쓴다. 나중에 add 한 것이 위에 있다.
 */
export class HitMap {
  private rects: HitRect[] = [];
  clear() { this.rects.length = 0; }
  add(x: number, y: number, w: number, h: number, onClick?: () => void, onHover?: () => void, onRight?: () => void) {
    this.rects.push({ x, y, w, h, onClick, onHover, onRight });
  }
  /**
   * 손가락용 여유(UI 픽셀). 0 이면 꺼짐. 정확히 맞는 영역이 없을 때만, 이 거리 안에서 가장 가까운 클릭 가능 영역을 고른다.
   * 작은 단추(닫기 × 등)를 손가락으로 누르기 쉽게 하려는 것으로, 터치 화면(안드로이드 앱)에서만 켠다.
   */
  static slop = 0;
  /** 해당 좌표의 맨 위 영역 */
  at(x: number, y: number): HitRect | null {
    for (let i = this.rects.length - 1; i >= 0; i--) {
      const r = this.rects[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
    }
    return HitMap.slop > 0 ? this.near(x, y, HitMap.slop) : null;
  }
  private near(x: number, y: number, slop: number): HitRect | null {
    let best: HitRect | null = null, bestD = Infinity;
    for (let i = this.rects.length - 1; i >= 0; i--) {
      const r = this.rects[i];
      if (!r.onClick && !r.onRight) continue;
      const dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dy = Math.max(r.y - y, 0, y - (r.y + r.h));
      if (dx > slop || dy > slop) continue;
      const d = Math.hypot(dx, dy);
      if (d < bestD) { best = r; bestD = d; }
    }
    return best;
  }
  /** 포인터 이벤트 처리. 영역 위였으면 true (호버·클릭을 소비) */
  route(ev: PointerEv): boolean {
    const r = this.at(ev.x, ev.y);
    if (!r) return false;
    if (ev.kind === 'move') r.onHover?.();
    else if (ev.kind === 'down') {
      if (ev.button === 0) { r.onHover?.(); r.onClick?.(); }
      else if (ev.button === 2) r.onRight?.();
    }
    return true;
  }
  /** 마우스가 눌러 볼 만한 곳 위인가 (손가락 커서용) */
  clickable(x: number, y: number): boolean {
    const r = this.at(x, y);
    return !!r && !!(r.onClick || r.onRight);
  }
  get size() { return this.rects.length; }
}

/** 화면(clientX/Y) → UI 좌표. rect 는 HUD 캔버스의 getBoundingClientRect, uiW 는 hud.uiW */
export function toUiCoords(clientX: number, clientY: number, rect: { left: number; top: number; width: number }, uiW: number): { x: number; y: number } {
  const sc = rect.width / uiW;
  return { x: (clientX - rect.left) / sc, y: (clientY - rect.top) / sc };
}
