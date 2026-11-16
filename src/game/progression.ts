export interface ChapterTarget {
  book: number;
  chapter: number;
  ending?: boolean;
}

export interface ProgressionBook {
  readonly chapters: ReadonlyArray<unknown>;
}

/**
 * 다음 챕터 대상 위치를 계산합니다.
 * 현재 권 내 다음 챕터가 있으면 (curBook, curChapter + 1),
 * 없으면 다음 권의 첫 챕터 (curBook + 1, 0),
 * 마지막 권을 넘어가면 아우트로(7권, 0) 및 ending 플래그를 반환합니다.
 */
export function nextChapterTarget(
  books: ReadonlyArray<{ chapters: ReadonlyArray<unknown> }>,
  curBook: number,
  curChapter: number,
): ChapterTarget {
  const bookData = books[curBook];
  if (!bookData) {
    return { book: 7, chapter: 0, ending: true };
  }

  if (curChapter + 1 < bookData.chapters.length) {
    return { book: curBook, chapter: curChapter + 1 };
  } else if (curBook + 1 < books.length) {
    return { book: curBook + 1, chapter: 0 };
  } else {
    return { book: 7, chapter: 0, ending: true };
  }
}

/**
 * 특정 권의 시작 챕터(0번) 대상을 반환합니다.
 * onBook1Complete 등 특정 권 완료 후 다음 권으로 직행할 때 사용됩니다.
 */
export function bookStartTarget(nextBookIndex: number): { book: number; chapter: number } {
  return { book: nextBookIndex, chapter: 0 };
}

/**
 * 권/장 인덱스를 도서 목록 범위 내로 클램핑합니다.
 * loadChapter 진입 시 유효 범위를 보장하기 위해 사용됩니다.
 */
export function clampTarget(
  books: ReadonlyArray<{ chapters: ReadonlyArray<unknown> }>,
  book: number,
  chapter: number,
): { book: number; chapter: number } {
  if (books.length === 0) {
    return { book: 0, chapter: 0 };
  }
  const clampedBook = Math.max(0, Math.min(books.length - 1, book));
  const bData = books[clampedBook];
  const maxChapter = bData && bData.chapters.length > 0 ? bData.chapters.length - 1 : 0;
  const clampedChapter = Math.max(0, Math.min(maxChapter, chapter));
  return { book: clampedBook, chapter: clampedChapter };
}
