#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const QA_DIR = path.join(ROOT, 'docs/qa/furnace');
fs.mkdirSync(QA_DIR, { recursive: true });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 5174;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQa() {
  console.log('[QA] 우르 풀무불 클라이맥스 씬 정밀 촬영 시작...');
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

  // 1. 인트로 자막 스킵
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Space');
    await sleep(250);
  }
  await sleep(600);

  // 2. 풀무불 컷신 트리거
  console.log('  -> 풀무불 기적 클라이맥스 트리거 실행');
  await page.evaluate(() => {
    if (window.__AGY_DEBUG__) {
      window.__AGY_DEBUG__.triggerFurnace();
    }
  });
  await sleep(1500); // 타이틀 카드 후 전경 오픈

  // 샷 1: 니므롯 왕실 테라스와 대면 심판
  await page.screenshot({ path: path.join(QA_DIR, '01_furnace_judgment.png') });
  console.log('  ✓ 캡처 1: 01_furnace_judgment.png (니므롯 왕실 테라스와 대면 심판)');

  // 다음 대사들로 전진
  const advanceTo = async (searchStr, maxPress = 10) => {
    for (let k = 0; k < maxPress; k++) {
      const cur = await page.evaluate(() => window.__AGY_DEBUG__?.cutscene?.caption?.text || '');
      if (cur.includes(searchStr)) return true;
      await page.keyboard.press('Space');
      await sleep(350);
    }
    return false;
  };

  // 샷 2: 투척 명령 및 불길 폭발
  await advanceTo('던져 넣어라');
  await sleep(1800); // 투척 애니메이션 및 폭발 완료 대기
  await page.screenshot({ path: path.join(QA_DIR, '02_hurled_into_inferno.png') });
  console.log('  ✓ 캡처 2: 02_hurled_into_inferno.png (가마 투척 및 맹렬한 화염 폭발)');

  // 샷 3: 천사 강림 및 결박 해방
  await advanceTo('하나님의 거룩한 천사');
  await sleep(1500);
  await page.screenshot({ path: path.join(QA_DIR, '03_angel_descent_wings.png') });
  console.log('  ✓ 캡처 3: 03_angel_descent_wings.png (복셀 날개와 후광을 두른 천사 강림)');

  // 샷 4: 장미꽃 동산 기적과 산책
  await advanceTo('향기로운 장미꽃');
  await sleep(2400); // 개화 및 산책 진행
  await page.screenshot({ path: path.join(QA_DIR, '04_rose_garden_miracle.png') });
  console.log('  ✓ 캡처 4: 04_rose_garden_miracle.png (장미꽃 동산과 맑은 시냇물의 기적)');

  // 샷 5: 니므롯의 공포와 전율
  await advanceTo('황금 홀을 떨어뜨렸다');
  await sleep(1200);
  await page.screenshot({ path: path.join(QA_DIR, '05_nimrod_terror_cower.png') });
  console.log('  ✓ 캡처 5: 05_nimrod_terror_cower.png (홀을 떨어뜨리고 전율하는 니므롯)');

  // 샷 6: 불길 밖 개선 및 퀘스트 완료 HUD
  await advanceTo('풀무불 밖으로');
  await sleep(2600); // 개선 행진
  await page.keyboard.press('Space'); // 바벨의 모든 권력 내레이션
  await sleep(400);
  await page.keyboard.press('Space'); // 아브람 출발 선언
  await sleep(400);
  await page.keyboard.press('Space'); // 컷신 종료 및 최종 HUD 축하 배너 발동!
  await sleep(1500);
  await page.screenshot({ path: path.join(QA_DIR, '06_abram_triumphant_exit.png') });
  console.log('  ✓ 캡처 6: 06_abram_triumphant_exit.png (불길 밖 개선 및 퀘스트 완료 HUD)');

  await browser.close();
  console.log('[QA] 풀무불 연출 6종 정밀 스크린샷 캡처 완료!');
}

runQa().catch((err) => {
  console.error('[QA Failed]', err);
  process.exit(1);
});
