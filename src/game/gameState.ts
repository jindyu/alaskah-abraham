import type { ProtagonistId } from '../entities/cast';
import { restoreFlags } from './storyFlags';
import type { SaveData } from '../systems/save';

/**
 * 한 판의 진행 상태 (권·장·선택·끝낸 장·플레이 시간). createGame 의 지역 변수였던 것을 한 객체로 모아
 * 장 흐름(chapterFlow)·저장(saveSession)·프레임 루프가 같은 값을 읽고 쓰게 한다. DOM·Three 없이 만들 수 있다.
 */
export interface GameState {
  book: number;
  chapter: number;
  hero: ProtagonistId;
  playSeconds: number;
  /** 같은 상호작용 묶음(루프)은 한 번 끝내면 다음 방문부터 컷신 + '다음 이야기로'만 보여 준다 (저장: story.flags 'loop:…') */
  loopsDone: Set<string>;
  /** 지금 장에 등록된 루프 식별자 */
  chapterSigs: Set<string>;
  /** 지금까지 한 선택(갈래) — 이후 장의 대사가 읽는다 (저장: story.flags 'pick:…') */
  picks: Map<string, string>;
  /** 끝낸 장 ("권:장") — 장 선택에 ✓ 로 보이고 저장된다 */
  doneChapters: Set<string>;
  /** 장 선택으로 직접 들어와 끝낸 루프도 다시 하게 할지 */
  forceLoop: boolean;
}

export function createGameState(loaded: SaveData | null): GameState {
  const state: GameState = {
    book: loaded?.story?.book ?? 1,
    chapter: loaded?.story?.chapter ?? 0,
    hero: 'abram_young',
    playSeconds: loaded?.playSeconds ?? 0,
    loopsDone: new Set<string>(),
    chapterSigs: new Set<string>(),
    picks: new Map<string, string>(),
    doneChapters: new Set<string>(),
    forceLoop: false,
  };
  restoreFlags(loaded?.story?.flags, loaded?.story?.done, state);
  return state;
}

/** 현재 등록된 상호작용 묶음의 식별자 ("권:id,id,…") */
export function loopSignature(book: number, ids: Iterable<string>): string {
  let s = book + ':';
  let first = true;
  for (const id of ids) { s += first ? id : ',' + id; first = false; }
  return s;
}
