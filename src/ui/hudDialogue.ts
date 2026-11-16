import { GLOW_BANDS, type Hud, type DialogueChoice } from './hud';
import type { CaptionState } from '../systems/cutscene/cutscene';
import { dev, frame, snapRect } from './uiScale';
import { centerY, densityOf, drawDigits } from './pixelText';
import { ACCENT, ACCENT_LIGHT, CREAM, INK, INK_SOFT, INK_WARM, OUTLINE, PAPER, PAPER_LIGHT, PAPER_SHADOW, RULE, WOOD, WOOD_LIGHT } from './theme';
import { tr } from '../i18n/tr';
import { avoidPrompt, NARRATION_PX, NARRATION_LINE_H, SPEECH_PX, SPEECH_LINE_H } from './dialogueLayout';
import { touchClusterTopCss } from './touchControls';
import { drawPortrait, resolvePortraitKey } from './portraits';

/** 대사 패널·선택지·자막·시네마틱 제목 그리기 (hud.ts 에서 분리). Hud 의 공개 멤버만 쓴다. */

/** 대사 패널 아래 여백: 안전 영역 + (터치 세로 화면이면) 스틱·단추 무리 위까지 — 조작부가 대사를 덮지 않게 */
function dockBottom(h: Hud): number {
  const portrait = h.cssH > h.cssW * 1.15;
  return h.edge.bottom + (h.touch && portrait ? Math.ceil((touchClusterTopCss(h.cssH, true) + 8) / h.cssScale) : 0);
}

/** 프레임마다 쓰는 임시 버퍼 — 그리기 함수 안에서 배열을 새로 만들지 않기 위해 (CLAUDE.md: 프레임당 할당 금지) */
const scratchEls: HTMLCanvasElement[] = [];
/** 시네마틱 제목의 줄 나누기는 글이 바뀔 때만 다시 한다 */
let titleSrc = '';
let titleLines: string[] = [''];

export function drawCinematicTitle(h: Hud, titleText: string): void {
  const g = h.ctx;
  if (titleText !== titleSrc) { titleSrc = titleText; titleLines = titleText.split('\n'); }
  const lines = titleLines;
  const base = 22;
  const lh = 32;
  const totalH = lines.length * lh + 20;
  let maxLine = 0;
  for (let i = 0; i < lines.length; i++) maxLine = Math.max(maxLine, h.tw(h.txt(lines[i], base, '#ffd700')));
  const maxW = maxLine + 40;
  const x = Math.round(h.w / 2 - maxW / 2);
  const y = Math.round(h.h / 2 - totalH / 2);

  g.fillStyle = 'rgba(10, 8, 6, 0.75)';
  g.fillRect(0, y - 10, h.w, totalH + 20);

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const isHeader = i === 0 && lines.length > 1;
    const size = isHeader ? 14 : base;
    const col = isHeader ? '#d0c8b0' : '#ffe484';
    const c = h.txt(l, size, col);
    const lx = Math.round(h.w / 2 - h.tw(c) / 2);
    const ly = y + 10 + i * lh;
    h.put(c, lx, ly);
  }
}

