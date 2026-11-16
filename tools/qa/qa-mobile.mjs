#!/usr/bin/env node
/**
 * 모바일 터치 QA (에뮬레이션): 모바일 뷰포트 + 터치 입력으로
 *  1) 터치 UI(스틱·행동·달리기·장 선택·도감·메뉴·왼쪽 위 도움말)가 보이는지
 *  2) 단추를 '탭'해서 도움말·장 선택·일시정지 메뉴가 실제로 열리고 닫히는지
 * 를 단언하고 docs/qa/mobile/ 에 스크린샷을 남긴다. (실제 기기 QA 를 대신하지는 않는다 — 에뮬레이션이다.)
 *
 * 개발 서버가 떠 있어야 한다 (window.__AGY_DEBUG__ 로 HUD 상태를 읽는다): PORT=5174 node tools/qa/qa-mobile.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/qa/mobile');
fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const launch = { headless: true, args: ['--no-sandbox'] };
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH; else launch.channel = 'chrome';

const ready = (pg) => pg.waitForFunction(() => window.__AGY_DEBUG__ && window.__abraham, { timeout: 20000 }).catch(() => null);
const failures = [];
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) failures.push(msg); };

const browser = await puppeteer.launch(launch);
try {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // 가로 모드 폰 (iPhone 계열 크기), 터치·모바일 에뮬레이션
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('abraham.help.seen.v1', '1'); } catch { /* 저장소 없음 */ } });
  await page.goto(`http://localhost:${PORT}/?touch=1`, { waitUntil: 'domcontentloaded' });
  await ready(page); await sleep(1500);
  // 인트로 컷신을 넘겨 조작 가능한 상태로
  await page.evaluate(() => window.__abraham && window.__abraham.skipCutscenes());
  await sleep(500);

  const tapEl = async (sel, label) => {
    const box = await page.evaluate((s) => {
      const el = document.querySelector(s); if (!el) return null;
      const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    }, sel);
    if (!box) { check(false, `${label}: 단추 요소를 찾지 못함 (${sel})`); return false; }
    await page.touchscreen.tap(box.x, box.y);
    await sleep(500);
    return true;
  };
  const tapElOn = async (pg, sel) => {
    const box = await pg.evaluate((q) => { const el = document.querySelector(q); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
    if (!box) { check(false, `단추 요소를 찾지 못함 (${sel})`); return; }
    await pg.touchscreen.tap(box.x, box.y); await sleep(500);
  };
  const hudState = () => page.evaluate(() => {
    const h = window.__AGY_DEBUG__ && window.__AGY_DEBUG__.hud;
    return h ? { help: !!h.help.open, chapter: !!h.chapterSelect.open, pause: !!h.pauseMenu.open, codex: !!h.codex.open } : null;
  });

  console.log('[모바일 QA] 터치 UI 표시');
  const visible = await page.evaluate(() => {
    const names = ['abraham-act', 'abraham-help', 'abraham-g0', 'abraham-g1', 'abraham-g2', 'abraham-g3', 'abraham-stick'];
    const out = {};
    for (const n of names) { const el = document.querySelector('.' + n); out[n] = !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== 'none'; }
    return out;
  });
  for (const [n, ok] of Object.entries(visible)) check(ok, `터치 요소 .${n} 가 보인다`);
  await page.screenshot({ path: path.join(OUT, 'mobile1_touch_ui.png') });

  console.log('[모바일 QA] 탭으로 메뉴 열기');
  let st = await hudState();
  check(st !== null, 'HUD 상태를 읽을 수 있다 (개발 서버)');
  if (st) {
    await tapEl('.abraham-help', '도움말');
    st = await hudState(); check(st.help, '도움말 단추를 탭하면 도움말이 열린다');
    await page.screenshot({ path: path.join(OUT, 'mobile2_help.png') });
    await page.touchscreen.tap(422, 195); await sleep(500);
    st = await hudState(); check(!st.help, '도움말 화면을 탭하면 닫힌다');

    // 진행 표시(✓·지금까지 한 선택)가 모바일 장 선택에도 보이는지 증거를 남긴다 — 개발 훅으로 진행을 채워 넣는다
    await page.evaluate(() => window.__abraham.setProgress(['1:2', '1:6'], { palace_answer: '담대히 선포', haran_depart: '아버지를 기리며' }));
    await tapEl('.abraham-g1', '장 선택');
    st = await hudState(); check(st.chapter, '장 선택 단추를 탭하면 권/장 선택이 열린다');
    await page.screenshot({ path: path.join(OUT, 'mobile3_chapter_select.png') });
    // 화면 위 ✕ 단추를 탭해 닫는다 (패널 오른쪽 위, 터치에는 Esc 가 없다)
    const closeBox = await page.evaluate(() => { const r = window.__AGY_DEBUG__.hud.chapterCloseRect; const c = document.querySelector('canvas'); const b = c.getBoundingClientRect(); const s = b.width / window.__AGY_DEBUG__.hud.uiW; return { x: b.x + (r.x + r.w / 2) * s, y: b.y + (r.y + r.h / 2) * s }; });
    await page.touchscreen.tap(closeBox.x, closeBox.y); await sleep(400);
    st = await hudState(); check(!st.chapter, '장 선택의 ✕ 단추를 탭하면 닫힌다');

    await tapEl('.abraham-g3', '메뉴');
    st = await hudState(); check(st.pause, '메뉴 단추를 탭하면 일시정지 메뉴가 열린다');
    await page.screenshot({ path: path.join(OUT, 'mobile4_pause.png') });
  }

  // ── 첫 플레이 흐름 (입력 장치 하나만으로): 컷신을 넘기고 → 안내 표식 쪽으로 걸어가 → 상호작용 프롬프트가 뜨면 → 행동으로 대화를 연다 ──
  // 안내 표식(hud.targetMarker)은 게임이 '지금 할 일'로 가리키는 곳이다. 표식까지의 방향으로 스틱(터치)·방향키(키보드)를 조종한다.
  const walkToFirstInteraction = async (pg, mode) => {
    const read = () => pg.evaluate(() => {
      const d = window.__AGY_DEBUG__, p = d.sceneCtx.player.root.position, m = d.hud.targetMarker;
      return { x: p.x, z: p.z, tx: m ? m.x : null, tz: m ? m.z : null, prompt: !!d.hud.promptOn, talking: !!d.hud.dialogue };
    });
    let stick = null, touch = null, keys = new Set();
    if (mode === 'touch') stick = await pg.evaluate(() => { const r = document.querySelector('.abraham-stick').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r: r.width / 2 }; });
    const setKeys = async (want) => {
      for (const k of [...keys]) if (!want.has(k)) { await pg.keyboard.up(k); keys.delete(k); }
      for (const k of want) if (!keys.has(k)) { await pg.keyboard.down(k); keys.add(k); }
    };
    let st = await read();
    const t0 = Date.now();
    try {
      while (!st.prompt && Date.now() - t0 < 25000) {
        if (st.talking) {
          // 장 시작 대사(요약 내레이션)가 먼저 나오면 그 입력 수단으로 넘긴다 — 터치는 행동 단추, 키보드는 E
          await setKeys(new Set());
          if (touch) { await touch.end(); touch = null; }
          if (mode === 'touch') { const b = await pg.evaluate(() => { const r = document.querySelector('.abraham-act').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await pg.touchscreen.tap(b.x, b.y); } else await pg.keyboard.press('KeyE');
          await sleep(350); st = await read(); continue;
        }
        if (st.tx === null) { await sleep(200); st = await read(); continue; }
        const dx = st.tx - st.x, dz = st.tz - st.z, d = Math.hypot(dx, dz);
        if (mode === 'touch') {
          const kx = stick.x + (dx / d) * stick.r * 0.8, ky = stick.y + (dz / d) * stick.r * 0.8;
          if (!touch) { touch = await pg.touchscreen.touchStart(stick.x, stick.y); }
          await touch.move(kx, ky);
        } else {
          const want = new Set();
          if (dx > 0.5 * Math.abs(dz) && Math.abs(dx) > 0.3) want.add('KeyD'); else if (dx < -0.5 * Math.abs(dz) && Math.abs(dx) > 0.3) want.add('KeyA');
          if (dz > 0.5 * Math.abs(dx) && Math.abs(dz) > 0.3) want.add('KeyS'); else if (dz < -0.5 * Math.abs(dx) && Math.abs(dz) > 0.3) want.add('KeyW');
          await setKeys(want);
        }
        await sleep(120);
        st = await read();
      }
    } finally {
      if (touch) await touch.end();
      await setKeys(new Set());
    }
    return st;
  };
  const dialogueOpens = async (pg, mode) => {
    const reached = await walkToFirstInteraction(pg, mode);
    check(reached.prompt, `${mode === 'touch' ? '터치(스틱)' : '키보드'}만으로 안내 표식까지 걸어가 상호작용 프롬프트가 뜬다${reached.prompt ? '' : ' ' + JSON.stringify(reached)}`);
    if (!reached.prompt) return;
    if (mode === 'touch') await tapElOn(pg, '.abraham-act'); else { await pg.keyboard.press('KeyE'); await sleep(500); }
    let opened = false;
    for (let i = 0; i < 10 && !opened; i++) { opened = await pg.evaluate(() => !!window.__AGY_DEBUG__.hud.dialogue || !!window.__AGY_DEBUG__.hud.activeDialogue); if (!opened) await sleep(200); }
    check(opened, `${mode === 'touch' ? '행동 단추 탭' : 'E 키'}으로 첫 상호작용(대화)이 열린다`);
    if (opened && mode === 'touch') {
      await pg.screenshot({ path: path.join(OUT, 'mobile7_first_interaction_touch.png') });
      // 대사는 행동 단추 탭만으로 끝까지 넘어간다 (최대 60번)
      let closed = false;
      for (let i = 0; i < 60 && !closed; i++) {
        await tapElOn(pg, '.abraham-act');
        closed = await pg.evaluate(() => !window.__AGY_DEBUG__.hud.dialogue && !window.__AGY_DEBUG__.hud.choice);
      }
      const left = closed ? null : await pg.evaluate(() => { const h = window.__AGY_DEBUG__.hud; return { d: h.dialogue, a: !!h.activeDialogue, c: !!h.choice }; });
      check(closed, `행동 단추 탭만으로 대화를 끝까지 넘길 수 있다${left ? ' ' + JSON.stringify(left).slice(0, 160) : ''}`);
    }
  };
  console.log('[모바일 QA] 첫 플레이 흐름: 터치만');
  {
    const tp = await ctx.newPage();
    tp.on('pageerror', (e) => errors.push(e.message));
    await tp.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await tp.evaluateOnNewDocument(() => { try { localStorage.setItem('abraham.help.seen.v1', '1'); } catch { /* 저장소 없음 */ } });
    await tp.goto(`http://localhost:${PORT}/?touch=1`, { waitUntil: 'domcontentloaded' });
    await ready(tp); await sleep(1500);
    await tp.evaluate(() => window.__abraham && window.__abraham.skipCutscenes());
    await sleep(800);
    await dialogueOpens(tp, 'touch');
    await tp.close();
  }
  console.log('[모바일 QA] 첫 플레이 흐름: 키보드만');
  {
    const kb = await ctx.newPage();
    kb.on('pageerror', (e) => errors.push(e.message));
    await kb.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await kb.evaluateOnNewDocument(() => { try { localStorage.setItem('abraham.help.seen.v1', '1'); } catch { /* 저장소 없음 */ } });
    await kb.goto(`http://localhost:${PORT}/?touch=0`, { waitUntil: 'domcontentloaded' });
    await ready(kb); await sleep(1500);
    await kb.evaluate(() => window.__abraham && window.__abraham.skipCutscenes());
    await sleep(800);
    await dialogueOpens(kb, 'keyboard');
    await kb.close();
  }

  // 세로(포트레이트)·짧은 화면: 터치 단추·패널이 화면 안에 있고 서로 겹치지 않는지 (iPhone 세로 390x844)
  console.log('[모바일 QA] 세로 화면');
  const portrait = await ctx.newPage();
  portrait.on('pageerror', (e) => errors.push(e.message));
  await portrait.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await portrait.evaluateOnNewDocument(() => { try { localStorage.setItem('abraham.help.seen.v1', '1'); } catch { /* 저장소 없음 */ } });
  await portrait.goto(`http://localhost:${PORT}/?touch=1`, { waitUntil: 'domcontentloaded' });
  await ready(portrait); await sleep(1500);
  await portrait.evaluate(() => window.__abraham && window.__abraham.skipCutscenes());
  await sleep(500);
  await portrait.screenshot({ path: path.join(OUT, 'mobile5_portrait_ui.png') });
  const overlaps = await portrait.evaluate(() => {
    const names = ['abraham-act', 'abraham-help', 'abraham-g0', 'abraham-g1', 'abraham-g2', 'abraham-g3', 'abraham-stick'];
    const rs = [];
    for (const n of names) { const el = document.querySelector('.' + n); if (el) { const r = el.getBoundingClientRect(); if (r.width > 0) rs.push({ n, x: r.x, y: r.y, w: r.width, h: r.height }); } }
    const bad = [];
    for (const r of rs) if (r.x < -1 || r.y < -1 || r.x + r.w > innerWidth + 1 || r.y + r.h > innerHeight + 1) bad.push(`${r.n} 화면 밖`);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      if (a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1) bad.push(`${a.n} ↔ ${b.n} 겹침`);
    }
    return bad;
  });
  check(overlaps.length === 0, `세로 화면에서 터치 단추가 화면 안에 있고 겹치지 않는다${overlaps.length ? ' (' + overlaps.join(', ') + ')' : ''}`);
  await portrait.evaluate(() => window.__abraham.setProgress(['1:2'], {}));
  await tapElOn(portrait, '.abraham-g1');
  const pst = await portrait.evaluate(() => { const h = window.__AGY_DEBUG__.hud; const p = h.chapterPanelRect; return { open: !!h.chapterSelect.open, x: p.x, w: p.w, uiW: h.uiW }; });
  check(pst.open, '세로 화면에서도 장 선택이 열린다');
  check(pst.x >= 0 && pst.x + pst.w <= pst.uiW + 1, `세로 화면의 장 선택 패널이 화면 안에 있다 (x=${Math.round(pst.x)}, w=${Math.round(pst.w)}, ui=${Math.round(pst.uiW)})`);
  await portrait.screenshot({ path: path.join(OUT, 'mobile6_portrait_chapter_select.png') });
  await portrait.close();

  // 세로 화면 구도: 플레이어가 위쪽-가운데에 오고(아래 약 40% 는 조작·대화 몫), 가로로 14~16 유닛이 보인다. 390x844 와 작은 360x640 두 크기 모두
  for (const [vw, vh, tag] of [[390, 844, '390x844'], [360, 640, '360x640']]) {
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => errors.push(e.message));
    await pg.setViewport({ width: vw, height: vh, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('abraham.help.seen.v1', '1'); } catch { /* 저장소 없음 */ } });
    await pg.goto(`http://localhost:${PORT}/?touch=1`, { waitUntil: 'domcontentloaded' });
    await ready(pg); await sleep(1500);
    await pg.evaluate(() => window.__abraham && window.__abraham.skipCutscenes());
    await sleep(800);
    const f = await pg.evaluate(() => {
      const d = window.__AGY_DEBUG__, r = d.sceneCtx.renderer, p = d.sceneCtx.player.root.position;
      const sp = d.hud.project(p.x, 0, p.z);
      return { fy: sp.y / d.hud.uiH, fx: sp.x / d.hud.uiW, framing: r && r.viewFraming, ppu: r && r.size ? r.size.ppu : null, w: r && r.size ? r.size.w : null };
    });
    const units = f.ppu && f.w ? (f.w / f.ppu) * f.framing : 0;
    check(f.fy > 0.2 && f.fy < 0.5, `세로 ${tag}: 플레이어가 화면 위쪽-가운데에 있다 (위에서 ${(f.fy * 100).toFixed(0)}%)`);
    check(units >= 13 && units <= 17, `세로 ${tag}: 가로로 약 ${units.toFixed(1)} 유닛이 보인다 (14~16 목표)`);
    await pg.screenshot({ path: path.join(OUT, `mobile8_portrait_${tag}_play.png`) });
    // 장 시작 요약 대사가 떠 있으면 행동 단추로 먼저 넘긴다 (시험용 대사와 겹쳐 찍히지 않게)
    for (let i = 0; i < 60 && await pg.evaluate(() => !!window.__AGY_DEBUG__.hud.dialogue); i++) await tapElOn(pg, '.abraham-act');
    // 대사: 행동 단추로 첫 상호작용을 열어, 대사창 높이가 화면의 약 28% 이하인지 본다 (장 시작 요약 대사가 이미 떠 있을 수 있다)
    await pg.evaluate(() => window.__AGY_DEBUG__.hud.showDialogue('아브람', '여호와께서 내게 말씀하셨다. 너는 네 고향과 친척과 아버지의 집을 떠나 내가 네게 보여 줄 땅으로 가라. 내가 너를 큰 민족이 되게 하리라.', 30));
    await sleep(700);
    const dh = await pg.evaluate(() => { const h = window.__AGY_DEBUG__.hud; return h.dialogueRect.h > 0 ? { y: h.dialogueRect.y, h: h.dialogueRect.h, uiH: h.uiH } : null; });
    await pg.screenshot({ path: path.join(OUT, `mobile9_portrait_${tag}_dialogue.png`) });
    if (dh) check(dh.h <= dh.uiH * 0.28 + 1, `세로 ${tag}: 대사창이 화면 높이의 28% 이하 (${((dh.h / dh.uiH) * 100).toFixed(0)}%)`);
    await pg.evaluate(() => window.__abraham.setProgress(['1:2'], {}));
    await tapElOn(pg, '.abraham-g1');
    await pg.screenshot({ path: path.join(OUT, `mobile10_portrait_${tag}_chapter.png`) });
    await pg.close();
  }
  check(errors.length === 0, `콘솔/페이지 오류 0건 (${errors.length}건${errors[0] ? ': ' + errors[0].slice(0, 80) : ''})`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n[모바일 QA 실패] ${failures.length}건`);
  process.exit(1);
}
console.log('\n[모바일 QA 성공] 스크린샷: docs/qa/mobile/');
