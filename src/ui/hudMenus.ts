import type { Hud } from './hud';
import { dev, frame, snapRect } from './uiScale';
import { centerY, densityOf, drawDigits } from './pixelText';
import { ACCENT, ACCENT_LIGHT, CREAM, INK, INK_SOFT, INK_WARM, OUTLINE, PAPER, PAPER_LIGHT, PAPER_SHADOW, RULE, WOOD, WOOD_LIGHT } from './theme';
import { tr } from '../i18n/tr';
import { lang, LANG_LABEL } from '../i18n/lang';
import { CATALOG } from '../systems/story';
import { PICK_AT } from './pickAt';
import { recommendedNext, visibleRows, scrollStart, scrollThumb } from './chapterHints';
import { drawPortrait, resolvePortraitKey } from './portraits';

/** 장 선택·일시정지·도움말·도감 패널 그리기 (hud.ts 에서 분리). Hud 의 공개 멤버만 쓴다. */


/** 장 선택에 보일 그 선택의 장 제목 (없으면 null) */
function pickChapterTitle(id: string): string | null {
  const at = PICK_AT[id];
  if (!at) return null;
  return CATALOG[at[0]]?.chapters[at[1]]?.title ?? null;
}

// 선택 요약을 그리는 Map.forEach 콜백이 쓰는 모듈 버퍼 (클로저·[key,value] 항목 배열을 프레임마다 만들지 않으려고)
let pickCount = 0;
let pickHud: Hud | null = null;
let pickSkip = 0, pickShown = 0, pickDrawX = 0, pickDrawBase = 0, pickSeen = 0, pickRow = 0;
function countPickCb(_tag: string, id: string): void { if (PICK_AT[id]) pickCount++; }
function drawPickCb(tag: string, id: string): void {
  const h = pickHud;
  if (!h) return;
  const label = pickChapterTitle(id);
  if (!label) return;
  if (pickSeen++ < pickSkip) return;
  const line = h.txt(`· ${tr(label)}: ${tr(tag)}`, 10, INK_SOFT);
  h.put(line, pickDrawX, pickDrawBase - 14 * (pickShown - pickRow));
  pickRow++;
}

/** 추천 다음 장은 끝낸 장 집합이 바뀔 때만 다시 센다 (프레임마다 순회·할당하지 않음) */
let recSet: ReadonlySet<string> | null = null, recSize = -1, recVal: { book: number; chapter: number } | null = null;
let recCounts: number[] | null = null;
function cachedRecommended(done: ReadonlySet<string>): { book: number; chapter: number } | null {
  if (done !== recSet || done.size !== recSize) {
    if (!recCounts) recCounts = CATALOG.map((b) => b.chapters.length);
    recSet = done; recSize = done.size; recVal = recommendedNext(done, recCounts);
  }
  return recVal;
}

const BOOK_TAB_FULL: readonly string[] = ['인트로', '1권: 불·팥죽', '2권: 약속의 땅', '3권: 별·언약', '4권: 소돔의 불', '5권: 모리아', '6권: 막벨라', '아우트로'];
const BOOK_TAB_SHORT: readonly string[] = ['인트로', '1권', '2권', '3권', '4권', '5권', '6권', '아우트로'];

