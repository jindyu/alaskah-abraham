import { describe, expect, it } from 'vitest';
import { TOAST_H, toastCenterX, toastHeight, toastSlideY, toastSpan } from '../src/ui/toastLayout';

describe('터치 알림 위치', () => {
  it('구간은 왼쪽·오른쪽 패널 사이 틈을 두고 잡힌다', () => {
    const s = toastSpan(952, 138, 700);
    expect(s.x0).toBeGreaterThan(138);
    expect(s.x1).toBeLessThan(700);
  });

  it('구간이 너무 좁으면 안전 영역 안쪽 전체를 쓴다', () => {
    const s = toastSpan(400, 300, 310, 20, 30);
    expect(s).toEqual({ x0: 28, x1: 362 });
  });

  it('알림은 구간 가운데에 놓이고 넘치면 왼쪽 끝에 붙는다', () => {
    const s = { x0: 100, x1: 500 };
    expect(toastCenterX(s, 200)).toBe(200);
    expect(toastCenterX(s, 400)).toBe(100);
    expect(toastCenterX(s, 900)).toBe(100);
  });

  it('들어올 때 위에서 내려와 0.2초 뒤에 제자리', () => {
    expect(toastSlideY(0, TOAST_H)).toBe(-TOAST_H);
    expect(toastSlideY(0.1, TOAST_H)).toBeCloseTo(-TOAST_H / 2, 0);
    expect(toastSlideY(0.2, TOAST_H)).toBe(0);
    expect(toastSlideY(2, TOAST_H)).toBe(0);
  });

  it('둘째 줄은 높이를 더한다', () => {
    expect(toastHeight(1)).toBe(TOAST_H);
    expect(toastHeight(2)).toBeGreaterThan(TOAST_H);
  });
});
