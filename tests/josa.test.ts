import { describe, expect, it } from 'vitest';
import { hasBatchim, josa, josaRo } from '../src/core/josa';

describe('josa', () => {
  it('받침 유무에 따라 조사를 고른다', () => {
    expect(hasBatchim('아브라함')).toBe(true);
    expect(hasBatchim('사라')).toBe(false);
    expect(josa('아브라함', '은', '는')).toBe('아브라함은');
    expect(josa('사라', '은', '는')).toBe('사라는');
  });
  it('(으)로 는 ㄹ 받침을 받침 없음으로 본다', () => {
    expect(josaRo('모리아산')).toBe('모리아산으로');
    expect(josaRo('우물')).toBe('우물로');
    expect(josaRo('하란')).toBe('하란으로');
    expect(josaRo('사라')).toBe('사라로');
  });
});
