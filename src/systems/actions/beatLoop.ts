import type { GetPick, SetPick } from './pickTypes';
import type { Interactions } from '../interaction';
import type { Hud } from '../../ui/hud';
import type { AudioManager } from '../../audio/audioManager';

/** 한 번에 한 곳씩 차례로 닿아 가며 이야기를 따라가는 짧은 상호작용 루프의 한 단계 */
export interface Beat {
  id: string;
  x: number;
  z: number;
  /** 프롬프트 문구 */
  label: string;
  /** 달성 시 토스트(대사). 함수면 앞서 한 선택(getPick)에 따라 문구가 달라진다 */
  toast: string | ((pick: (beatId: string) => string | undefined) => string);
  /** 목표 패널에 보일 짧은 항목 */
  goalItem: string;
  voice?: string;
  /** 앞서 한 선택에 따라 이 단계가 생길지 (없으면 항상). 선택의 결과가 대사뿐 아니라 해야 할 일을 바꾼다 */
  when?: (pick: (beatId: string) => string | undefined) => boolean;
  /** 있으면 단순 대사 대신 선택지를 띄운다. ok 인 답을 골라야 이 단계가 끝나고, 아니면 답만 보여 주고 다시 고르게 한다 */
  choice?: {
    prompt: string;
    options: ReadonlyArray<{ text: string; reply: string; ok: boolean; /** 맞는 답이 여럿일 때 목표 패널에 남길 짧은 표시(선택한 갈래) */ tag?: string }>;
  };
}

export interface BeatLoopDeps {
  interactions: Interactions;
  hud: Hud;
  audio: AudioManager;
  /** 목표 패널의 제목 줄 */
  goalTitle: string;
  beats: ReadonlyArray<Beat>;
  /** 마지막 단계의 프롬프트 */
  finishLabel: string;
  finishX: number;
  finishZ: number;
  onComplete: () => void;
  /** 앞 장에서 한 선택의 갈래 표시 읽기/기록 (저장됨 — 이후 장의 대사가 달라짐) */
  getPick?: GetPick;
  setPick?: SetPick;
}

/**
 * 단계들을 순서대로(앞 단계를 끝내야 다음이 열림) 진행하고, 모두 끝나면 마무리 지점에서 다음 장으로 넘어간다.
 * 상태는 클로저 안에만 있다 (장 진행 복원은 chapterLog 의 입력 재생이 맡는다).
 */
const noPick = (): undefined => undefined;

export function addBeatLoop(d: BeatLoopDeps): void {
  const { interactions, hud, audio } = d;
  const pickOf = d.getPick ?? noPick;
  const beats = d.beats.filter((b) => !b.when || b.when(pickOf));
  const done: boolean[] = beats.map(() => false);
  const picked: string[] = beats.map(() => '');
  const count = (): number => { let n = 0; for (let i = 0; i < done.length; i++) if (done[i]) n++; return n; };
  const refresh = (): void => {
    const lines = [d.goalTitle];
    for (let i = 0; i < beats.length; i++) lines.push(`${done[i] ? '☑' : '☐'} ${beats[i].goalItem}${done[i] && picked[i] ? ` — ${picked[i]}` : ''}`);
    hud.goal = lines.join('\n');
    const n = count();
    hud.goalProgress = { current: n, total: beats.length, label: `${n}/${beats.length}` };
  };
  refresh();

  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    const pos = { x: b.x, z: b.z };
    interactions.add({
      id: b.id,
      pos: () => pos,
      height: 1.3,
      r: 2.8,
      label: () => (done[i] || (i > 0 && !done[i - 1]) ? null : b.label),
      act: () => {
        if (done[i] || (i > 0 && !done[i - 1])) return;
        const finish = (): void => {
          done[i] = true;
          if (b.voice) audio.playVoiceBlip(b.voice);
          hud.toast(b.id, null, typeof b.toast === 'function' ? b.toast(d.getPick ?? noPick) : b.toast);
          refresh();
        };
        const ch = b.choice;
        if (!ch) { finish(); return; }
        const opts = ch.options.map((o) => ({ text: o.text }));
        hud.showChoice(ch.prompt, opts, (idx: number) => {
          const o = ch.options[idx];
          if (!o) return;
          hud.toast(`${b.id}_reply`, null, o.reply);
          if (o.ok) { picked[i] = o.tag ?? ''; if (o.tag && d.setPick) d.setPick(b.id, o.tag); finish(); }
        });
      },
    });
  }

  const endPos = { x: d.finishX, z: d.finishZ };
  interactions.add({
    id: `${beats[beats.length - 1].id}_end`,
    pos: () => endPos,
    height: 1.4,
    r: 3.0,
    label: () => (count() === beats.length ? d.finishLabel : null),
    act: () => { if (count() === beats.length) d.onComplete(); },
  });
}
