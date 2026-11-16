import { describe, expect, it } from 'vitest';
import { Interactions, type Interactable, addSpot, SPOTS } from '../src/systems/interaction';

describe('상호작용 시스템 (Interactions & Interactable)', () => {
  function createMockInteractable(
    id: string,
    x: number,
    z: number,
    options: {
      r?: number;
      label?: string | null;
      bias?: number | (() => number);
      height?: number;
    } = {},
  ): Interactable {
    return {
      id,
      pos: () => ({ x, z }),
      height: options.height ?? 1.0,
      r: options.r ?? 0.2,
      label: () => (options.label !== undefined ? options.label : '상호작용'),
      bias: options.bias ?? 0,
      act: () => {},
    };
  }

  it('Interactions 의 add, get, remove, clear, size, values 가 정상 동작한다', () => {
    const interactions = new Interactions();
    expect(interactions.size).toBe(0);
    expect(interactions.get('item1')).toBeUndefined();
    expect([...interactions.values()]).toEqual([]);

    const item1 = createMockInteractable('item1', 1, 1);
    const item2 = createMockInteractable('item2', 2, 2);
    const item3 = createMockInteractable('item3', 3, 3);

    // add 단일 및 복수 등록
    interactions.add(item1);
    expect(interactions.size).toBe(1);
    expect(interactions.get('item1')).toBe(item1);

    interactions.add(item2, item3);
    expect(interactions.size).toBe(3);
    expect([...interactions.values()]).toHaveLength(3);

    // remove
    interactions.remove('item2');
    expect(interactions.size).toBe(2);
    expect(interactions.get('item2')).toBeUndefined();

    // clear
    interactions.clear();
    expect(interactions.size).toBe(0);
    expect([...interactions.values()]).toEqual([]);
  });

  describe('nearest 탐색 동작 (거리, 시선 방향, 가중치, 라벨 스킵)', () => {
    it('reach 거리(0.85) 밖의 대상은 탐색되지 않고 범위 내 대상만 선택된다', () => {
      const interactions = new Interactions();
      // 대상 r = 0.5, 중심 (0, 2.0). 플레이어 (0, 0), 시선 +Z(facing = 0)
      // gap = 2.0 - 0.5 = 1.5 > reach(0.85) -> 도달 불가
      const farItem = createMockInteractable('far', 0, 2.0, { r: 0.5 });
      interactions.add(farItem);
      expect(interactions.nearest(0, 0, 0)).toBeNull();

      // 대상 r = 0.5, 중심 (0, 1.2). gap = 1.2 - 0.5 = 0.7 <= reach(0.85) -> 도달 가능
      const nearItem = createMockInteractable('near', 0, 1.2, { r: 0.5 });
      interactions.add(nearItem);
      expect(interactions.nearest(0, 0, 0)).toBe(nearItem);
    });

    it('바라보는 방향(front)을 우선하며 등 뒤의 먼 대상은 제외한다', () => {
      const interactions = new Interactions();
      // 플레이어는 (0, 0)에서 +Z 방향(facing = 0: fx=0, fz=1)을 바라봄
      // 전방 대상: (0, 0.6), gap = 0.6 - 0.1 = 0.5
      const frontItem = createMockInteractable('front', 0, 0.6, { r: 0.1 });
      // 후방 대상: (0, -0.6), gap = 0.6 - 0.1 = 0.5 (front = -1 < -0.2, gap > 0.25 -> 필터링)
      const backItem = createMockInteractable('back', 0, -0.6, { r: 0.1 });

      interactions.add(frontItem, backItem);
      expect(interactions.nearest(0, 0, 0)).toBe(frontItem);

      // 플레이어가 -Z 방향(facing = Math.PI: fx=0, fz=-1)으로 돌아서면 후방 대상이 선택됨
      expect(interactions.nearest(0, 0, Math.PI)).toBe(backItem);
    });

    it('bias 가중치(숫자 또는 함수)가 높은 대상을 더 멀리 있어도 우선 선택한다', () => {
      const interactions = new Interactions();
      // itemA: 더 가까움 (gap = 0.5 - 0.1 = 0.4), bias = 0 -> score = 0.4 - 0.4 - 0 = 0
      const itemA = createMockInteractable('itemA', 0, 0.5, { r: 0.1, bias: 0 });
      // itemB: 조금 더 멂 (gap = 0.65 - 0.1 = 0.55), bias = 0.6 -> score = 0.55 - 0.4 - 0.6 = -0.45 (더 낮은 점수가 우선)
      const itemB = createMockInteractable('itemB', 0, 0.65, { r: 0.1, bias: 0.6 });

      interactions.add(itemA, itemB);
      expect(interactions.nearest(0, 0, 0)).toBe(itemB);

      // 함수형 bias 검증
      interactions.remove('itemB');
      const itemC = createMockInteractable('itemC', 0, 0.65, { r: 0.1, bias: () => 0.8 });
      interactions.add(itemC);
      expect(interactions.nearest(0, 0, 0)).toBe(itemC);
    });

    it('가장 가까운 대상의 label()이 null(비활성)이면 건너뛰고 다음 최적 대상을 고른다', () => {
      const interactions = new Interactions();
      // 가장 가깝지만 현재 상호작용 불가능(label: null)
      const disabledItem = createMockInteractable('disabled', 0, 0.4, {
        r: 0.1,
        label: null,
      });
      // 조금 더 멀지만 활성화된 대상
      const activeItem = createMockInteractable('active', 0, 0.7, {
        r: 0.1,
        label: '말 걸기',
      });

      interactions.add(disabledItem, activeItem);
      expect(interactions.nearest(0, 0, 0)).toBe(activeItem);

      // 두 대상 모두 label 이 null 이면 null 반환
      interactions.remove('active');
      const alsoDisabled = createMockInteractable('alsoDisabled', 0, 0.7, {
        r: 0.1,
        label: null,
      });
      interactions.add(alsoDisabled);
      expect(interactions.nearest(0, 0, 0)).toBeNull();
    });
  });

  it('addSpot 헬퍼가 SPOTS 배열에 고유 id와 함께 등록한다', () => {
    const beforeCount = SPOTS.length;
    addSpot('well_spot', 12, 34, 1.5);
    expect(SPOTS.length).toBe(beforeCount + 1);

    const lastSpot = SPOTS[SPOTS.length - 1];
    expect(lastSpot.kind).toBe('well_spot');
    expect(lastSpot.x).toBe(12);
    expect(lastSpot.z).toBe(34);
    expect(lastSpot.y).toBe(1.5);
    expect(lastSpot.id).toMatch(/^well_spot#\d+$/);
  });
});