/** 주인공 캐릭터 아래 대사 패널 렌더링 ("대사가 주인공 캐릭터 아래쪽으로 좀 아래에 좀크게 나오게") */
export function drawDialogue(h: Hud, dt: number): void {
  if (!h.activeDialogue) return;
  const d = h.activeDialogue;
  d.age += dt;
  if (d.age >= d.life) {
    h.activeDialogue = null;
    return;
  }

  const g = h.ctx;
  const e = h.edge;

  // 1) 주인공 캐릭터의 화면 투영 좌표 (markerFrom)
  const p = h.project(h.markerFrom.x, 0, h.markerFrom.z);

  // 2) 대사 글자 크기 (16px) 및 줄바꿈
  // 화자 없는 안내(이야기꾼·전승 표기)는 작고 낮게, 화자 있는 대사는 크게
  const narration = !d.speaker;
  const baseFontSize = narration ? NARRATION_PX : SPEECH_PX;
  const cleanText = d.text.trim();
  const maxInnerW = narration ? Math.min(560, Math.round(h.w * 0.8) - 40) : Math.min(520, Math.round(h.w * 0.82) - 40);
  const lines = h.wrapMemo(cleanText, maxInnerW, baseFontSize, 3);

  const lineElements = scratchEls;
  lineElements.length = 0;
  let maxTextW = 0;
  for (let i = 0; i < lines.length; i++) {
    const el = h.txt(lines[i], baseFontSize, INK);
    lineElements.push(el);
    maxTextW = Math.max(maxTextW, h.tw(el));
  }

  let speakerW = 0;
  let badgeTextEl: HTMLCanvasElement | null = null;
  if (d.speaker) {
    badgeTextEl = h.txt(d.speaker, 13, '#ffe484', '#1f1308');
    speakerW = h.tw(badgeTextEl) + 24;
  }

  const panelW = Math.max(Math.max(speakerW + 36, 240), Math.min(maxInnerW + 36, Math.ceil(maxTextW) + 36));
  const lineH = (narration ? NARRATION_LINE_H : SPEECH_LINE_H) + h.grow(baseFontSize);
  const textH = lines.length * lineH;
  const padTop = d.speaker ? 18 : 8;
  const padBottom = narration ? 8 : 12;
  const panelH = padTop + textH + padBottom;

  // 3) X 좌표: 캐릭터 수평 중심에 배치, 화면 가장자리 벗어나지 않게 클램핑
  let panelX = Math.round(p.x - panelW / 2);
  const minX = 20 + e.left;
  const maxX = h.w - panelW - 20 - e.right;
  panelX = Math.max(minX, Math.min(maxX, panelX));

  // 4) Y 좌표: 주인공 캐릭터의 아래쪽으로 좀 아래에, 하단에서 어느 정도 떨어진 곳
  // p.y = 발 위치. 캐릭터 아래쪽으로 40px
  const pBelowChar = Math.round(p.y + 40);
  // 화면 하단(h.h - e.bottom)에서 적어도 48px 이상 띄워 하단 여유 확보
  const maxPanelY = h.h - panelH - 48 - dockBottom(h);
  // 캐릭터가 화면 중앙 근처일 때 자연스러운 위치(0.58*h)와 캐릭터 아래쪽 위치 중 알맞은 곳 선택
  const preferredY = Math.max(pBelowChar, Math.round(h.h * 0.58));
  let panelY = preferredY;
  if (panelY > maxPanelY) panelY = maxPanelY;
  if (panelY < 32 + e.top) panelY = 32 + e.top;
  // 안내는 화면 맨 아래 띠로 내려 장면을 덜 가리고, E 프롬프트 상자는 절대 덮지 않는다
  const minPanelY = 32 + e.top;
  if (narration) panelY = Math.max(minPanelY, h.h - panelH - 14 - dockBottom(h));
  panelY = avoidPrompt(panelY, panelX, panelW, panelH, minPanelY, Math.max(minPanelY, h.h - panelH - 4 - dockBottom(h)), h.promptRect);

  // 5) 부드러운 페이드인 / 페이드아웃 및 팝업 애니메이션
  const fadeIn = Math.min(1, d.age / 0.15);
  const fadeOut = Math.min(1, (d.life - d.age) / 0.35);
  const alpha = fadeIn * fadeOut;
  if (alpha <= 0) return;

  g.save();
  g.globalAlpha = alpha;

  // 위로 살짝 부드럽게 안착
  const slideOffset = Math.round((1 - fadeIn) * 4);
  const curY = panelY + slideOffset;

  // 6) 대화 패널 본체 (우아한 양피지/원목 패널)
  h.panel(panelX, curY, panelW, panelH);

  // 7) 캐릭터를 향하는 말풍선 꼬리 포인터
  const pointerX = Math.max(panelX + 24, Math.min(panelX + panelW - 24, Math.round(p.x)));
  if (curY > p.y + 10) {
    g.fillStyle = WOOD;
    g.fillRect(pointerX - 4, curY - 3, 8, 3);
    g.fillRect(pointerX - 2, curY - 5, 4, 2);
    g.fillStyle = CREAM;
    g.fillRect(pointerX - 2, curY - 2, 4, 2);
  }

  // 8) 화자 뱃지 (있을 때만)
  if (d.speaker && badgeTextEl) {
    const bw = Math.round(h.tw(badgeTextEl)) + 18;
    const bh = 22;
    const bx = panelX + 14;
    const by = curY - 10;

    const f = h.frame(bx, by, bw, bh);
    h.fillIn(OUTLINE, f, 1, 0, 1, 0);
    h.fillIn(OUTLINE, f, 0, 1, 0, 1);
    h.fillIn('#382315', f, 1, 1, 1, 1);
    h.put(badgeTextEl, bx + 9, centerY(badgeTextEl, by, by + bh - 1));
  }

  // 9) 본문 텍스트 (16px, INK)
  const textStartX = panelX + 18;
  const textStartY = curY + padTop + 2;

  for (let idx = 0; idx < lineElements.length; idx++) h.put(lineElements[idx], textStartX, textStartY + idx * lineH);

  g.restore();
}

