import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import extra from '../src/i18n/en_extra.json';

/** 영어에서 붙일 필요가 없어 일부러 빈 값으로 둔 한국어 조사 (josa 로 붙는 것들) */
const PARTICLES = new Set(['가', '과', '는', '랑', '로', '를', '아', '야', '예요', '와', '으로', '은', '을', '이', '이랑', '이야', '이에요']);

describe('영어 번역의 빈 값', () => {
  it('빈 값은 한국어 조사 목록에 있는 키에만 허용한다 (번역 누락이 빈 값으로 숨지 않게)', () => {
    const empties = [...Object.entries(en), ...Object.entries(extra)].filter(([, v]) => v === '').map(([k]) => k);
    expect(empties.filter((k) => !PARTICLES.has(k))).toEqual([]);
  });
  it('조사 키가 실제로 있고 비어 있다 (목록이 낡지 않았는지)', () => {
    const e = en as Record<string, string>;
    expect(Object.keys(e).filter((k) => PARTICLES.has(k) && e[k] === '').length).toBeGreaterThan(10);
  });
});
