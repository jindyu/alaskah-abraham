import { describe, expect, it } from 'vitest';
import { CODEX_TOUCH_TAIL, TOUCH_REWRITES, touchWording } from '../src/ui/touchWording';
import extra from '../src/i18n/en_extra.json';

const en = extra as Record<string, string>;
const KEYBOARD = /WASD|방향키|화살표 키|\bE ?키|\[?Esc\]?|Space|Enter|C키/;

describe('터치 안내 문구 (키보드 안내를 터치 안내로)', () => {
  it('터치가 아니면 문장을 그대로 둔다', () => {
    for (const [ko] of TOUCH_REWRITES) expect(touchWording(ko, false)).toBe(ko);
  });
  it('알려진 키보드 안내는 터치 문장으로 바뀌고 키보드 낱말이 없다', () => {
    for (const [ko, touch] of TOUCH_REWRITES) {
      expect(touchWording(ko, true)).toBe(touch);
      expect(KEYBOARD.test(touch), touch).toBe(false);
    }
  });
  it('도감 기록 알림의 (C키로 열람)은 도감 단추 안내가 된다', () => {
    const out = touchWording('성경·미드라시 도감이 기록되었습니다: [아브람] (C키로 열람)', true);
    expect(out).toBe(`성경·미드라시 도감이 기록되었습니다: [아브람]${CODEX_TOUCH_TAIL}`);
  });
  it('모르는 문장은 그대로', () => {
    expect(touchWording('아무 말', true)).toBe('아무 말');
  });
  it('바뀐 문장과 새 HUD 문구의 영어 번역이 en_extra.json 에 있다', () => {
    const keys = [
      ...TOUCH_REWRITES.map(([, t]) => t),
      `성경·미드라시 도감이 기록되었습니다: [{0}]${CODEX_TOUCH_TAIL}`,
      '닫기',
      '▼ [✕] 또는 도감 단추로 닫기  |  항목을 탭해 선택',
    ];
    for (const k of keys) expect(en[k], k).toBeTruthy();
  });
});
