import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('대본 및 자산 무결성 (Content Integrity)', () => {
  const booksDir = path.resolve(__dirname, '../src/data/books');
  const catalogPath = path.resolve(__dirname, '../src/data/catalog.json');
  const sfxPath = path.resolve(__dirname, '../src/data/sfxManifest.json');
  const voicePath = path.resolve(__dirname, '../src/data/voiceManifest.json');

  it('카탈로그 파일이 존재하고 8개 도서(intro, 1~6, outro)를 포함한다', () => {
    expect(fs.existsSync(catalogPath)).toBe(true);
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    expect(catalog.length).toBe(8);
    const ids = catalog.map((b: { id: string }) => b.id);
    expect(ids).toEqual([
      'abraham_intro',
      'abraham_1',
      'abraham_2',
      'abraham_3',
      'abraham_4',
      'abraham_5',
      'abraham_6',
      'abraham_outro',
    ]);
  });

  it('모든 권의 JSON 대본 파일이 존재하며 챕터와 스텝을 갖는다', () => {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    for (const b of catalog) {
      const bPath = path.join(booksDir, `${b.id}.json`);
      expect(fs.existsSync(bPath), `도서 파일 존재: ${b.id}`).toBe(true);
      const data = JSON.parse(fs.readFileSync(bPath, 'utf8'));
      expect(data.chapters.length).toBe(b.chapterCount);
      expect(data.chapters.length).toBeGreaterThan(0);
      for (const ch of data.chapters) {
        expect(ch.steps.length).toBeGreaterThan(0);
        for (const st of ch.steps) {
          expect(typeof st.step_type).toBe('string');
        }
      }
    }
  });

  it('SFX 및 Voice 매니페스트가 풍부하게 등록되어 있다', () => {
    const sfx = JSON.parse(fs.readFileSync(sfxPath, 'utf8'));
    const voice = JSON.parse(fs.readFileSync(voicePath, 'utf8'));
    expect(Object.keys(sfx).length).toBeGreaterThanOrEqual(100);
    expect(Object.keys(voice).length).toBeGreaterThanOrEqual(500);
  });
});
