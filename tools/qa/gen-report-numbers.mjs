#!/usr/bin/env node
/**
 * QA 리포트의 숫자 블록 생성기: docs/qa/perf.json(npm run qa:perf)과 vitest JSON 결과에서 숫자를 읽어
 * docs/qa/QA_REPORT.md 의 <!-- numbers:start --> ~ <!-- numbers:end --> 사이를 채운다 (손으로 쓴 숫자가 낡지 않게).
 *
 *   node tools/qa/gen-report-numbers.mjs            블록만 출력
 *   node tools/qa/gen-report-numbers.mjs --write    QA_REPORT.md 의 표시 구간을 갱신 (표시가 없으면 오류)
 *   --vitest-json=파일   이미 있는 `npx vitest run --reporter=json` 결과 사용 (없으면 vitest 를 직접 돌린다)
 *   --perf=파일          perf.json 위치 (기본 docs/qa/perf.json)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const WRITE = process.argv.includes('--write');
const START = '<!-- numbers:start -->', END = '<!-- numbers:end -->';
const reportPath = path.join(root, 'docs/qa/QA_REPORT.md');
const perfPath = arg('perf') ?? path.join(root, 'docs/qa/perf.json');

function readVitest() {
  let file = arg('vitest-json');
  if (!file) {
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'abraham-vitest-')), 'result.json');
    try {
      execFileSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${file}`], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], maxBuffer: 1 << 28 });
    } catch (e) {
      if (!fs.existsSync(file)) throw e; // 실패한 테스트가 있어도 결과 파일은 남는다 — 아래에서 실패 수를 그대로 적는다
    }
  }
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const files = Array.isArray(j.testResults) ? j.testResults.length : 0;
  return { files, total: j.numTotalTests, passed: j.numPassedTests, failed: j.numFailedTests, pending: j.numPendingTests ?? 0, todo: j.numTodoTests ?? 0 };
}

function perfBlock() {
  if (!fs.existsSync(perfPath)) return ['(docs/qa/perf.json 없음 — `npm run qa:perf` 먼저)'];
  const p = JSON.parse(fs.readFileSync(perfPath, 'utf8'));
  const st = Object.entries(p.stages);
  const max = (k) => st.reduce((m, [id, v]) => (v[k] > m[1] ? [id, v[k]] : m), ['', -1]);
  const k = (n) => `${Math.round(n / 1000)}k`;
  const [cid, cmax] = max('calls'), [tid, tmax] = max('triangles');
  const hs = Object.entries(p.heap ?? {});
  const hmax = (key) => hs.reduce((m, [id, v]) => (v[key] > m[1] ? [id, v[key]] : m), ['', -Infinity]);
  const lines = [];
  lines.push(`- 성능 측정(\`docs/qa/perf.json\`): 무대 **${st.length}개** 드로우콜·삼각형, 정지 힙 **${hs.length}개** 장`);
  lines.push(`- 드로우콜 최대 **${cmax}**(${cid}) / 예산 ${p.budget.maxCallsPerStage}, 삼각형 최대 **${k(tmax)}**(${tid}) / 예산 ${k(p.budget.maxTrianglesPerStage)}`);
  if (hs.length) {
    const [rid, rv] = hmax('retainedGrowthMB'), [aid, av] = hmax('allocRateMBs');
    const secs = [...new Set(hs.map(([, v]) => Math.round(v.seconds)))].join('/');
    lines.push(`- 정지 ${secs}초 힙(장마다): 잔존 증가 최대 **${rv.toFixed(2)}MB**(${rid}) / 예산 ${p.budget.maxRetainedGrowthMB}MB, 추정 할당률 최대 **${av.toFixed(2)}MB/s**(${aid}) / 예산 ${p.budget.maxAllocRateMBs}MB/s`);
  }
  lines.push('', '| 무대 | 드로우콜(최악) | 삼각형 | 메시 | 정지 힙 잔존 MB | 할당률 MB/s |', '|---|---|---|---|---|---|');
  for (const [id, v] of st) {
    const h = p.heap?.[id];
    lines.push(`| ${id} | ${v.calls} | ${k(v.triangles)} | ${v.meshes} | ${h ? h.retainedGrowthMB.toFixed(2) : '-'} | ${h ? h.allocRateMBs.toFixed(2) : '-'} |`);
  }
  return lines;
}

const t = readVitest();
const out = [
  START,
  `<!-- 이 구간은 \`npm run qa:report\`(tools/qa/gen-report-numbers.mjs)가 만든다. 손으로 고치지 말 것 -->`,
  `- Vitest: **${t.files}개 파일, ${t.passed}/${t.total}개 통과**${t.failed ? `, **실패 ${t.failed}개**` : ''}${t.pending + t.todo ? ` (건너뜀 ${t.pending + t.todo})` : ''}`,
  ...perfBlock(),
  END,
].join('\n');

if (!WRITE) { console.log(out); process.exit(t.failed ? 1 : 0); }
const md = fs.readFileSync(reportPath, 'utf8');
const a = md.indexOf(START), b = md.indexOf(END);
if (a < 0 || b < a) { console.error(`${path.relative(root, reportPath)} 에 ${START} … ${END} 표시가 없다`); process.exit(2); }
fs.writeFileSync(reportPath, md.slice(0, a) + out + md.slice(b + END.length));
console.log(`갱신: ${path.relative(root, reportPath)} (vitest ${t.passed}/${t.total}, 무대 ${Object.keys(JSON.parse(fs.readFileSync(perfPath, 'utf8')).stages).length}개)`);
process.exit(t.failed ? 1 : 0);