export function drawDialoguePanel(h: Hud, d: { speaker: string; text: string; portrait: string | null }): void {
  const e = h.edge;
  const panelW = Math.min(600, Math.round(h.w * 0.92));
  const panelH = 96;
  const x = Math.round((h.w - panelW) / 2);
  const y = h.h - panelH - 16 - dockBottom(h);

  h.panel(x, y, panelW, panelH);

  // 초상화 해석: d.portrait 우선 확인 후, 없거나 해석 불가 시 d.speaker 로 확인
  const portraitKey = resolvePortraitKey(d.portrait) ?? resolvePortraitKey(d.speaker);
  const hasPortrait = portraitKey !== null;

  // 화자 뱃지
  if (d.speaker) {
    const badgeText = h.txt(d.speaker, 12, '#ffffff');
    const bw = Math.round(h.tw(badgeText)) + 18;
    const bh = 22;
    const bx = x + 12;
    const by = y - 12;

    const f = h.frame(bx, by, bw, bh);
    h.fillIn(OUTLINE, f, 1, 0, 1, 0);
    h.fillIn(OUTLINE, f, 0, 1, 0, 1);
    h.fillIn('#3d2817', f, 1, 1, 1, 1);
    h.put(badgeText, bx + 9, centerY(badgeText, by, by + bh - 1));
  }

  // 초상화 액자 및 렌더링 (초상화가 있을 때만 좌측에 표시)
  if (hasPortrait && portraitKey) {
    const boxSize = 48;
    const boxX = x + 16;
    const boxY = y + Math.round((panelH - boxSize) / 2);

    const f = h.frame(boxX, boxY, boxSize, boxSize);
    h.fillIn(OUTLINE, f, 1, 0, 1, 0);
    h.fillIn(OUTLINE, f, 0, 1, 0, 1);
    h.fillIn('#3d2817', f, 1, 1, 1, 1);
    h.fillIn('#1a120b', f, 2, 2, 2, 2);

    drawPortrait(h.ctx, boxX + 4, boxY + 4, portraitKey, 56);
  }

  // 본문 텍스트 (줄바꿈): 초상화가 있으면 오른쪽으로 밀고 너비를 줄임. 없으면 기존 레이아웃 유지
  const contentX = hasPortrait ? x + 76 : x + 20;
  const contentY = y + 18;
  const maxTextW = hasPortrait ? panelW - 96 : panelW - 40;
  const lines = h.wrapMemo(d.text, maxTextW, 14, 3);

  for (let idx = 0; idx < lines.length; idx++) {
    const l = lines[idx];
    const t = h.txt(l, 14, INK);
    h.put(t, contentX, contentY + idx * 22);
  }

  // 다음 대사 넘기기 힌트
  const advanceHint = h.txt(h.touch ? '▼ 탭' : '▼ Enter / 클릭', 10, INK_SOFT);
  h.put(advanceHint, x + panelW - h.tw(advanceHint) - 16, y + panelH - 18);
}

