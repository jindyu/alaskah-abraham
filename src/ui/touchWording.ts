/**
 * 터치 기기에서는 키보드 안내(E·Space·WASD·C키 등)를 터치 안내로 바꾼다.
 * 장면 쪽(src/systems)에서 넘어오는 안내 문장은 손대지 않고, HUD 가 보여 주기 직전에 이 표로 갈아 끼운다.
 * 바꾼 문장의 영어 번역은 src/i18n/en_extra.json 에 있다 (tests/touchWording.test.ts 가 확인).
 */
export const TOUCH_REWRITES: ReadonlyArray<readonly [string, string]> = [
  ['WASD나 화살표 키로 움직이고, E키나 클릭으로 대화해보자', '왼쪽 스틱으로 움직이고, 행동 단추나 화면 탭으로 대화해보자'],
];
const CODEX_KEY_TAIL = ' (C키로 열람)';
export const CODEX_TOUCH_TAIL = ' (도감 단추로 열람)';

/** touch 가 아니면 그대로. 터치면 알려진 키보드 안내 문장을 터치 문장으로 바꾼다 (없으면 그대로) */
export function touchWording(text: string, touch: boolean): string {
  if (!touch) return text;
  if (text.endsWith(CODEX_KEY_TAIL)) return text.slice(0, text.length - CODEX_KEY_TAIL.length) + CODEX_TOUCH_TAIL;
  for (let i = 0; i < TOUCH_REWRITES.length; i++) if (TOUCH_REWRITES[i][0] === text) return TOUCH_REWRITES[i][1];
  return text;
}
