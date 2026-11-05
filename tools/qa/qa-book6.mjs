#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const QA_DIR = path.join(ROOT, 'docs/qa/book6');
fs.mkdirSync(QA_DIR, { recursive: true });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 5174;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQa() {
  console.log('[QA] 6권(막벨라) 전용 헤드리스 QA 시작...');
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

  // 1. 헤브론 막벨라 굴 (제6권 1장)로 이동
  await sleep(1500);
  await page.keyboard.press('Tab');
  await sleep(500);
  // 6권으로 이동 (1권 -> 2권 -> 3권 -> 4권 -> 5권 -> 6권)
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ArrowRight');
    await sleep(200);
  }
  await page.keyboard.press('Enter');
  await sleep(2000);
  await page.screenshot({ path: path.join(QA_DIR, '01_machpelah_cave.png') });
  console.log('  ✓ 캡처 1: 01_machpelah_cave.png (헤브론 성문과 막벨라 굴)');

  // 2. 나홀 성 우물가 (제6권 5장)로 이동
  await page.keyboard.press('Tab');
  await sleep(500);
  // 5번째 장(나홀 성 우물가) 선택
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowDown');
    await sleep(150);
  }
  await page.keyboard.press('Enter');
  await sleep(2500);
  await page.screenshot({ path: path.join(QA_DIR, '02_nahor_well.png') });
  console.log('  ✓ 캡처 2: 02_nahor_well.png (나홀 성벽과 우물가 낙타들)');

  await browser.close();
  console.log('[QA] 6권 QA 스크린샷 캡처 완료!');
}

runQa().catch((err) => {
  console.error('[QA Failed]', err);
  process.exit(1);
});
