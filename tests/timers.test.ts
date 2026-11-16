import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { after, cancelTimers, pendingTimerCount } from '../src/game/timers';

describe('after()/cancelTimers() — 장 전환 시 대사·선택지 체인 무효화', () => {
  beforeEach(() => { vi.useFakeTimers(); cancelTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('걸어 둔 시간이 지나면 실행되고, 끝나면 대기 목록에서 빠진다', () => {
    const fn = vi.fn();
    after(fn, 1000);
    expect(pendingTimerCount()).toBe(1);
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(pendingTimerCount()).toBe(0);
  });

  it('장이 바뀌면(cancelTimers) 대기 중이던 콜백은 실행되지 않고 타이머도 해제된다', () => {
    const fn = vi.fn();
    after(fn, 1000);
    after(fn, 2000);
    cancelTimers();
    expect(pendingTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('취소 뒤에 새로 건 콜백은 정상 실행된다', () => {
    const old = vi.fn(), fresh = vi.fn();
    after(old, 500);
    cancelTimers();
    after(fresh, 500);
    vi.advanceTimersByTime(600);
    expect(old).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('콜백이 다음 after() 를 이어 거는 체인도 장 전환 시 중간에 끊긴다', () => {
    const second = vi.fn();
    after(() => { after(second, 1000); }, 1000);
    vi.advanceTimersByTime(1000);   // 첫 단계 실행, 두 번째 대기 중
    expect(pendingTimerCount()).toBe(1);
    cancelTimers();                 // 장 전환
    vi.advanceTimersByTime(5000);
    expect(second).not.toHaveBeenCalled();
  });
});
