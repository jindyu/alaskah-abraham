import { describe, expect, it } from 'vitest';
import type { Hud } from '../src/ui/hud';
import { handleChapterSelectClick, handleChoiceClick, handleCodexClick, handleHelpClick, handlePauseMenuClick } from '../src/ui/hudClicks';

const R = (x: number, y: number, w: number, h: number, index = 0) => ({ x, y, w, h, index });

function hud(over: Record<string, unknown> = {}): Hud {
  return {
    choice: null, choiceOptionRects: [],
    chapterSelect: { open: false, bookIndex: 0, chapterIndex: 0 },
    chapterPanelRect: R(100, 100, 400, 300), chapterCloseRect: R(470, 105, 26, 22),
    chapterBookRects: [R(110, 130, 40, 20, 0), R(160, 130, 40, 20, 1)],
    chapterItemRects: [R(110, 170, 280, 22, 0), R(110, 194, 280, 22, 1)],
    onChapterSelectLoad: undefined as undefined | ((b: number, c: number) => void),
    pauseMenu: { open: false, selectedItem: 0 }, pausePanelRect: R(200, 100, 200, 300), pauseItemRects: [R(210, 150, 180, 24, 0), R(210, 180, 180, 24, 1)],
    onPauseMenuSelect: undefined as undefined | ((i: number) => void),
    help: { open: false },
    codex: { open: false, selectedIndex: 0 }, codexItemRects: [R(10, 10, 100, 20, 0), R(10, 40, 100, 20, 3)],
    ...over,
  } as unknown as Hud;
}

describe('hudClicks — 닫혀 있으면 아무것도 삼키지 않는다', () => {
  it('열려 있지 않은 메뉴는 false 를 돌려 월드 클릭이 지나가게 한다', () => {
    const h = hud();
    expect(handleChapterSelectClick(h, 120, 140)).toBe(false);
    expect(handlePauseMenuClick(h, 220, 160)).toBe(false);
    expect(handleHelpClick(h, 1, 1)).toBe(false);
    expect(handleCodexClick(h, 20, 20)).toBe(false);
    expect(handleChoiceClick(h, 20, 20)).toBe(false);
  });
});

describe('hudClicks — 장 선택', () => {
  it('패널 바깥을 누르면 닫고, ✕ 를 누르면 닫는다', () => {
    const a = hud(); (a.chapterSelect as { open: boolean }).open = true;
    expect(handleChapterSelectClick(a, 5, 5)).toBe(true);
    expect(a.chapterSelect.open).toBe(false);
    const b = hud(); (b.chapterSelect as { open: boolean }).open = true;
    expect(handleChapterSelectClick(b, 480, 110)).toBe(true);
    expect(b.chapterSelect.open).toBe(false);
  });
  it('권 탭을 누르면 그 권의 첫 장이 골라진다', () => {
    const h = hud(); Object.assign(h.chapterSelect, { open: true, bookIndex: 0, chapterIndex: 5 });
    handleChapterSelectClick(h, 165, 135);
    expect(h.chapterSelect.bookIndex).toBe(1);
    expect(h.chapterSelect.chapterIndex).toBe(0);
  });
  it('장을 처음 누르면 고르기만, 이미 골라진 장을 다시 누르면 이동(닫고 콜백)', () => {
    const loads: Array<[number, number]> = [];
    const h = hud({ onChapterSelectLoad: (b: number, c: number) => loads.push([b, c]) });
    Object.assign(h.chapterSelect, { open: true, bookIndex: 2, chapterIndex: 0 });
    handleChapterSelectClick(h, 120, 200); // index 1 (처음)
    expect(h.chapterSelect.chapterIndex).toBe(1);
    expect(loads).toEqual([]);
    expect(h.chapterSelect.open).toBe(true);
    handleChapterSelectClick(h, 120, 200); // index 1 (다시)
    expect(loads).toEqual([[2, 1]]);
    expect(h.chapterSelect.open).toBe(false);
  });
  it('패널 안의 빈 곳을 눌러도 월드 이동으로 새지 않게 삼킨다', () => {
    const h = hud(); (h.chapterSelect as { open: boolean }).open = true;
    expect(handleChapterSelectClick(h, 300, 350)).toBe(true);
    expect(h.chapterSelect.open).toBe(true);
  });
});

describe('hudClicks — 일시정지·도움말·도감·선택지', () => {
  it('일시정지: 항목을 누르면 선택 알림, 바깥을 누르면 닫는다', () => {
    const picked: number[] = [];
    const h = hud({ onPauseMenuSelect: (i: number) => picked.push(i) });
    (h.pauseMenu as { open: boolean }).open = true;
    handlePauseMenuClick(h, 220, 190);
    expect(picked).toEqual([1]);
    expect(h.pauseMenu.selectedItem).toBe(1);
    handlePauseMenuClick(h, 5, 5);
    expect(h.pauseMenu.open).toBe(false);
  });
  it('도움말: 어디를 눌러도 닫힌다', () => {
    const h = hud(); (h.help as { open: boolean }).open = true;
    expect(handleHelpClick(h, 1, 1)).toBe(true);
    expect(h.help.open).toBe(false);
  });
  it('도감: 항목을 누르면 그 항목의 index 가 골라진다 (보이는 순서가 아니라 실제 index)', () => {
    const h = hud(); (h.codex as { open: boolean }).open = true;
    handleCodexClick(h, 20, 50);
    expect(h.codex.selectedIndex).toBe(3);
  });
  it('선택지: 항목을 누르면 그 번호로 콜백하고 창을 닫는다, 바깥 클릭은 삼킨다', () => {
    const got: number[] = [];
    const h = hud({ choice: { prompt: 'q', options: [{ text: 'a' }, { text: 'b' }], selectedIndex: 0, onSelect: (i: number) => got.push(i) }, choiceOptionRects: [R(10, 10, 100, 20, 0), R(10, 40, 100, 20, 1)] });
    expect(handleChoiceClick(h, 500, 500)).toBe(true);
    expect(h.choice).not.toBeNull();
    expect(got).toEqual([]);
    expect(handleChoiceClick(h, 20, 50)).toBe(true);
    expect(got).toEqual([1]);
    expect(h.choice).toBeNull();
  });
});
