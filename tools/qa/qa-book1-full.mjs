#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const QA_DIR = path.join(ROOT, 'docs/qa/book1');
fs.mkdirSync(QA_DIR, { recursive: true });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 5174;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQa() {
  console.log('[QA] 1권 풀 인터랙션 & 이벤트 루프 검증 시작...');
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

  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

  // 1. 인트로 자막 빠르게 스킵 (Space 6회)
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Space');
    await sleep(350);
  }
  await sleep(600);

  // 2. 데라에게 다가가서 대화하기 (E 키)
  await page.keyboard.press('KeyE');
  await sleep(600);
  await page.screenshot({ path: path.join(QA_DIR, '06_talk_terah.png') });
  console.log('  ✓ 캡처 6: 06_talk_terah.png (아버지 데라와의 대화 토스트)');

  // 3. 서쪽 우물가 롯에게 이동 후 대화 (Left-Shift 달리기)
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyA');
  await sleep(1800);
  await page.keyboard.up('KeyA');
  await page.keyboard.up('ShiftLeft');
  await sleep(400);
  await page.keyboard.press('KeyE');
  await sleep(600);
  await page.screenshot({ path: path.join(QA_DIR, '07_talk_lot.png') });
  console.log('  ✓ 캡처 7: 07_talk_lot.png (조카 롯과의 대화 토스트)');

  // 4. 동쪽 안채 사래에게 이동 후 대화 (Left-Shift 달리기)
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyD');
  await sleep(3500);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await sleep(1200);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  await sleep(400);
  await page.keyboard.press('KeyE');
  await sleep(600);
  await page.screenshot({ path: path.join(QA_DIR, '08_talk_sarai.png') });
  console.log('  ✓ 캡처 8: 08_talk_sarai.png (사래와의 대화 토스트)');

  // 5. 공방 안으로 들어가서 작은 우상 3개 조사
  await page.keyboard.down('KeyA');
  await sleep(2400);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyW');
  await sleep(1800);
  await page.keyboard.up('KeyW');
  await sleep(500);

  // 우상 1번째 조사
  await page.keyboard.press('KeyE');
  await sleep(400);
  // 우상 2번째 조사
  await page.keyboard.press('KeyE');
  await sleep(400);
  // 우상 3번째 조사
  await page.keyboard.press('KeyE');
  await sleep(600);
  await page.screenshot({ path: path.join(QA_DIR, '09_inspect_idols.png') });
  console.log('  ✓ 캡처 9: 09_inspect_idols.png (공방 우상 조사 완료 및 옥상 유도 목표)');

  // 6. 공방 서쪽 계단으로 올라가 옥상 테라스 도달 (x: -6.8 계단 이용 후 x: 0 옥상 도착)
  await page.keyboard.down('KeyA');
  await sleep(900);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyS');
  await sleep(700);
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyW');
  await sleep(1600);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyD');
  await sleep(900);
  await page.keyboard.up('KeyD');
  await sleep(500);

  // 옥상 별밤 이벤트 트리거 (E 키)
  await page.keyboard.press('KeyE');
  await sleep(2200);
  await page.screenshot({ path: path.join(QA_DIR, '10_night_calling_beam.png') });
  console.log('  ✓ 캡처 10: 10_night_calling_beam.png (옥상 별밤 & 하늘의 빛기둥 부르심)');

  await browser.close();
  console.log('[QA] 1권 풀 인터랙션 검증 및 스크린샷 10종 캡처 완료!');
}

runQa().catch((err) => {
  console.error('[QA Failed]', err);
  process.exit(1);
});
