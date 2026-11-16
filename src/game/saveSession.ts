import { noteError } from '../core/diagnostics';
import type { Hud } from '../ui/hud';
import type { Player } from '../entities/player';
import type { Interactions } from '../systems/interaction';
import type { StageManager } from '../world/stageManager';
import { SaveLifecycle, saveFailText, SAVE_CONFLICT_TEXT, type WriteOutcome } from './saveLifecycle';
import { writeSaveDetail, type SaveData, type WriteDetail } from '../systems/save';
import { ChapterLog, parseLog } from './chapterLog';
import { setReplayImmediate } from './timers';
import { buildFlags } from './storyFlags';
import { anyMenuOpen } from './panelToggles';
import { sessionGet, sessionSet } from './safeStorage';
import { tr } from '../i18n/tr';
import type { GameState } from './gameState';

/** 저장 데이터로 만든 스냅샷 (버전·시각은 save.ts 가 붙인다) */
export function buildSnapshot(
  state: GameState,
  chapterLog: ChapterLog,
  px: number,
  pz: number,
  stageId: string | undefined,
): Omit<SaveData, 'version' | 'savedAt'> {
  return {
    story: {
      book: state.book,
      chapter: state.chapter,
      hero: state.hero,
      flags: buildFlags({ loopsDone: state.loopsDone, picks: state.picks, doneChapters: state.doneChapters, chapterLog: { book: state.book, chapter: state.chapter, entries: chapterLog.entries } }),
      done: [...state.doneChapters],
    },
    player: { x: px, z: pz },
    playSeconds: Math.floor(state.playSeconds),
    stageId,
  };
}

/** 쓰기 결과(save.ts 의 상세 결과)를 SaveLifecycle 이 아는 WriteOutcome 으로 */
export function toOutcome(d: WriteDetail): WriteOutcome {
  return d.result === 'ok' ? true : d.result === 'conflict' ? 'conflict' : d.reason ?? false;
}

export interface SaveSessionDeps {
  state: GameState;
  slot: number;
  hud: Hud;
  player: Player;
  stageManager: StageManager;
  chapterLog: ChapterLog;
  busyCutscene(): boolean;
  panelsOpen(): boolean;
}

/** 저장 수명주기(자동 저장·탭 이탈 저장·다른 탭 충돌 안내)를 만들고 window/document 에 연결한다 */
export function createSaveSession(d: SaveSessionDeps): SaveLifecycle {
  const { state, hud, player, stageManager, chapterLog } = d;
  const write = (): WriteOutcome => {
    const p = player.root.position;
    return toOutcome(writeSaveDetail(buildSnapshot(state, chapterLog, p.x, p.z, stageManager.stage?.id), d.slot));
  };
  const lifecycle = new SaveLifecycle(
    () => ({
      disabled: false,
      leaving: false,
      started: true,
      locked: false,
      cutscene: d.busyCutscene(),
      menu: d.panelsOpen() || hud.chapterSelect.open || hud.pauseMenu.open || hud.codex.open || hud.help.open || !!hud.choice,
    }),
    write,
    (reason) => hud.toast('save-fail', null, saveFailText(reason), 0, 6),
    () => hud.toast('save-conflict', null, tr(SAVE_CONFLICT_TEXT), 0, 12),
  );
  lifecycle.bind(window, document);
  return lifecycle;
}

/**
 * 이어하기: 저장된 위치를 되살리고, 이 장의 행동 기록(chlog)을 즉시 재생해 진행을 복원한다.
 * 같은 권·장일 때만 위치를 되살린다. 끝에 사용자에게 알림 토스트를 띄운다.
 */
export function resumeFromSave(loaded: SaveData, state: GameState, player: Player, interactions: Interactions, chapterLog: ChapterLog, hud: Hud): void {
  let restoredPos = false;
  if (
    loaded.story.book === state.book &&
    loaded.story.chapter === state.chapter &&
    loaded.player &&
    Number.isFinite(loaded.player.x) &&
    Number.isFinite(loaded.player.z)
  ) {
    player.root.position.x = loaded.player.x;
    player.root.position.z = loaded.player.z;
    restoredPos = true;
  }
  let replayed = 0;
  if (loaded.story.flags) {
    for (const k of Object.keys(loaded.story.flags)) {
      if (!k.startsWith('chlog:')) continue;
      const lg = parseLog(k.slice(6));
      if (!lg || lg.book !== state.book || lg.chapter !== state.chapter) continue;
      chapterLog.startReplay(lg.entries);
      setReplayImmediate(true);
      try {
        for (const e of lg.entries) {
          if (e.k !== 'a') continue;
          const it = interactions.get(e.id);
          if (it) { it.act(); replayed++; }
        }
      } catch (err) {
        console.error('장 진행 복원 중 오류', err);
      } finally {
        setReplayImmediate(false);
        chapterLog.endReplay(lg.entries);
      }
    }
  }
  const pos = `(${state.book}-${state.chapter + 1})`;
  if (replayed > 0) hud.toast('load', null, `${tr('이어서 시작한다')} ${pos} · ${tr('이 장의 진행을 되살렸다')}`, 0, 6);
  else if (restoredPos) hud.toast('load', null, `${tr('이어서 시작한다')} ${pos} · ${tr('이 장의 행동은 처음부터 다시 한다')}`, 0, 6);
  else hud.toast('load', null, tr('챕터 처음부터 이어서 시작합니다'));
}

const HELP_SEEN_KEY = 'abraham.help.seen.v1';

export function hasSeenHelp(): boolean {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(HELP_SEEN_KEY) === '1') return true;
  } catch (e) { noteError('game:helpSeenRead', e); }
  return sessionGet(HELP_SEEN_KEY) === '1';
}

export function markHelpSeen(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(HELP_SEEN_KEY, '1');
  } catch (e) { noteError('game:helpSeenWrite', e); }
  sessionSet(HELP_SEEN_KEY, '1');
}
