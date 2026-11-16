import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('삼키는 오류는 진단 기록을 남긴다', () => {
  it('src 의 `catch {` 와 `.catch(() => {})` (오류를 받지 않고 삼키는 catch) 는 하나도 없다 — 삼킬 때도 noteError/noteSaveError 로 원인을 남긴다', () => {
    const bad: string[] = [];
    for (const f of walk(path.resolve(__dirname, '../src'))) {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((l, i) => { if (/catch\s*\{/.test(l) || /\.catch\(\(\)\s*=>\s*(\{\s*\}|undefined)\)/.test(l)) bad.push(`${path.relative(process.cwd(), f)}:${i + 1}`); });
    }
    expect(bad).toEqual([]);
  });
});
