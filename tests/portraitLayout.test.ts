import { describe, expect, it } from 'vitest';
import { visibleRows } from '../src/ui/chapterHints';
import { touchClusterTopCss } from '../src/ui/touchControls';

describe('세로 화면 레이아웃', () => {
  it('장 선택 보이는 줄 수: 기본은 10줄까지, 세로 화면은 더 늘릴 수 있다', () => {
    expect(visibleRows(1000, 24)).toBe(10);
    expect(visibleRows(1000, 36, 16)).toBe(16);
    expect(visibleRows(480, 36, 16)).toBe(13);
    expect(visibleRows(10, 36, 16)).toBe(4);
  });
  it('세로 화면의 조작부는 가로(2×2 단추)보다 낮게 모인다', () => {
    const land = touchClusterTopCss(844, false);
    const port = touchClusterTopCss(844, true);
    expect(port).toBeLessThan(land);
    expect(port).toBe(28 + 80 + 6 + 46); // 행동 단추 + 작은 단추 한 줄
  });
});

import { stickCodes, stickMask } from '../src/ui/touchControls';
describe('stickMask (할당 없는 스틱 판정)', () => {
  it('stickCodes 와 같은 방향을 비트로 낸다', () => {
    const names = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    for (let a = 0; a < 360; a += 15) {
      const dx = Math.cos((a * Math.PI) / 180) * 40, dy = Math.sin((a * Math.PI) / 180) * 40;
      const fromMask = names.filter((_, i) => (stickMask(dx, dy, 46) & (1 << i)) !== 0).sort();
      expect(fromMask).toEqual([...stickCodes(dx, dy, 46)].sort());
    }
    expect(stickMask(2, 2, 46)).toBe(0);
  });
});
