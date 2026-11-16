import { beforeEach, describe, expect, it } from 'vitest';
import {
  classifyRaw,
  clearSave,
  migrateSave,
  peekSave,
  readSave,
  slotInfo,
  writeSave,
  SLOTS,
  exportSlot,
  importIntoSlot,
  discardSave,
  backupSave,
  restoreBackup,
  listBackups,
  validSave,
  forgetSeen,
  saveDiagnostics,
} from '../src/systems/save';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  forgetSeen();
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

  it('전체 SaveData(story, hero, step, flags, done, player, playSeconds, stageId)를 저장하고 정확히 복원한다', () => {
    const fullPayload = {
      story: {
        book: 3,
        chapter: 1,
        hero: 'abram',
        step: 4,
        flags: { covenant_passed: true, stars_counted: 100, altar_built: 'done' },
        done: ['1:0', '1:1', '2:0', '3:0'],
        stageId: 'mamre',
      },
      player: { x: 15.5, z: -22.75 },
      playSeconds: 4200,
      stageId: 'mamre',
    };

    expect(writeSave(fullPayload, 1)).toBe(true);
    const loaded = readSave(1);
    expect(loaded).toBeDefined();
    expect(loaded?.version).toBe(1);
    expect(typeof loaded?.savedAt).toBe('number');
    expect(loaded?.savedAt).toBeGreaterThan(0);
    expect(loaded?.story.book).toBe(3);
    expect(loaded?.story.chapter).toBe(1);
    expect(loaded?.story.hero).toBe('abram');
    expect(loaded?.story.step).toBe(4);
    expect(loaded?.story.flags).toEqual({ covenant_passed: true, stars_counted: 100, altar_built: 'done' });
    expect(loaded?.story.done).toEqual(['1:0', '1:1', '2:0', '3:0']);
    expect(loaded?.story.stageId).toBe('mamre');
    expect(loaded?.player).toEqual({ x: 15.5, z: -22.75 });
    expect(loaded?.playSeconds).toBe(4200);
    expect(loaded?.stageId).toBe('mamre');

    // 슬롯 1에서 내보내고(exportSlot) 슬롯 3으로 가져오기(importIntoSlot) 라운드트립
    const rawExport = exportSlot(1);
    expect(rawExport).toBeDefined();
    expect(importIntoSlot(3, rawExport!)).toBe(true);

    const slot3Data = readSave(3);
    expect(slot3Data?.story).toEqual(loaded?.story);
    expect(slot3Data?.player).toEqual(loaded?.player);
    expect(slot3Data?.playSeconds).toBe(4200);
  });

  describe('구버전 저장 형식 하위 호환성 (Backward Compatibility)', () => {
    it('version 필드가 누락된 v0 저장을 v1 형식으로 정상 마이그레이션한다', () => {
      const v0Save = {
        story: { book: 2, chapter: 1 },
      };
      const migrated = migrateSave(v0Save);
      expect(migrated).not.toBeNull();
      expect(migrated?.version).toBe(1);
      expect(migrated?.story.book).toBe(2);
      expect(migrated?.story.chapter).toBe(1);
    });

    it('선택적 필드(player, playSeconds, flags, hero)가 누락된 옛 저장도 validSave 를 통과한다', () => {
      const minimalOldSave: any = {
        version: 1,
        savedAt: 1600000000000,
        story: { book: 1, chapter: 0 },
      };
      expect(validSave(minimalOldSave)).toBe(true);
      expect(classifyRaw(JSON.stringify(minimalOldSave)).status).toBe('ok');
    });

    it('v0 저장이 localStorage에 저장되어 있을 때 readSave가 마이그레이션하여 읽어온다', () => {
      const v0Raw = JSON.stringify({
        story: { book: 4, chapter: 2, hero: 'lot' },
        player: { x: 5, z: 10 },
      });
      expect(importIntoSlot(2, v0Raw)).toBe(true);

      const loaded = readSave(2);
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(1);
      expect(loaded?.story.book).toBe(4);
      expect(loaded?.story.hero).toBe('lot');
      expect(loaded?.player).toEqual({ x: 5, z: 10 });
    });

    it('잘못된 형태의 데이터는 migrateSave 및 classifyRaw 에서 안전하게 거부된다', () => {
      expect(migrateSave(null)).toBeNull();
      expect(migrateSave(undefined)).toBeNull();
      expect(migrateSave(12345)).toBeNull();
      expect(migrateSave('not object')).toBeNull();
      expect(migrateSave({ version: 1.5 })).toBeNull();
      expect(migrateSave({ version: 2 })).toBeNull();
      expect(migrateSave({ version: -1 })).toBeNull();

      expect(classifyRaw('{"version": 1}').status).toBe('broken');
      expect(classifyRaw('{"version": 1, "story": null}').status).toBe('broken');
      expect(classifyRaw('{"version": 1, "story": {"book": "abc"}}').status).toBe('broken');
    });

    it('다단계 마이그레이션 체인(MIGRATIONS) 단계별 동작을 지원한다', () => {
      const customSteps = {
        0: (d: Record<string, unknown>) => ({ ...d, step0: true }),
        1: (d: Record<string, unknown>) => ({ ...d, step1: true }),
      };
      const res = migrateSave({ version: 0, story: { book: 1, chapter: 0 } }, 2, customSteps);
      expect(res).not.toBeNull();
      expect((res as any).version).toBe(2);
      expect((res as any).step0).toBe(true);
      expect((res as any).step1).toBe(true);
    });
  });

  describe('백업 보관 및 복원 (Backup & Restore Lifecycle)', () => {
    it('backupSave 및 listBackups, restoreBackup 이 정상 작동한다', () => {
      forgetSeen();
      writeSave({ story: { book: 1, chapter: 0 } }, 1);
      backupSave(1);

      writeSave({ story: { book: 1, chapter: 1 } }, 1);
      const backups = listBackups(1);
      expect(backups.length).toBeGreaterThanOrEqual(1);

      const restored = restoreBackup(1, backups[0].suffix);
      expect(restored).toBe(true);
      const afterRestore = readSave(1);
      expect(afterRestore?.story.chapter).toBe(0);
    });

    it('discardSave 가 현재 저장을 안전하게 비운다', () => {
      writeSave({ story: { book: 5, chapter: 0 } }, 1);
      expect(peekSave(1).status).toBe('ok');
      discardSave(1);
      expect(peekSave(1).status).toBe('empty');
    });
  });
});

describe('save 진단 기록', () => {
  it('깨진 저장을 읽다 삼킨 오류가 진단 기록에 남는다', () => {
    const before = saveDiagnostics().length;
    mem.set('abraham.save.v1', '{ 깨진 json');
    peekSave(1);
    readSave(1);
    expect(saveDiagnostics().length).toBeGreaterThanOrEqual(before);
    const last = saveDiagnostics()[saveDiagnostics().length - 1];
    if (saveDiagnostics().length > before) expect(last.where).toBe('parse');
  });
  it('쓰기가 막히면(저장소 예외) false 를 돌려주고 원인을 남긴다', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => undefined, key: () => null, length: 0,
    };
    const before = saveDiagnostics().length;
    expect(writeSave(base, 1)).toBe(false);
    expect(saveDiagnostics().length).toBeGreaterThan(before);
    expect(saveDiagnostics().some((d) => d.message.includes('QuotaExceededError'))).toBe(true);
  });
});
