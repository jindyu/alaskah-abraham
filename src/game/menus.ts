/**
 * 키보드·메뉴 라우팅: 선택지 모달, 권/장 선택, 도감, 도움말, 일시정지 메뉴, 컷신 넘기기.
 * createGame.ts 의 클로저에서 분리한 것 — 필요한 상태는 deps 로 받는다 (가변 값은 getter).
 */
import type { Hud } from '../ui/hud';
import type { PanelStack as Panels } from './panels';
import type { AudioManager } from '../audio/audioManager';
import type { Cutscene } from '../systems/cutscene/cutscene';
import type { CutsceneEngine } from '../systems/cutscene/cutsceneEngine';
import type { SaveLifecycle } from './saveLifecycle';
import { discardSave } from '../systems/save';
import { sessionSet } from './safeStorage';
import { lang, setLang, nextLang, LANG_LABEL } from '../i18n/lang';
import { tr } from '../i18n/tr';
import { BOOKS } from '../data/books';

export interface MenuDeps {
  audio: AudioManager;
  hud: Hud;
  panels: Panels;
  cutscene: Cutscene;
  cutsceneEngine: CutsceneEngine;
  loadChapter: (book: number, chapter: number, forceLoop?: boolean) => void;
  getBook: () => number;
  getChapter: () => number;
  lifecycle: () => SaveLifecycle;
  /** 지금 장을 마치고 다음 장으로 */
  advance: () => void;
}

