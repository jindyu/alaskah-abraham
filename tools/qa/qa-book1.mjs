#!/usr/bin/env node
import { spawn } from 'node:child_process';
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
  console.log('[QA] 1권(불과 팥죽) 전용 헤드리스 QA 시작...');
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

  // 1. 오프닝 컷신 (원경 지구라트와 프롤로그 자막)
  await sleep(1500);
  await page.screenshot({ path: path.join(QA_DIR, '01_intro_ziggurat.png') });
  console.log('  ✓ 캡처 1: 01_intro_ziggurat.png (원경 지구라트와 바벨탑 프롤로그)');

  // 2. 인트로 자막 넘기기 (Space 연타)
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Space');
    await sleep(400);
  }
  await sleep(1000);
  await page.screenshot({ path: path.join(QA_DIR, '02_ur_workshop_arrival.png') });
  console.log('  ✓ 캡처 2: 02_ur_workshop_arrival.png (공방 마당 착지 및 우르 거리)');

  // 3. 거리와 시장 둘러보기 (플레이어 이동)
  await page.keyboard.down('KeyS');
  await sleep(1200);
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyD');
  await sleep(800);
  await page.keyboard.up('KeyD');
  await sleep(500);
  await page.screenshot({ path: path.join(QA_DIR, '03_ur_market_walk.png') });
  console.log('  ✓ 캡처 3: 03_ur_market_walk.png (시장 가판대와 거리 걷기)');

  // 4. 서쪽 우물과 종려나무 쉼터로 이동
  await page.keyboard.down('KeyA');
  await sleep(2200);
  await page.keyboard.up('KeyA');
  await sleep(500);
  await page.screenshot({ path: path.join(QA_DIR, '04_ur_well_shelter.png') });
  console.log('  ✓ 캡처 4: 04_ur_well_shelter.png (서쪽 우물과 종려나무 쉼터, 롯과의 대면)');

  // 5. 공방 안으로 들어가기
  await page.keyboard.down('KeyD');
  await sleep(1800);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await sleep(1800);
  await page.keyboard.up('KeyW');
  await sleep(600);
  await page.screenshot({ path: path.join(QA_DIR, '05_workshop_idols.png') });
  console.log('  ✓ 캡처 5: 05_workshop_idols.png (데라의 공방 내부와 우상들)');

  await browser.close();
  console.log('[QA] 1권 스크린샷 5종 캡처 완료! docs/qa/book1/');
}

runQa().catch((err) => {
  console.error('[QA Failed]', err);
  process.exit(1);
});
