import { describe, expect, it } from 'vitest';
import { BOOKS } from '../src/data/books';
import { getChapterContext, CATALOG } from '../src/systems/story';
import { CAST_REGISTRY, getCast } from '../src/entities/cast';

describe('전권 서사 및 진행 무결성 (Story & Chapter Progression)', () => {
  it('8개 도서(인트로, 1~6권, 아우트로)의 모든 챕터가 유효한 메타데이터와 스텝을 갖는다', () => {
    expect(BOOKS.length).toBe(8);
    expect(CATALOG.length).toBe(8);

    let totalChapters = 0;
    let totalSteps = 0;

    BOOKS.forEach((book, bIdx) => {
      expect(book.chapters.length).toBeGreaterThan(0);
      totalChapters += book.chapters.length;

      book.chapters.forEach((ch, cIdx) => {
        expect(ch.slug.length).toBeGreaterThan(0);
        expect(ch.title.length).toBeGreaterThan(0);
        expect(ch.steps.length).toBeGreaterThan(0);
        totalSteps += ch.steps.length;

        // 컨텍스트 매핑 검증
        const ctx = getChapterContext(bIdx, cIdx);
        expect(ctx.stageId).toBeDefined();
        expect(ctx.hero).toBeDefined();
        expect(ctx.defaultGoal.length).toBeGreaterThan(0);

        // 주인공이 캐스트에 존재하는지 검증
        const heroCast = CAST_REGISTRY[ctx.hero];
        expect(heroCast).toBeDefined();
      });
    });

    // 46개 이상 챕터 및 3000개 이상 연출 스텝 검증
    expect(totalChapters).toBeGreaterThanOrEqual(46);
    expect(totalSteps).toBeGreaterThanOrEqual(3000);
  });

  it('시점 전환(Protagonist Switching) 주인공들이 올바른 외형과 속성을 갖는다', () => {
    const heroes = ['abram_young', 'abram', 'abraham', 'lot', 'eliezer', 'esau'] as const;
    for (const h of heroes) {
      const cast = getCast(h);
      expect(cast).toBeDefined();
      expect(cast.name.length).toBeGreaterThan(0);
      expect(cast.skinColor).toBeDefined();
      expect(cast.tunicColor).toBeDefined();
    }
  });

  it('핵심 상호작용 챕터들의 목표와 배경 무대가 일치한다', () => {
    // 1권 도끼와 우상
    const b1c5 = getChapterContext(1, 5);
    expect(b1c5.stageId).toBe('ur_workshop');
    expect(b1c5.hero).toBe('abram_young');

    // 2권 세겜 벧엘 제단
    const b2c0 = getChapterContext(2, 0);
    expect(b2c0.stageId).toBe('shechem_bethel');
    expect(b2c0.hero).toBe('abram');

    // 4권 롯의 소돔 탈출
    const b4c2 = getChapterContext(4, 2);
    expect(b4c2.stageId).toBe('sodom');
    expect(b4c2.hero).toBe('lot');

    // 5권 모리아 산 번제단
    const b5c6 = getChapterContext(5, 6);
    expect(b5c6.stageId).toBe('moriah');
    expect(b5c6.hero).toBe('abraham');

    // 6권 엘리에셀의 나홀 우물
    const b6c4 = getChapterContext(6, 4);
    expect(b6c4.stageId).toBe('nahor_well');
    expect(b6c4.hero).toBe('eliezer');
  });
});
