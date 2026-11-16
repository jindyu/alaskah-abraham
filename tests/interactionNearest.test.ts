import { describe, it, expect } from 'vitest';
import { Interactions, type Interactable } from '../src/systems/interaction';

function mk(id: string, x: number, z: number, label: string | null = id): Interactable {
  const p = { x, z };
  return { id, pos: () => p, height: 1, r: 0.3, label: () => label, act() { /* 없음 */ } };
}

describe('Interactions.nearest (배열 캐시)', () => {
  it('add/remove/clear 뒤에도 최신 목록으로 고른다', () => {
    const ia = new Interactions();
    expect(ia.nearest(0, 0, 0)).toBeNull();
    ia.add(mk('a', 0, 0.5), mk('b', 0, 5));
    expect(ia.nearest(0, 0, 0)?.id).toBe('a');
    ia.remove('a');
    expect(ia.nearest(0, 0, 0)).toBeNull();
    ia.add(mk('c', 0, 0.4));
    expect(ia.nearest(0, 0, 0)?.id).toBe('c');
    ia.clear();
    expect(ia.nearest(0, 0, 0)).toBeNull();
  });

  it('지금 할 수 없는(label null) 대상은 건너뛰고 다음 후보를 고른다', () => {
    const ia = new Interactions();
    ia.add(mk('near', 0, 0.4, null), mk('far', 0, 0.9));
    expect(ia.nearest(0, 0, 0)?.id).toBe('far');
  });
});
