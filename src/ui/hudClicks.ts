import type { Hud } from './hud';

/** 마우스·터치로 메뉴를 누를 때의 처리 (hud.ts 에서 분리). 눌린 위치를 그리기 때 저장해 둔 사각형과 맞춰 본다. */

export function handleChoiceClick(hud: Hud, x: number, y: number): boolean {
  if (!hud.choice) return false;
  for (let i = 0; i < hud.choiceOptionRects.length; i++) {
    const r = hud.choiceOptionRects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      hud.choice.selectedIndex = i;
      const cb = hud.choice.onSelect;
      hud.choice = null;
      cb(i);
      return true;
    }
  }
  return true; // 모달 바깥 클릭 시에도 월드 이동 삼킴
}

export function handleChapterSelectClick(hud: Hud, x: number, y: number): boolean {
  if (!hud.chapterSelect.open) return false;
  const pr = hud.chapterPanelRect;
  if (x < pr.x || x > pr.x + pr.w || y < pr.y || y > pr.y + pr.h) {
    hud.chapterSelect.open = false;
    return true;
  }
  const cr = hud.chapterCloseRect;
  if (x >= cr.x && x <= cr.x + cr.w && y >= cr.y && y <= cr.y + cr.h) {
    hud.chapterSelect.open = false;
    return true;
  }
  for (let i = 0; i < hud.chapterBookRects.length; i++) {
    const r = hud.chapterBookRects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      hud.chapterSelect.bookIndex = r.index;
      hud.chapterSelect.chapterIndex = 0;
      return true;
    }
  }
  for (let i = 0; i < hud.chapterItemRects.length; i++) {
    const r = hud.chapterItemRects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      if (hud.chapterSelect.chapterIndex === r.index) {
        hud.chapterSelect.open = false;
        hud.onChapterSelectLoad?.(hud.chapterSelect.bookIndex, r.index);
      } else {
        hud.chapterSelect.chapterIndex = r.index;
      }
      return true;
    }
  }
  return true;
}

export function handlePauseMenuClick(hud: Hud, x: number, y: number): boolean {
  if (!hud.pauseMenu.open) return false;
  const pr = hud.pausePanelRect;
  if (x < pr.x || x > pr.x + pr.w || y < pr.y || y > pr.y + pr.h) {
    hud.pauseMenu.open = false;
    return true;
  }
  for (let i = 0; i < hud.pauseItemRects.length; i++) {
    const r = hud.pauseItemRects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      hud.pauseMenu.selectedItem = r.index;
      hud.onPauseMenuSelect?.(r.index);
      return true;
    }
  }
  return true;
}

export function handleHelpClick(hud: Hud, _x: number, _y: number): boolean {
  if (!hud.help.open) return false;
  hud.help.open = false;
  return true;
}

export function handleCodexClick(hud: Hud, x: number, y: number): boolean {
  if (!hud.codex.open) return false;
  for (const r of hud.codexItemRects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      hud.codex.selectedIndex = r.index;
      return true;
    }
  }
  return true;
}
