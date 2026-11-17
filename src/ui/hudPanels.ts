import { goalPx } from './textSize';
import { GOAL_MAX_LINES, BANNER_H, type Hud, type Prompt } from './hud';
import { touchClusterTopCss } from './touchControls';
import { TOAST_LINE_H, TOAST_H, TOAST_GAP, toastCenterX, toastHeight, toastSlideY, toastSpan } from './toastLayout';
import { dev, frame, pooledFrame, hudScale, inset, snapRect } from './uiScale';
import { centerY, densityOf, drawDigits } from './pixelText';
import { ACCENT, ACCENT_LIGHT, CREAM, INK, INK_SOFT, INK_WARM, OUTLINE, PAPER, PAPER_LIGHT, PAPER_SHADOW, RULE, WOOD, WOOD_LIGHT } from './theme';
import { wrapLines, wrapParagraphs } from './wrap';
import { tr } from '../i18n/tr';
import { ONBOARD_STEPS, onboardAlpha } from './onboarding';

/** 목표 패널·토스트·배너·상호작용 프롬프트·미니맵 그리기 (hud.ts 에서 분리). Hud 의 공개 멤버만 쓴다. */

/** 목표: 오른쪽 위 퀘스트 패널. 카테고리 헤더, 체크리스트, 진행바, 안내선 및 골드 플래시 지원 */
/** 목표 패널 레이아웃 캐시 키 조각 (매 프레임 비교용 — 하나만 달라도 다시 배치) */
const goalKeyParts = { base: -1, floor: -1, rev: -1, y0: -1, cat: '', pc: -2, pt: -2 };

/** 글에서 "(2/5)" 같은 진행도를 찾는 것은 글이 바뀔 때만 한다 (매 프레임 정규식·객체 할당 방지) */
const autoProg = { current: 0, total: 0, label: undefined as string | undefined };
let autoSrc = '';
let autoOk = false;
function autoProgress(text: string): boolean {
  if (text !== autoSrc) {
    autoSrc = text;
    const m = text.match(/\((\d+)\s*\/\s*(\d+)\)/);
    autoOk = !!m;
    if (m) { autoProg.current = parseInt(m[1], 10); autoProg.total = parseInt(m[2], 10); }
  }
  return autoOk;
}

/** 목표 줄 종류(0 일반·1 완료 ✓·2 불릿)와 표식을 뗀 글: 줄 목록이 바뀔 때만 다시 나눈다 (프레임마다 정규식·replace 문자열 할당 금지) */
let kindFor: readonly string[] | null = null;
const lineKind: number[] = [];
const lineClean: string[] = [];
function classifyGoalLines(lines: readonly string[]): void {
  if (kindFor === lines) return;
  kindFor = lines;
  lineKind.length = 0; lineClean.length = 0;
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i];
    lineKind.push(/^([✓]|\[x\])/.test(s) ? 1 : /^([▪\-•]|\[ \])/.test(s) ? 2 : 0);
    lineClean.push(s.replace(/^([✓▪\-•]|\[[ x]\])\s*/, ''));
  }
}
/** 진행 글자("3/5 (60%)", "3/5")는 수가 바뀔 때만 만든다 */
let pgCur = -1, pgTot = -1, pgFull = '', pgShort = '';
function progStrings(cur: number, tot: number): void {
  if (cur === pgCur && tot === pgTot) return;
  pgCur = cur; pgTot = tot;
  pgShort = `${cur}/${tot}`;
  pgFull = `${cur}/${tot} (${Math.round(Math.min(1, cur / tot) * 100)}%)`;
}

function panelHeight(top: number, lh: number, hl: number, progH: number, n: number, m: number): number {
  return top + 4 + n * lh + progH + (m > 0 ? m * hl + 3 : 0) + 4;
}

