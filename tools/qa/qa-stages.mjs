#!/usr/bin/env node
/**
 * 전 장 도달 QA: 1~6권의 모든 장(48개)으로 이동해 "정말 그 장에 들어갔는지"(state 단언)와
 * "화면이 서로 다른지"(스크린샷 해시 중복 검사)를 확인한다. 권마다 첫·마지막 장과 새 무대가 처음 나오는 장은 docs/qa/stages/ 에 저장한다.
 * (예전 qa-book5/6 는 이동에 실패해도 통과해서, 5·6권 증거가 우르 화면이었다 — 그 재발 방지용)
 * 개발 서버: PORT=5174 node tools/qa/qa-stages.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openGame, gotoChapter, evalRetry, COUNTS } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/qa/stages');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;
const problems = [];
const seen = new Map();
const savedStages = new Set();
const browser = await launch();
try {
  const page = await openGame(browser, PORT);
  for (const [bk, n] of Object.entries(COUNTS)) {
    const book = Number(bk);
    for (let ch = 0; ch < n; ch++) {
      const st = await gotoChapter(page, book, ch, { port: PORT });
      const tag = `book${book}_ch${ch + 1}`;
      if (!st.ok || st.book !== book || st.chapter !== ch) { problems.push(`${tag}: 이동 실패 (현재 ${st.book}권 ${st.chapter + 1}장, stage=${st.stage})`); continue; }
      const buf = Buffer.from(await page.screenshot());
      const hash = crypto.createHash('md5').update(buf).digest('hex');
      if (seen.has(hash)) problems.push(`${tag}: ${seen.get(hash)} 와 화면이 똑같다`); else seen.set(hash, tag);
      if (ch === 0 || ch === n - 1 || !savedStages.has(`${book}:${st.stage}`)) { savedStages.add(`${book}:${st.stage}`); fs.writeFileSync(path.join(OUT, `${tag}_${st.stage}.png`), buf); }
      console.log(`  ✓ ${tag} → ${st.stage}`);
    }
  }
} finally {
  await browser.close();
}
if (problems.length) { console.error(`\n[전 장 QA 실패]\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log(`\n[전 장 QA 통과] 48개 장 모두 도달, 화면 ${seen.size}종`);
