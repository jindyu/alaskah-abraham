/**
 * 조용히 삼키는 오류(저장소·오디오·렌더러 정리 등)를 최근 30개까지 기억한다.
 * 사용자에게 보이는 알림과는 별개의 원인 진단용 — 개발 빌드는 콘솔에도 남기고, 프로덕션에서는 `diagnostics()` 로만 읽는다.
 * 삼켜도 되는 오류를 '왜 삼켰는지 나중에 알 수 있게' 하는 것이 목적이지, 오류 처리를 대신하지 않는다.
 */
export interface DiagEntry { where: string; message: string; at: number }

const log: DiagEntry[] = [];
const MAX = 30;

/**
 * 브라우저가 자동 재생을 막거나(NotAllowedError) 재생 중에 소리를 바꿔 끊긴(AbortError) 오디오 재생 거절은
 * 사용자가 아직 화면을 누르지 않았을 때 정상적으로 계속 나므로 기록하지 않는다 (30개짜리 기록이 이 소음으로 가득 차지 않게).
 */
function isExpectedPlayRejection(err: unknown): boolean {
  const name = err instanceof Error ? err.name : (err as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'AbortError';
}

export function noteError(where: string, err: unknown): void {
  if (isExpectedPlayRejection(err)) return;
  const message = err instanceof Error ? err.message : String(err);
  log.push({ where, message, at: Date.now() });
  if (log.length > MAX) log.shift();
  if (import.meta.env.DEV) console.debug(`[diag:${where}]`, message);
}

export function diagnostics(): ReadonlyArray<DiagEntry> { return log; }