export function goalPanel(hud: Hud, text: string, y0: number) {
  const catText = hud.goalCategory ? hud.goalCategory : '주요 임무';
  const lab = hud.txt(catText, 10, '#8a5a36');
  const GOAL_PX = goalPx(hud.cssScale);
  const top = 22 + hud.grow(10), LH = GOAL_PX + 4 + hud.grow(GOAL_PX), HL = 13 + hud.grow(10);

  // 자동 진행도 감지 또는 명시적 goalProgress
  const prog = hud.goalProgress || (autoProgress(text) ? autoProg : null);
  const hasProg = !!(prog && prog.total > 0);
  const progH = hasProg ? 16 + hud.grow(9) : 0;

  const base = Math.max(160, Math.min(hud.wide(320), Math.round(hud.w * 0.44)) - 18);
  const floor = hud.touch ? hud.h - hud.edge.bottom - Math.ceil(touchClusterTopCss(hud.cssH, hud.cssH > hud.cssW * 1.15) / hud.cssScale) - 4 : Infinity;
  // 세로 터치 화면은 위쪽을 덜 차지하도록 보조 힌트를 숨기고 목표 줄 수를 줄인다 (탭하면 도움말에서 다시 볼 수 있다)
  const compact = hud.touch && hud.cssH > hud.cssW * 1.15;
  const translatedGoal = tr(text), translatedHint = hud.hint && !compact ? tr(hud.hint) : '';
  // 레이아웃 캐시 키: 문자열을 매 프레임 만들지 않고 숫자·문자열 필드를 직접 비교한다 (프레임당 할당 금지)
  const pc = prog ? prog.current : -1, pt = prog ? prog.total : -1;
  const k = goalKeyParts;
  const same = k.base === base && k.floor === floor && k.rev === hud.textRev && k.y0 === y0 && k.cat === catText && k.pc === pc && k.pt === pt;

  if (translatedGoal !== hud.goalSrc || translatedHint !== hud.hintSrc || !same) {
    k.base = base; k.floor = floor; k.rev = hud.textRev; k.y0 = y0; k.cat = catText; k.pc = pc; k.pt = pt;
    hud.goalSrc = translatedGoal; hud.hintSrc = translatedHint;
    const lay = (maxText: number, goalMax: number) => {
      const goal = wrapParagraphs(text, maxText, (s) => hud.tw(hud.txt(s, GOAL_PX, INK)), goalMax);
      const hint = translatedHint ? translatedHint.split('\n').flatMap((l) => wrapLines(l, maxText, (s) => hud.tw(hud.txt(s, 10, INK_WARM)), 2)) : [];
      return { goal, hint };
    };
    const avail = floor - y0;
    let r = lay(base, compact ? 3 : GOAL_MAX_LINES);
    if (panelHeight(top, LH, HL, progH, r.goal.length, r.hint.length) > avail) {
      const wider = Math.max(base, Math.min(Math.round(hud.w * 0.55), hud.wide(400)) - 18);
      if (wider > base) r = lay(wider, compact ? 3 : GOAL_MAX_LINES);
      const fitGoal = Math.max(1, Math.floor((avail - top - 6 - progH) / LH));
      if (r.goal.length > fitGoal) r = { goal: wrapParagraphs(text, wider, (s) => hud.tw(hud.txt(s, GOAL_PX, INK)), fitGoal), hint: r.hint };
      const fitHint = Math.max(0, Math.floor((avail - panelHeight(top, LH, HL, progH, r.goal.length, 0)) / HL));
      if (r.hint.length > fitHint) r.hint = r.hint.slice(0, fitHint);
    }
    hud.goalLines = r.goal; hud.hintLines = r.hint;
  }

  const gs = hud.gsBuf;
  gs.length = 0;
  let wide = hud.tw(lab) + 20;

  classifyGoalLines(hud.goalLines);
  for (let i = 0; i < hud.goalLines.length; i++) {
    const isCheck = lineKind[i] === 1;
    const isBullet = lineKind[i] === 2;
    const clean = lineClean[i];
    const col = isCheck ? INK_SOFT : INK;
    const c = hud.txt(clean, GOAL_PX, col);
    gs.push(c);
    const lineW = hud.tw(c) + (isCheck || isBullet ? 16 : 0);
    wide = Math.max(wide, lineW);
  }

  const hs = hud.hsBuf;
  hs.length = 0;
  for (let i = 0; i < hud.hintLines.length; i++) {
    const h = hud.txt(hud.hintLines[i], 10, INK_WARM);
    hs.push(h);
    wide = Math.max(wide, hud.tw(h) + 12);
  }

  if (hasProg && prog) {
    progStrings(prog.current, prog.total);
    const pLabel = prog.label ?? pgShort;
    const pText = hud.txt(pLabel, 9, INK_WARM);
    wide = Math.max(wide, hud.tw(pText) + 80);
  }

  const W = Math.max(120, Math.round(wide) + 22), H = panelHeight(top, LH, HL, progH, gs.length, hs.length), x0 = hud.w - W - 8 - hud.edge.right;
  hud.toastRight = Math.min(hud.toastRight, x0);
  hud.panel(x0, y0, W, H);

  const g = hud.ctx;

  // 진행 골드 플래시 (목표 갱신/진행 시 테두리 발광)
  if (hud.goalFlash > 0) {
    g.save();
    g.globalAlpha = Math.min(1, hud.goalFlash);
    g.fillStyle = '#ffd23a';
    g.fillRect(x0 - 2, y0 - 2, W + 4, 2);
    g.fillRect(x0 - 2, y0 + H, W + 4, 2);
    g.fillRect(x0 - 2, y0, 2, H);
    g.fillRect(x0 + W, y0, 2, H);
    if (hud.goalFlash > 0.4) {
      g.globalAlpha = (hud.goalFlash - 0.4) * 0.7;
      g.fillStyle = '#fff6b0';
      g.fillRect(x0 - 3, y0 - 3, W + 6, 1);
      g.fillRect(x0 - 3, y0 + H + 2, W + 6, 1);
      g.fillRect(x0 - 3, y0 - 2, 1, H + 4);
      g.fillRect(x0 + W + 2, y0 - 2, 1, H + 4);
    }
    g.restore();
  }

  // 헤더 카테고리 텍스트
  // 글자가 커진 화면(터치·큰 글자)에서는 머리글이 위로 잘리지 않게 아래로 맞추고, 구분선도 그만큼 내린다
  const hg = hud.grow(10);
  hud.put(lab, x0 + 9, y0 + 5 + Math.round(hg / 2));

  // 헤더 장식 구분선
  g.fillStyle = RULE;
  g.fillRect(x0 + 8, y0 + 17 + hg, W - 16, 1);
  g.fillStyle = PAPER_LIGHT;
  g.fillRect(x0 + 8, y0 + 18 + hg, W - 16, 1);
  g.fillStyle = '#e8a020';
  g.fillRect(x0 + 8, y0 + 16 + hg, 3, 3);

  // 목표 텍스트 및 서브태스크 체크박스
  for (let i = 0; i < hud.goalLines.length; i++) {
    const isCheck = lineKind[i] === 1;
    const isBullet = lineKind[i] === 2;
    const cy = y0 + top + i * LH;

    if (isCheck) {
      // 녹색 완료 체크박스 [✓]
      g.fillStyle = OUTLINE; g.fillRect(x0 + 9, cy + 3, 8, 8);
      g.fillStyle = '#4a8e2e'; g.fillRect(x0 + 10, cy + 4, 6, 6);
      g.fillStyle = '#ffffff';
      g.fillRect(x0 + 11, cy + 6, 1, 2);
      g.fillRect(x0 + 12, cy + 7, 2, 1);
      g.fillRect(x0 + 14, cy + 4, 1, 3);
      hud.put(gs[i], x0 + 21, centerY(gs[i], cy, cy + LH));
    } else if (isBullet) {
      // 앰버 진행중 체크박스 [▪]
      g.fillStyle = OUTLINE; g.fillRect(x0 + 9, cy + 3, 8, 8);
      g.fillStyle = '#fff4d8'; g.fillRect(x0 + 10, cy + 4, 6, 6);
      g.fillStyle = '#d49020'; g.fillRect(x0 + 12, cy + 6, 2, 2);
      hud.put(gs[i], x0 + 21, centerY(gs[i], cy, cy + LH));
    } else {
      hud.put(gs[i], x0 + 9, centerY(gs[i], cy, cy + LH));
    }
  }

  let nextY = y0 + top + gs.length * LH;

  // 진행도 바 (Progress Bar)
  if (hasProg && prog) {
    const barX = x0 + 9, barW = W - 18, barH = 5;
    const barY = nextY + 7 + hud.grow(9);

    // 수치 레이블
    progStrings(prog.current, prog.total);
    const progStr = prog.label ?? pgFull;
    const progTxt = hud.txt(progStr, 9, INK_WARM);
    hud.put(progTxt, x0 + W - 9 - hud.tw(progTxt), nextY + 1);

    // 바 테두리 및 홈
    g.fillStyle = OUTLINE; g.fillRect(barX, barY, barW, barH);
    g.fillStyle = PAPER_SHADOW; g.fillRect(barX + 1, barY + 1, barW - 2, barH - 2);

    // 바 채우기
    const pct = Math.max(0, Math.min(1, prog.current / prog.total));
    const fillW = Math.round((barW - 2) * pct);
    if (fillW > 0) {
      const isDone = prog.current >= prog.total;
      g.fillStyle = isDone ? '#4a8e2e' : ACCENT;
      g.fillRect(barX + 1, barY + 1, fillW, barH - 2);
      g.fillStyle = isDone ? '#76c448' : ACCENT_LIGHT;
      g.fillRect(barX + 1, barY + 1, fillW, 1);
    }

    nextY += progH;
  }

  // 하단 조작/장소 힌트 (안내)
  for (let i = 0; i < hs.length; i++) {
    const hy = nextY + 1 + i * HL;
    g.fillStyle = '#e8a020';
    g.fillRect(x0 + 9, hy + 4, 3, 3);
    hud.put(hs[i], x0 + 16, centerY(hs[i], hy, hy + HL - 1));
  }
}