export function drawChapterSelect(h: Hud): void {
  const g = h.ctx;
  g.fillStyle = 'rgba(0, 0, 0, 0.7)';
  g.fillRect(0, 0, h.w, h.h);

  const mw = Math.min(640, Math.round(h.w * 0.94));
  // 세로 화면(폰): 위아래가 길게 남으므로 패널도 키워 더 많은 줄을 보인다 (가로는 기존 크기)
  const tall = h.h > h.w * 1.15;
  const mh = Math.min(tall ? 1400 : 460, Math.round(h.h * (tall ? 0.94 : 0.88)));
  const mx = Math.round((h.w - mw) / 2);
  const my = Math.round((h.h - mh) / 2);

  h.chapterPanelRect.x = mx;
  h.chapterPanelRect.y = my;
  h.chapterPanelRect.w = mw;
  h.chapterPanelRect.h = mh;

  h.panel(mx, my, mw, mh);

  const title = h.txt(tr('성경 대서사 권 / 장 선택'), 16, INK);
  h.put(title, mx + 20, my + 14);

  // 오른쪽 위 닫기 단추 (터치에는 Esc 가 없다)
  const cr = h.chapterCloseRect;
  cr.w = 26; cr.h = 22; cr.x = mx + mw - cr.w - 10; cr.y = my + 10;
  g.fillStyle = PAPER_SHADOW;
  g.fillRect(cr.x, cr.y, cr.w, cr.h);
  g.strokeStyle = WOOD;
  g.lineWidth = 1;
  g.strokeRect(cr.x + 0.5, cr.y + 0.5, cr.w - 1, cr.h - 1);
  const xs = h.txt('✕', 13, INK);
  h.put(xs, cr.x + Math.round((cr.w - h.tw(xs)) / 2), cr.y + 3);

  // 8개 권 탭 (상단 가로) — 칸에 안 들어가는 긴 이름은 짧은 이름(N권)으로 줄인다 (잘려서 '약속의 ᄆ' 처럼 보이지 않게)
  const bookNames = BOOK_TAB_FULL;
  const tabY = my + 42;
  const tabW = Math.floor((mw - 40) / bookNames.length);
  // 한 탭이라도 긴 이름이 안 들어가면 모든 탭을 짧은 이름으로 통일한다 (어떤 탭은 길고 어떤 탭은 짧으면 어수선하다)
  let useShort = false;
  for (let idx = 0; idx < bookNames.length; idx++) if (h.tw(h.txt(tr(bookNames[idx]), 10, INK_SOFT, PAPER_SHADOW)) > tabW - 4 - 6) { useShort = true; break; }

  for (let idx = 0; idx < bookNames.length; idx++) {
    const name = bookNames[idx];
    const isSel = idx === h.chapterSelect.bookIndex;
    const tx = mx + 20 + idx * tabW;
    const tw = tabW - 4;
    const th = 22;

    if (idx < h.chapterBookRects.length) {
      const r = h.chapterBookRects[idx];
      r.x = tx; r.y = tabY; r.w = tw; r.h = th; r.index = idx;
    } else {
      h.chapterBookRects.push({ x: tx, y: tabY, w: tw, h: th, index: idx });
    }

    const col = isSel ? '#ffffff' : INK_SOFT;
    const bg = isSel ? '#8e4a2e' : '#e2d5be';
    g.fillStyle = bg;
    g.fillRect(tx, tabY, tw, th);
    // 선택된 탭은 흰 글자 + 어두운 그림자 (기본 밝은 종이색 그림자는 갈색 바탕에서 글자가 번져 보인다)
    const t = h.txt(tr(useShort ? BOOK_TAB_SHORT[idx] : name), 10, col, isSel ? '#4a2418' : PAPER_SHADOW);
    h.put(t, tx + Math.max(2, Math.round((tw - h.tw(t)) / 2)), tabY + 4);
  }
  h.chapterBookRects.length = bookNames.length;

  // 선택된 권의 챕터 목록 (세로 리스트, 좌측)
  const listY = tabY + 30;
  // 아래 안내(두 줄까지 줄바꿈) 높이: 패널 아래 테두리에 글자가 닿지 않게 안쪽 여백을 둔다
  const noteStr = tr('어느 장이든 바로 시작할 수 있다 · ✓ 끝낸 장 · 추천 = 다음에 볼 장');
  const hintStr = tr(h.touch ? '장을 탭해 고르기 · 한 번 더 탭하면 이동 · ✕ 단추로 닫기' : '[클릭/탭] 선택 및 이동 · [Enter] 이동 · [Tab/Esc] 닫기');
  const footW = mw - 40;
  const noteLines = h.wrapMemo(noteStr, footW, 11, 2, INK_SOFT), hintLines = h.wrapMemo(hintStr, footW, 11, 2, INK_WARM);
  const FLH = 18;
  const footH = (noteLines.length + hintLines.length) * FLH + 16;
  const footTop = my + mh - footH;
  const bookData = CATALOG[h.chapterSelect.bookIndex];
  const chList = bookData?.chapters || [];

  // 스크롤 가시 범위: 패널 높이에 맞춰 4~10 줄 (작은 화면에서 목록이 아래 안내를 덮지 않게)
  // 세로 화면: 남는 높이를 줄 간격에 나눠 쓴다 (40~54, 내용은 줄 안에서 세로 가운데)
  const ROW = tall ? Math.max(40, Math.min(54, Math.floor((footTop - 4 - listY) / Math.max(8, chList.length)))) : 24;
  const padY = tall ? Math.floor((ROW - 40) / 2) : 0;
  const visibleCount = visibleRows(footTop - 4 - listY, ROW, tall ? 20 : 10);
  const scrollOffset = scrollStart(h.chapterSelect.chapterIndex, chList.length, visibleCount);
  const sliceLen = Math.max(0, Math.min(visibleCount, chList.length - scrollOffset)); // 보이는 개수 (새 배열을 만들지 않는다)
  const bi = h.chapterSelect.bookIndex;
  // 추천 다음 장·이어하기 자리 (첫 호출 때 한 번 계산하는 게 아니라 프레임마다 가볍게: 권 수만큼 순회, 할당 없음)
  const rec = cachedRecommended(h.doneChapters);
  const recBook = rec ? rec.book : -1, recCh = rec ? rec.chapter : -1;
  const resume = h.resumeAt;
  const tagRec = h.txt(tr('추천'), 10, '#ffffff', '#4a2418'), tagRes = h.txt(tr('이어하기'), 10, '#ffffff', '#1f3a52');
  const itemW = tall ? Math.min(260, Math.max(170, Math.round(mw * 0.46))) : Math.min(280, Math.max(200, Math.round(mw * 0.46)));

  for (let sIdx = 0; sIdx < sliceLen; sIdx++) {
    const ch = chList[scrollOffset + sIdx];
    const actualIdx = scrollOffset + sIdx;
    const isSel = actualIdx === h.chapterSelect.chapterIndex;
    const itemY = listY + sIdx * ROW;
    const itemH = ROW - 2;

    if (sIdx < h.chapterItemRects.length) {
      const r = h.chapterItemRects[sIdx];
      r.x = mx + 20; r.y = itemY - 2; r.w = itemW; r.h = itemH; r.index = actualIdx;
    } else {
      h.chapterItemRects.push({ x: mx + 20, y: itemY - 2, w: itemW, h: itemH, index: actualIdx });
    }

    const col = isSel ? ACCENT : INK;
    if (isSel) {
      g.fillStyle = '#eddcc2';
      g.fillRect(mx + 20, itemY - 2, itemW, itemH);
    }
    const doneMark = h.doneChapters.has(`${bi}:${actualIdx}`) ? '✓ ' : '  ';
    // 꼬리표: 이어하기(지금 하던 장) > 추천(다음에 할 장)
    const isRes = !!resume && resume.book === bi && resume.chapter === actualIdx, isRec = bi === recBook && actualIdx === recCh;
    const tag = isRes ? tagRes : isRec ? tagRec : null;
    const label = (isSel ? '▶' : ' ') + doneMark + ch.title;
    const labelMaxW = tag && !tall ? itemW - Math.ceil(h.tw(tag)) - 30 : itemW - 12;
    if (tall) {
      // 세로 화면: 긴 제목은 잘라내지 않고 두 줄로 줄바꿈 (꼬리표 자리는 뺀 폭)
      // 꼬리표가 있는 줄은 꼬리표를 윗줄 오른쪽에, 제목은 아랫줄 한 줄에 둔다 (제목 위에 올라타지 않고 제목도 줄이지 않는다)
      const lines = tag ? null : h.wrapMemo(label, labelMaxW, 11, 2, col);
      if (tag) h.put(h.fitTxt(label, 11, col, labelMaxW), mx + 24, itemY + padY + 19);
      else if (lines && lines.length > 1) {
        for (let li = 0; li < lines.length; li++) h.put(h.txt(li === 0 ? lines[li] : '    ' + lines[li].trim(), 11, col), mx + 24, itemY + padY + li * 17);
      } else h.put(h.txt(label, 11, col), mx + 24, itemY + Math.round((itemH - 18) / 2));
    } else {
      let t = h.txt(label, 11, col);
      // 좁은 화면에서 제목이 꼬리표 밑으로 들어가 겹치지 않게, 꼬리표 자리를 뺀 폭에 맞춰 줄인다 (끝은 …)
      if (tag && h.tw(t) > labelMaxW) t = h.fitTxt(label, 11, col, labelMaxW);
      h.put(t, mx + 24, itemY + 2);
    }
    if (tag) {
      const tw = Math.ceil(h.tw(tag)) + 8, tx = mx + 20 + itemW - tw - (tall ? 6 : 14), ty = tall ? itemY + padY + 1 : itemY;
      g.fillStyle = isRes ? '#2f5f86' : '#8e4a2e';
      g.fillRect(tx, ty, tw, 16);
      h.put(tag, tx + 4, centerY(tag, ty, ty + 16));
    }
  }
  h.chapterItemRects.length = sliceLen;

  // 스크롤 단서: 오른쪽 막대 + 위/아래 숨은 개수 (화살표는 목록 끝 줄에 겹쳐 그리지 않고 막대 끝에)
  const trackX = mx + 20 + itemW + 4, trackY = listY - 2, trackH = visibleCount * ROW - 2;
  const thumb = scrollThumb(scrollOffset, visibleCount, chList.length, trackH);
  if (thumb) {
    g.fillStyle = PAPER_SHADOW; g.fillRect(trackX, trackY, 4, trackH);
    g.fillStyle = WOOD; g.fillRect(trackX, trackY + thumb.y, 4, thumb.h);
  }
  const hiddenAbove = scrollOffset, hiddenBelow = Math.max(0, chList.length - scrollOffset - visibleCount);
  if (hiddenAbove > 0) { const t = h.txt(`▲ ${hiddenAbove}`, 10, ACCENT, PAPER_SHADOW); h.put(t, trackX - Math.ceil(h.tw(t)) - 2, listY - 16); }
  if (hiddenBelow > 0) { const t = h.txt(`▼ ${hiddenBelow}`, 10, ACCENT, PAPER_SHADOW); h.put(t, trackX - Math.ceil(h.tw(t)) - 2, trackY + trackH + 1); }

  // 지금까지 한 선택 개수 (상세 요약이 쓸 수 있는 높이를 정하려고 먼저 센다)
  pickCount = 0;
  h.picks.forEach(countPickCb);
  const pickTotal0 = pickCount;

  // 우측 챕터 상세 정보 및 요약
  const selChapter = chList[h.chapterSelect.chapterIndex];
  if (selChapter) {
    const infoX = mx + 20 + itemW + 22;
    const infoW = mx + mw - 20 - infoX;
    const chTitle = tall ? h.fitTxt(selChapter.title, 13, INK, infoW - 4) : h.txt(selChapter.title, 13, INK);
    h.put(chTitle, infoX, listY);

    // 배경·등장 줄: 세로 화면(좁은 칸)에서는 패널 밖으로 나가지 않게 줄바꿈 (가로는 기존대로 한 줄)
    let infoY = listY + 22;
    if (selChapter.location) {
      const locKey = tr('배경: ') + selChapter.location;
      const ll = tall ? h.wrapMemo(locKey, infoW - 6, 10, 2, INK_WARM) : null;
      if (ll) { for (let i = 0; i < ll.length; i++) { h.put(h.txt(ll[i], 10, INK_WARM), infoX, infoY); infoY += 18; } }
      else { h.put(h.txt(locKey, 10, INK_WARM), infoX, listY + 22); infoY = listY + 40; }
    }
    if (selChapter.characters && selChapter.characters.length > 0) {
      const chKey = tr('등장: ') + selChapter.characters.join(', ');
      const cl = tall ? h.wrapMemo(chKey, infoW - 6, 10, 3, INK_SOFT) : null;
      if (cl) { for (let i = 0; i < cl.length; i++) { h.put(h.txt(cl[i], 10, INK_SOFT), infoX, infoY); infoY += 18; } }
      else { h.put(h.txt(chKey, 10, INK_SOFT), infoX, listY + 40); infoY = listY + 58; }
    }
    const sumTop = tall ? infoY + 6 : listY + 68;

    // 요약 줄바꿈
    if (selChapter.summary) {
      const sumLH = 16 + h.grow(12);
      const sumBottom = footTop - 4 - (pickTotal0 > 0 ? 14 * (Math.min(pickTotal0, 5) + 1) + 6 : 0);
      const sumMax = Math.max(2, Math.min(8, Math.floor((sumBottom - sumTop) / sumLH)));
      const sumLines = h.wrapMemo(selChapter.summary, infoW - 6, 12, sumMax);
      for (let lIdx = 0; lIdx < sumLines.length; lIdx++) {
        const l = sumLines[lIdx];
        const st = h.txt(l, 12, INK);
        h.put(st, infoX, sumTop + lIdx * sumLH);
      }
    }
  }

  // 지금까지 한 선택 (오른쪽 아래) — 이름이 있는 선택 중 가장 최근 5개 (넘치면 오래된 것부터 가린다)
  const pickTotal = pickTotal0;
  if (pickTotal > 0) {
    const shown = Math.min(pickTotal, 5), skip = pickTotal - shown;
    const pickX = mx + 20 + itemW + 22, pickBase = footTop - 4;
    const head = h.txt(tr('지금까지 한 선택') + (skip > 0 ? ` (+${skip})` : ''), 10, INK_WARM);
    h.put(head, pickX, pickBase - 14 * (shown + 1));
    pickHud = h; pickSkip = skip; pickShown = shown; pickDrawX = pickX; pickDrawBase = pickBase; pickSeen = 0; pickRow = 0;
    h.picks.forEach(drawPickCb);
    pickHud = null;
  }

  // 자유 선택 안내: 어느 장이든 바로 시작할 수 있고, ✓ 는 끝까지 본 장에만 붙는다 (건너뛰어도 기록이 지워지지 않는다)
  let fy = footTop + 2;
  for (let i = 0; i < noteLines.length; i++, fy += FLH) h.put(h.txt(noteLines[i], 11, INK_SOFT), mx + 20, fy);
  for (let i = 0; i < hintLines.length; i++, fy += FLH) h.put(h.txt(hintLines[i], 11, INK_WARM), mx + 20, fy);
}

