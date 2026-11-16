import { describe, expect, it } from 'vitest';
import { SaveLifecycle, type SaveGate } from '../src/game/saveLifecycle';

describe('SaveLifecycle 실패 알림', () => {
  it('첫 실패에 알리고, 계속 실패하면 3회마다 다시 알린다', () => {
    const gate = (): SaveGate => ({ disabled: false, leaving: false, started: true, locked: false, cutscene: false, menu: false } as SaveGate);
    const notified: number[] = [];
    let n = 0;
    const lc = new SaveLifecycle(gate, () => 'quota', () => { notified.push(++n); });
    for (let i = 0; i < 7; i++) lc.save(true);
    // 실패 1, 4, 7 번째에 알림
    expect(notified.length).toBe(3);
  });
});
