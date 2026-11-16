import { describe, it, expect } from 'vitest';
import { avoidPrompt, boxesOverlap, narrationLife } from '../src/ui/dialogueLayout';
import { recommendedNext, visibleRows, scrollStart, scrollThumb } from '../src/ui/chapterHints';
import { advanceOnboard, newOnboard, onboardAlpha, ONBOARD_STEPS, ONBOARD_STEP_SECONDS, ONBOARD_START_DELAY } from '../src/ui/onboarding';
import { textPolicyFor, goalPx, DESKTOP_MIN_CSS_PX, TOUCH_MIN_CSS_PX } from '../src/ui/textSize';
import { policyTextSize } from '../src/ui/uiScale';
import { toggleChapterSelect, type PanelHud } from '../src/game/panelToggles';
import en from '../src/i18n/en.json';
import extra from '../src/i18n/en_extra.json';

describe('dialogue never covers the interaction prompt', () => {
  const prompt = { x: 400, y: 360, w: 120, h: 30 };
  it('moves a panel that would overlap the prompt', () => {
    const y = avoidPrompt(350, 300, 360, 60, 32, 520, prompt);
    expect(boxesOverlap(300, y, 360, 60, prompt)).toBe(false);
  });
  it('leaves a non-overlapping panel alone', () => {
    expect(avoidPrompt(480, 300, 360, 60, 32, 520, prompt)).toBe(480);
    expect(avoidPrompt(100, 300, 360, 60, 32, 520, null)).toBe(100);
  });
  it('goes above when below does not fit', () => {
    const y = avoidPrompt(380, 300, 360, 120, 32, 380, prompt);
    expect(y + 120).toBeLessThanOrEqual(prompt.y);
  });
  it('narration auto-dismiss is capped and scales with length', () => {
    expect(narrationLife(6, 20)).toBeLessThan(narrationLife(6, 120));
    expect(narrationLife(30, 500)).toBeLessThanOrEqual(5);
    expect(narrationLife(1, 10)).toBeGreaterThanOrEqual(2.5);
  });
});

describe('chapter select hints', () => {
  it('recommends first unfinished chapter', () => {
    const counts = [2, 3];
    expect(recommendedNext(new Set(), counts)).toEqual({ book: 0, chapter: 0 });
    expect(recommendedNext(new Set(['0:0', '0:1', '1:0']), counts)).toEqual({ book: 1, chapter: 1 });
    expect(recommendedNext(new Set(['0:0', '0:1', '1:0', '1:1', '1:2']), counts)).toBeNull();
  });
  it('visible rows and scroll window stay in range', () => {
    expect(visibleRows(1000, 24)).toBe(10);
    expect(visibleRows(10, 24)).toBe(4);
    expect(scrollStart(0, 12, 6)).toBe(0);
    expect(scrollStart(11, 12, 6)).toBe(6);
    expect(scrollStart(5, 12, 6)).toBe(2);
  });
  it('scroll thumb only when scrollable and inside track', () => {
    expect(scrollThumb(0, 10, 8, 100)).toBeNull();
    const t = scrollThumb(3, 6, 12, 120)!;
    expect(t.y).toBeGreaterThanOrEqual(0);
    expect(t.y + t.h).toBeLessThanOrEqual(120);
    const end = scrollThumb(6, 6, 12, 120)!;
    expect(end.y + end.h).toBe(120);
  });
  it('opening chapter select records the resume chapter', () => {
    const h: PanelHud = { chapterSelect: { open: false, bookIndex: 0, chapterIndex: 0 }, pauseMenu: { open: false }, help: { open: false }, codex: { open: false }, choice: null };
    toggleChapterSelect(h, 3, 2);
    expect(h.resumeAt).toEqual({ book: 3, chapter: 2 });
  });
});

describe('onboarding', () => {
  it('waits, runs every step only while quiet, then finishes once', () => {
    const s = newOnboard();
    expect(advanceOnboard(s, ONBOARD_START_DELAY + 0.1, true)).toBe(false);
    const a0 = s.age;
    advanceOnboard(s, 2, false);
    expect(s.age).toBe(a0);
    let finished = 0;
    for (let i = 0; i < 200; i++) if (advanceOnboard(s, 0.25, true)) finished++;
    expect(finished).toBe(1);
    expect(s.done).toBe(true);
    expect(onboardAlpha(s)).toBe(0);
  });
  it('fades in and out within a step', () => {
    const s = newOnboard();
    s.delay = 0;
    expect(onboardAlpha(s)).toBe(0);
    s.age = ONBOARD_STEP_SECONDS / 2;
    expect(onboardAlpha(s)).toBe(1);
  });
  it('already-seen state never shows', () => {
    expect(onboardAlpha(newOnboard(true))).toBe(0);
  });
  it('every onboarding line has an English translation', () => {
    const all = { ...en, ...extra } as Record<string, string>;
    for (const st of ONBOARD_STEPS) { expect(all[st.ko]).toBeTruthy(); expect(all[st.touch]).toBeTruthy(); }
    for (const k of ['추천', '이어하기', '어느 장이든 바로 시작할 수 있다 · ✓ 끝낸 장 · 추천 = 다음에 볼 장']) expect(all[k]).toBeTruthy();
  });
});

describe('legibility policy', () => {
  it('desktop floors small text, touch uses its own floor, same object is reused', () => {
    const d = textPolicyFor(0, false), t = textPolicyFor(0, true);
    expect(d.minCssPx).toBe(DESKTOP_MIN_CSS_PX);
    expect(t.minCssPx).toBe(TOUCH_MIN_CSS_PX);
    expect(textPolicyFor(0, false)).toBe(d);
    // 배율 1 인 960×600 창: 9px 글자는 12 로 올라가고, 배율 2 면 그대로
    expect(policyTextSize(9, 1, d)).toBe(12);
    expect(policyTextSize(9, 2, d)).toBe(9);
  });
  it('goal text is larger in small windows', () => {
    expect(goalPx(1)).toBe(14);
    expect(goalPx(2)).toBe(13);
  });
});
