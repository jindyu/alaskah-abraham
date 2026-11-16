/**
 * 프레임 루프 건강 감시 (순수, DOM 없음).
 * 한 프레임 예외는 넘기고(루프는 계속 돎), 연속으로 limit 프레임 실패하면 true 를 한 번만 돌려 줘
 * 호출한 쪽이 '문제가 생겼다' 안내 화면을 띄우게 한다.
 */
export class FrameHealth {
  private consecutive = 0;
  private total = 0;
  private warned = false;

  constructor(readonly limit = 30) {}

  /** 프레임이 무사히 끝남 — 연속 실패 기록을 지움 */
  ok(): void {
    this.consecutive = 0;
  }

  /** 프레임이 예외로 끝남. 연속 실패가 limit 에 처음 닿은 순간에만 true */
  fail(): boolean {
    this.consecutive++;
    this.total++;
    if (!this.warned && this.consecutive >= this.limit) {
      this.warned = true;
      return true;
    }
    return false;
  }

  get consecutiveFailures(): number {
    return this.consecutive;
  }

  get totalFailures(): number {
    return this.total;
  }
}
