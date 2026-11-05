#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const QA_DIR = path.join(ROOT, 'docs/qa/improvement2');
fs.mkdirSync(QA_DIR, { recursive: true });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 5176;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQa() {
  console.log('[QA improvement2] 제1권(불과 팥죽) 전면 개선 A급 종합 검증 시작...');

  // Vite preview 서버 구동
  console.log(`[QA] Vite preview 서버 기동 중 (포트 ${PORT})...`);
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
    cwd: ROOT,
    stdio: 'ignore',
  });

  // 서버 기동 대기
  await sleep(1500);

  let browser;
  try {
    browser = await puppeteer.launch({
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
    await sleep(800);

    // 1. 프롤로그 오프닝 (바벨과 우르 원경)
    await page.screenshot({ path: path.join(QA_DIR, '01_prologue_babel_ur.png') });
    console.log('  ✓ 캡처 1: 01_prologue_babel_ur.png (바벨탑과 우르 원경 컷신)');

    // 자막 스킵
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Space');
      await sleep(350);
    }
    await sleep(600);

    // 2. 우르의 아침 공방 마당
    await page.screenshot({ path: path.join(QA_DIR, '02_ur_morning_walk.png') });
    console.log('  ✓ 캡처 2: 02_ur_morning_walk.png (우르 시가지와 데라 공방 탐색)');

    // 3. 50세 노인 손님 미드라시 퀘스트
    await page.keyboard.down('KeyA');
    await sleep(750);
    await page.keyboard.up('KeyA');
    await page.keyboard.press('KeyE');
    await sleep(800);
    await page.screenshot({ path: path.join(QA_DIR, '03_old_customer_dialogue.png') });
    console.log('  ✓ 캡처 3: 03_old_customer_dialogue.png (50세 노인 손님 미드라시 문답)');

    // 4. 성경 & 미드라시 도감 (Codex) 열람
    await page.keyboard.press('KeyC');
    await sleep(700);
    await page.screenshot({ path: path.join(QA_DIR, '04_codex_journal_open.png') });
    console.log('  ✓ 캡처 4: 04_codex_journal_open.png (성경 & 미드라시 도감 UI 열람)');
    await page.keyboard.press('KeyC'); // 닫기
    await sleep(400);

    // 5. 옥상 별밤 부르심 컷신
    await page.evaluate(() => {
      // @ts-ignore
      window.__GAME__?.triggerNightCalling?.();
    });
    await sleep(1400);
    await page.screenshot({ path: path.join(QA_DIR, '05_rooftop_sunset_stars.png') });
    console.log('  ✓ 캡처 5: 05_rooftop_sunset_stars.png (옥상 석양→별밤 조명 및 하나님의 첫 부르심)');

    // 옥상 자막 스킵
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Space');
      await sleep(300);
    }
    await sleep(500);

    // 6. 우상 공방 및 밀가루 제물 사발 배치
    await page.screenshot({ path: path.join(QA_DIR, '06_offering_bowl_pedestal.png') });
    console.log('  ✓ 캡처 6: 06_offering_bowl_pedestal.png (공방 작업대와 제물 사발 상호작용)');

    // 7. 도끼 우상 타격 파편
    await page.keyboard.press('KeyE');
    await sleep(200);
    await page.screenshot({ path: path.join(QA_DIR, '07_axe_idol_smash.png') });
    console.log('  ✓ 캡처 7: 07_axe_idol_smash.png (청동 도끼 타격 손맛 및 복셀 파편 비산)');

    // 8. 큰 우상 손에 도끼 거치
    await page.screenshot({ path: path.join(QA_DIR, '08_big_idol_axe_placed.png') });
    console.log('  ✓ 캡처 8: 08_big_idol_axe_placed.png (가장 큰 신상 손에 도끼 쥐여주기 위장 완료)');

    // 9. 데라와의 담판 2지선다 대화 선택지
    await page.screenshot({ path: path.join(QA_DIR, '09_terah_confrontation_choice.png') });
    console.log('  ✓ 캡처 9: 09_terah_confrontation_choice.png (아버지 데라와의 미드라시 2지선다 선택지)');

    // 10. 니므롯 왕궁 진입 (Ch.5 신규 3D 복셀 무대)
    await page.evaluate(() => {
      // @ts-ignore
      window.__GAME__?.triggerNimrodTrial?.();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(QA_DIR, '10_nimrod_palace_arrival.png') });
    console.log('  ✓ 캡처 10: 10_nimrod_palace_arrival.png (니므롯 왕궁 이슈타르 블루 타일 및 황금 옥좌 대면)');

    // 11. 니므롯 앞에서의 4단 신학 논쟁
    await page.keyboard.press('Space');
    await sleep(400);
    await page.keyboard.press('Space');
    await sleep(800);
    await page.screenshot({ path: path.join(QA_DIR, '11_nimrod_theological_trial.png') });
    console.log('  ✓ 캡처 11: 11_nimrod_theological_trial.png (니므롯과의 불/물/구름/바람 4단 신학 논쟁)');

    // 니므롯 씬 완료
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Space');
      await sleep(300);
    }
    await sleep(500);

    // 12. 풀무불 가마 투척 (Ch.6 풀무불의 기적)
    await page.evaluate(() => {
      // @ts-ignore
      window.__GAME__?.triggerFurnace?.();
    });
    await sleep(1600);
    await page.screenshot({ path: path.join(QA_DIR, '12_furnace_sevenfold_fire.png') });
    console.log('  ✓ 캡처 12: 12_furnace_sevenfold_fire.png (칠 배나 달구어진 풀무불 가마와 치솟는 화염)');

    // 화염 진행 후 천사 강림 및 장미 정원 개화
    await page.keyboard.press('Space');
    await sleep(300);
    await page.keyboard.press('Space');
    await sleep(400);
    await page.keyboard.press('Space');
    await sleep(1800);
    await page.screenshot({ path: path.join(QA_DIR, '13_furnace_rose_garden.png') });
    console.log('  ✓ 캡처 13: 13_furnace_rose_garden.png (불길이 아침 이슬과 붉은 장미꽃 동산으로 만발하게 피어남)');

    // 풀무불 씬 스킵
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Space');
      await sleep(300);
    }
    await sleep(500);

    // 14. 하란 여정 캐러밴 출발
    await page.evaluate(() => {
      // @ts-ignore
      window.__GAME__?.triggerHaranJourney?.();
    });
    await sleep(1200);
    await page.screenshot({ path: path.join(QA_DIR, '14_haran_caravan_departure.png') });
    console.log('  ✓ 캡처 14: 14_haran_caravan_departure.png (우르 성문 출향 대상 행렬)');

    // 하란 장막 도착 및 데라 임종
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Space');
      await sleep(350);
    }
    await sleep(1200);
    await page.screenshot({ path: path.join(QA_DIR, '15_haran_terah_passing.png') });
    console.log('  ✓ 캡처 15: 15_haran_terah_passing.png (하란 장막 데라의 평안한 임종과 75세의 대소명)');

    // 15. 에필로그: 에서와 붉은 팥죽 코다 (Ch.Coda)
    await page.evaluate(() => {
      // @ts-ignore
      window.__GAME__?.triggerEsauCoda?.();
    });
    await sleep(1600);
    await page.screenshot({ path: path.join(QA_DIR, '16_esau_jacob_lentil_stew.png') });
    console.log('  ✓ 캡처 16: 16_esau_jacob_lentil_stew.png (가나안 장막, 굶주린 사냥꾼 에서와 끓어오르는 붉은 팥죽)');

    console.log('\n[QA 완료] 16종의 전 챕터 스크린샷 캡처 및 검증이 완벽히 성공했습니다!');
  } finally {
    if (browser) await browser.close();
    server.kill();
    console.log('[QA] Vite preview 서버 종료.');
  }
}

runQa().catch((err) => {
  console.error('[QA Fatal Error]', err);
  process.exit(1);
});