export function drawChoicePanel(h: Hud, ch: DialogueChoice): void {
  const g = h.ctx;
  const e = h.edge;
  h.choiceOptionRects.length = 0; // 새 배열을 만들지 않고 비운다

  const optH = 44;
  const headerH = 32;
  const footerH = 20;
  const panelW = Math.min(580, Math.round(h.w * 0.94));
  const panelH = headerH + ch.options.length * optH + footerH + 8;
  const x = Math.round((h.w - panelW) / 2);
  // 대사창 바로 위에 가지런히 배치
  const y = Math.max(16, h.h - panelH - (h.dialogue ? 116 : 28) - dockBottom(h));

  h.panel(x, y, panelW, panelH);

  // 제목/상황 프롬프트 바
  const pTitle = h.txt(ch.prompt || '아브람의 대답 선택', 11, '#ffffff');
  const bw = Math.round(h.tw(pTitle)) + 20;
  const bh = 22;
  const bx = x + 14;
  const by = y - 11;
  const f = h.frame(bx, by, bw, bh);
  h.fillIn(OUTLINE, f, 1, 0, 1, 0);
  h.fillIn(OUTLINE, f, 0, 1, 0, 1);
  h.fillIn('#4a2e1b', f, 1, 1, 1, 1);
  h.put(pTitle, bx + 10, centerY(pTitle, by, by + bh - 1));

  // 선택지 리스트
  const startY = y + headerH;
  for (let idx = 0; idx < ch.options.length; idx++) {
    const opt = ch.options[idx];
    const isSel = idx === ch.selectedIndex;
    const oy = startY + idx * optH;
    const ox = x + 14;
    const ow = panelW - 28;
    const oh = optH - 6;

    h.choiceOptionRects.push({ x: ox, y: oy, w: ow, h: oh });

    // 카드 배경
    g.fillStyle = isSel ? '#fff7e4' : '#ede2ce';
    g.fillRect(ox, oy, ow, oh);

    // 테두리
    g.strokeStyle = isSel ? '#d48236' : '#c8b69c';
    g.lineWidth = isSel ? 2 : 1;
    g.strokeRect(ox, oy, ow, oh);

    // 선택 인디케이터
    if (isSel) {
      g.fillStyle = '#d48236';
      g.fillRect(ox, oy, 4, oh);
    }

    // 뱃지 (예: [미드라시 풍자] / [성경적 직언])
    let textOffsetX = ox + (isSel ? 16 : 12);
    if (opt.badge) {
      const badgeColor = opt.badgeColor || (idx === 0 ? '#b85422' : '#28629e');
      const bText = h.txt(opt.badge, 10, '#ffffff');
      const bW = Math.round(h.tw(bText)) + 12;
      const bH = 18;
      const bY = oy + Math.round((oh - bH) / 2);
      g.fillStyle = badgeColor;
      g.fillRect(textOffsetX, bY, bW, bH);
      h.put(bText, textOffsetX + 6, bY + 3);
      textOffsetX += bW + 8;
    }

    // 옵션 본문
    const optText = h.txt(opt.text, 12, isSel ? '#2a1a10' : INK);
    h.put(optText, textOffsetX, oy + Math.round((oh - 14) / 2));
  }

  // 하단 키 안내
  const hintText = h.txt(h.touch ? '[탭] 답을 골라 결정' : '[위/아래] 선택  ·  [1, 2] 단축키  ·  [Enter / 클릭] 결정', 10, INK_SOFT);
  h.put(hintText, x + Math.round((panelW - h.tw(hintText)) / 2), y + panelH - 17);
}

/**
 * 자막. voice = 하늘의 음성: 화면 가운데 금빛 글자, 사람 이름·초상 없이 (빛과 글로만 표현)
 * narration = 이야기꾼: 아래 레터박스 안 크림색 글자
 */
