import { describe, expect, it } from 'vitest';
import { diagnostics, noteError } from '../src/core/diagnostics';

describe('diagnostics', () => {
  it('삼킨 오류를 어디서·무슨 일로 났는지와 함께 기억한다', () => {
    const before = diagnostics().length;
    noteError('audio:test', new Error('boom'));
    noteError('x', 'plain string');
    const last = diagnostics()[diagnostics().length - 1];
    expect(diagnostics().length).toBeGreaterThanOrEqual(Math.min(before + 2, 30));
    expect(last.where).toBe('x');
    expect(last.message).toBe('plain string');
    expect(diagnostics().some((d) => d.where === 'audio:test' && d.message === 'boom')).toBe(true);
  });
  it('최근 30개만 남긴다', () => {
    for (let i = 0; i < 50; i++) noteError('flood', i);
    expect(diagnostics().length).toBe(30);
  });
});

describe('diagnostics — 정상적인 재생 거절은 기록하지 않는다', () => {
  it('NotAllowedError·AbortError 는 건너뛰고 다른 오류는 기록한다', () => {
    const before = diagnostics().length;
    const mk = (name: string) => Object.assign(new Error('x'), { name });
    noteError('audio:play', mk('NotAllowedError'));
    noteError('audio:play', mk('AbortError'));
    expect(diagnostics().length).toBe(before);
    noteError('audio:play', mk('NotSupportedError'));
    expect(diagnostics().length).toBeGreaterThan(before - 1);
    expect(diagnostics()[diagnostics().length - 1].where).toBe('audio:play');
  });
});