export function drawPauseMenu(h: Hud): void {
  const g = h.ctx;
  g.fillStyle = 'rgba(0, 0, 0, 0.6)';
  g.fillRect(0, 0, h.w, h.h);

  const pw = 300;
  const ph = 382;
  const px = Math.round((h.w - pw) / 2);
  const py = Math.round((h.h - ph) / 2);

  h.pausePanelRect.x = px;
  h.pausePanelRect.y = py;
  h.pausePanelRect.w = pw;
  h.pausePanelRect.h = ph;

  h.panel(px, py, pw, ph);

  const title = h.txt(tr('일시 정지 (Paused)'), 15, INK);
  h.put(title, Math.round(px + (pw - h.tw(title)) / 2), py + 16);

  const items = [
    tr('이어서 하기'),
    tr('도움말'),
    tr('장 선택'),
    tr('배경음악'),
    tr('효과음'),
    tr('음성 안내'),
    `${tr('언어')}: ${LANG_LABEL[lang()]}`,
    tr('이 장 건너뛰기'),
    tr('새로 시작'),
    tr('닫기 [Esc]'),
  ];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const selected = idx === h.pauseMenu.selectedItem;
    const color = selected ? ACCENT : INK;
    const itemY = py + 48 + idx * 30;
    const itemW = pw - 40;
    const itemH = 26;

    if (idx < h.pauseItemRects.length) {
      const r = h.pauseItemRects[idx];
      r.x = px + 20; r.y = itemY; r.w = itemW; r.h = itemH; r.index = idx;
    } else {
      h.pauseItemRects.push({ x: px + 20, y: itemY, w: itemW, h: itemH, index: idx });
    }

    if (selected) {
      g.fillStyle = '#eddcc2';
      g.fillRect(px + 20, itemY, itemW, itemH);
    }

    const t = h.txt((selected ? '▶ ' : '   ') + item, 12, color);
    h.put(t, px + 26, itemY + 5);
  }
  h.pauseItemRects.length = items.length;
}

