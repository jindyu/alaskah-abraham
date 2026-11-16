import * as THREE from 'three';
import type { Step, CaptionStyle } from '../../cutscene/cutscene';
import type { SceneContext } from '../book1/book1Scenes';
import { Actor } from '../../../entities/actor';
import { VoxelBuilder } from '../../../world/voxel';
import { PAL } from '../../../world/palette';
import data from '../../../data/staging.json';

/**
 * 직접 쓴 장면이 없던 장의 연출 (src/data/staging.json 이 대본, 여기는 그것을 기존 Cutscene 단계로 바꾸는 번역기).
 * 쓰는 단계: do(배치·소품·등장인물), animate(걷기·카메라 이동), wait, caption. 새 단계 형식은 만들지 않는다.
 * 상호작용 모듈(actions/book*Actions.ts)이 장에 들어올 때 playChapterStaging 으로 재생한다.
 */
export type Pt = [number, number];
export interface StagingWhen { pick: string; is: string | string[] }
export interface StagingBeat {
  focus?: Pt;
  walk?: Pt;
  npc?: { id: string; to: Pt };
  fx?: string;
  spawn?: { prop?: string; actor?: string; at: Pt };
  when?: StagingWhen;
  src: 'bible' | 'tradition' | 'story';
  ko?: string;
  en?: string;
  style?: CaptionStyle;
  speaker?: string;
  hold?: number;
}
export interface StagingCast { id: string; at: Pt; face?: Pt; when?: StagingWhen }
export interface StagingChapter {
  book: number;
  chapter: number;
  stage: string;
  title: { ko: string; en: string };
  tilt: number;
  bgm: string;
  start: Pt;
  cast?: StagingCast[];
  beats: StagingBeat[];
}

export const STAGING: ReadonlyArray<StagingChapter> = data.chapters as unknown as StagingChapter[];

export function stagingFor(book: number, chapter: number): StagingChapter | undefined {
  for (const s of STAGING) if (s.book === book && s.chapter === chapter) return s;
  return undefined;
}

export type GetPickFn = ((id: string) => string | undefined) | undefined;

/** 앞서 한 선택이 조건과 맞는가. 선택이 없으면 'none' 으로 본다 */
export function whenHolds(w: StagingWhen | undefined, getPick: GetPickFn): boolean {
  if (!w) return true;
  const v = getPick?.(w.pick) ?? 'none';
  return Array.isArray(w.is) ? w.is.includes(v) : w.is === v;
}

/** 선택이 바꾸는 소품 (장면 데이터의 spawn.prop 이름). 모두 기존 복셀 빌더로 만든 작은 소품이다 */
export const STAGING_PROPS = ['bow_target', 'watch_cairn', 'vigil_lamp', 'trust_cairn', 'bow_rest', 'altar_lamp', 'bread_basket'] as const;

