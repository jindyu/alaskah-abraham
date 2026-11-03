#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const QA_DIR = path.join(ROOT, 'docs/qa');
fs.mkdirSync(QA_DIR, { recursive: true });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 5176;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQa() {
  console.log('[QA] 헤드리스 Chrome 실행 중...');
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

  console.log(`[QA] http://localhost:${PORT} 접속 중...`);
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

  // 1. 게임 부팅 및 1권 우르 공방 스크린샷
  await sleep(2500);
  await page.screenshot({ path: path.join(QA_DIR, 'stage2-ur-workshop.png') });
  console.log('  ✓ 캡처 완료: stage2-ur-workshop.png');

  // 2. 권/장 선택 오버레이 [Tab] 열기
  await page.keyboard.press('Tab');
  await sleep(800);
  await page.screenshot({ path: path.join(QA_DIR, 'stage2-chapter-select.png') });
  console.log('  ✓ 캡처 완료: stage2-chapter-select.png');

  // 3. 2권 (약속의 땅, 세겜 제단)으로 이동
  await page.keyboard.press('ArrowRight'); // 2권
  await sleep(400);
  await page.keyboard.press('Enter');     // 1장 시작
  await sleep(2500);
  await page.screenshot({ path: path.join(QA_DIR, 'stage5-bethel-altar.png') });
  console.log('  ✓ 캡처 완료: stage5-bethel-altar.png');

  // 4. 4권 (소돔의 불, 마므레 환대)으로 이동
  await page.keyboard.press('Tab');
  await sleep(500);
  await page.keyboard.press('ArrowRight'); // 3권
  await sleep(300);
  await page.keyboard.press('ArrowRight'); // 4권
  await sleep(400);
  await page.keyboard.press('Enter');
  await sleep(2500);
  await page.screenshot({ path: path.join(QA_DIR, 'stage7-mamre.png') });
  console.log('  ✓ 캡처 완료: stage7-mamre.png');

  // 5. 5권 (모리아 산 정상 번제단)으로 이동
  await page.keyboard.press('Tab');
  await sleep(500);
  await page.keyboard.press('ArrowRight'); // 5권
  await sleep(300);
  // 7번째 장(모리아 산 정상) 선택
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('ArrowDown');
    await sleep(150);
  }
  await page.keyboard.press('Enter');
  await sleep(2500);
  await page.screenshot({ path: path.join(QA_DIR, 'stage8-moriah.png') });
  console.log('  ✓ 캡처 완료: stage8-moriah.png');

  // 6. 6권 (막벨라 굴)으로 이동
  await page.keyboard.press('Tab');
  await sleep(500);
  await page.keyboard.press('ArrowRight'); // 6권
  await sleep(300);
  await page.keyboard.press('ArrowDown');  // 2장 막벨라 굴 매입
  await sleep(300);
  await page.keyboard.press('Enter');
  await sleep(2500);
  await page.screenshot({ path: path.join(QA_DIR, 'stage9-machpelah.png') });
  console.log('  ✓ 캡처 완료: stage9-machpelah.png');

  // 7. 일시정지 메뉴 [Esc] 열기
  await page.keyboard.press('Escape');
  await sleep(600);
  await page.screenshot({ path: path.join(QA_DIR, 'stage2-pause.png') });
  console.log('  ✓ 캡처 완료: stage2-pause.png');

  await browser.close();
  console.log('[QA] 모든 헤드리스 브라우저 검증 및 스크린샷 캡처 완료!');
}

runQa().catch((err) => {
  console.error('[QA Failed]', err);
  process.exit(1);
});