/**
 * 터치 기기의 알림: 위 가운데, 오래된 것이 위·새 것이 아래로 쌓임. 가로는 왼쪽 도움말 단추·지도(leftEdge)와
 * 오른쪽 시계·할 일 패널 사이, 글이 길면 두 줄까지. 들어올 때 위에서 내려오고 나갈 때는 PC 와 같이 두 단계로 흐려짐.
 * 완료 띠(위 가운데)가 떠 있는 동안은 그 아래로 내려가 있다가 띠가 사라지면 올라옴
 */
export function toastsTop(hud: Hud, dt: number, edgeTop: number, leftEdge: number) {
  const g = hud.ctx, e = hud.edge;
  const span = toastSpan(hud.w, leftEdge, hud.toastRight, e.left, e.right);
  const bannerBottom = hud.banner ? 10 + hud.bannerH() + 4 : 0;
  const base = 8 + edgeTop, target = Math.max(0, bannerBottom - base);
  hud.toastDrop += Math.sign(target - hud.toastDrop) * Math.min(Math.abs(target - hud.toastDrop), 160 * dt);
  let ty = base + Math.round(hud.toastDrop);
  const gr = hud.grow(13), LH = TOAST_LINE_H + gr, H1 = TOAST_H + gr;
  const toasts = hud.toasts;
  for (let ti = 0; ti < toasts.length; ti++) {
    const t = toasts[ti];
    const text = t.count ? `+${t.count} ${t.name}` : t.name;
    const inner = span.x1 - span.x0 - (t.iconId ? 30 : 14);
    let lay = hud.toastLayout.get(t);
    if (!lay || lay.inner !== inner) {
      const lines = wrapLines(text, inner, (s) => hud.tw(hud.txt(s, 13, INK)), 2).map((s) => hud.txt(s, 13, INK));
      lay = { inner, lines, tw: Math.ceil(Math.max(...lines.map((l) => hud.tw(l)))) + 14 };
      hud.toastLayout.set(t, lay);
    }
    const lines = lay.lines;
    const th = toastHeight(lines.length, gr);
    const tw = lay.tw;
    const fade = t.life - t.age;
    g.globalAlpha = fade < 0.2 ? 0.35 : fade < 0.45 ? 0.7 : 1;
    const tx = toastCenterX(span, tw), y = ty + toastSlideY(t.age, th);
    hud.panel(tx, y, tw, th);
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      hud.put(l, tx + 7, centerY(l, y + 5 + li * LH, y + H1 - 6 + li * LH));
    }
    g.globalAlpha = 1;
    ty += th + TOAST_GAP;
  }
}

