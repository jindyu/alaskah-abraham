#!/usr/bin/env node
/**
 * 시각 회귀 QA: 각 권의 첫 장면 + 장 선택 화면을 같은 조건(960×600)으로 찍어 기준 이미지(docs/qa/baseline/)와 비교한다.
 *  - 기본: 기준과 비교 — 픽셀의 채널 차이가 24 를 넘는 비율이 THRESHOLD(기본 4%)를 넘으면 실패 (입자·물결 같은 움직임은 허용)
 *  - --update: 지금 화면을 새 기준으로 저장 (의도한 시각 변경 뒤에 실행하고 diff 를 눈으로 확인할 것)
 * 개발 서버가 떠 있어야 한다: PORT=5174 node tools/qa/qa-visual.mjs [--update]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { waitFor, gotoChapter } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, '../../docs/qa/baseline');
fs.mkdirSync(BASE, { recursive: true });
const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;
const THRESHOLD = process.env.VISUAL_THRESHOLD ? Number(process.env.VISUAL_THRESHOLD) : 0.04;
const UPDATE = process.argv.includes('--update');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const launch = { headless: true, args: ['--no-sandbox'], protocolTimeout: 60000 };
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH; else launch.channel = 'chrome';

const SCENES = [
  { name: 'book1_ur', book: 1, chapter: 0 },
  { name: 'book2_shechem', book: 2, chapter: 0 },
  { name: 'book3_mamre_night', book: 3, chapter: 0 },
  { name: 'book4_mamre_day', book: 4, chapter: 0 },
  { name: 'book5_beersheba', book: 5, chapter: 0 },
  { name: 'book6_hebron', book: 6, chapter: 0 },
  { name: 'chapter_select', book: 1, chapter: 0, chapterSelect: true },
];

const failures = [];
const browser = await puppeteer.launch(launch);
try {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 960, height: 600, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('abraham.help.seen.v1', '1'); } catch { /* 저장소 없음 */ } });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await waitFor(page, () => !!window.__abraham && !!window.__abraham.state, { timeout: 20000 });
  // 이미지 비교는 게임이 돌지 않는 빈 탭에서 한다 (게임 탭은 프레임 루프가 바빠 이미지 디코드가 늦다)
  const cmp = await browser.newPage();
  await cmp.goto('about:blank');
  await page.bringToFront();

  for (const sc of SCENES) {
    const at = await gotoChapter(page, sc.book, sc.chapter, { port: PORT }); // 상태(권·장·무대)가 맞을 때까지 폴링 + 실패 시 한 번 재시도
    if (!at.ok) failures.push(`${sc.name}: 이동 실패 (${at.book}권 ${at.chapter + 1}장 stage=${at.stage})`);
    await sleep(2500); // 알림 토스트가 사라질 시간
    if (sc.chapterSelect) { await page.keyboard.press('Tab'); await sleep(600); }
    const buf = await page.screenshot();
    const file = path.join(BASE, `${sc.name}.png`);
    if (UPDATE || !fs.existsSync(file)) {
      fs.writeFileSync(file, buf);
      const stale = path.join(BASE, `${sc.name}.actual.png`);
      if (fs.existsSync(stale)) fs.rmSync(stale); // 기준을 갱신하면 옛 비교 이미지도 지운다
      console.log(`  • ${sc.name}: 기준 저장`);
      if (sc.chapterSelect) await page.keyboard.press('Escape');
      continue;
    }
    const base = fs.readFileSync(file).toString('base64');
    const cur = Buffer.from(buf).toString('base64');
    await cmp.bringToFront();
    const ratio = await cmp.evaluate(async (a, b) => {
      const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return 1;
      const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, cv.width, cv.height).data;
      g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, cv.width, cv.height).data;
      let diff = 0; const n = da.length / 4;
      for (let p = 0; p < da.length; p += 4) {
        if (Math.abs(da[p] - db[p]) > 24 || Math.abs(da[p + 1] - db[p + 1]) > 24 || Math.abs(da[p + 2] - db[p + 2]) > 24) diff++;
      }
      return diff / n;
    }, base, cur);
    await page.bringToFront();
    const ok = ratio <= THRESHOLD;
    console.log(`  ${ok ? '✓' : '✗'} ${sc.name}: 달라진 픽셀 ${(ratio * 100).toFixed(2)}% (허용 ${(THRESHOLD * 100).toFixed(0)}%)`);
    const actualFile = path.join(BASE, `${sc.name}.actual.png`);
    if (ok && fs.existsSync(actualFile)) fs.rmSync(actualFile); // 통과했으면 지난 실패의 비교 이미지는 지운다
    if (!ok) {
      failures.push(sc.name);
      fs.writeFileSync(path.join(BASE, `${sc.name}.actual.png`), buf);
    }
    if (sc.chapterSelect) await page.keyboard.press('Escape');
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(`\n[시각 회귀 실패] ${failures.join(', ')} — *.actual.png 와 기준을 눈으로 비교하고, 의도한 변경이면 --update`); process.exit(1); }
console.log(UPDATE ? '\n[기준 이미지 갱신 완료] docs/qa/baseline/' : '\n[시각 회귀 통과]');
