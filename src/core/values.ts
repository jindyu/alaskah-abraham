/** 저장의 숫자는 유한한 number만 받고, 게임 규칙 범위의 정수로 되돌린다. */
export function boundedInt(value: unknown, min: number, max: number, fallback = min): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
}

/** NPC 친밀도(rapport: 그 사람과 대화한 서로 다른 날 수)의 상한. persist/limits.ts SAVE_LIMITS.rapport 와 같은 값 */
export const RAPPORT_MAX = 999;
/** 방주 사건 반응을 들었다는 기록 키(talk.ts eventKey = 날*8 + 고비*2 + 해결)의 상한. 날 상한 1_000_000 기준. persist/limits.ts SAVE_LIMITS.eventDay 와 같은 값 */
export const EVENT_KEY_MAX = 8_000_007;

/** 배열이 아닌 보통 객체인가 (저장 모양 검사용) */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
export const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
