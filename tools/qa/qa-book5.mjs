#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const QA_DIR = path.join(ROOT, 'docs/qa/book5');
fs.mkdirSync(QA_DIR, { recursive: true });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 5174;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQa() {
  console.log('[QA] 5권(모리아) 전용 헤드리스 QA 시작...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[Browser Error]', msg.text());
  });

  console.log(`[QA] http://localhost:${PORT} 접속...`);
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

  // 1. 브엘세바 우물터 (제5권 1장)로 이동
  await sleep(1500);
  await page.keyboard.press('Tab');
  await sleep(500);
  // 5권으로 이동 (1권 -> 2권 -> 3권 -> 4권 -> 5권)
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowRight');
    await sleep(200);
  }
  await page.keyboard.press('Enter');
  await sleep(2000);
  await page.screenshot({ path: path.join(QA_DIR, '01_beersheba_well.png') });
  console.log('  ✓ 캡처 1: 01_beersheba_well.png (브엘세바 우물과 에셀나무)');

  // 2. 모리아 산 정상 번제단 (제5권 7장)으로 이동
  await page.keyboard.press('Tab');
  await sleep(500);
  // 7번째 장(모리아 산 아케다) 선택
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('ArrowDown');
    await sleep(150);
  }
  await page.keyboard.press('Enter');
  await sleep(2500);
  await page.screenshot({ path: path.join(QA_DIR, '02_moriah_akedah.png') });
  console.log('  ✓ 캡처 2: 02_moriah_akedah.png (모리아 산 정상 번제단과 숫양)');

  await browser.close();
  console.log('[QA] 5권 QA 스크린샷 캡처 완료!');
}

runQa().catch((err) => {
  console.error('[QA Failed]', err);
  process.exit(1);
});
