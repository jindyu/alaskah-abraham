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
});
