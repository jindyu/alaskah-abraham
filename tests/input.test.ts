import { describe, expect, it, vi } from 'vitest';
import { isBrowserShortcut, performAct } from '../src/game/input';
import { PanelStack } from '../src/game/panels';
import type { Interactable } from '../src/systems/interaction';

const item = (act: () => void): Interactable => ({ id: 'x', pos: () => ({ x: 0, z: 0 }), height: 1, r: 1, label: () => 'x', act });

describe('input', () => {
  it('행동이 던진 오류는 onActError 로 넘긴다', () => {
    const onActError = vi.fn();
    performAct(item(() => { throw new Error('boom'); }), { onActError });
    expect(onActError).toHaveBeenCalledOnce();
  });
  it('정상 행동은 onAct 뒤에 실행된다', () => {
    const order: string[] = [];
    performAct(item(() => order.push('act')), { onAct: () => order.push('before'), onActError: () => order.push('err') });
    expect(order).toEqual(['before', 'act']);
  });
  it('브라우저 단축키는 게임이 가로채지 않는다', () => {
    expect(isBrowserShortcut({ code: 'F5' })).toBe(true);
    expect(isBrowserShortcut({ code: 'KeyR', metaKey: true })).toBe(true);
    expect(isBrowserShortcut({ code: 'KeyE' })).toBe(false);
  });
  it('PanelStack 은 우선순위 순으로 키를 주고 열린 창이 마우스를 삼킨다', () => {
    const calls: string[] = [];
    const mk = (name: string, open: boolean, handled: boolean) => ({ open, draw() {}, key: () => { calls.push(name); return handled; } });
    const st = new PanelStack().add(mk('low', true, true), 5).add(mk('high', true, false), 1);
    expect(st.routeKey({} as KeyboardEvent)).toBe(true);
    expect(calls).toEqual(['high', 'low']);
    expect(st.routePointer({ x: 0, y: 0, kind: 'down', button: 0, dy: 0 })).toBe(true);
  });
});
