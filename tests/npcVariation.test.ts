import { describe, expect, it } from 'vitest';
import { Actor } from '../src/entities/actor';
import { getCast } from '../src/entities/cast';
import { hashId, npcLook } from '../src/entities/variation';

describe('NPC 결정적 외형 변주', () => {
  it('같은 id 는 언제나 같은 모습', () => {
    for (const id of ['crowd_3', 'merchant', 'guard1']) {
      const cast = getCast(id.startsWith('guard') ? 'guard' : 'citizen');
      expect(npcLook(id, cast)).toEqual(npcLook(id, cast));
    }
    expect(hashId('abc')).toBe(hashId('abc'));
  });

  it('일반 배역은 id 마다 다르고 키는 0.92~1.08 범위 (citizen 0.95 기준)', () => {
    const cast = getCast('citizen');
    const sigs = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const l = npcLook('crowd_' + i, cast);
      expect(l.scale).toBeGreaterThanOrEqual(0.95 * 0.92 - 1e-9);
      expect(l.scale).toBeLessThanOrEqual(0.95 * 1.08 + 1e-9);
      sigs.add(JSON.stringify(l));
    }
    expect(sigs.size).toBeGreaterThan(25);
  });

  it('이름 있는 인물은 보조 인스턴스(id 달라도)에서 본체와 같은 모습', () => {
    const c = getCast('abram');
    expect(npcLook('dep_abram', c)).toEqual(npcLook('abram', c));
  });

  it('핵심 인물 실루엣: 아브라함 지팡이, 이스마엘 활, 근위병 투구·창, 천사 날개', () => {
    expect(npcLook('abraham', getCast('abraham')).prop).toBe('staff');
    expect(npcLook('ishmael', getCast('ishmael')).prop).toBe('bow');
    const g = npcLook('guard1', getCast('guard'));
    expect(g.headpiece).toBe('helmet');
    expect(g.prop).toBe('spear');
    expect(getCast('nimrod').scale).toBeGreaterThan(1.1);
    expect(getCast('nimrod').headpiece).toBe('crown');
    expect(getCast('sarah').headpiece).toBe('veil');
  });

  it('Actor 생성이 결정적이며 정리까지 동작', () => {
    const a = new Actor('guard1', 'guard');
    const b = new Actor('guard1', 'guard');
    expect(a.root.scale.x).toBe(b.root.scale.x);
    expect(a.look).toEqual(b.look);
    a.dispose(); b.dispose();
  });
});