export function drawCaption(h: Hud, c: CaptionState) {
  const g = h.ctx;
  const portraitKey = c.speaker ? resolvePortraitKey(c.speaker) : null;

  if (portraitKey) {
    const bh = Math.round(h.h * 0.12 * h.letterbox);
    const barH = Math.max(bh, 76);
    const textH = Math.max(76, barH - h.edge.bottom);
    const barTop = h.h - h.edge.bottom - textH;

    if (h.letterbox <= 0 || bh < barH) {
      g.fillStyle = '#0a0806';
      g.fillRect(0, barTop, h.w, textH + h.edge.bottom);
    }

    const a = c.age < 0.15 ? 0.5 : c.hold - c.age < 0.25 ? 0.5 : 1;
    g.globalAlpha = a;

    const boxSize = 64;
    const padLeft = Math.max(16, h.edge.left + 20);
    const boxX = padLeft;
    const boxY = barTop + Math.max(2, Math.round((textH - boxSize) / 2));

    const f = h.frame(boxX, boxY, boxSize, boxSize);
    h.fillIn(OUTLINE, f, 1, 0, 1, 0);
    h.fillIn(OUTLINE, f, 0, 1, 0, 1);
    h.fillIn('#3d2817', f, 1, 1, 1, 1);
    h.fillIn('#1a120b', f, 2, 2, 2, 2);

    drawPortrait(h.ctx, boxX + 4, boxY + 4, portraitKey, 40);

    const textLeft = boxX + boxSize + 14;
    const maxTextW = h.w - textLeft - Math.max(16, h.edge.right + 20);

    const displayName = tr(c.speaker!);
    const speakerTxt = h.txt(displayName, 12, ACCENT, OUTLINE);

    const base = 13, size = h.fs(base);
    const lh = size + 6;
    const lines = h.wrapMemo(c.text, maxTextW, base, 2, '#000000');

    const totalH = 15 + 4 + lines.length * lh - 6;
    const textY0 = Math.max(barTop + 4, boxY + Math.round((boxSize - totalH) / 2));
    h.put(speakerTxt, textLeft, textY0);

    let n = Math.min(c.text.length, Math.floor(c.age * 26));
    const dialY0 = textY0 + 17;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (n <= 0) continue;
      const cnt = Math.min(n, line.length);
      n -= line.length + 1;
      const t = h.txt(line, base, '#ffe7a8', OUTLINE);
      const y = dialY0 + i * lh;
      if (cnt >= line.length) {
        h.put(t, textLeft, y);
      } else {
        g.save();
        g.beginPath();
        const cr = snapRect(textLeft, y - 2, Math.ceil((h.tw(t) * cnt) / Math.max(1, line.length)) + 1, size + 8, h.d), dd = h.d;
        g.rect(cr.x0 / dd, cr.y0 / dd, (cr.x1 - cr.x0) / dd, (cr.y1 - cr.y0) / dd);
        g.clip();
        h.put(t, textLeft, y);
        g.restore();
      }
    }

    g.globalAlpha = 1;
    return;
  }

  const title = c.style === 'title';
  const voice = c.style === 'voice' || title;
  // 제목: 크게, 화면 한가운데. base = 보통 단계 크기 (음성 16 · 이야기꾼 13 — 글자 크기 단계는 정책이 키움), size = 실제 UI 크기
  const base = title ? 30 : voice ? 16 : 13, size = h.fs(base);
  let lay = h.captionLayout.get(c);
  if (!lay || lay.w !== h.w) {
    lay = h.layoutCaption(c, base, voice, title);
    h.captionLayout.set(c, lay);
  }
  const lines = lay.lines;
  // 글자가 한 자씩 나오고, 들어올 때·나갈 때 두 단계로 흐려짐
  let n = Math.min(c.text.length, Math.floor(c.age * (voice ? 16 : 26)));
  if (n <= 0) return;
  const a = c.age < 0.15 ? 0.5 : c.hold - c.age < 0.25 ? 0.5 : 1;
  const lh = size + 8;
  const bh = Math.round(h.h * 0.12 * h.letterbox);
  // 이야기꾼 자막은 아래 안전 영역(둥근 모서리·제스처 막대) 위의 띠 안에 가운데 맞춤 (여백이 0 이면 예전과 같음)
  // 줄 수에 맞춰 띠 높이를 키운다 (두 줄 자막이 화면 아래로 잘리지 않게) — 레터박스가 없을 때는 어두운 바탕을 깔아 장면 위에서도 읽히게
  const needH = lines.length * lh - 8 + 18;
  const barH = Math.max(bh, 30, voice ? 0 : needH), textH = Math.max(30, barH - h.edge.bottom), barTop = h.h - h.edge.bottom - textH;
  if (!voice && h.letterbox <= 0) {
    g.globalAlpha = a * 0.6;
    g.fillStyle = '#0a0806';
    g.fillRect(0, barTop, h.w, textH + h.edge.bottom);
  }
  const y0 = title ? Math.round(h.h * 0.45 - (lines.length * lh - 8) / 2) : voice ? Math.round(h.h * 0.2)
    : lines.length === 1 ? barTop + Math.round((textH - 16 - h.grow(13)) / 2) : barTop + Math.max(0, Math.round((textH - (lines.length * lh - 8)) / 2));
  g.globalAlpha = a;
  if (voice) {
    // 글자 뒤 은은한 빛 띠 (계단진 세 겹)
    // 높이: 마지막 줄 뒤 줄 간격(8)은 빼서 위아래 여백을 같게. 화면이 어두워지면(엔딩 검은 화면) 띠가 상자처럼 보이므로 흐리게
    const bandW = lay.maxW + 40, bandH = lines.length * lh - 8 + 14;
    const glow = 1 - Math.min(1, h.fade) * 0.85;
    // 부르심의 흰 빛기둥처럼 밝은 배경 위에서도 읽히게 어두운 바탕을 먼저 깖 (금빛 띠는 그 위에서 따뜻한 기운만 더함)
    g.globalAlpha = a * 0.55 * glow;
    g.fillStyle = '#140c06';
    g.fillRect(Math.round(h.w / 2 - bandW / 2) - 10, y0 - 7 - 5, bandW + 20, bandH + 10);
    for (let bi = 0; bi < GLOW_BANDS.length; bi++) {
      const pad = GLOW_BANDS[bi][0], al = GLOW_BANDS[bi][1];
      g.globalAlpha = a * al * glow;
      g.fillStyle = '#ffd98a';
      g.fillRect(Math.round(h.w / 2 - bandW / 2) - pad, y0 - 7 - pad / 2, bandW + pad * 2, bandH + pad);
    }
    g.globalAlpha = a;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (n <= 0) continue;
    const cnt = Math.min(n, line.length);
    n -= line.length + 1;
    // 줄 전체를 한 번만 그려 캐시하고 보이는 만큼만 잘라 냄 (글자마다 새 글자판을 만들지 않음 — 대화창 본문과 같은 방식)
    const t = h.txt(line, base, voice ? '#ffe7a8' : '#f0e2c0', voice ? '#6a4818' : OUTLINE);
    const x = Math.round(h.w / 2 - lay.widths[i] / 2), y = y0 + i * lh;
    if (cnt >= line.length) h.put(t, x, y);
    else {
      g.save();
      g.beginPath();
      // 자르는 선도 장치 픽셀에 맞춤 (흐린 반 픽셀 열이 생기지 않게)
      const cr = snapRect(x, y - 2, Math.ceil((h.tw(t) * cnt) / Math.max(1, line.length)) + 1, size + 8, h.d), dd = h.d;
      g.rect(cr.x0 / dd, cr.y0 / dd, (cr.x1 - cr.x0) / dd, (cr.y1 - cr.y0) / dd);
      g.clip();
      h.put(t, x, y);
      g.restore();
    }
  }
  g.globalAlpha = 1;
}
