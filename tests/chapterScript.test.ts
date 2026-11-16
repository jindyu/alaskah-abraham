import { describe, it, expect } from 'vitest';
import { dialogueOnlySteps, countDialogues, type LegacyStep } from '../src/game/chapterScript';
import { FrameHealth } from '../src/game/guard';
import book1 from '../src/data/books/abraham_1.json';
import book2 from '../src/data/books/abraham_2.json';
import book3 from '../src/data/books/abraham_3.json';
import book4 from '../src/data/books/abraham_4.json';
import book5 from '../src/data/books/abraham_5.json';
import book6 from '../src/data/books/abraham_6.json';

const BOOKS = [book1, book2, book3, book4, book5, book6] as unknown as Array<{ chapters: Array<{ steps: LegacyStep[] }> }>;

describe('챕터 대본 (dialogueOnlySteps)', () => {
  it('연출 스텝은 버리고 대사·제목만 남긴다', () => {
    const steps: LegacyStep[] = [
      { step_type: 'spawn', character: 'abram_young' },
      { step_type: 'camera_move', duration: 1 },
      { step_type: 'title', text: '제목' },
      { step_type: 'dialogue', speaker: '아브람', text: '여호와여' },
      { step_type: 'move_actor', id: 'abram' },
      { step_type: 'dialogue', speaker: '사래', text: '   ' },
    ];
    const out = dialogueOnlySteps(steps);
    expect(out.map((s) => s.step_type)).toEqual(['title', 'dialogue']);
  });

  it('대사가 하나도 없으면 빈 배열', () => {
    expect(dialogueOnlySteps([{ step_type: 'title', text: 'x' }, { step_type: 'wait', seconds: 1 }])).toEqual([]);
  });

  it('1~6권 대본에서 재생 가능한 대사가 충분히 살아난다', () => {
    let total = 0;
    BOOKS.forEach((b) => b.chapters.forEach((c) => { total += countDialogues(c.steps); }));
    expect(total).toBeGreaterThan(500);
  });

  it('재생용으로 걸러낸 모든 대사는 본문이 있고 화자는 문자열이다', () => {
    BOOKS.forEach((b) => b.chapters.forEach((c) => {
      for (const s of dialogueOnlySteps(c.steps)) {
        if (s.step_type !== 'dialogue') continue;
        expect(typeof s.text).toBe('string');
        expect((s.text as string).trim().length).toBeGreaterThan(0);
        if (s.speaker !== undefined) expect(typeof s.speaker).toBe('string');
      }
    }));
  });
});

describe('FrameHealth (프레임 연속 실패 감시)', () => {
  it('limit 에 처음 닿을 때만 true, 성공하면 연속 기록이 지워진다', () => {
    const h = new FrameHealth(3);
    expect(h.fail()).toBe(false);
    expect(h.fail()).toBe(false);
    h.ok();
    expect(h.consecutiveFailures).toBe(0);
    expect(h.fail()).toBe(false);
    expect(h.fail()).toBe(false);
    expect(h.fail()).toBe(true);
    expect(h.fail()).toBe(false); // 한 번만 알림
    expect(h.totalFailures).toBe(6);
  });
});

import { traditionSources } from '../src/game/chapterScript';
import catalog from '../src/data/catalog.json';
import en from '../src/i18n/en.json';
import enExtra from '../src/i18n/en_extra.json';

describe('전승 표기 (성경 본문 vs 미드라시·탈무드)', () => {
  const table = { ...(en as Record<string, string>), ...(enExtra as Record<string, string>) };

  it('전승 태그가 있는 챕터는 출처가 뽑히고, 없는 챕터는 빈 배열이다', () => {
    expect(traditionSources(['아브람', '미드라시', '창세기 12장'])).toEqual(['미드라시']);
    expect(traditionSources(['아브람', '창세기 12장'])).toEqual([]);
    expect(traditionSources(undefined)).toEqual([]);
  });

  it('카탈로그의 전승 챕터가 15개 이상이고 모든 출처 낱말에 영어 번역이 있다', () => {
    let chapters = 0;
    const sources = new Set<string>();
    for (const b of catalog as Array<{ chapters: Array<{ tags?: string[] }> }>) {
      for (const ch of b.chapters) {
        const s = traditionSources(ch.tags);
        if (s.length) chapters++;
        s.forEach((x) => sources.add(x));
      }
    }
    expect(chapters).toBeGreaterThanOrEqual(15);
    for (const s of sources) expect(table[s], `영어 번역 없음: ${s}`).toBeTruthy();
    expect(table['전해오는 이야기']).toBeTruthy();
    expect(table['성경 본문 밖의 전해 오는 이야기가 더해진 장이다']).toBeTruthy();
  });
});

import { tr, loadEnglish } from '../src/i18n/tr';
import { setLang } from '../src/i18n/lang';
import bookIntro from '../src/data/books/abraham_intro.json';
import bookOutro from '../src/data/books/abraham_outro.json';

describe('챕터 대본 영어 번역 (JSON 대사·제목 전부)', () => {
  it('영어 모드에서 1~6권·인트로·아웃트로 대사/제목이 한국어 그대로 나오지 않는다', async () => {
    await loadEnglish();
    setLang('en');
    try {
      const all = [...BOOKS, bookIntro, bookOutro] as unknown as Array<{ chapters: Array<{ steps: LegacyStep[] }> }>;
      const untranslated: string[] = [];
      let lines = 0;
      for (const b of all) for (const c of b.chapters) for (const s of c.steps) {
        if (s.step_type !== 'dialogue' && s.step_type !== 'title') continue;
        const raw = typeof s.text === 'string' ? s.text : '';
        if (!raw.trim()) continue;
        lines++;
        // 엔진은 tr(step.text)를 그대로 부른다 (src/systems/cutscene/cutsceneEngine.ts)
        if (/[가-힣]/.test(tr(raw))) untranslated.push(raw.slice(0, 40));
      }
      expect(lines).toBeGreaterThan(800);
      expect(untranslated, `영어 미번역 ${untranslated.length}줄: ${untranslated.slice(0, 5).join(' | ')}`).toEqual([]);
    } finally {
      setLang('ko');
    }
  });
});
