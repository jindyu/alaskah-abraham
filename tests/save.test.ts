import { beforeEach, describe, expect, it } from 'vitest';
import { classifyRaw, clearSave, migrateSave, peekSave, readSave, slotInfo, writeSave, SLOTS } from '../src/systems/save';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
});

const base = { story: { book: 1, chapter: 2, hero: 'abraham' }, player: { x: 1, z: 2 } };

describe('save', () => {
  it('쓰고 다시 읽는다', () => {
    expect(writeSave(base, 1)).toBe(true);
    const d = readSave(1);
    expect(d?.story.chapter).toBe(2);
    expect(slotInfo(1)).toMatchObject({ book: 1, chapter: 2 });
  });
  it('칸은 서로 독립이다', () => {
    writeSave(base, 2);
    expect(peekSave(1).status).toBe('empty');
    expect(peekSave(2).status).toBe('ok');
    expect(SLOTS).toBe(3);
    clearSave(2);
    expect(peekSave(2).status).toBe('empty');
  });
  it('깨진 글과 새 버전 글을 가른다', () => {
    expect(classifyRaw('not json').status).toBe('broken');
    expect(classifyRaw(JSON.stringify({ version: 1, story: {} })).status).toBe('broken');
    expect(classifyRaw(JSON.stringify({ version: 99, story: { book: 1, chapter: 0 } })).status).toBe('newer');
  });
  it('version 없는 옛 저장은 v0 으로 올린다', () => {
    expect(migrateSave({ story: { book: 1, chapter: 0 } })?.version).toBe(1);
    expect(migrateSave({ version: -1 })).toBeNull();
  });
});
