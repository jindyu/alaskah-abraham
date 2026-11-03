import { describe, expect, it } from 'vitest';
import { uiLayout } from '../src/ui/layout';

describe('패널이 들어가는 UI 크기', () => {
  it.each([[390, 844, 2], [844, 390, 1], [1280, 720, 1], [1920, 1080, 2]])('%i×%i 화면에서 패널 여백과 커스터마이징 높이를 확보한다', (w, h, scale) => {
    const out = uiLayout(w, h, scale);
    expect(out.width).toBeGreaterThanOrEqual(560);
    expect(out.height).toBeGreaterThanOrEqual(440);
    expect(out.width * out.scale).toBeCloseTo(w);
    expect(out.height * out.scale).toBeCloseTo(h);
  });
});
