/**
 * 장(chapter) 단위로 무효화되는 지연 실행.
 * 대사·선택지 체인을 setTimeout 으로 짜면 그 사이 장을 바꿔도 이전 장의 토스트·선택창이 새 장에 뜬다.
 * after() 로 건 콜백은 cancelTimers()(loadChapter 가 호출) 이후에는 실행되지 않고, 대기 중인 타이머도 clear 된다.
 */
let generation = 0;
/** 장 진행 복원(재생) 중에는 지연 실행을 기다리지 않고 바로 실행한다 */
let immediate = false;
export function setReplayImmediate(on: boolean): void { immediate = on; }
const pending = new Set<ReturnType<typeof setTimeout>>();

export function after(fn: () => void, ms: number): void {
  if (immediate) { fn(); return; }
  const g = generation;
  const id = setTimeout(() => {
    pending.delete(id);
    if (g === generation) fn();
  }, ms);
  pending.add(id);
}

/** 지금까지 건 모든 after() 를 무효화하고 대기 중인 타이머를 해제 */
export function cancelTimers(): void {
  generation++;
  for (const id of pending) clearTimeout(id);
  pending.clear();
}

/** 대기 중인 after() 개수 (테스트·진단용) */
export function pendingTimerCount(): number {
  return pending.size;
}
