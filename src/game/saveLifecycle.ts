import { isForeignWrite, savedAtOf } from '../systems/save';

export interface SaveGate {
  disabled: boolean; leaving: boolean; started: boolean; locked: boolean; cutscene: boolean;
}

/** 저장 실패 까닭: quota 저장 공간 부족 · unavailable 저장소를 못 씀(시크릿 창·차단 등) */
export type FailReason = 'quota' | 'unavailable';

/** 쓰기 결과: true 성공, false 실패(까닭 모름), 'quota'·'unavailable' 까닭을 아는 실패, 'conflict' 다른 탭이 더 새 저장을 써 둠(덮어쓰지 않음) */
export type WriteOutcome = boolean | 'conflict' | FailReason;

/** 저장 실패 토스트 문구 (원인별) */
export function saveFailText(reason: FailReason | null): string {
  if (reason === 'quota') return '브라우저 저장 공간이 부족해 저장하지 못했다. 다른 저장 칸의 이야기를 지우거나 브라우저 저장 공간을 비우자';
  if (reason === 'unavailable') return '브라우저가 저장을 막고 있어 저장하지 못했다. 시크릿 창이거나 사이트 저장이 꺼져 있는지 확인하자';
  return '저장하지 못했다. 시크릿 창이 아닌지, 브라우저 저장 공간이 찼는지 확인하자';
}
/** 다른 탭과 충돌해 읽기 전용이 됐을 때의 토스트 문구 (복구 길 안내 포함) */
export const SAVE_CONFLICT_TEXT = '다른 탭에서 이 저장 칸을 저장했다. 덮어쓰지 않도록 이 탭은 저장을 멈췄다. Esc 메뉴의 ‘이 탭에서 계속하기’나 ‘다른 탭의 저장 불러오기’를 고르자';

/**
 * 'storage' 이벤트가 "다른 탭이 이 탭의 저장 칸을 새로 썼다"는 뜻인가 (순수).
 * eventKey = 이벤트의 key (storage.clear() 면 null), slotKey = 이 탭 칸의 키, newValue = 이벤트의 새 값(지워졌으면 null),
 * known = 이 탭이 그 칸에서 마지막으로 읽거나 쓴 savedAt (아직 본 적이 없으면 undefined → 저장할 때 충돌 검사도 안 하므로 여기서도 건너뜀).
 * 같은 탭의 쓰기는 'storage' 이벤트가 오지 않으므로, 이 이벤트가 오면 늘 다른 탭의 쓰기다. 백업 키(.bak 등)는 slotKey 와 달라 걸러짐
 */
export function shouldFlagForeign(eventKey: string | null, slotKey: string, newValue: string | null, known: number | undefined): boolean {
  if (eventKey !== null && eventKey !== slotKey) return false;
  if (known === undefined) return false;
  return isForeignWrite(newValue === null ? null : savedAtOf(newValue), known);
}

/**
 * 저장 가능 시점과 연속 실패 알림(3회마다)을 관리한다. 스냅샷과 저장소는 호출자가 제공한다.
 * 쓰기가 'conflict' 면 그 탭은 읽기 전용으로 잠그고(이후 저장 안 함) conflict 알림을 한 번만 부른다.
 */
