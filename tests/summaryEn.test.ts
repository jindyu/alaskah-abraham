import { describe, expect, it } from 'vitest';
import catalog from '../src/data/catalog.json';
import en from '../src/i18n/en.json';
import extra from '../src/i18n/en_extra.json';

describe('장 요약의 영어 번역', () => {
  it('요약이 있는 모든 장은 영어 번역이 있다 (장 선택 화면이 영어 모드에서 한국어로 남지 않게)', () => {
    const table = { ...(extra as Record<string, string>), ...(en as Record<string, string>) };
    const missing: string[] = [];
    for (const b of catalog as Array<{ id: string; chapters: Array<{ slug: string; summary: string }> }>) {
      for (const ch of b.chapters) {
        if (ch.summary.trim() && !table[ch.summary]) missing.push(`${b.id}/${ch.slug}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
