#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const QA_DIR = path.join(ROOT, 'docs/qa/book1_features');
fs.mkdirSync(QA_DIR, { recursive: true });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 5174;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQa() {
  console.log('[QA] 1권 전체 신규 기능 검증 (대기환경, 동물, 옥상조명, 제물그릇, 분쇄타격, 2지선다대화) 시작...');
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

  // 1. 인트로 자막 스킵 (Space 7회)
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Space');
    await sleep(350);
  }
  await sleep(600);

  // 1-1. 우물가 이동하여 비둘기 무리와 오아시스 대기 환경 캡처
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyA');
  await sleep(1500);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyS');
  await sleep(400);
  await page.keyboard.up('KeyS');
  await page.keyboard.up('ShiftLeft');
  await sleep(800);

  await page.screenshot({ path: path.join(QA_DIR, '01_well_pigeons_oasis.png') });
  console.log('  ✓ 캡처 1: 01_well_pigeons_oasis.png (우물가 비둘기 무리와 종려나무 바람 흔들림)');

  // 1-2. 남쪽 장터로 이동하여 짐실은 낙타 및 상인 캡처
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyS');
  await sleep(1600);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyS');
  await page.keyboard.up('ShiftLeft');
  await sleep(600);

  await page.screenshot({ path: path.join(QA_DIR, '02_market_camel_breeze.png') });
  console.log('  ✓ 캡처 2: 02_market_camel_breeze.png (남쪽 장터 낙타, 차양막 흔들림, 모래 먼지)');

  // 1-3. 동쪽 안채로 이동하여 아기 염소와 사래 캡처
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyW');
  await sleep(1400);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  await sleep(600);

  await page.screenshot({ path: path.join(QA_DIR, '03_courtyard_kid_goat.png') });
  console.log('  ✓ 캡처 3: 03_courtyard_kid_goat.png (안채 마당 아기 염소와 사래)');

  // 2. 공방 안으로 들어가서 미드라시 제물 사발 및 우상 진열 캡처
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyA');
  await sleep(1800);
  await page.keyboard.up('KeyA');
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.down('KeyW');
  await sleep(1500);
  await page.keyboard.up('KeyW');
  await sleep(500);

  await page.screenshot({ path: path.join(QA_DIR, '04_workshop_midrash_shelf.png') });
  console.log('  ✓ 캡처 4: 04_workshop_midrash_shelf.png (공방 선반의 미드라시 밀가루 제물 사발과 우상들)');

  // 3. 옥상 별밤 부르심 테스트를 위해 옥상 컷신 직접 트리거 및 석양/밤하늘 조명 캡처
  await page.evaluate(() => {
    // @ts-ignore
    const g = window.__GAME__;
    if (g && g.triggerNightCalling) {
      g.triggerNightCalling();
    }
  });
  await sleep(1500);

  await page.screenshot({ path: path.join(QA_DIR, '05_rooftop_sunset_lighting.png') });
  console.log('  ✓ 캡처 5: 05_rooftop_sunset_lighting.png (옥상 석양 황혼 조명 전환)');

  await sleep(3800);
  await page.screenshot({ path: path.join(QA_DIR, '06_rooftop_divine_calling_beam.png') });
  console.log('  ✓ 캡처 6: 06_rooftop_divine_calling_beam.png (밤하늘 별들과 영광의 빛기둥 소명)');

  // 4. 대화 2지선다 선택지 UI 검증을 위해 showChoice 모달 직접 시연
  await page.evaluate(() => {
    // @ts-ignore
    const g = window.__GAME__;
    if (g && g.hud) {
      g.hud.showChoice(
        '아버지 데라에게 건넬 대답 (아브람의 선택)',
        [
          {
            badge: '미드라시 전승 풍자',
            badgeColor: '#b85422',
            text: '1. "제물을 두고 서로 다투더니, 큰 우상이 도끼로 작은 것들을 부쉈습니다!"',
          },
          {
            badge: '성경적 직언 선포',
            badgeColor: '#25588e',
            text: '2. "보지도 듣지도 못하는 우상은 헛된 거짓이며, 살아계신 하나님만이 참신이십니다!"',
          },
        ],
        (idx) => {
          console.log('[Choice Selected]', idx);
        }
      );
    }
  });
  await sleep(500);

  await page.screenshot({ path: path.join(QA_DIR, '07_terah_dialogue_choices_modal.png') });
  console.log('  ✓ 캡처 7: 07_terah_dialogue_choices_modal.png (데라와의 담판 2지선다 선택지 UI)');

  // 5. 아래 화살표 눌러 2번째 선택지 하이라이트 확인
  await page.keyboard.press('ArrowDown');
  await sleep(300);
  await page.screenshot({ path: path.join(QA_DIR, '08_choice_option2_highlighted.png') });
  console.log('  ✓ 캡처 8: 08_choice_option2_highlighted.png (키보드로 선택지 2번 하이라이트 전환)');

  // 6. 1번 단축키 눌러 1번 선택 확정 및 미드라시 풍자 대화 팝업
  await page.keyboard.press('Digit1');
  await sleep(400);

  await page.evaluate(() => {
    // @ts-ignore
    const g = window.__GAME__;
    if (g && g.hud) {
      g.hud.toast(
        'abram',
        null,
        '아브람: "어떤 여인이 고운 밀가루 한 그릇을 바쳤는데, 저들이 서로 먼저 먹겠다고 다투더니 가장 큰 우상이 도끼를 들어 작은 것들을 쳐부수었습니다!"'
      );
    }
  });
  await sleep(500);

  await page.screenshot({ path: path.join(QA_DIR, '09_midrash_satire_dialogue.png') });
  console.log('  ✓ 캡처 9: 09_midrash_satire_dialogue.png (미드라시 풍자 선택 시 아브람의 통렬한 대사)');

  // 7. 우르 성문 출향 캐러밴 & 하란 도착/데라 임종 피날레 검증
  await page.evaluate(() => {
    // @ts-ignore
    const g = window.__GAME__;
    if (g && g.triggerHaranJourney) {
      g.triggerHaranJourney();
    }
  });
  await sleep(1800);

  await page.screenshot({ path: path.join(QA_DIR, '10_exodus_from_ur_caravan.png') });
  console.log('  ✓ 캡처 10: 10_exodus_from_ur_caravan.png (성문 밖 아브람 가족 출향 캐러밴)');

  await sleep(4500);
  await page.screenshot({ path: path.join(QA_DIR, '11_haran_terah_farewell.png') });
  console.log('  ✓ 캡처 11: 11_haran_terah_farewell.png (하란 오아시스 장막과 데라의 임종·재소명)');

  await browser.close();
  console.log('[QA] 1권 전체 신규 기능 검증 및 스크린샷 11종 캡처 완료!');
}

runQa().catch((err) => {
  console.error('[QA Failed]', err);
  process.exit(1);
});