export class SaveLifecycle {
  private failures = 0;
  private readOnly = false;
  private reason: FailReason | null = null;
  private suspendedBy: string | null = null;
  constructor(private readonly gate: () => SaveGate, private readonly write: () => WriteOutcome, private readonly failed: (reason: FailReason | null) => void,
    private readonly conflict: () => void = () => {}) {}
  /** 다른 탭과 겹쳐 읽기 전용으로 잠겼나 */
  get isReadOnly() { return this.readOnly; }
  /** 자동 저장을 멈춘 까닭 (멈추지 않았으면 null) — 프레임이 계속 실패하는 안전 모드 등 */
  get suspendedReason(): string | null { return this.suspendedBy; }
  /**
   * 저장을 멈춤(안전 모드): 풀기 전에는 강제 저장(force)도 쓰지 않음 — 망가졌을지 모를 상태로 마지막 정상 저장을 덮지 않게.
   * 이미 멈춘 상태면 처음 까닭을 유지. 새로 멈췄으면 true
   */
  suspend(reason: string): boolean {
    if (this.suspendedBy !== null) return false;
    this.suspendedBy = reason;
    return true;
  }
  /** suspend 를 풂 (멈춘 적이 없었으면 false). 읽기 전용 잠금(resume)과는 따로 풀림 */
  unsuspend(): boolean {
    const was = this.suspendedBy !== null;
    this.suspendedBy = null;
    return was;
  }
  /**
   * 다른 탭이 이 칸을 새로 썼음을 'storage' 이벤트로 미리 알고 읽기 전용으로 잠금 (저장을 시도해 충돌이 나기를 기다리지 않음).
   * 저장 불가 상태(꺼짐·떠나는 중·잠긴 칸)거나 이미 잠겼으면 false. 새로 잠갔으면 conflict 알림을 한 번 부르고 true
   */
  flagForeign(): boolean {
    const g = this.gate();
    if (this.readOnly || g.disabled || g.leaving || g.locked) return false;
    this.readOnly = true;
    try { this.conflict(); } catch { /* 알림 실패는 무시 */ }
    return true;
  }
  /** 가장 최근 저장 시도가 실패한 까닭 (성공했거나 저장하지 않았으면 null) */
  get lastFailure(): FailReason | null { return this.reason; }
  /**
   * 읽기 전용 잠금을 풀고 다시 저장하게 함 ("이 탭에서 계속하기"). 호출한 쪽이 먼저 save.ts adoptForeign 으로
   * 저장소의 지금 저장을 이 탭의 기준으로 삼아야 다음 저장이 충돌로 막히지 않음. 잠겨 있었으면 true
   */
  resume(): boolean {
    const was = this.readOnly;
    this.readOnly = false;
    this.failures = 0;
    this.reason = null;
    return was;
  }
  save(force = false): boolean {
    this.reason = null;
    const g = this.gate();
    if (this.readOnly || this.suspendedBy !== null || g.disabled || g.leaving || !g.started || g.locked || (g.cutscene && !force)) return false;
    let out: WriteOutcome = false;
    try { out = this.write(); } catch { /* 저장소 예외도 실패 알림으로 처리 */ }
    if (out === 'conflict') {
      this.readOnly = true;
      try { this.conflict(); } catch { /* 알림 실패는 무시 */ }
      return false;
    }
    const ok = out === true;
    if (!ok) this.reason = out === 'quota' ? 'quota' : 'unavailable';
    this.failures = ok ? 0 : this.failures + 1;
    // 연속 실패 3번째부터 3회마다 다시 알림 (한 번 놓쳐도 계속 안 써지는 걸 알 수 있게)
    if (this.failures > 0 && this.failures % 3 === 0) { try { this.failed(this.reason); } catch { /* 알림 실패는 무시 */ } }
    return ok;
  }
  /**
   * 다른 탭의 저장을 'storage' 이벤트로 감시. slotKey/seen 은 칸이 바뀔 수 있어 함수로 받음. 해제 함수를 돌려줌
   */
  bindStorage(target: EventTarget, slotKey: () => string, seen: () => number | undefined) {
    const onStorage = (e: Event) => {
      const ev = e as Partial<StorageEvent>;
      if (shouldFlagForeign(ev.key ?? null, slotKey(), ev.newValue ?? null, seen())) this.flagForeign();
    };
    target.addEventListener('storage', onStorage);
    return () => target.removeEventListener('storage', onStorage);
  }
  bind(target: Window, doc: Document) {
    const hidden = () => { if (doc.visibilityState === 'hidden') this.save(); };
    const pagehide = () => { this.save(); };
    doc.addEventListener('visibilitychange', hidden);
    target.addEventListener('pagehide', pagehide);
    return () => { doc.removeEventListener('visibilitychange', hidden); target.removeEventListener('pagehide', pagehide); };
  }
}
