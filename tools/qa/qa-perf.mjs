#!/usr/bin/env node
/**
 * 성능 예산 QA: 장마다 한 번씩 들어가 (1) 드로우콜·삼각형·메시 수(renderer.info, 개발 훅 renderStats/sceneStats),
 * (2) 가만히 선 채 IDLE_SECONDS 동안의 JS 힙(강제 GC 후 잔존 증가량 + 샘플 증가분 합으로 추정한 할당률)을 잰다.
 * 예산 초과면 종료 코드 1. 결과는 docs/qa/perf.json 에 저장.
 *   PORT=5174 node tools/qa/qa-perf.mjs
 *   QA_PERF_NO_ASSERT=1  측정만 (기준선 측정용)
 *   IDLE_SECONDS=20      힙 측정 시간
 * Chrome 은 --js-flags=--expose-gc 로 띄워 window.gc / CDP HeapProfiler.collectGarbage 를 쓴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch as launchBrowser, openGame, gotoChapter as gotoCh, evalRetry, waitMerged, waitFrames, sleep, COUNTS } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;
const IDLE = Number(process.env.IDLE_SECONDS ?? 20);
const NO_ASSERT = !!process.env.QA_PERF_NO_ASSERT;

/** 예산 (측정값 + 여유, docs/qa/QA_REPORT.md 3절 참고). 드로우콜은 본 패스+그림자 패스(그림자 맵을 매 프레임 갱신시킨 최악 프레임)+후처리 합계.
 * 측정(최악): 드로우콜 최대 151(mamre) → 170, 삼각형 최대 279k(mamre) → 300k, 잔존 힙 ≤0.12MB → 0.5, 정지 할당률 0.65~0.92MB/s(three 유니폼 업로드가 대부분; 앱 쪽 HUD/플레이어/상호작용 할당 제거 후 측정) → 1.2 */
export const BUDGET = {
  maxCallsPerStage: Number(process.env.BUDGET_CALLS ?? 170),
  maxTrianglesPerStage: Number(process.env.BUDGET_TRIS ?? 300000),
  /** 20초 정지 후 강제 GC 한 잔존 힙 증가 (MB) — 누수 감시 */
  maxRetainedGrowthMB: Number(process.env.BUDGET_RETAINED_MB ?? 0.5),
  /** 정지 상태 추정 할당률 (MB/s) */
  maxAllocRateMBs: Number(process.env.BUDGET_ALLOC_MBS ?? 1.2),
};
const HEAP_STAGES = (process.env.HEAP_STAGES ?? 'shechem_bethel,sodom,hebron_machpelah').split(',');

const gotoChapter = async (page, b, c) => {
  // 개발 서버가 소스 변경으로 페이지를 다시 읽으면 상태가 사라지므로, 이동+병합 대기를 한 번 더 시도한다
  for (let attempt = 0; attempt < 2; attempt++) {
    const st = await gotoCh(page, b, c, { port: PORT });
    if (!st.ok) { if (attempt) throw new Error(`이동 실패: ${b}권 ${c + 1}장 (현재 ${st.book}권 ${st.chapter + 1}장 stage=${st.stage})`); continue; }
    // 병합 관찰(45프레임)이 끝나 병합된 뒤의 상태를 잰다
    if (await waitMerged(page)) { await waitFrames(page, 10); return; }
  }
  throw new Error(`병합이 끝나지 않음: ${b}권 ${c + 1}장`);
};