const bannerCache = { src: '', compact: false, w: -1, rev: -1, short: '' };

export function drawBanner(hud: Hud, b: { title: string; sub: string; age: number; compact?: boolean }) {
  const g = hud.ctx;
  const translated = tr(b.sub);
  // 띠 부제 줄임은 글·폭·글자 크기가 같으면 이전 결과를 재사용 (프레임마다 split/replace/wrap 하지 않음)
  const bc = bannerCache;
  if (bc.src !== translated || bc.compact !== !!b.compact || bc.w !== hud.w || bc.rev !== hud.textRev) {
    const sub = b.compact ? translated.split('\n')[0].replace(/\s*\([^)]*\)/g, '').trim() : translated;
    bc.short = wrapLines(sub, hud.w - 64, text => hud.tw(hud.txt(text, 11, CREAM, OUTLINE)), 1)[0];
    bc.src = translated; bc.compact = !!b.compact; bc.w = hud.w; bc.rev = hud.textRev;
  }
  const short = bc.short;
  const t = hud.txt(b.title, 18, '#ffe7a8', '#6a4818'), s = hud.txt(short, 11, CREAM, OUTLINE);
  const W = Math.max(hud.tw(t), hud.tw(s)) + 40, H = hud.bannerH();
  const x0 = Math.round(hud.w / 2 - W / 2);
  // 위에서 내려왔다가 끝에 흐려짐
  const y0 = 10 + Math.round(Math.min(0, b.age * 120 - 18));
  g.globalAlpha = b.age > 2.4 ? Math.max(0, (2.8 - b.age) / 0.4) : 1;
  const f = hud.frame(x0, y0, W, H);
  hud.fillIn(OUTLINE, f, 0, 0, 0, 0);
  hud.fillIn('#3a2a1c', f, 1, 1, 1, 1);
  hud.fillDev('#c99a3a', f.L(1), f.T(1), f.R(1), f.T(3)); hud.fillDev('#c99a3a', f.L(1), f.B(3), f.R(1), f.B(1));
  hud.put(t, Math.round(hud.w / 2 - hud.tw(t) / 2), y0 + 5);
  hud.put(s, Math.round(hud.w / 2 - hud.tw(s) / 2), y0 + 29 + hud.grow(18));
  // 반짝이 (양옆에서 튀는 별 몇 개)
  for (let k = 0; k < 6; k++) {
    const a = b.age * 3 + k;
    const sx = x0 + (k % 2 ? W + 6 + (k * 7) % 14 : -10 - (k * 7) % 14), sy = y0 + 8 + ((k * 13 + Math.floor(a * 6)) % 30);
    g.fillStyle = k % 3 ? '#ffe070' : '#ffffff'; g.fillRect(sx, sy, 2, 2);
  }
  g.globalAlpha = 1;
}

