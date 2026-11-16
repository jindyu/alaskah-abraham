#!/usr/bin/env node
/**
 * 진행 표시 QA: 1권 7장(궁정)을 끝까지 플레이(선택지에서 '담대히 선포')한 뒤
 *  1) 끝낸 장 목록(hud.doneChapters)에 '1:6' 이 들어갔는지
 *  2) 한 선택(hud.picks)에 palace_answer='담대히 선포' 가 기록됐는지
 *  3) 다음 장(풀무불)에 선택에 따른 단계(furnace_bold)가 생겼는지
 * 를 단언하고, 장 선택 화면 스크린샷(✓·'지금까지 한 선택')을 docs/qa/progress/ 에 남긴다.
 * 개발 서버가 떠 있어야 한다: PORT=5174 node tools/qa/qa-progress.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { waitFor, gotoChapter } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/qa/progress');
fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const launch = { headless: true, args: ['--no-sandbox'] };
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH; else launch.channel = 'chrome';

const failures = [];
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) failures.push(msg); };

const browser = await puppeteer.launch(launch);
try {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 960, height: 600 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('abraham.help.seen.v1', '1'); } catch { /* 저장소 없음 */ } });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await waitFor(page, () => !!window.__abraham && !!window.__abraham.state, { timeout: 20000 });
  { const at = await gotoChapter(page, 1, 6, { port: PORT, settle: false }); check(at.ok, `1권 7장(궁정) 진입 (stage=${at.stage})`); }
  await page.evaluate(() => window.__abraham.skipCutscenes());

  console.log('[진행 QA] 1권 7장 플레이');
  for (const id of ['palace_throne', 'palace_idols', 'palace_courtiers', 'palace_answer']) {
    await page.evaluate((i) => window.__abraham.activate(i), id); await sleep(250);
  }
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(400); // 두 번째 답 = 담대히 선포
  await page.evaluate(() => window.__abraham.activate('palace_answer_end')); await sleep(900);
  await page.evaluate(() => window.__abraham.skipCutscenes()); await sleep(500);

  const st = await page.evaluate(() => {
    const h = window.__AGY_DEBUG__.hud;
    return { done: [...h.doneChapters], picks: Object.fromEntries(h.picks), ids: window.__abraham.interactionIds(), state: window.__abraham.state() };
  });
  check(st.state.book === 1 && st.state.chapter === 7, `다음 장(1권 8장)으로 넘어갔다 (현재 ${st.state.book}-${st.state.chapter + 1})`);
  check(st.done.includes('1:6'), "끝낸 장 목록에 '1:6' 이 있다");
  check(st.picks.palace_answer === '담대히 선포', `선택이 기록됐다 (palace_answer=${st.picks.palace_answer})`);
  check(st.ids.includes('furnace_bold') && !st.ids.includes('furnace_calm'), '선택에 따른 단계(furnace_bold)만 생겼다');

  await page.keyboard.press('Tab'); await sleep(600);
  const open = await page.evaluate(() => window.__AGY_DEBUG__.hud.chapterSelect.open);
  check(open, '장 선택이 열렸다');
  await page.screenshot({ path: path.join(OUT, 'chapter_select_progress.png') });
} finally {
  await browser.close();
}
if (failures.length) { console.error(`\n[진행 QA 실패] ${failures.length}건`); process.exit(1); }
console.log('\n[진행 QA 성공] 스크린샷: docs/qa/progress/');