export function installMenus(d: MenuDeps): void {
  const { audio, hud, panels, cutscene, cutsceneEngine, loadChapter } = d;
  // ── 키보드 / 입력 라우팅 ──
  // 0. 대화 2지선다 선택지 모달 [↑/↓, 1/2, Enter/Space/E]
  panels.addKey({
    get open() { return !!hud.choice; },
    key(e) {
      if (!hud.choice) return false;
      const ch = hud.choice;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        ch.selectedIndex = Math.max(0, ch.selectedIndex - 1);
        audio.playSfx('ui_confirm');
        return true;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        ch.selectedIndex = Math.min(ch.options.length - 1, ch.selectedIndex + 1);
        audio.playSfx('ui_confirm');
        return true;
      }
      if (e.code === 'Digit1') {
        ch.selectedIndex = 0;
        audio.playSfx('ui_confirm');
        hud.choice = null;
        ch.onSelect(0);
        return true;
      }
      if (e.code === 'Digit2' && ch.options.length > 1) {
        ch.selectedIndex = 1;
        audio.playSfx('ui_confirm');
        hud.choice = null;
        ch.onSelect(1);
        return true;
      }
      if (e.code === 'Digit3' && ch.options.length > 2) {
        ch.selectedIndex = 2;
        audio.playSfx('ui_confirm');
        hud.choice = null;
        ch.onSelect(2);
        return true;
      }
      if (e.code === 'Digit4' && ch.options.length > 3) {
        ch.selectedIndex = 3;
        audio.playSfx('ui_confirm');
        hud.choice = null;
        ch.onSelect(3);
        return true;
      }
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        const idx = ch.selectedIndex;
        audio.playSfx('ui_confirm');
        hud.choice = null;
        ch.onSelect(idx);
        return true;
      }
      return true;
    },
    pointer(ev) {
      if (!hud.choice || ev.kind !== 'down') return false;
      return hud.handleChoiceClick(ev.x, ev.y);
    },
  }, 2);

  // 1. 권/장 선택 오버레이 [Tab]
  hud.onChapterSelectLoad = (b, c) => {
    loadChapter(b, c, true);
  };

  panels.addKey({
    get open() { return hud.chapterSelect.open; },
    key(e) {
      if (e.code === 'Tab' || e.code === 'Escape') {
        hud.chapterSelect.open = false;
        return true;
      }
      if (e.code === 'ArrowLeft') {
        hud.chapterSelect.bookIndex = (hud.chapterSelect.bookIndex + BOOKS.length - 1) % BOOKS.length;
        hud.chapterSelect.chapterIndex = 0;
        return true;
      }
      if (e.code === 'ArrowRight') {
        hud.chapterSelect.bookIndex = (hud.chapterSelect.bookIndex + 1) % BOOKS.length;
        hud.chapterSelect.chapterIndex = 0;
        return true;
      }
      const chCount = BOOKS[hud.chapterSelect.bookIndex]?.chapters.length || 1;
      if (e.code === 'ArrowUp') {
        hud.chapterSelect.chapterIndex = (hud.chapterSelect.chapterIndex + chCount - 1) % chCount;
        return true;
      }
      if (e.code === 'ArrowDown') {
        hud.chapterSelect.chapterIndex = (hud.chapterSelect.chapterIndex + 1) % chCount;
        return true;
      }
      if (e.code === 'Enter') {
        const b = hud.chapterSelect.bookIndex;
        const c = hud.chapterSelect.chapterIndex;
        hud.chapterSelect.open = false;
        loadChapter(b, c, true);
        return true;
      }
      return true;
    },
    pointer(ev) {
      if (!hud.chapterSelect.open) return false;
      if (ev.kind === 'wheel') {
        const chCount = BOOKS[hud.chapterSelect.bookIndex]?.chapters.length || 1;
        if (ev.dy > 0) {
          hud.chapterSelect.chapterIndex = (hud.chapterSelect.chapterIndex + 1) % chCount;
        } else if (ev.dy < 0) {
          hud.chapterSelect.chapterIndex = (hud.chapterSelect.chapterIndex + chCount - 1) % chCount;
        }
        return true;
      }
      if (ev.kind === 'down') {
        return hud.handleChapterSelectClick(ev.x, ev.y);
      }
      return true;
    },
  }, 10);

  // 1-2. 성경 & 미드라시 도감 오버레이 [C]
  panels.addKey({
    get open() { return hud.codex.open; },
    key(e) {
      if (e.code === 'KeyC' || e.code === 'Escape') {
        hud.codex.open = false;
        return true;
      }
      const count = hud.codex.entries.length;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        hud.codex.selectedIndex = (hud.codex.selectedIndex + count - 1) % count;
        audio.playSfx('ui_confirm');
        return true;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        hud.codex.selectedIndex = (hud.codex.selectedIndex + 1) % count;
        audio.playSfx('ui_confirm');
        return true;
      }
      return true;
    },
    pointer(ev) {
      if (!hud.codex.open || ev.kind !== 'down') return false;
      return hud.handleCodexClick(ev.x, ev.y);
    },
  }, 10);

  // 1-3. 조작 안내 및 온보딩 도움말 [F1 / H]
  panels.addKey({
    get open() { return hud.help.open; },
    key(e) {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space' || e.code === 'F1' || e.code === 'KeyH') {
        hud.help.open = false;
        return true;
      }
      return true;
    },
    pointer(ev) {
      if (!hud.help.open) return false;
      if (ev.kind === 'down') {
        return hud.handleHelpClick(ev.x, ev.y);
      }
      return true;
    },
  }, 5);

  // 2. 일시정지 메뉴 [Esc]
  const PAUSE_MENU_COUNT = 10;
  function activatePauseItem(idx: number): void {
    if (idx === 0 || idx === 9) {
      // 계속하기 / 닫기
      hud.pauseMenu.open = false;
    } else if (idx === 1) {
      // 도움말
      hud.pauseMenu.open = false;
      hud.help.open = true;
    } else if (idx === 2) {
      // 장 선택 바로가기
      hud.pauseMenu.open = false;
      hud.chapterSelect.bookIndex = d.getBook();
      hud.chapterSelect.chapterIndex = d.getChapter();
      hud.chapterSelect.open = true;
    } else if (idx === 3) {
      // BGM
      audio.bgmVol = audio.bgmVol > 0.1 ? 0 : 0.7;
      hud.toast('audio', null, tr(`BGM 볼륨: ${Math.round(audio.bgmVol * 100)}%`));
    } else if (idx === 4) {
      // SFX
      audio.sfxVol = audio.sfxVol > 0.1 ? 0 : 0.8;
      hud.toast('audio', null, tr(`SFX 볼륨: ${Math.round(audio.sfxVol * 100)}%`));
    } else if (idx === 5) {
      // 보이스
      audio.voiceVol = audio.voiceVol > 0.1 ? 0 : 0.9;
      hud.toast('audio', null, tr(`보이스 볼륨: ${Math.round(audio.voiceVol * 100)}%`));
    } else if (idx === 6) {
      // 언어 토글 (한국어 / English)
      const next = nextLang(lang());
      setLang(next, true);
      sessionSet('abraham.lang.v1', next);
      hud.toast('lang', null, `${tr('언어')}: ${LANG_LABEL[next]}`);
    } else if (idx === 7) {
      // 이 장 건너뛰기 (막힌 장을 넘길 수 있게, 확인 후 다음 장으로)
      hud.pauseMenu.open = false;
      hud.choice = {
        prompt: tr('이 장을 건너뛸까? 이 장의 이야기와 행동은 넘어간다'),
        options: [{ text: tr('취소') }, { text: tr('건너뛰기') }],
        selectedIndex: 0,
        onSelect: (sel: number) => {
          hud.choice = null;
          if (sel === 1) d.advance();
        },
      };
    } else if (idx === 8) {
      // 새로 시작 (확인 후 현재 저장은 백업으로 남기고 처음부터)
      hud.pauseMenu.open = false;
      hud.choice = {
        prompt: tr('처음부터 새로 시작할까? 지금 저장은 백업으로 남는다'),
        options: [{ text: tr('취소') }, { text: tr('새로 시작') }],
        selectedIndex: 0,
        onSelect: (sel: number) => {
          hud.choice = null;
          if (sel !== 1) return;
          d.lifecycle().suspend('new-game');
          discardSave();
          location.reload();
        },
      };
    }
  }

  hud.onPauseMenuSelect = (idx) => {
    activatePauseItem(idx);
  };

  panels.addKey({
    get open() { return hud.pauseMenu.open; },
    key(e) {
      if (e.code === 'Escape') {
        hud.pauseMenu.open = false;
        return true;
      }
      if (e.code === 'ArrowUp') {
        hud.pauseMenu.selectedItem = (hud.pauseMenu.selectedItem + PAUSE_MENU_COUNT - 1) % PAUSE_MENU_COUNT;
        return true;
      }
      if (e.code === 'ArrowDown') {
        hud.pauseMenu.selectedItem = (hud.pauseMenu.selectedItem + 1) % PAUSE_MENU_COUNT;
        return true;
      }
      if (e.code === 'Enter') {
        activatePauseItem(hud.pauseMenu.selectedItem);
        return true;
      }
      return true;
    },
    pointer(ev) {
      if (!hud.pauseMenu.open) return false;
      if (ev.kind === 'down') {
        return hud.handlePauseMenuClick(ev.x, ev.y);
      }
      return true;
    },
  }, 10);

  // 3. 컷신 대사 넘기기 [Space / Enter / E]
  panels.addKey({
    get open() { return cutsceneEngine.running || cutscene.running; },
    key(e) {
      if (cutscene.running) {
        cutscene.key(e);
        return true;
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        cutsceneEngine.advance();
        return true;
      }
      return false;
    },
  }, 20);

}
