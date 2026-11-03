/**
 * 게임 안 1시간이 지날 때마다 true (자동 저장 시점). 시계가 24시→0시로 넘어가도 시(時)가 바뀐 것으로 셈.
 * main.ts step() 의 "저장 시각" 블록을 옮김.
 */
export class HourTicker {
  private last: number;
  constructor(minutes: number) { this.last = Math.floor(minutes / 60); }
  /** 지금 시계(분)를 넣어, 지난번과 시가 달라졌으면 true */
  tick(minutes: number): boolean {
    const h = Math.floor(minutes / 60);
    if (h === this.last) return false;
    this.last = h;
    return true;
  }

  private busy = false;
  private retryAt = 0;
  /**
   * 자동 저장 시도를 시작할 때인가. tick 과 달리 '시를 소비'하지 않는다 — 저장이 거절(컷신 중·다른 탭 잠금·쓰기 실패)되면
   * 그 시는 그대로 남아 다시 시도하고, 성공해야(finish) 넘어감. 시도 중에는 겹치지 않고, 실패하면 retryMs 뒤에 다시.
   */
  begin(minutes: number, nowMs = 0): boolean {
    if (this.busy || nowMs < this.retryAt || Math.floor(minutes / 60) === this.last) return false;
    this.busy = true;
    return true;
  }
  /** begin 이 true 였던 시도의 끝. saved 가 true 면 그 시를 넘기고, 아니면 retryMs 뒤에 다시 시도 */
  finish(minutes: number, saved: boolean, nowMs = 0, retryMs = 5000): void {
    this.busy = false;
    if (saved) this.last = Math.floor(minutes / 60);
    else this.retryAt = nowMs + retryMs;
  }
}