export function prompt(hud: Hud, p: Prompt, withSpace: boolean) {
  const g = hud.ctx;
  const label = hud.txt(p.label, 13, INK);
  const key = hud.txt(hud.touch ? '행동' : 'E', 11, PAPER, null);
  // 글자가 커지면 키캡·첫 줄·안내 줄이 그만큼 높아짐 (기본: 키캡 14, 첫 줄 15, 안내 줄 13)
  const ks = 14 + hud.grow(11), kw = hud.touch ? Math.ceil(hud.tw(key)) + 8 : ks;
  const rowH = Math.max(15 + hud.grow(13), ks + 1), HL = 13 + hud.grow(10);
  const labelX = 7 + kw + 5;
  // 처음 몇 번만 라벨 뒤에 작게 'Space' (도움말의 'E / Space' 와 같은 뜻). 폭은 글자 폭으로 계산
  const space = withSpace ? hud.txt('Space', 9, INK_SOFT) : null;
  const labelW = Math.ceil(hud.tw(label)) + labelX + 6 + (space ? Math.ceil(hud.tw(space)) + 5 : 0);
  const hint = p.hint ? tr(p.hint) : '';
  const maxHintW = Math.min(hud.wide(300), hud.w - 32);
  if (hint !== hud.promptHintSrc || maxHintW !== hud.promptHintMaxW || hud.textRev !== hud.promptHintRev) {
    hud.promptHintSrc = hint; hud.promptHintMaxW = maxHintW; hud.promptHintRev = hud.textRev;
    hud.promptHintLines = hint ? wrapLines(hint, maxHintW, s => hud.tw(hud.txt(s, 10, INK_WARM)), 2) : [];
    hud.promptHintWidth = 0;
    for (const line of hud.promptHintLines) hud.promptHintWidth = Math.max(hud.promptHintWidth, hud.tw(hud.txt(line, 10, INK_WARM)) + 16);
  }
  const hintLines = hud.promptHintLines;
  const h0 = 11 + rowH, w = Math.max(labelW, hud.promptHintWidth), h = h0 + (hintLines.length ? 4 + hintLines.length * HL : 0);
  const bob = Math.floor(hud.time * 3) % 2;
  const e = hud.edge;
  const x = Math.max(4 + e.left, Math.min(hud.w - w - 4 - e.right, Math.round(p.x - w / 2)));
  const y = Math.max(4 + e.top, Math.round(p.y - h - 10) - bob);
  const prr = hud.promptRectBuf; prr.x = x; prr.y = y; prr.w = w; prr.h = h + 3; hud.promptRect = prr; // 말풍선이 이 상자를 가리지 않게 (아래 말풍선 단계에서 비킴)
  hud.panel(x, y, w, h);
  // 키캡 (속지 안에서 세로 가운데)
  const ky = y + 5 + Math.round((rowH - ks) / 2);
  hud.keycap(x + 7, ky, kw, ks);
  hud.put(key, x + 7 + (kw - hud.tw(key) + 2) / 2, centerY(key, ky + 1, ky + ks - 3));
  hud.put(label, x + labelX, centerY(label, y + 5, y + 5 + rowH));
  if (space) hud.put(space, x + labelX + Math.ceil(hud.tw(label)) + 5, centerY(space, y + 5, y + 5 + rowH));
  for (let i = 0; i < hintLines.length; i++) hud.put(hud.txt(hintLines[i], 10, INK_WARM), x + 8, y + h0 - 1 + i * HL);
  // 말풍선 꼬리
  g.fillStyle = OUTLINE;
  g.fillRect(Math.round(p.x) - 3, y + h, 7, 1);
  g.fillRect(Math.round(p.x) - 2, y + h + 1, 5, 1);
  g.fillRect(Math.round(p.x) - 1, y + h + 2, 3, 1);
  g.fillStyle = WOOD;
  g.fillRect(Math.round(p.x) - 2, y + h, 5, 1);
  g.fillRect(Math.round(p.x) - 1, y + h + 1, 3, 1);
}