const browser = await launchBrowser({ args: ['--js-flags=--expose-gc'], protocolTimeout: 120000 });
const result = { stages: {}, heap: {}, budget: BUDGET };
const problems = [];
try {
  const page = await openGame(browser, PORT);
  if (process.env.MERGE_CFG) await evalRetry(page, (c) => Object.assign(window.__abraham.mergeConfig, JSON.parse(c)), process.env.MERGE_CFG);
  if (process.env.NO_MERGE) await evalRetry(page, () => window.__abraham.setMergeStatic(false));
  const cdp = await page.createCDPSession();
  const firstChapter = {};

  for (const [bk, n] of Object.entries(COUNTS)) {
    for (let ch = 0; ch < n; ch++) {
      await gotoChapter(page, Number(bk), ch);
      const st = await evalRetry(page, () => window.__abraham.state());
      if (!st.stage || result.stages[st.stage]) continue;
      // 그림자 맵은 매 프레임 갱신하지 않으므로(lighting.ts shadowEvery) 프레임마다 드로우콜이 다르다 → 여러 프레임의 최댓값(그림자 패스 포함 최악 프레임)
      const stats = await evalRetry(page, async () => {
        const a = window.__abraham;
        let calls = 0, triangles = 0, minCalls = 1e9, last = a.renderStats();
        // 실내/야간 연출에서는 해 그림자 맵 갱신이 멎어 그림자 패스가 빠진 프레임이 나오므로, 재는 동안은 매 프레임 그림자 맵을 갱신하게 해 최악(그림자 패스 포함) 프레임을 결정적으로 잰다
        const suns = [];
        window.__GAME__.sceneCtx.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) suns.push(o); });
        for (let i = 0; i < 60; i++) {
          for (const l of suns) { l.shadow.autoUpdate = true; l.shadow.needsUpdate = true; }
          await a.frames(1); // 그림자 맵이 격프레임으로 갱신되므로 한 프레임씩 재서 갱신 프레임이 반드시 잡히게
          last = a.renderStats();
          calls = Math.max(calls, last.calls); triangles = Math.max(triangles, last.triangles); minCalls = Math.min(minCalls, last.calls);
        }
        const sc = a.sceneStats();
        return { calls, minCalls, triangles, geometries: last.geometries, textures: last.textures, meshes: sc.meshes, mergedMeshes: sc.merge.meshes, mergedSources: sc.merge.sources, unmerged: sc.merge.unmerged };
      });
      result.stages[st.stage] = { book: Number(bk), chapter: ch, ...stats };
      firstChapter[st.stage] = [Number(bk), ch];
      console.log(`  ${st.stage.padEnd(18)} calls(max)=${String(stats.calls).padStart(4)} min=${String(stats.minCalls).padStart(4)} tris=${String(stats.triangles).padStart(7)} meshes=${String(stats.meshes).padStart(4)} geos=${stats.geometries} merged=${stats.mergedSources}->${stats.mergedMeshes} unmerged=${stats.unmerged}`);
      if (stats.calls > BUDGET.maxCallsPerStage) problems.push(`${st.stage}: 드로우콜 ${stats.calls} > ${BUDGET.maxCallsPerStage}`);
      if (stats.triangles > BUDGET.maxTrianglesPerStage) problems.push(`${st.stage}: 삼각형 ${stats.triangles} > ${BUDGET.maxTrianglesPerStage}`);
    }
  }

  const heapNow = async () => (await page.metrics()).JSHeapUsedSize;
  for (const sid of HEAP_STAGES) {
    const fc = firstChapter[sid];
    if (!fc) { problems.push(`${sid}: 힙 측정할 장을 찾지 못함`); continue; }
    await gotoChapter(page, fc[0], fc[1]);
    await waitFrames(page, 60);
    await cdp.send('HeapProfiler.collectGarbage');
    const h0 = await heapNow();
    let prev = h0, allocated = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < IDLE * 1000) {
      await sleep(100);
      const h = await heapNow();
      if (h > prev) allocated += h - prev; // GC 로 줄어든 구간은 건너뜀 → 하한 추정
      prev = h;
    }
    const secs = (Date.now() - t0) / 1000;
    await cdp.send('HeapProfiler.collectGarbage');
    const h1 = await heapNow();
    const retainedMB = (h1 - h0) / 1048576;
    const rateMBs = allocated / 1048576 / secs;
    result.heap[sid] = { seconds: +secs.toFixed(1), retainedGrowthMB: +retainedMB.toFixed(2), allocRateMBs: +rateMBs.toFixed(2) };
    console.log(`  heap ${sid.padEnd(18)} ${secs.toFixed(0)}s 잔존 ${retainedMB.toFixed(2)}MB, 할당률 ~${rateMBs.toFixed(2)}MB/s`);
    if (retainedMB > BUDGET.maxRetainedGrowthMB) problems.push(`${sid}: 잔존 힙 증가 ${retainedMB.toFixed(2)}MB > ${BUDGET.maxRetainedGrowthMB}MB`);
    if (rateMBs > BUDGET.maxAllocRateMBs) problems.push(`${sid}: 할당률 ${rateMBs.toFixed(2)}MB/s > ${BUDGET.maxAllocRateMBs}MB/s`);
  }
} finally {
  await browser.close();
}
const outPath = path.resolve(__dirname, '../../docs/qa/perf.json');
if (!process.env.QA_PERF_OUT_SKIP) fs.writeFileSync(process.env.QA_PERF_OUT ?? outPath, JSON.stringify(result, null, 2));
if (problems.length && !NO_ASSERT) { console.error(`\n[성능 예산 실패]\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log(problems.length ? `\n[측정만, 예산 위반 ${problems.length}건 무시됨]\n - ${problems.join('\n - ')}` : '\n[성능 예산 통과]');
