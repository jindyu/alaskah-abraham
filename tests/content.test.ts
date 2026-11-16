import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BOOKS } from '../src/data/books';

describe('대본 및 자산 무결성 (Content Integrity)', () => {
  const booksDir = path.resolve(__dirname, '../src/data/books');
  const catalogPath = path.resolve(__dirname, '../src/data/catalog.json');
  const sfxPath = path.resolve(__dirname, '../src/data/sfxManifest.json');
  const voicePath = path.resolve(__dirname, '../src/data/voiceManifest.json');
  const stageManagerPath = path.resolve(__dirname, '../src/world/stageManager.ts');
  const publicAudioDir = path.resolve(__dirname, '../public/audio');

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

  it('src/data/books: 모든 챕터가 slug와 title을 가지며 catalog.json의 chapterCount와 BOOKS 길이가 일치한다', () => {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    expect(BOOKS.length).toBe(catalog.length);

    for (let i = 0; i < BOOKS.length; i++) {
      const book = BOOKS[i];
      const cat = catalog[i];

      expect(book.id).toBe(cat.id);
      expect(book.chapters.length).toBe(cat.chapterCount);
      expect(book.chapters.length).toBe(cat.chapters.length);

      for (const ch of book.chapters) {
        expect(typeof ch.slug).toBe('string');
        expect(ch.slug.trim().length).toBeGreaterThan(0);
        expect(typeof ch.title).toBe('string');
        expect(ch.title.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('SFX 및 Voice 매니페스트가 풍부하게 등록되어 있다', () => {
    const sfx = JSON.parse(fs.readFileSync(sfxPath, 'utf8'));
    const voice = JSON.parse(fs.readFileSync(voicePath, 'utf8'));
    expect(Object.keys(sfx).length).toBeGreaterThanOrEqual(100);
    expect(Object.keys(voice).length).toBeGreaterThanOrEqual(500);
  });

  it('src/systems/**/*.ts 에서 audio.playSfx(...) 로 호출된 모든 SFX 키가 sfxManifest.json에 존재한다', () => {
    const sfxManifest = JSON.parse(fs.readFileSync(sfxPath, 'utf8'));
    const manifestKeys = new Set(Object.keys(sfxManifest));

    const systemsDir = path.resolve(__dirname, '../src/systems');

    function getFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getFiles(fullPath));
        } else if (entry.isFile() && fullPath.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const tsFiles = getFiles(systemsDir);
    expect(tsFiles.length).toBeGreaterThan(0);

    const sfxRegex = /(?:[a-zA-Z0-9_.]*audio\.)?playSfx\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g;
    const referencedKeys = new Set<string>();

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      let match: RegExpExecArray | null;
      while ((match = sfxRegex.exec(content)) !== null) {
        referencedKeys.add(match[1]);
      }
    }

    expect(referencedKeys.size).toBeGreaterThan(0);
    const missingKeys: string[] = [];
    for (const key of referencedKeys) {
      if (!manifestKeys.has(key)) {
        missingKeys.push(key);
      }
    }

    expect(missingKeys, `sfxManifest.json에 누락된 SFX 키: ${missingKeys.join(', ')}`).toEqual([]);
  });

  it('src/world/stageManager.ts 에서 사용된 BGM 및 Ambience 키가 public/audio 에 실제 파일로 존재한다', () => {
    const content = fs.readFileSync(stageManagerPath, 'utf8');

    const bgmRegex = /bgm:\s*['"]([a-zA-Z0-9_-]+)['"]/g;
    const ambRegex = /ambience:\s*['"]([a-zA-Z0-9_-]+)['"]/g;

    const bgmKeys = new Set<string>();
    const ambKeys = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = bgmRegex.exec(content)) !== null) {
      bgmKeys.add(match[1]);
    }
    while ((match = ambRegex.exec(content)) !== null) {
      ambKeys.add(match[1]);
    }

    expect(bgmKeys.size).toBeGreaterThan(0);
    expect(ambKeys.size).toBeGreaterThan(0);

    const missingBgm: string[] = [];
    for (const key of bgmKeys) {
      const filePath = path.join(publicAudioDir, 'bgm', `${key}.ogg`);
      if (!fs.existsSync(filePath)) {
        missingBgm.push(key);
      }
    }
    expect(missingBgm, `누락된 BGM 오디오 파일: ${missingBgm.join(', ')}`).toEqual([]);

    const missingAmb: string[] = [];
    for (const key of ambKeys) {
      const filePath = path.join(publicAudioDir, 'ambience', `${key}.ogg`);
      if (!fs.existsSync(filePath)) {
        missingAmb.push(key);
      }
    }
    expect(missingAmb, `누락된 Ambience 오디오 파일: ${missingAmb.join(', ')}`).toEqual([]);
  });
});
