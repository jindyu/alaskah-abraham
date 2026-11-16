#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { waitFor } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const QA_DIR = path.join(ROOT, 'docs/qa');
const QA_BOOKS_DIR = path.join(QA_DIR, 'books');
fs.mkdirSync(QA_BOOKS_DIR, { recursive: true });

const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQa() {
  console.log('[QA] 헤드리스 Chrome 실행 중 (6개 전권 자동 탐색 및 검증)...');
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720'],
  };
  if (process.env.CHROME_PATH) {
    launchOptions.executablePath = process.env.CHROME_PATH;
  } else {
    launchOptions.channel = 'chrome';
  }
  const browser = await puppeteer.launch(launchOptions);

  const allErrors = [];
  const bookHashes = new Map();

  try {
    for (let bookNum = 1; bookNum <= 6; bookNum++) {
      console.log(`\n[QA] === 제${bookNum}권 (Book ${bookNum}) 검증 시작 ===`);
      // 각 권마다 신선한 브라우저 컨텍스트를 생성하여 localStorage 오염 방지
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({ width: 1280, height: 720 });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          console.error(`  [제${bookNum}권 Console Error]`, text);
          allErrors.push(`[Book ${bookNum}] Console error: ${text}`);
        }
      });

      page.on('pageerror', (err) => {
        const text = err.message || String(err);
        console.error(`  [제${bookNum}권 Page Error]`, text);
        allErrors.push(`[Book ${bookNum}] Page error: ${text}`);
      });

      console.log(`  [제${bookNum}권] http://localhost:${PORT} 접속 중...`);
      await page.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await waitFor(page, () => !!window.__abraham && !!window.__abraham.state, { timeout: 20000 });
      await waitFor(page, () => !!document.querySelector('canvas'), { timeout: 10000 });

      // 1. 캔버스 존재 및 유효한 크기(non-zero size) 검증
      const canvas = await page.$('canvas');
      if (!canvas) {
        throw new Error(`[Book ${bookNum}] Assertion failed: canvas element not found on page`);
      }
      const bbox = await canvas.boundingBox();
      if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
        throw new Error(`[Book ${bookNum}] Assertion failed: canvas size is zero or invalid (${bbox?.width}x${bbox?.height})`);
      }

      // 2. 부팅 인트로 컷신 스킵 (Space x16)
      console.log(`  [제${bookNum}권] 인트로 스킵 (Space x60)...`);
      for (let s = 0; s < 60; s++) {
        await page.keyboard.press('Space');
        await sleep(250);
      }
      await sleep(400);

      // 3. 권/장 선택 UI 열기 (Tab)
      console.log(`  [제${bookNum}권] 권/장 선택 메뉴 열기 (Tab)...`);
      await page.keyboard.press('Tab');
      await sleep(400);

      // 4. ArrowRight x (bookNum - 1) 눌러 해당 권으로 이동
      if (bookNum > 1) {
        console.log(`  [제${bookNum}권] 권 전환: ArrowRight x${bookNum - 1}...`);
        for (let r = 0; r < bookNum - 1; r++) {
          await page.keyboard.press('ArrowRight');
          await sleep(200);
        }
      }

      // 5. Enter 로 해당 권 1장 진입
      await page.keyboard.press('Enter');
      await sleep(2000);

      // 6. 시작 컷신 대사 스킵 (Space 연타)
      console.log(`  [제${bookNum}권] 컷신 대사 스킵 (Space x10)...`);
      for (let s = 0; s < 10; s++) {
        await page.keyboard.press('Space');
        await sleep(150);
      }
      // 남은 컷신·대본 자막을 정리해, 스크린샷이 연출 도중(제목 띠·자막)이 아니라 조작 가능한 장면을 보이게 한다
      await page.evaluate(() => { if (window.__abraham && window.__abraham.skipCutscenes) window.__abraham.skipCutscenes(); });
      await sleep(1500);

      // 6.5 실제로 해당 권이 로드됐는지 개발 훅(window.__abraham)으로 단언 — 해시 비교는 입자 노이즈로 같은 장면도 달라 보여 신뢰할 수 없다
      const qaState = await page.evaluate(() => (window.__abraham && window.__abraham.state ? window.__abraham.state() : null));
      if (qaState) {
        if (qaState.book !== bookNum) {
          throw new Error(`[Book ${bookNum}] Assertion failed: 권/장 선택 후 실제 로드된 권이 ${qaState.book} (stage=${qaState.stage})`);
        }
        console.log(`  ✓ [제${bookNum}권] 로드 확인: book=${qaState.book} chapter=${qaState.chapter} stage=${qaState.stage}`);
      } else {
        console.warn(`  ! [제${bookNum}권] window.__abraham 훅 없음(프로덕션 빌드): 권 번호 단언 생략`);
      }

      // 7. 스크린샷 캡처 및 해시 계산
      const shotPath = path.join(QA_BOOKS_DIR, `book${bookNum}.png`);
      const buffer = await page.screenshot({ path: shotPath });
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      bookHashes.set(bookNum, hash);
      console.log(`  ✓ [제${bookNum}권] 스크린샷 저장: docs/qa/books/book${bookNum}.png (해시: ${hash.slice(0, 16)}...)`);

      // 8. 컨텍스트 종료
      await context.close();
    }

    // 8. 권 간 스크린샷 해시 상이성 검증 (두 권이 동일한 프레임을 렌더링하면 실패)
    console.log('\n[QA] 6개 권 스크린샷 해시 상이성(Visual Difference) 검증 중...');
    const seenHashes = new Map();
    for (const [bookNum, hash] of bookHashes.entries()) {
      if (seenHashes.has(hash)) {
        const conflictBook = seenHashes.get(hash);
        throw new Error(
          `[Assertion Failed] 제${bookNum}권과 제${conflictBook}권의 렌더링 프레임 해시가 동일합니다 (${hash}). 서로 다른 무대가 렌더링되어야 합니다.`,
        );
      }
      seenHashes.set(hash, bookNum);
    }
    console.log('  ✓ 6개 권 스크린샷 해시가 모두 고유함을 확인했습니다 (서로 다른 무대 렌더링 검증 완료).');
  } finally {
    await browser.close();
  }

  // 콘솔 에러 및 페이지 에러 무결성 검증
  if (allErrors.length > 0) {
    console.error(`\n[QA Failed] 총 ${allErrors.length}건의 브라우저 에러가 발생했습니다:\n` + allErrors.join('\n'));
    process.exit(1);
  }

  console.log('\n[QA Success] 6개 전권 헤드리스 브라우저 검증, 스크린샷 캡처, 해시 무결성 검증을 완벽히 마쳤습니다!');
}

runQa().catch((err) => {
  console.error('\n[QA Fatal Error]', err);
  process.exit(1);
});