export function buildStagingProp(kind: string): THREE.Group {
  const b = new VoxelBuilder(9, false);
  switch (kind) {
    case 'bow_target': // 짚단 과녁(붉은 표적 원)과 땅에 세운 활 — 모래색 바닥에서도 눈에 띄도록 진한 색을 쓴다
      b.box(-0.45, 0, 0, 0.1, 1.4, 0.1, PAL.wood[0], { tex: 'wood' });
      b.box(0.45, 0, 0, 0.1, 1.4, 0.1, PAL.wood[0], { tex: 'wood' });
      b.box(0, 0.35, 0, 0.9, 0.8, 0.3, PAL.straw[0], { tex: 'soil' });
      b.box(0, 0.55, 0.17, 0.5, 0.4, 0.06, 0xb02a1a, { tex: 'soil' });
      b.box(0, 0.65, 0.2, 0.2, 0.2, 0.06, 0xf4ecd8, { tex: 'soil' });
      b.box(1.2, 0, 0.3, 0.07, 1.2, 0.07, PAL.wood[0], { tex: 'wood' });
      b.box(1.2, 0.95, 0.3, 0.3, 0.07, 0.07, PAL.wood[0], { tex: 'wood' });
      break;
    case 'watch_cairn': // 멀리서 지켜보던 자리의 작은 돌무더기
      b.box(0, 0, 0, 0.9, 0.35, 0.8, PAL.stone[1], { tex: 'stone' });
      b.box(0, 0.35, 0, 0.6, 0.3, 0.55, PAL.stone[2], { tex: 'stone' });
      b.box(0, 0.65, 0, 0.3, 0.25, 0.3, PAL.stone[3], { tex: 'stone' });
      break;
    case 'vigil_lamp': // 롯을 위해 밝힌 등불
      b.box(0, 0, 0, 0.12, 1.3, 0.12, PAL.wood[1], { tex: 'wood' });
      b.box(0, 1.3, 0, 0.45, 0.45, 0.45, 0xffd23a, { tex: 'soil' });
      b.box(0, 1.2, 0, 0.6, 0.08, 0.6, PAL.wood[0], { tex: 'wood' });
      break;
    case 'bow_rest': // 땅에 꽂아 세운 활과 화살통 (6권 대단원: 담대함)
      b.box(0, 0, 0, 0.09, 1.5, 0.09, PAL.wood[1], { tex: 'wood' });
      b.box(0.1, 0.9, 0, 0.09, 0.5, 0.09, PAL.wood[2], { tex: 'wood' });
      b.box(0.1, 0.1, 0, 0.09, 0.5, 0.09, PAL.wood[2], { tex: 'wood' });
      b.box(0.45, 0, 0.1, 0.35, 0.6, 0.35, PAL.fabric.redDark, { tex: 'soil' });
      b.box(0.5, 0.6, 0.12, 0.05, 0.3, 0.05, PAL.straw[2], { tex: 'wood' });
      break;
    case 'altar_lamp': // 돌 제단 위에 밝힌 등불 (6권 대단원: 맡김)
      b.box(0, 0, 0, 1.0, 0.5, 0.8, PAL.stone[2], { tex: 'stone' });
      b.box(0, 0.5, 0, 0.8, 0.12, 0.6, PAL.stone[3], { tex: 'stone' });
      b.box(0, 0.62, 0, 0.3, 0.3, 0.3, PAL.clay[2], { tex: 'soil' });
      b.box(0, 0.92, 0, 0.18, 0.28, 0.18, 0xffd23a, { tex: 'soil' });
      break;
    case 'bread_basket': // 바구니에 담긴 둥근 떡 (6권 대단원: 돌봄)
      b.box(0, 0, 0, 1.0, 0.25, 1.0, PAL.straw[1], { tex: 'wood' });
      b.box(-0.2, 0.25, -0.15, 0.4, 0.22, 0.4, PAL.dirt[3], { tex: 'soil' });
      b.box(0.2, 0.25, 0.15, 0.4, 0.22, 0.4, PAL.dirt[2], { tex: 'soil' });
      b.box(0.0, 0.25, 0.3, 0.3, 0.2, 0.3, PAL.dirt[4], { tex: 'soil' });
      break;
    default: // trust_cairn — 맡김의 표로 쌓은 돌
      b.box(0, 0, 0, 1.0, 0.4, 0.9, PAL.stone[2], { tex: 'stone' });
      b.box(0, 0.4, 0, 0.7, 0.35, 0.6, PAL.stone[3], { tex: 'stone' });
      b.box(0, 0.75, 0, 0.35, 0.3, 0.35, PAL.stone[4], { tex: 'stone' });
  }
  return b.build();
}

// ── 단계 만들기 (빌드 시점에만 할당한다 — 프레임마다 도는 frame 콜백은 숫자만 만진다) ──
const FOCUS_Y = 1.2;
const MIN_MOVE = 1.0;
const MAX_MOVE = 3.5;
const SPEED = 2.2;

function moveTime(dist: number): number {
  return Math.min(MAX_MOVE, Math.max(MIN_MOVE, dist / SPEED));
}

function stageRoot(c: SceneContext): THREE.Object3D | null {
  return c.stageManager?.stage?.root ?? null;
}

function placeActor(root: THREE.Object3D | null, a: Actor, at: Pt, face?: Pt): void {
  a.root.position.set(at[0], 0, at[1]);
  if (face) a.face({ x: face[0], z: face[1] });
  root?.add(a.root);
}

