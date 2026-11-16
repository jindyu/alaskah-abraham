import { describe, it, expect } from 'vitest';
import { sceneKeyFor, allScenePlans } from '../src/game/chapterRouter';
import { countDialogues, type LegacyStep } from '../src/game/chapterScript';
import { BOOKS } from '../src/data/books';
import book1 from '../src/data/books/abraham_1.json';
import book2 from '../src/data/books/abraham_2.json';
import book3 from '../src/data/books/abraham_3.json';
import book4 from '../src/data/books/abraham_4.json';
import book5 from '../src/data/books/abraham_5.json';
import book6 from '../src/data/books/abraham_6.json';

const SCRIPTS = [null, book1, book2, book3, book4, book5, book6] as unknown as Array<{ chapters: Array<{ steps: LegacyStep[] }> } | null>;

describe('챕터 라우팅 표 (chapterRouter)', () => {
  it('등록된 모든 장면 계획은 실제 존재하는 (권, 장)을 가리킨다', () => {
    for (const p of allScenePlans()) {
      expect(BOOKS[p.book], `권 ${p.book}`).toBeDefined();
      expect(p.chapter, `${p.book}권 ${p.chapter}장`).toBeLessThan(BOOKS[p.book].chapters.length);
      expect(sceneKeyFor(p.book, p.chapter)).toBe(p.key);
    }
  });

  it('표에 없는 장은 null (챕터 대본 대사로 대체)', () => {
    expect(sceneKeyFor(3, 1)).toBeNull();
    expect(sceneKeyFor(99, 0)).toBeNull();
  });

  it('1~6권의 모든 장은 직접 쓴 장면이 있거나, 재생할 챕터 대본 대사가 1줄 이상 있다 (스토리 없는 빈 장 0개)', () => {
    const empty: string[] = [];
    for (let b = 1; b <= 6; b++) {
      BOOKS[b].chapters.forEach((_, c) => {
        const handwritten = sceneKeyFor(b, c) !== null || (b === 1 && c === 0); // 1권 0장은 첫 시작 인트로
        const dialogues = countDialogues(SCRIPTS[b]!.chapters[c]?.steps ?? []);
        if (!handwritten && dialogues === 0) empty.push(`${b}권 ${c + 1}장`);
      });
    }
    expect(empty, `스토리 콘텐츠가 없는 장: ${empty.join(', ')}`).toEqual([]);
  });
});

import { timeOfDayFor } from '../src/game/timeOfDay';

describe('시간대 프리셋 (timeOfDay)', () => {
  it('같은 마므레 무대라도 3권(별빛 밤)과 4권(한낮)은 다른 조명이다', () => {
    const a = timeOfDayFor(3, 'mamre'), b = timeOfDayFor(4, 'mamre');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.sunColor).not.toBe(b!.sunColor);
    expect(a!.sunPos).not.toEqual(b!.sunPos);
  });
  it('모리아(새벽)와 브엘세바(오후), 소돔(지역 기본)은 서로 구분된다', () => {
    expect(timeOfDayFor(5, 'moriah')!.sky).toBeDefined();
    expect(timeOfDayFor(5, 'beersheba')!.sky).toBeUndefined();
    expect(timeOfDayFor(4, 'sodom')).toBeNull();
  });
  it('모든 프리셋의 값은 유한한 숫자다', () => {
    for (const [b, st] of [[3, 'mamre'], [4, 'mamre'], [5, 'moriah'], [5, 'beersheba'], [6, 'nahor_well'], [6, 'hebron_machpelah']] as const) {
      const t = timeOfDayFor(b, st)!;
      for (const v of [t.sunColor, t.sunIntensity, t.hemiColor, t.hemiGround, t.hemiIntensity, ...t.sunPos]) expect(Number.isFinite(v)).toBe(true);
      expect(t.sunIntensity).toBeGreaterThan(0);
    }
  });
});

import { ambientFor } from '../src/game/timeOfDay';

describe('환경 입자 (ambientFor)', () => {
  it('소돔은 불씨, 3권은 반딧불, 마른 땅 무대는 먼지, 나머지는 없음', () => {
    expect(ambientFor(4, 'sodom')).toBe('embers');
    expect(ambientFor(3, 'mamre')).toBe('glory_sparkles');
    expect(ambientFor(6, 'nahor_well')).toBe('glory_sparkles');
    expect(ambientFor(5, 'beersheba')).toBe('trail_dust');
    expect(ambientFor(2, 'egypt')).toBeNull();
    expect(ambientFor(1, 'ur_workshop')).toBeNull();
  });
});

import { withChapterIntro, dialogueOnlySteps as onlySteps } from '../src/game/chapterScript';
import { tr as trEn, loadEnglish as loadEn } from '../src/i18n/tr';
import { setLang as setLangEn } from '../src/i18n/lang';

describe('챕터 도입 내레이션 (카탈로그 요약)', () => {
  it('요약이 있으면 맨 앞에 내레이션 대사로 붙고, 대사가 없으면 붙이지 않는다', () => {
    const steps = [{ step_type: 'dialogue', speaker: '아브람', text: '여호와여' }];
    const out = withChapterIntro(steps, '  아브람이 길을 떠난다.  ');
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ step_type: 'dialogue', text: '아브람이 길을 떠난다.' });
    expect(withChapterIntro([], '요약')).toEqual([]);
    expect(withChapterIntro(steps, '   ')).toBe(steps);
  });

  it('직접 쓴 장면이 없는 모든 장은 카탈로그 요약이 있고 영어로 번역된다', async () => {
    await loadEn();
    setLangEn('en');
    try {
      const bad: string[] = [];
      for (let b = 1; b <= 6; b++) {
        BOOKS[b].chapters.forEach((ch, c) => {
          if (sceneKeyFor(b, c) !== null || (b === 1 && c === 0)) return;
          const steps = onlySteps(SCRIPTS[b]!.chapters[c]?.steps ?? []);
          const intro = withChapterIntro(steps, ch.summary);
          if (intro.length === steps.length) bad.push(`${b}권 ${c + 1}장: 요약 없음`);
          else if (/[가-힣]/.test(trEn(ch.summary))) bad.push(`${b}권 ${c + 1}장: 요약 영어 없음`);
        });
      }
      expect(bad, bad.join(' | ')).toEqual([]);
    } finally {
      setLangEn('ko');
    }
  });
});