export function drawHelp(h: Hud): void {
  const g = h.ctx;
  g.fillStyle = 'rgba(0, 0, 0, 0.72)';
  g.fillRect(0, 0, h.w, h.h);

  const mw = Math.min(580, Math.round(h.w * 0.92));
  const mh = Math.min(400, Math.round(h.h * 0.88));
  const mx = Math.round((h.w - mw) / 2);
  const my = Math.round((h.h - mh) / 2);

  h.helpPanelRect.x = mx;
  h.helpPanelRect.y = my;
  h.helpPanelRect.w = mw;
  h.helpPanelRect.h = mh;

  h.panel(mx, my, mw, mh);

  const title = h.txt(tr('조작 방법 및 단축키 안내'), 15, INK);
  h.put(title, mx + 20, my + 14);

  // 오른쪽 위 ✕ — 화면을 아무 데나 탭해도 닫히지만 닫는 법이 눈에 보이게 한다 (장 선택과 같은 모양)
  const cx = mx + mw - 36, cy = my + 10;
  g.fillStyle = PAPER_SHADOW;
  g.fillRect(cx, cy, 26, 22);
  g.strokeStyle = WOOD;
  g.lineWidth = 1;
  g.strokeRect(cx + 0.5, cy + 0.5, 25, 21);
  const hx = h.txt('✕', 13, INK);
  h.put(hx, cx + Math.round((26 - h.tw(hx)) / 2), cy + 3);

  // 구분선
  g.fillStyle = '#c8b496';
  g.fillRect(mx + 20, my + 38, mw - 40, 1);

  const contentY = my + 50;
  const isTouch = h.touch;

  if (isTouch) {
    const touchRows: [string, string][] = [
      [tr('가상 스틱 (좌하단)'), tr('8방향 이동 및 메뉴 항목 이동')],
      [tr('행동 단추'), tr('상호작용, 대사 넘기기, 대화 선택 확인')],
      [tr('달리기 단추'), tr('달리기 모드 켜기 / 끄기 토글')],
      [tr('장 선택 단추'), tr('원하는 권과 챕터로 즉시 이동')],
      [tr('도감 단추'), tr('성경 본문 및 미드라시 전승 도감 열람')],
      [tr('메뉴 단추'), tr('일시정지 메뉴 열기 및 열린 창 닫기')],
      [tr('화면 탭 / 터치'), tr('해당 위치로 걸어가기 또는 대상 상호작용')],
    ];
    for (let idx = 0; idx < touchRows.length; idx++) {
      const [keyName, desc] = touchRows[idx];
      const rowY = contentY + idx * 36;
      const kEl = h.txt(keyName, 12, ACCENT);
      const dEl = h.txt(desc, 11, INK);
      h.put(kEl, mx + 24, rowY);
      h.put(dEl, mx + 160, rowY + 1);
    }
  } else {
    const pcRows: [string, string][] = [
      [tr('이동 (WASD / 방향키)'), tr('캐릭터 이동 (또는 마우스 지면 클릭)')],
      [tr('상호작용 [E]'), tr('사물 조사, 인물 대화, 행동 실행 (클릭 가능)')],
      [tr('대사 넘기기 [Space / Enter]'), tr('컷신 및 대화 진행, 선택지 결정')],
      [tr('달리기 [Shift]'), tr('누른 상태로 빠르게 달리기')],
      [tr('권 / 장 선택 [Tab]'), tr('전체 6권 50개 챕터 바로가기 오버레이')],
      [tr('미드라시 도감 [C]'), tr('성서 배경 및 랍비 구전 전승 열람')],
      [tr('일시정지 메뉴 [Esc]'), tr('게임 메뉴, 사운드 볼륨, 언어 설정')],
      [tr('도움말 [F1 / H]'), tr('언제든 이 조작 안내창 다시 열기')],
    ];
    for (let idx = 0; idx < pcRows.length; idx++) {
      const [keyName, desc] = pcRows[idx];
      const rowY = contentY + idx * 34;
      const kEl = h.txt(keyName, 12, ACCENT);
      const dEl = h.txt(desc, 11, INK);
      h.put(kEl, mx + 24, rowY);
      h.put(dEl, mx + 180, rowY + 1);
    }
  }

  // 조작 말고도 알아 둘 것 두 줄 (패널 아래가 비어 보이지 않게)
  h.put(h.txt(tr('저장: 일정 시간마다, 그리고 창을 닫거나 숨길 때 자동으로 저장됩니다'), 11, INK_SOFT), mx + 20, my + mh - 66);
  h.put(h.txt(tr('선택은 이후 장면에 영향을 줍니다 (장 선택 화면의 "지금까지 한 선택"에서 확인)'), 11, INK_SOFT), mx + 20, my + mh - 46);

  const hint = h.txt(tr(h.touch ? '[✕] 또는 화면을 탭하면 닫힌다' : '[Esc / Enter / 마우스 클릭] 창 닫기'), 11, INK_WARM);
  h.put(hint, mx + 20, my + mh - 24);
}

