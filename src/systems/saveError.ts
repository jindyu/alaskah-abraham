/**
 * 저장을 불러오다 난 오류의 종류.
 * - 데이터 오류(SaveDataError): 저장 내용이 잘못됨 → 복사본(.bak)을 남기고 그 칸을 잠금(기존 처리)
 * - 코드 오류(ReferenceError·TypeError·RangeError 등): 게임 코드의 버그일 수 있음 → 저장은 건드리지 않음
 * 순수 모듈 (테스트 가능).
 */
export class SaveDataError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
    this.name = 'SaveDataError';
  }
}

export type LoadErrorKind = 'data' | 'code';

/** 불러오기 중 던져진 것을 분류. SaveDataError 만 데이터 오류, 나머지(알 수 없는 것 포함)는 코드 오류로 본다 */
export function classifyLoadError(err: unknown): LoadErrorKind {
  return err instanceof SaveDataError ? 'data' : 'code';
}

/** 코드 오류로 이어하지 못했을 때 타이틀에 띄울 알림 */
export const LOAD_CODE_ERROR_NOTICE = '문제가 생겨 이어 가지 못했다. 저장은 그대로 있다. 페이지를 새로 고친 뒤 다시 해 보자';