export function drawMinimap(hud: Hud, x: number, y: number): void {
  const g = hud.ctx;
  const w = 78, h = 78;
  hud.panel(x, y, w, h);

  const innerX = x + 6;
  const innerY = y + 6;
  const innerW = w - 12;
  const innerH = h - 12;
  const cx = innerX + innerW / 2;
  const cy = innerY + innerH / 2;

  g.save();
  // 미니맵 속지 클리핑
  g.beginPath();
  g.rect(innerX, innerY, innerW, innerH);
  g.clip();

  // 양피지 지도 바닥
  g.fillStyle = '#ecd8b0';
  g.fillRect(innerX, innerY, innerW, innerH);

  // 미니맵 축척: 월드 1유닛 = 1.05px
  const zoom = 1.05;
  // 월드 → 지도 변환은 클로저 대신 미리 계산한 원점(ox, oy)과 배율로 (프레임마다 함수를 만들지 않는다): 지도x = ox + 월드x * zoom
  const ox = cx - hud.minimap.playerX * 0.3 * zoom;
  const oy = cy - hud.minimap.playerZ * 0.3 * zoom;

  // 주 도로 십자선 (동서 대로 & 남북 길)
  g.fillStyle = '#caa070';
  g.fillRect(innerX, (oy + 3.5 * zoom) - 2, innerW, 4);
  g.fillRect((ox + 0 * zoom) - 2, innerY, 4, innerH);

  // 랜드마크 렌더링
  const lms = hud.minimap.landmarks as readonly { x: number; z: number; color: string }[];
  for (let li = 0; li < lms.length; li++) {
    const lm = lms[li];
    const mx = Math.round((ox + lm.x * zoom));
    const my = Math.round((oy + lm.z * zoom));
    g.fillStyle = lm.color;
    g.fillRect(mx - 2, my - 2, 5, 5);
    g.strokeStyle = '#3a2210';
    g.lineWidth = 1;
    g.strokeRect(mx - 2.5, my - 2.5, 6, 6);
  }

  // 퀘스트 목표 핀 (타겟 핀이 있을 때)
  if (hud.minimap.targetPin) {
    const tx = Math.round((ox + hud.minimap.targetPin.x * zoom));
    const ty = Math.round((oy + hud.minimap.targetPin.z * zoom));
    const pulse = 3 + Math.sin(hud.time * 8) * 1.5;
    g.fillStyle = '#e03030';
    g.beginPath();
    g.arc(tx, ty, pulse, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(tx - 1, ty - 1, 2, 2);
  }

  // 플레이어 마커 (현재 위치 & 시선 방향)
  const px = Math.round((ox + hud.minimap.playerX * zoom));
  const py = Math.round((oy + hud.minimap.playerZ * zoom));
  const facing = hud.minimap.playerFacing;

  // 시선 방향 콘 화살표
  g.fillStyle = 'rgba(240, 200, 80, 0.45)';
  g.beginPath();
  g.moveTo(px, py);
  g.arc(px, py, 9, facing - 0.4, facing + 0.4);
  g.closePath();
  g.fill();

  // 플레이어 중심 마커
  g.fillStyle = '#f0c030';
  g.beginPath();
  g.arc(px, py, 2.5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2a1a0e';
  g.lineWidth = 1;
  g.stroke();

  g.restore();

  // 나침반 N 마커 (우측 상단 작은 글씨)
  g.fillStyle = '#8a2020';
  g.font = 'bold 9px monospace';
  g.fillText('N', innerX + innerW - 9, innerY + 9);
  // 지도 이름 표기 (좌측 하단 지명)
  hud.put(hud.txt(hud.minimap.label || '우르', 9, INK_WARM), innerX + 2, innerY + innerH - 9);
}

/** 첫 플레이 안내 한 줄: 위 가운데 (할 일 패널·미니맵 아래), 단계마다 흐려지며 바뀐다. 상태 진행은 hudFrame 이 한다 */
export function drawOnboarding(hud: Hud): void {
  const a = onboardAlpha(hud.onboard);
  if (a <= 0) return;
  const st = ONBOARD_STEPS[hud.onboard.step];
  const g = hud.ctx, e = hud.edge;
  const maxW = Math.max(160, hud.w - 2 * (96 + Math.max(e.left, e.right)));
  const lines = hud.wrapMemo(hud.touch ? st.touch : st.ko, maxW, 13, 2);
  const els = hud.onboardEls; els.length = 0;
  let tw0 = 0;
  for (let i = 0; i < lines.length; i++) { const t = hud.txt(lines[i], 13, INK); els.push(t); tw0 = Math.max(tw0, hud.tw(t)); }
  const lh = 15 + hud.grow(13), w = Math.ceil(tw0) + 56, h = 14 + lines.length * lh + 4;
  const x = Math.round((hud.w - w) / 2), y = Math.round(hud.h * 0.2) + e.top;
  g.globalAlpha = a;
  hud.panel(x, y, w, h);
  // 단계 점 (현재 단계 강조)
  for (let i = 0; i < ONBOARD_STEPS.length; i++) {
    g.fillStyle = i === hud.onboard.step ? '#d49020' : '#c8b496';
    g.fillRect(x + 10, y + 9 + i * 6, 4, 4);
  }
  for (let i = 0; i < els.length; i++) hud.put(els[i], x + 24, centerY(els[i], y + 7 + i * lh, y + 7 + (i + 1) * lh));
  g.globalAlpha = 1;
}
