import bookIntro from './abraham_intro.json';
import book1 from './abraham_1.json';
import book2 from './abraham_2.json';
import book3 from './abraham_3.json';
import book4 from './abraham_4.json';
import book5 from './abraham_5.json';
import book6 from './abraham_6.json';
import bookOutro from './abraham_outro.json';

export interface ChapterData {
  slug: string;
  title: string;
  summary: string;
  characters: string[];
  location: string;
  tags: string[];
  stepCount: number;
  steps: any[];
}

export interface BookData {
  id: string;
  title: string;
  chapterCount: number;
  chapters: ChapterData[];
}

export const BOOKS: BookData[] = [
  bookIntro as BookData,
  book1 as BookData,
  book2 as BookData,
  book3 as BookData,
  book4 as BookData,
  book5 as BookData,
  book6 as BookData,
  bookOutro as BookData,
];
