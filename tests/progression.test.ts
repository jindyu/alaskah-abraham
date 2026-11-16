import { describe, expect, it } from 'vitest';
import { BOOKS } from '../src/data/books';
import {
  nextChapterTarget,
  bookStartTarget,
  clampTarget,
} from '../src/game/progression';

describe('서사 진행 로직 (Story Progression Architecture)', () => {
  describe('nextChapterTarget', () => {
    it('동일 권 내에서 다음 챕터가 있으면 챕터 인덱스를 1 증가시킨다', () => {
      expect(nextChapterTarget(BOOKS, 1, 0)).toEqual({ book: 1, chapter: 1 });
      expect(nextChapterTarget(BOOKS, 1, 5)).toEqual({ book: 1, chapter: 6 });
      expect(nextChapterTarget(BOOKS, 2, 3)).toEqual({ book: 2, chapter: 4 });
    });

    it('1권 12장에서 2권 0장으로 전이한다 (book 1 chapter 12 -> book 2 chapter 0)', () => {
      // 1권은 총 13챕터 (0~12)이며 마지막 챕터(12) 완료 시 2권 0장으로 진행
      const target = nextChapterTarget(BOOKS, 1, 12);
      expect(target).toEqual({ book: 2, chapter: 0 });
    });

    it('각 권의 마지막 챕터에서 다음 권의 0장으로 전이한다 (0권~6권)', () => {
      for (let b = 0; b < BOOKS.length - 1; b++) {
        const lastChapterIndex = BOOKS[b].chapters.length - 1;
        const target = nextChapterTarget(BOOKS, b, lastChapterIndex);
        expect(target).toEqual({ book: b + 1, chapter: 0 });
      }
    });

    it('6권의 마지막 챕터에서 아우트로(7권 0장)로 전이한다 (last chapter of book 6 -> outro book 7)', () => {
      const book6LastChapter = BOOKS[6].chapters.length - 1;
      const target = nextChapterTarget(BOOKS, 6, book6LastChapter);
      expect(target).toEqual({ book: 7, chapter: 0 });
    });

    it('아우트로(7권)의 마지막 챕터 완료 시 엔딩 플래그와 함께 아우트로 0장으로 귀결된다', () => {
      const outroLastChapter = BOOKS[7].chapters.length - 1;
      const target = nextChapterTarget(BOOKS, 7, outroLastChapter);
      expect(target).toEqual({ book: 7, chapter: 0, ending: true });
    });

    it('범위 밖의 잘못된 권 번호 입력 시 엔딩 플래그를 반환한다', () => {
      expect(nextChapterTarget(BOOKS, -1, 0)).toEqual({ book: 7, chapter: 0, ending: true });
      expect(nextChapterTarget(BOOKS, 999, 0)).toEqual({ book: 7, chapter: 0, ending: true });
    });

    it('인트로(0권 0장)부터 nextChapterTarget을 반복 적용하여 모든 챕터를 순서대로 정확히 1회씩 방문하고 아우트로에서 종료된다', () => {
      // 실제 BOOKS 테이블의 전체 권·장 순서 목록 생성
      const expected: Array<{ book: number; chapter: number }> = [];
      for (let b = 0; b < BOOKS.length; b++) {
        for (let c = 0; c < BOOKS[b].chapters.length; c++) {
          expected.push({ book: b, chapter: c });
        }
      }

      const visited: Array<{ book: number; chapter: number }> = [];
      let curBook = 0;
      let curChapter = 0;
      const maxIterations = 200; // 무한 루프 방지 가드
      let iterations = 0;
      let terminated = false;

      while (iterations++ < maxIterations) {
        visited.push({ book: curBook, chapter: curChapter });
        const next = nextChapterTarget(BOOKS, curBook, curChapter);
        if (next.ending) {
          terminated = true;
          expect(next.book).toBe(7);
          expect(next.chapter).toBe(0);
          break;
        }
        curBook = next.book;
        curChapter = next.chapter;
      }

      expect(terminated).toBe(true);
      expect(visited.length).toBe(expected.length);
      expect(visited).toEqual(expected);
    });
  });

  describe('bookStartTarget', () => {
    it('지정된 권의 0번 챕터 대상을 반환한다 (onBook1Complete 등에서 2권 0장 직행에 사용)', () => {
      expect(bookStartTarget(2)).toEqual({ book: 2, chapter: 0 });
      expect(bookStartTarget(1)).toEqual({ book: 1, chapter: 0 });
      expect(bookStartTarget(5)).toEqual({ book: 5, chapter: 0 });
    });
  });

  describe('clampTarget', () => {
    it('범위를 벗어난 권 및 장 입력을 유효한 경계값으로 안전하게 클램핑한다', () => {
      // 음수 권 번호는 0권으로 클램핑
      expect(clampTarget(BOOKS, -5, 0)).toEqual({ book: 0, chapter: 0 });

      // 초과 권 번호는 마지막 권(7권)으로 클램핑
      expect(clampTarget(BOOKS, 999, 0)).toEqual({ book: 7, chapter: 0 });

      // 음수 챕터 번호는 0장으로 클램핑
      expect(clampTarget(BOOKS, 1, -10)).toEqual({ book: 1, chapter: 0 });

      // 초과 챕터 번호는 해당 권의 마지막 챕터로 클램핑 (1권은 12장)
      const book1LastChapter = BOOKS[1].chapters.length - 1;
      expect(clampTarget(BOOKS, 1, 999)).toEqual({ book: 1, chapter: book1LastChapter });

      // 권과 장 모두 음수인 경우 (0권 0장)
      expect(clampTarget(BOOKS, -1, -1)).toEqual({ book: 0, chapter: 0 });

      // 권과 장 모두 초과인 경우 (7권의 마지막 장)
      const book7LastChapter = BOOKS[7].chapters.length - 1;
      expect(clampTarget(BOOKS, 100, 100)).toEqual({ book: 7, chapter: book7LastChapter });

      // 유효 범위 내의 입력은 그대로 유지
      expect(clampTarget(BOOKS, 3, 2)).toEqual({ book: 3, chapter: 2 });
    });

    it('빈 도서 배열이 주어질 경우 (0, 0)을 반환한다', () => {
      expect(clampTarget([], 5, 5)).toEqual({ book: 0, chapter: 0 });
    });
  });
});
