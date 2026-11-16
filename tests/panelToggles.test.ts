import { describe, expect, it } from 'vitest';
import { anyMenuOpen, anyModalOpen, toggleChapterSelect, toggleCodex, toggleHelp, togglePause, type PanelHud } from '../src/game/panelToggles';

const mk = (): PanelHud => ({
  chapterSelect: { open: false, bookIndex: 0, chapterIndex: 0 },
  pauseMenu: { open: false }, help: { open: false }, codex: { open: false }, choice: null,
});

describe('panelToggles', () => {
  it('장 선택을 열면 지금 권·장으로 맞추고 다른 메뉴를 닫는다', () => {
    const h = mk();
    h.pauseMenu.open = true; h.help.open = true; h.codex.open = true;
    toggleChapterSelect(h, 3, 2);
    expect(h.chapterSelect).toEqual({ open: true, bookIndex: 3, chapterIndex: 2 });
    expect(h.pauseMenu.open || h.help.open || h.codex.open).toBe(false);
    toggleChapterSelect(h, 3, 2);
    expect(h.chapterSelect.open).toBe(false);
  });
  it('일시정지를 열면 장 선택·도움말·도감이 닫힌다', () => {
    const h = mk();
    h.chapterSelect.open = true;
    togglePause(h);
    expect(h.pauseMenu.open).toBe(true);
    expect(h.chapterSelect.open).toBe(false);
  });
  it('도움말은 컷신 중·선택지 중에는 열리지 않는다', () => {
    const h = mk();
    toggleHelp(h, true);
    expect(h.help.open).toBe(false);
    h.choice = {};
    toggleHelp(h, false);
    expect(h.help.open).toBe(false);
    h.choice = null;
    toggleHelp(h, false);
    expect(h.help.open).toBe(true);
  });
  it('도감은 다른 메뉴·선택지가 열려 있으면 무시하고, 열었을 때만 true', () => {
    const h = mk();
    h.pauseMenu.open = true;
    expect(toggleCodex(h, false)).toBe(false);
    expect(h.codex.open).toBe(false);
    h.pauseMenu.open = false;
    expect(toggleCodex(h, true)).toBe(false);
    expect(toggleCodex(h, false)).toBe(true);
    expect(toggleCodex(h, false)).toBe(false); // 닫힘
    expect(h.codex.open).toBe(false);
  });
  it('anyModalOpen 은 선택지를 포함하고 anyMenuOpen 은 포함하지 않는다', () => {
    const h = mk();
    h.choice = {};
    expect(anyModalOpen(h)).toBe(true);
    expect(anyMenuOpen(h)).toBe(false);
  });
});
