/**
 * 저장 구간을 Web Locks(navigator.locks)로 감싸 여러 탭의 "저장 검사 + 쓰기"가 한 번에 하나씩만 돌게 한다.
 * - 잠금 API 가 없으면(옛 브라우저·비보안 주소) 그냥 바로 실행: 기존 경로(savedAt 충돌 검사 + 'storage' 이벤트)가 지킴
 * - 잠금은 비동기라 탭을 닫을 때(pagehide)·메뉴 저장처럼 그 자리에서 끝나야 하는 저장에는 못 씀 — 자동(시간마다) 저장에만 씀
 * - 잠금을 얻으려다 실패해도 fn 은 한 번만 실행 (저장을 놓치지 않음)
 */
export interface LockManagerLike {
  request(name: string, callback: () => unknown): Promise<unknown>;
}

/** 이 환경의 잠금 관리자 (없으면 null) */
export function locksOf(nav: { locks?: unknown } | undefined | null): LockManagerLike | null {
  const l = nav?.locks as Partial<LockManagerLike> | undefined;
  return l && typeof l.request === 'function' ? (l as LockManagerLike) : null;
}

/** 칸마다 따로 잠그는 이름 */
export const saveLockName = (slot: number) => `abraham.save.${slot}`;

/** fn 을 잠금 안에서 실행 (잠금이 없으면 바로). fn 이 실행됐는지와 상관없이 약속은 예외 없이 끝남 */
export async function withSaveLock(locks: LockManagerLike | null, name: string, fn: () => void): Promise<void> {
  let ran = false;
  const once = () => { if (ran) return; ran = true; fn(); };
  if (!locks) { try { once(); } catch { /* fn 의 예외는 이 약속 밖으로 내지 않음 */ } return; }
  try { await locks.request(name, once); } catch { /* 잠금 요청 자체가 실패 */ }
  if (!ran) { try { once(); } catch { /* 호출한 쪽 fn 이 스스로 예외를 삼키지 않았어도 이 약속은 끝냄 */ } }
}
