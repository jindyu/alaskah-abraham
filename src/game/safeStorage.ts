/**
 * sessionStorage 를 안전하게 쓰는 도우미. 저장소가 없거나(사생활 보호 모드 등) 막혀 있어 예외가 나도 삼키고 넘어감.
 * createGame.ts 의 "다시 열 때 넘기는 표시"(noah.skiptitle·noah.nobackup)에 씀.
 */

/** 읽기. 없거나 저장소를 못 쓰면 null */
export function sessionGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

/** 쓰기. 저장소를 못 쓰면 조용히 무시 */
export function sessionSet(key: string, v: string): void {
  try { sessionStorage.setItem(key, v); } catch { /* 저장소 없음 */ }
}

/** 읽고 지움(한 번만 쓰는 표시). 읽은 값을 돌려주고, 지우다 실패해도 읽은 값은 그대로 돌려줌 */
export function sessionTake(key: string): string | null {
  const v = sessionGet(key);
  try { sessionStorage.removeItem(key); } catch { /* 저장소 없음 */ }
  return v;
}
