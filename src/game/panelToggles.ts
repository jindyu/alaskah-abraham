/**
 * 전체 화면 메뉴(장 선택·일시정지·도움말·도감) 열기/닫기 규칙 — 서로 겹쳐 열리지 않게 한다.
 * Hud 의 해당 필드만 쓰는 순수 함수라 DOM 없이 테스트한다 (tests/panelToggles.test.ts).
 */
export interface PanelHud {
  chapterSelect: { open: boolean; bookIndex: number; chapterIndex: number };
  pauseMenu: { open: boolean };
  help: { open: boolean };
  codex: { open: boolean };
  choice: unknown;
  /** 장 선택을 열 때 지금 하던 장 (이어하기 표시) */
  resumeAt?: { book: number; chapter: number } | null;
}

/** 전체 화면 메뉴나 선택지가 열려 있나 (선택지 포함) */
export function anyModalOpen(h: PanelHud): boolean {
  return h.chapterSelect.open || h.pauseMenu.open || h.codex.open || h.help.open || !!h.choice;
}

/** 전체 화면 메뉴만(선택지 제외) */
export function anyMenuOpen(h: PanelHud): boolean {
  return h.chapterSelect.open || h.pauseMenu.open || h.help.open || h.codex.open;
}

function closeOthers(h: PanelHud, keep: 'chapter' | 'pause' | 'help' | 'codex'): void {
  if (keep !== 'chapter') h.chapterSelect.open = false;
  if (keep !== 'pause') h.pauseMenu.open = false;
  if (keep !== 'help') h.help.open = false;
  if (keep !== 'codex') h.codex.open = false;
}

export function toggleChapterSelect(h: PanelHud, book: number, chapter: number): void {
  h.chapterSelect.bookIndex = book;
  h.chapterSelect.chapterIndex = chapter;
  h.chapterSelect.open = !h.chapterSelect.open;
  if (h.chapterSelect.open) { closeOthers(h, 'chapter'); h.resumeAt = { book, chapter }; }
}

export function togglePause(h: PanelHud): void {
  h.pauseMenu.open = !h.pauseMenu.open;
  if (h.pauseMenu.open) closeOthers(h, 'pause');
}

/** blocked(컷신 중·선택지 중)이면 열지 않는다 */
export function toggleHelp(h: PanelHud, blocked: boolean): void {
  if (blocked || h.choice) return;
  h.help.open = !h.help.open;
  if (h.help.open) closeOthers(h, 'help');
}

/** 도감: 컷신 중이거나 다른 메뉴·선택지가 열려 있으면 무시. 열렸으면 true */
export function toggleCodex(h: PanelHud, blocked: boolean): boolean {
  if (blocked || h.chapterSelect.open || h.pauseMenu.open || h.help.open || h.choice) return false;
  h.codex.open = !h.codex.open;
  return h.codex.open;
}
