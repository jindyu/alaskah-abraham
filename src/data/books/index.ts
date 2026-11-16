import bookIntro from './abraham_intro.json';
import bookOutro from './abraham_outro.json';
import catalog from '../catalog.json';
import type { LegacyStep } from '../../game/chapterScript';

export interface ChapterData {
  slug: string;
  title: string;
  summary: string;
  characters: string[];
  location: string;
  tags: string[];
  stepCount: number;
  steps: LegacyStep[];
}

export interface BookData {
  id: string;
  title: string;
  chapterCount: number;
  chapters: ChapterData[];
}

/**
 * 1~6권은 장면·액션 코드(src/systems/scenes, actions)가 직접 연출하므로
 * 런타임에는 장 제목/요약 같은 메타데이터만 필요하다 (장 선택 화면, 세이브).
 * Godot 덤프 대본(abraham_1..6.json, ~780KB)은 번들에 싣지 않고 카탈로그로 대체한다.
 * 인트로/아우트로만 CutsceneEngine 이 JSON 스텝을 그대로 재생한다.
 */
function fromCatalog(id: string): BookData {
  const book = (catalog as Array<Omit<BookData, 'chapters'> & { chapters: Array<Omit<ChapterData, 'steps'>> }>)
    .find((b) => b.id === id);
  if (!book) throw new Error(`catalog.json 에 ${id} 가 없습니다`);
  return { ...book, chapters: book.chapters.map((ch) => ({ ...ch, steps: [] })) };
}

export const BOOKS: BookData[] = [
  bookIntro as BookData,
  fromCatalog('abraham_1'),
  fromCatalog('abraham_2'),
  fromCatalog('abraham_3'),
  fromCatalog('abraham_4'),
  fromCatalog('abraham_5'),
  fromCatalog('abraham_6'),
  bookOutro as BookData,
];
