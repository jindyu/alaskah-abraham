/** 창(패널) 공통 규약과 등록부. 새 창 = 창 클래스를 만들고 createGame.ts 에서 `panels.add(...)` 한 줄. */
import type { PointerEv } from './pointer';

/** 키 입력을 받을 수 있는 것. `key` 는 처리했으면 true(= 이후 창·월드 입력을 막음) */
export interface KeyRoute {
  readonly open: boolean;
  key(e: KeyboardEvent): boolean;
  /** 마우스 입력(UI 좌표). 소비했으면 true. 없어도 열려 있는 동안은 PanelStack 이 클릭을 삼킴 */
  pointer?(ev: PointerEv): boolean;
}

/** 화면에 그려지는 창 */
export interface Panel {
  readonly open: boolean;
  /** 열려 있든 아니든 매 프레임 불림(닫힘 처리는 창이 스스로) */
  draw(dt: number): void;
  key?(e: KeyboardEvent): boolean;
  pointer?(ev: PointerEv): boolean;
}

interface Keyed { readonly rank: number; readonly route: KeyRoute }

/**
 * 창 등록부.
 * - 그리기 순서 = `add` 한 순서(나중에 add 한 창이 위에 덮임).
 * - 입력 우선순위 = `keyRank` 오름차순(작을수록 먼저). 같거나 생략(맨 뒤)이면 등록 순서. 그리기 순서와 다를 수 있어 따로 받는다.
 * - 열려 있는 창이 `key` 에서 true 를 돌려주면 그 뒤 창에는 전달하지 않는다.
 * - 마우스(`routePointer`)도 같은 우선순위. 열린 창이 하나라도 있으면 아무도 소비하지 않아도 true(뒤 월드로 새지 않게).
 */
export class PanelStack {
  private readonly drawn: Panel[] = [];
  private keyed: Keyed[] = [];

  add(panel: Panel, keyRank = Infinity): this {
    this.drawn.push(panel);
    // key·pointer 가 없는 창(안내 등)도 목록에 넣어 열려 있는 동안 마우스를 삼키게 함. 키는 처리하지 않음(false)
    this.keyed.push({
      rank: keyRank,
      route: {
        get open() { return panel.open; },
        key: (e) => panel.key?.(e) ?? false,
        pointer: (ev) => panel.pointer?.(ev) ?? false,
      },
    });
    this.sort();
    return this;
  }

  /** 그려지지 않고 입력만 받는 것(컷신 등). `anyOpen` 에는 들어가지 않음 */
  addKey(route: KeyRoute, keyRank = Infinity): this {
    this.keyed.push({ rank: keyRank, route });
    this.sort();
    return this;
  }

  anyOpen(): boolean { return this.drawn.some((p) => p.open); }

  drawAll(dt: number): void { for (const p of this.drawn) p.draw(dt); }

  /** 우선순위 순으로 열린 창에 키를 줌. 누군가 처리했으면 true */
  routeKey(e: KeyboardEvent): boolean {
    for (const { route } of this.keyed) if (route.open && route.key(e)) return true;
    return false;
  }

  /**
   * 우선순위 순으로 열린 창에 마우스 이벤트를 줌. 소비하면 거기서 멈춤.
   * 아무도 소비하지 않았어도 열린 창(컷신 포함)이 있었으면 true — 모달 뒤 월드가 클릭을 받지 않게
   */
  routePointer(ev: PointerEv): boolean {
    let anyOpen = false;
    for (const { route } of this.keyed) {
      if (!route.open) continue;
      anyOpen = true;
      if (route.pointer?.(ev)) return true;
    }
    return anyOpen;
  }

  private sort() { this.keyed = this.keyed.map((k, i) => ({ k, i })).sort((a, b) => a.k.rank - b.k.rank || a.i - b.i).map((x) => x.k); }
}

/** 창이 마우스를 받을 수 있는 모양 (선택) */
interface PointerLike { pointer?(ev: PointerEv): boolean }

/** `key` 가 void 인 기존 창을 "열려 있으면 모든 키를 삼키는" KeyRoute 로. `after` 는 키·마우스 처리 직후(예: 닫혔으면 시계 해제) */
export function keyRoute(p: { readonly open: boolean; key(e: KeyboardEvent): void } & PointerLike, after?: () => void): KeyRoute {
  return {
    get open() { return p.open; },
    key(e) { p.key(e); after?.(); return true; },
    pointer(ev) { const r = p.pointer?.(ev) ?? false; after?.(); return r; },
  };
}

/** `key` 가 void 인 기존 창을 Panel 로. 열려 있으면 모든 키를 삼킴 (마우스는 창의 pointer 결과를 그대로, 못 받으면 PanelStack 이 삼킴) */
export function modal(
  p: { readonly open: boolean; draw(dt: number): void; key(e: KeyboardEvent): void } & PointerLike, after?: () => void,
): Panel {
  const r = keyRoute(p, after);
  return { get open() { return p.open; }, draw: (dt) => p.draw(dt), key: (e) => r.key(e), pointer: (ev) => r.pointer?.(ev) ?? false };
}