export function drawCodex(h: Hud): void {
  const g = h.ctx;
  g.fillStyle = 'rgba(0, 0, 0, 0.65)';
  g.fillRect(0, 0, h.w, h.h);

  const mw = Math.min(680, h.w - 32);
  const mh = Math.min(440, h.h - 32);
  const mx = Math.round((h.w - mw) / 2);
  const my = Math.round((h.h - mh) / 2);

  h.panel(mx, my, mw, mh);

  // 상단 헤더
  const headerTitle = h.txt('📖 성경 & 미드라시 도감 (Biblical Lore Codex)', 14, INK);
  h.put(headerTitle, mx + 24, my + 16);

  let unlockedCount = 0;
  for (let i = 0; i < h.codex.entries.length; i++) {
    if (h.codex.entries[i].unlocked) unlockedCount++;
  }
  const countText = h.txt(`기록된 전승: ${unlockedCount} / ${h.codex.entries.length}`, 11, INK_SOFT);
  h.put(countText, mx + mw - h.tw(countText) - 24, my + 18);

  // 구분선
  g.fillStyle = '#c8b496';
  g.fillRect(mx + 20, my + 38, mw - 40, 1);

  // 좌측: 목록 (폭 240)
  const listX = mx + 20;
  const listY = my + 48;
  const listW = 230;
  const itemH = 36;

  // 스크롤 가시 범위 (최대 10개)
  const visibleCount = 10;
  const scrollOffset = Math.max(0, Math.min(h.codex.entries.length - visibleCount, h.codex.selectedIndex - 4));
  const sliceLen = Math.max(0, Math.min(visibleCount, h.codex.entries.length - scrollOffset));

  for (let sIdx = 0; sIdx < sliceLen; sIdx++) {
    const entry = h.codex.entries[scrollOffset + sIdx];
    const idx = scrollOffset + sIdx;
    const isSel = idx === h.codex.selectedIndex;
    const iy = listY + sIdx * itemH;

    if (sIdx < h.codexItemRects.length) {
      const r = h.codexItemRects[sIdx];
      r.x = listX;
      r.y = iy;
      r.w = listW;
      r.h = itemH - 4;
      r.index = idx;
    } else {
      h.codexItemRects.push({ x: listX, y: iy, w: listW, h: itemH - 4, index: idx });
    }

    if (isSel) {
      g.fillStyle = '#eddcc2';
      g.fillRect(listX, iy, listW, itemH - 4);
      g.fillStyle = ACCENT;
      g.fillRect(listX, iy, 4, itemH - 4);
    }

    const icon = entry.unlocked ? '📜 ' : '🔒 ';
    const titleStr = entry.unlocked ? entry.title : '미지의 성서 전승';
    const col = isSel ? ACCENT : (entry.unlocked ? INK : INK_SOFT);
    const titleEl = h.txt(icon + titleStr, 11, col);
    h.put(titleEl, listX + 8, iy + 6);

    const srcStr = entry.unlocked ? entry.source : '???';
    const srcEl = h.txt(srcStr, 9, INK_WARM);
    h.put(srcEl, listX + 24, iy + 20);
  }
  h.codexItemRects.length = sliceLen;

  // 중앙 수직 구분선
  g.fillStyle = '#c8b496';
  g.fillRect(mx + 258, my + 48, 1, mh - 84);

  // 우측: 상세 정보 패널 (폭 mw - 280)
  const detailX = mx + 274;
  const detailY = my + 48;
  const detailW = mw - 296;

  const sel = h.codex.entries[h.codex.selectedIndex];
  if (sel && sel.unlocked) {
    // 제목
    const titleEl = h.txt(sel.title, 13, INK);
    h.put(titleEl, detailX, detailY);

    // 출처 뱃지
    const srcEl = h.txt(`[출처: ${sel.source}]`, 10, '#b85422');
    h.put(srcEl, detailX, detailY + 20);

    // 요약 인용 박스
    const boxY = detailY + 38;
    g.fillStyle = '#f4ebd8';
    g.fillRect(detailX, boxY, detailW, 36);
    g.strokeStyle = '#dfd0b4';
    g.lineWidth = 1;
    g.strokeRect(detailX, boxY, detailW, 36);

    const sumLines = h.wrapMemo(sel.summary, detailW - 16, 10, 2);
    for (let sIdx = 0; sIdx < sumLines.length; sIdx++) {
      const sl = sumLines[sIdx];
      h.put(h.txt(sl, 10, INK), detailX + 8, boxY + 5 + sIdx * 14);
    }

    // 상세 해설 본문
    const detLines = h.wrapMemo(sel.detail, detailW, 11, 10, INK_SOFT);
    for (let dIdx = 0; dIdx < detLines.length; dIdx++) {
      const dl = detLines[dIdx];
      h.put(h.txt(dl, 11, INK_SOFT), detailX, boxY + 46 + dIdx * 16);
    }
  } else if (sel) {
    const lockTitle = h.txt('🔒 미해금 전승 기록', 13, INK_SOFT);
    h.put(lockTitle, detailX, detailY);
    const lockDesc = h.txt('아브라함의 여정을 진행하며 해당 사건을 경험하면 도감이 기록됩니다.', 11, INK_WARM);
    h.put(lockDesc, detailX, detailY + 28);
  }

  // 하단 닫기 안내
  const footerHint = h.txt('▼ [C / Esc] 닫기  |  [↑ / ↓] 항목 이동  |  [클릭] 선택', 10, INK_SOFT);
  h.put(footerHint, mx + 24, my + mh - 24);
}
