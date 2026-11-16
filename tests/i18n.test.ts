import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tr, loadEnglish } from '../src/i18n/tr';
import { setLang } from '../src/i18n/lang';

describe('한영 번역 무결성 (i18n Integrity)', () => {
  const enPath = path.resolve(__dirname, '../src/i18n/en.json');

  it('en.json 파일이 존재하고 주요 키가 번역되어 있다', async () => {
    expect(fs.existsSync(enPath)).toBe(true);
    const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    expect(Object.keys(enDict).length).toBeGreaterThan(1000);

    expect(enDict['아브라함']).toBe('Abraham');
    expect(enDict['아브람']).toBe('Abram');
    expect(enDict['이삭']).toBe('Isaac');
    expect(enDict['권/장 선택']).toBe('Chapter Select');
  });

  it('tr() 런타임 번역 함수가 한국어와 영어 모드에서 올바르게 동작한다', async () => {
    setLang('ko');
    expect(tr('아브라함')).toBe('아브라함');

    await loadEnglish();
    setLang('en');
    expect(tr('아브라함')).toBe('Abraham');
    expect(tr('권/장 선택')).toBe('Chapter Select');

    // 번역 없는 문자열은 원문 유지
    expect(tr('알려지지않은키XYZ')).toBe('알려지지않은키XYZ');

    // 다시 한국어로 복원
    setLang('ko');
  });

  it('제2~6권 컷신 자막 및 시네마틱 타이틀 키가 en.json에 번역되어 있다', () => {
    const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    // Book 2
    expect(enDict['제2권 · 약속의 땅\n세겜 모레 상수리나무']).toBeDefined();
    expect(enDict['하란을 떠나 유프라테스를 건넌 아브람은 마침내 약속의 땅, 세겜 모레 상수리나무에 이르렀다.']).toBeDefined();
    expect(enDict['애굽 국경과 세관']).toBeDefined();
    expect(enDict['[전해오는 이야기 · 창세기 라바 40:5] 가나안에 심한 기근이 들자, 아브람 일행은 물이 풍부한 나일강 애굽 국경에 다다랐다.']).toBeDefined();

    // Book 3
    expect(enDict['제3권 · 별과 언약\n하늘의 뭇별을 세어보라']).toBeDefined();
    expect(enDict['아브람이 여호와를 믿으니, 여호와께서 이를 그의 의로 여기셨다.']).toBeDefined();

    // Book 4
    expect(enDict['제4권 · 소돔의 불\n마므레 세 나그네 영접']).toBeDefined();
    expect(enDict['소돔의 멸망\n하늘의 유황불과 소금기둥']).toBeDefined();

    // Book 5
    expect(enDict['제5권 · 모리아\n이삭의 출생과 큰 잔치']).toBeDefined();
    expect(enDict['모리아 산의 번제단\n이삭의 결박 (아케다)']).toBeDefined();

    // Book 6
    expect(enDict['제6권 · 막벨라\n사라의 별세와 헤브론의 애도']).toBeDefined();
    expect(enDict['아브라함의 향년이 일백칠십오 세라. 그의 나이가 높고 늙어서 기운이 다하여 평안히 열조에게로 돌아갔다.']).toBeDefined();
  });

  it('터치 컨트롤(touchControls) 주요 레이블이 en.json에 모두 번역되어 있다', () => {
    const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const touchLabels = ['행동', '달리기', '장 선택', '도감', '메뉴'];
    for (const label of touchLabels) {
      expect(enDict[label], `터치 라벨 번역 존재: ${label}`).toBeDefined();
      expect(typeof enDict[label]).toBe('string');
      expect(enDict[label].length).toBeGreaterThan(0);
    }
  });

  it('en.json (및 en_extra.json 존재 시)에 중복되거나 충돌하는 한국어 키가 없다', () => {
    const enExtraPath = path.resolve(__dirname, '../src/i18n/en_extra.json');
    const enRaw = fs.readFileSync(enPath, 'utf8');

    // JSON 문자열 원본에서 키 추출하여 중복 검사
    const keyMatches = [...enRaw.matchAll(/"((?:\\.|[^"\\])*)"\s*:/g)].map((m) => m[1]);
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const k of keyMatches) {
      if (seen.has(k)) {
        dupes.push(k);
      }
      seen.add(k);
    }
    expect(dupes, `en.json 파일 내 중복된 한국어 키 발견: ${dupes.join(', ')}`).toEqual([]);

    if (fs.existsSync(enExtraPath)) {
      const extraRaw = fs.readFileSync(enExtraPath, 'utf8');
      const extraKeyMatches = [...extraRaw.matchAll(/"((?:\\.|[^"\\])*)"\s*:/g)].map((m) => m[1]);
      const collisions: string[] = [];
      for (const k of extraKeyMatches) {
        if (seen.has(k)) {
          collisions.push(k);
        }
      }
      expect(collisions, `en_extra.json 과 en.json 간 충돌 키 발견: ${collisions.join(', ')}`).toEqual([]);
    }
  });

  it.fails('en.json (및 en_extra.json 존재 시)의 모든 번역 값은 비어있지 않은 문자열이다 (한국어 조사 키 17개 빈 문자열 결함 감지)', () => {
    const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const emptyKeys: string[] = [];

    for (const [k, v] of Object.entries(enDict)) {
      if (typeof v !== 'string' || (v as string).trim().length === 0) {
        emptyKeys.push(k);
      }
    }

    const enExtraPath = path.resolve(__dirname, '../src/i18n/en_extra.json');
    if (fs.existsSync(enExtraPath)) {
      const extraDict = JSON.parse(fs.readFileSync(enExtraPath, 'utf8'));
      for (const [k, v] of Object.entries(extraDict)) {
        if (typeof v !== 'string' || (v as string).trim().length === 0) {
          emptyKeys.push(`[extra] ${k}`);
        }
      }
    }

    // 조사(은,는,이,가 등) 17개가 빈 문자열("")로 정의되어 있어 현재 코드는 실패해야 함(it.fails)
    expect(emptyKeys, `빈 문자열 번역 키 발견: ${emptyKeys.join(', ')}`).toEqual([]);
  });

  it('조사(은/는/이/가 등 17개 특수 키)를 제외한 모든 en.json 키의 번역 값은 비어있지 않은 문자열이다', () => {
    const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const JOSA_KEYS = new Set([
      '가', '과', '는', '랑', '로', '를', '아', '야', '예요', '와',
      '으로', '은', '을', '이', '이랑', '이야', '이에요',
    ]);

    const emptyKeys: string[] = [];
    for (const [k, v] of Object.entries(enDict)) {
      if (JOSA_KEYS.has(k)) continue;
      if (typeof v !== 'string' || (v as string).trim().length === 0) {
        emptyKeys.push(k);
      }
    }

    expect(emptyKeys).toEqual([]);
  });
});

describe('코드의 tr() 한국어 문자열 영어 번역 누락 스캔', () => {
  it("src 전체의 tr('한국어') 리터럴이 en.json/en_extra.json 에 모두 있다", () => {
    const root = path.resolve(__dirname, '../src');
    const en = JSON.parse(fs.readFileSync(path.join(root, 'i18n/en.json'), 'utf8')) as Record<string, string>;
    const ex = JSON.parse(fs.readFileSync(path.join(root, 'i18n/en_extra.json'), 'utf8')) as Record<string, string>;
    const table = new Set([...Object.keys(en), ...Object.keys(ex)]);
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p);
      }
    };
    walk(root);
    const missing: string[] = [];
    const re = /\btr\(\s*'((?:[^'\\\n]|\\.)*[가-힣](?:[^'\\\n]|\\.)*)'\s*\)/g;
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(re)) {
        const k = m[1].replace(/\\'/g, "'");
        if (!table.has(k)) missing.push(`${path.relative(root, f)}: ${k}`);
      }
    }
    expect(missing, `영어 번역 없는 tr() 문자열 ${missing.length}개:\n${missing.slice(0, 8).join('\n')}`).toEqual([]);
  });
});
