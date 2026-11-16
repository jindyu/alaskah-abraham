import type { Interactions, Interactable } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';
import type { ParticleManager } from '../../renderer/particles';

export interface LentilActionContext {
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  particles?: ParticleManager;
  bookIndex: number;
  chapterIndex: number;
  onLoopComplete: () => void;
}

/**
 * 1권 12장(팥죽과 장자권, 에서 진영) 전용 단일 상호작용.
 *
 * 1권의 나머지 장은 book1Actions(우르 통합 루프), 2~6권은 book2~6Actions 가 맡는다.
 * 여기에 있던 2~6권·1권 중간 장 분기는 어디서도 도달하지 않는 죽은 코드라 제거했다.
 * 어떤 액션도 등록하지 못한 장은 createGame 의 '다음 이야기로' 안전망이 이어 준다.
 */
export function setupBook1LentilActions(ctx: LentilActionContext): void {
  const { interactions, hud, audio, bookIndex, chapterIndex, onLoopComplete } = ctx;
  interactions.clear();

  if (bookIndex === 1 && chapterIndex === 12) {
    const potInteractable: Interactable = {
      id: 'lentil_pot',
      pos: () => ({ x: 0, z: 0 }),
      height: 1.0,
      r: 1.6,
      label: () => '붉은 팥죽과 장자권 맹세하기',
      act: () => {
        audio.playSfx('ui_confirm');
        hud.toast('stew', null, '에서: "내가 굶어 죽게 되었으니, 이 장자권이 내게 무엇이 유익하리요!"');
        hud.celebrate('팥죽과 장자권', '장자권을 야곱에게 넘기다');
        onLoopComplete();
      },
    };
    interactions.add(potInteractable);
  }
}