/** 한 장의 연출 대본을 Cutscene 단계 배열로 만든다 */
export function createStagingSteps(c: SceneContext, s: StagingChapter, getPick: GetPickFn): Step[] {
  const actors = new Map<string, Actor>();
  let fx = s.start[0];
  let fz = s.start[1];
  const steps: Step[] = [];
  let titleCleared = false;

  steps.push({ do: () => {
    c.hud.cinematicTitle = s.title.ko;
    c.renderer.setTilt(s.tilt);
    c.player.root.position.set(s.start[0], 0, s.start[1]);
    c.setCameraFocus(fx, FOCUS_Y, fz);
    c.audio.playBgm(s.bgm);
    const root = stageRoot(c);
    for (const m of s.cast ?? []) {
      if (!whenHolds(m.when, getPick)) continue;
      const a = new Actor(m.id);
      actors.set(m.id, a);
      placeActor(root, a, m.at, m.face);
    }
  } });
  steps.push({ wait: 0.9 });

  for (const beat of s.beats) {
    if (!whenHolds(beat.when, getPick)) continue;

    if (beat.spawn) {
      const sp = beat.spawn;
      steps.push({ do: () => {
        const root = stageRoot(c);
        if (sp.prop) {
          const g = buildStagingProp(sp.prop);
          g.position.set(sp.at[0], 0, sp.at[1]);
          root?.add(g);
        }
        if (sp.actor) { const a = new Actor(sp.actor); actors.set(sp.actor, a); placeActor(root, a, sp.at); }
        if (sp.prop) c.audio.playSfx('ui_confirm');
      } });
    }

    // 걷기·카메라 이동 (한 animate 로 묶는다)
    const wantMove = beat.walk || beat.npc || beat.focus;
    if (wantMove) {
      let px0 = 0, pz0 = 0, nx0 = 0, nz0 = 0, fx0 = 0, fz0 = 0;
      const px1 = beat.walk ? beat.walk[0] : 0;
      const pz1 = beat.walk ? beat.walk[1] : 0;
      const nx1 = beat.npc ? beat.npc.to[0] : 0;
      const nz1 = beat.npc ? beat.npc.to[1] : 0;
      const hasWalk = !!beat.walk;
      const npc = beat.npc;
      // 카메라 목표: focus 가 있으면 그곳, 없으면 걷는 쪽을 따라간다
      const tx = beat.focus ? beat.focus[0] : hasWalk ? px1 : npc ? nx1 : fx;
      const tz = beat.focus ? beat.focus[1] : hasWalk ? pz1 : npc ? nz1 : fz;
      const dur = moveTime(Math.max(
        hasWalk ? Math.hypot(px1 - fx, pz1 - fz) : 0,
        npc ? 2 : 0,
        Math.hypot(tx - fx, tz - fz),
      ));
      const startFx = fx, startFz = fz;
      steps.push({ do: () => {
        px0 = c.player.root.position.x; pz0 = c.player.root.position.z;
        const a = npc ? actors.get(npc.id) : undefined;
        if (a) { nx0 = a.root.position.x; nz0 = a.root.position.z; a.face({ x: nx1, z: nz1 }); }
        fx0 = startFx; fz0 = startFz;
        if (hasWalk) c.player.face(Math.atan2(px1 - px0, pz1 - pz0));
      } });
      steps.push({ animate: dur, frame: (p: number) => {
        const e = p * p * (3 - 2 * p);
        if (hasWalk) c.player.root.position.set(px0 + (px1 - px0) * e, 0, pz0 + (pz1 - pz0) * e);
        const a = npc ? actors.get(npc.id) : undefined;
        if (a && npc) a.root.position.set(nx0 + (nx1 - nx0) * e, 0, nz0 + (nz1 - nz0) * e);
        c.setCameraFocus(fx0 + (tx - fx0) * e, FOCUS_Y, fz0 + (tz - fz0) * e);
      } });
      fx = tx; fz = tz;
    }

    if (beat.fx) {
      const kind = beat.fx;
      const gx = fx, gz = fz;
      steps.push({ do: () => {
        c.audio.playSfx('fx_covenant_chime');
        if (c.particles) c.particles.emit(kind as 'glory_sparkles', gx, 1.5, gz, 30);
      } });
    }

    if (beat.ko) {
      const cap: Step = { caption: beat.ko, hold: beat.hold ?? 5.0 };
      if (beat.style) (cap as { style?: CaptionStyle }).style = beat.style;
      if (beat.speaker) (cap as { speaker?: string }).speaker = beat.speaker;
      steps.push(cap);
      if (!titleCleared) { // 제목 띠는 첫 자막 동안만 — 이후엔 등장인물과 소품이 가려지지 않게 치운다
        titleCleared = true;
        steps.push({ do: () => { c.hud.cinematicTitle = null; } });
      }
    }
  }

  steps.push({ do: () => {
    c.renderer.resetTilt();
    c.hud.cinematicTitle = null;
  } });
  return steps;
}

/** (권, 장)에 연출이 있고 지금 무대가 맞으면 재생한다. 재생했으면 true */
export function playChapterStaging(
  c: SceneContext,
  cutscene: { play(steps: Step[], onDone?: () => void, tag?: string): void },
  book: number,
  chapter: number | undefined,
  stageId: string,
  getPick: GetPickFn,
): boolean {
  if (chapter === undefined) return false;
  const s = stagingFor(book, chapter);
  if (!s || s.stage !== stageId) return false;
  cutscene.play(createStagingSteps(c, s, getPick), undefined, `staging_${book}_${chapter}`);
  return true;
}
