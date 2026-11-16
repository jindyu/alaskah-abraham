#!/usr/bin/env node
/**
 * 브라우저 QA 전부를 차례로 돌리는 공통 진입점: abraham(6권 진입) → mobile(터치 UI) → progress(진행 표시) → visual(시각 회귀) → stages(전 장 도달·화면 중복 검사) → furnace(풀무불 연출) → merge-visual(병합·안쪽 면 제거 전후 픽셀 동일성) → perf(드로우콜·삼각형·힙 예산).
 *
 * 자체 기동: PORT(기본 5174)에서 개발 서버가 응답하면 그대로 쓰고, 응답이 없으면 빈 포트에서 `vite` 를 띄운 뒤
 * 끝나면(성공·실패·Ctrl-C 모두) 그 서버를 내린다. 그래서 CI 에서 `npm run qa:all` 한 줄로 돈다.
 *   PORT=5176 npm run qa:all      # 이 포트를 먼저 확인하고, 비어 있으면 거기서 서버를 띄운다
 *   QA_NO_SERVER=1 npm run qa:all # 서버를 띄우지 않음 (없으면 실패)
 * 하나라도 실패하면 끝까지 돌린 뒤 실패 목록을 보이고 종료 코드 1 로 끝난다.
 * (qa-book1*.mjs 는 1권 개발용 보조 스크립트라 여기에 넣지 않는다 — docs/QA_RUNBOOK.md 참고)
 */
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '..', '..');
const STEPS = ['qa-abraham.mjs', 'qa-mobile.mjs', 'qa-progress.mjs', 'qa-visual.mjs', 'qa-stages.mjs', 'qa-furnace.mjs', 'qa-merge-visual.mjs', 'qa-perf.mjs'];
const WAIT_MS = 60000;

/** 그 포트에서 HTTP 응답이 오나 (개발 서버가 이미 떠 있는지) */
async function responds(port) {
  try {
    const r = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1500) });
    return r.status > 0;
  } catch {
    return false;
  }
}

/** 그 포트를 지금 열 수 있나 (다른 프로세스가 잡고 있지 않음) */
function isFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}

async function freePort(from) {
  for (let p = from; p < from + 50; p++) if (await isFree(p)) return p;
  throw new Error(`빈 포트를 찾지 못했다 (${from}~${from + 49})`);
}

async function startServer(port) {
  const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
  const child = spawn(bin, ['--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (b) => { log += b; });
  child.stderr.on('data', (b) => { log += b; });
  let exited = false;
  child.on('exit', () => { exited = true; });
  const t0 = Date.now();
  while (Date.now() - t0 < WAIT_MS) {
    if (exited) throw new Error(`vite 가 바로 종료됐다:\n${log}`);
    if (await responds(port)) return child;
    await new Promise((r) => setTimeout(r, 300));
  }
  child.kill('SIGTERM');
  throw new Error(`vite 가 ${WAIT_MS / 1000}초 안에 응답하지 않았다:\n${log}`);
}

function stop(child) {
  if (child && child.exitCode === null && !child.killed) child.kill('SIGTERM');
}

async function main() {
  let port = process.env.PORT ? Number(process.env.PORT) : 5174;
  let server = null;
  const cleanup = () => stop(server);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
  process.on('exit', cleanup);

  if (await responds(port)) {
    console.log(`[QA] 개발 서버 사용: http://localhost:${port}`);
  } else if (process.env.QA_NO_SERVER) {
    console.error(`[QA] 포트 ${port} 에 서버가 없고 QA_NO_SERVER 가 설정돼 있다`);
    process.exit(1);
  } else {
    port = await freePort(port);
    console.log(`[QA] 서버가 없어 vite 를 포트 ${port} 에서 띄운다...`);
    server = await startServer(port);
    console.log(`[QA] vite 준비됨: http://localhost:${port}`);
  }

  const failed = [];
  try {
    for (const s of STEPS) {
      console.log(`\n━━ ${s} ━━`);
      const r = spawnSync(process.execPath, [path.join(dir, s)], { stdio: 'inherit', env: { ...process.env, PORT: String(port) } });
      if (r.status !== 0) failed.push(s);
    }
  } finally {
    cleanup();
  }
  if (failed.length) { console.error(`\n[QA 전체 실패] ${failed.join(', ')}`); process.exit(1); }
  console.log(`\n[QA 전체 통과] ${STEPS.map((x) => x.replace(/^qa-|\.mjs$/g, '')).join(' · ')}`);
}

main().catch((e) => { console.error(`[QA] ${e.message}`); process.exit(1); });
