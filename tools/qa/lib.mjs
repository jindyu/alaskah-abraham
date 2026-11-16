/**
 * QA 공용 도우미: 고정 sleep 대신 상태(window.__abraham.state())를 폴링하고, 이동·접속은 한 번 다시 시도한다.
 * 개발 서버(vite HMR)가 소스 변경으로 페이지를 새로 읽으면 "Execution context was destroyed" 가 나는데, 그것도 여기서 흡수한다.
 */
import puppeteer from 'puppeteer-core';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const COUNTS = { 1: 13, 2: 9, 3: 6, 4: 5, 5: 8, 6: 7 };
const TRANSIENT = /Execution context was destroyed|Cannot find context|Target closed|Session closed|detached Frame|Navigating frame was detached|Cannot read properties of undefined|__abraham is not defined|window\.__abraham/;

export function launchOptions(extra = {}) {
  const o = { headless: true, args: ['--no-sandbox', ...(extra.args ?? [])], protocolTimeout: extra.protocolTimeout ?? 90000 };
  if (process.env.CHROME_PATH) o.executablePath = process.env.CHROME_PATH; else o.channel = 'chrome';
  return o;
}

export const launch = (extra) => puppeteer.launch(launchOptions(extra));

/** 조건(page 안에서 평가되는 함수)이 참이 될 때까지 폴링. 시간 초과면 false */
export async function waitFor(page, fn, { timeout = 15000, interval = 100, args = [] } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if (await page.evaluate(fn, ...args)) return true;
    } catch (e) {
      if (!TRANSIENT.test(String(e))) throw e;
    }
    await sleep(interval);
  }
  return false;
}

/** page.evaluate 를 페이지 갱신(HMR)에 지더라도 몇 번 다시 */
export async function evalRetry(page, fn, ...args) {
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      return await page.evaluate(fn, ...args);
    } catch (e) {
      last = e;
      if (!TRANSIENT.test(String(e))) throw e;
      await waitFor(page, () => !!window.__abraham, { timeout: 20000 });
    }
  }
  throw last;
}

/** 게임을 열고 개발 훅이 생길 때까지 기다린다. 안 열리면 한 번 다시 goto */
export async function openGame(browser, port, { width = 960, height = 600, dpr = 1, init } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dpr });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('abraham.help.seen.v1', '1'); } catch { /* 저장소 없음 */ } });
  // 셰이더 컴파일 오류 등 콘솔 오류를 모아 둔다 (page.qaErrors)
  page.qaErrors = [];
  page.on('pageerror', (e) => page.qaErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') page.qaErrors.push(m.text()); });
  if (init) await page.evaluateOnNewDocument(init);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      if (attempt) throw e;
      continue;
    }
    if (await waitFor(page, () => !!window.__abraham && !!window.__abraham.state, { timeout: 20000 })) {
      await waitFrames(page, 3);
      return page;
    }
  }
  throw new Error('게임 개발 훅(window.__abraham)이 나타나지 않았다');
}

export const waitFrames = (page, n) => evalRetry(page, (k) => window.__abraham.frames(k), n);

/**
 * (book, chapter) 로 이동하고 정말 들어갔는지(state: 권·장 일치 + 무대 있음)를 폴링으로 확인한다.
 * 실패하면 페이지를 새로 열어 한 번 더. settle=true 면 컷신을 정리하고 몇 프레임 더 돌린다.
 * 돌려주는 값: 마지막 state (실패 시 ok=false 로 현재 state).
 */
export async function gotoChapter(page, book, chapter, { port, settle = true, timeout = 15000 } = {}) {
  const attemptOnce = async () => {
    await evalRetry(page, (b, c) => { window.__abraham.skipCutscenes(); window.__abraham.goto(b, c, true); }, book, chapter);
    const ok = await waitFor(page, (b, c) => { const s = window.__abraham.state(); return s.book === b && s.chapter === c && !!s.stage; }, { timeout, args: [book, chapter] });
    if (ok && settle) {
      await evalRetry(page, () => window.__abraham.skipCutscenes());
      await waitFrames(page, 20);
      // 컷신이 끝나며 장면이 바뀔 수 있으니 한 번 더 같은 장인지
      return waitFor(page, (b, c) => { const s = window.__abraham.state(); return s.book === b && s.chapter === c && !!s.stage; }, { timeout: 4000, args: [book, chapter] });
    }
    return ok;
  };
  let ok = await attemptOnce();
  if (!ok && port) {
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitFor(page, () => !!window.__abraham && !!window.__abraham.state, { timeout: 20000 });
    ok = await attemptOnce();
  } else if (!ok) {
    ok = await attemptOnce();
  }
  const st = await evalRetry(page, () => window.__abraham.state());
  return { ...st, ok };
}

/** 병합 관찰(45프레임)이 끝날 때까지 */
export const waitMerged = (page, timeout = 15000) => waitFor(page, () => window.__abraham.mergeReady(), { timeout });
