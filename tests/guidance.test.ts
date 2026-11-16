import { describe, it, expect } from 'vitest';
import { Interactions } from '../src/systems/interaction';
import { findGuidanceTarget, SAFETY_NET_ID, type GuidanceTarget } from '../src/game/guidance';

const make = (id: string, x: number, z: number, label: string | null = id, height = 1.2) => ({
  id, pos: () => ({ x, z }), height, r: 1, label: () => label, act: () => {},
});
const fresh = (): GuidanceTarget => ({ x: 0, z: 0, height: 1, label: '' });

describe('목표 안내 대상 (findGuidanceTarget)', () => {
  it('가장 가까운 실제 상호작용을 고른다', () => {
    const i = new Interactions();
    i.add(make('far', 10, 10), make('near', 2, 1), make('mid', 5, 5));
    const out = fresh();
    expect(findGuidanceTarget(i, 0, 0, out)).toBe(true);
    expect(out.label).toBe('near');
    expect(out.x).toBe(2);
  });

  it('지금 할 수 없는(label null) 상호작용은 건너뛴다', () => {
    const i = new Interactions();
    i.add(make('locked', 1, 0, null), make('ok', 8, 0));
    const out = fresh();
    expect(findGuidanceTarget(i, 0, 0, out)).toBe(true);
    expect(out.label).toBe('ok');
  });

  it('실제 상호작용이 있으면 안전망은 더 가까워도 후보에서 뺀다', () => {
    const i = new Interactions();
    i.add(make(SAFETY_NET_ID, 0.5, 0), make('quest', 9, 9));
    const out = fresh();
    expect(findGuidanceTarget(i, 0, 0, out)).toBe(true);
    expect(out.label).toBe('quest');
  });

  it('안전망이 먼저 등록돼 있어도(Map 순서) 뒤에 실제 상호작용이 나오면 실제 쪽을 고른다', () => {
    const i = new Interactions();
    i.add(make(SAFETY_NET_ID, 0.1, 0));
    i.add(make('later', 20, 0));
    const out = fresh();
    findGuidanceTarget(i, 0, 0, out);
    expect(out.label).toBe('later');
  });

  it('실제 상호작용이 하나도 없을 때만 안전망을 가리킨다', () => {
    const i = new Interactions();
    i.add(make(SAFETY_NET_ID, 3, 0));
    const out = fresh();
    expect(findGuidanceTarget(i, 0, 0, out)).toBe(true);
    expect(out.label).toBe(SAFETY_NET_ID);
  });

  it('후보가 없으면 false 이고 out 은 그대로다', () => {
    const i = new Interactions();
    const out = fresh();
    expect(findGuidanceTarget(i, 0, 0, out)).toBe(false);
    expect(out).toEqual({ x: 0, z: 0, height: 1, label: '' });
  });
});
