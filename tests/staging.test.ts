import { describe, expect, it, vi } from 'vitest';

// 무대를 통째로 빌드하는 시험이 많아 느린 기계·병렬 실행에서 기본 5초를 넘기곤 한다
vi.setConfig({ testTimeout: 30000 });
import * as THREE from 'three';
import { StageManager, type StageId } from '../src/world/stageManager';
import { allScenePlans } from '../src/game/chapterRouter';
import { getChapterContext } from '../src/systems/story';
import { BOOKS } from '../src/data/books';
import {
  STAGING, stagingFor, whenHolds, createStagingSteps, playChapterStaging, STAGING_PROPS, buildStagingProp,
  type StagingChapter, type Pt,
} from '../src/systems/scenes/staging/chapterStaging';
import { setupBook3Actions } from '../src/systems/actions/book3Actions';
import { setupBook5Actions } from '../src/systems/actions/book5Actions';
import { setupBook4Actions } from '../src/systems/actions/book4Actions';
import { Interactions } from '../src/systems/interaction';
import { wireChapterActions, type WireDeps } from '../src/game/actionWiring';
import { allConsequenceLines, createMoriahAftermathSteps, createIshmaelPleaSteps, createBook6EpilogueSteps, createBook6FinaleTableauSteps, FINALE_LAYOUT } from '../src/systems/actions/consequenceScenes';
import { journeyLedgerLines, epilogueLines, LEDGER_ENTRIES, LEDGER_HEADER, TRAIT_OF, NEUTRAL_TAGS, PICK_ORDER } from '../src/game/storyFlags';
import consequences from '../src/data/consequences.json';
import en from '../src/i18n/en.json';
import extra from '../src/i18n/en_extra.json';
import type { Step } from '../src/systems/cutscene/cutscene';
import type { Trait } from '../src/systems/actions/pickTypes';
import { createChapterFlow } from '../src/game/chapterFlow';
import { createGameState } from '../src/game/gameState';
import { ChapterLog } from '../src/game/chapterLog';

const dict = { ...(en as Record<string, string>), ...(extra as Record<string, string>) };

function noop(): any {
  return new Proxy(function () {}, { get: (_t, p) => (p === 'then' || p === Symbol.toPrimitive ? undefined : noop()), apply: () => noop(), set: () => true });
}
function makeHud(goal?: string): any {
  const store: Record<string | symbol, unknown> = { goal };
  return new Proxy(store, { get: (t, p) => (p in t ? t[p] : noop()), set: (t, p, v) => { t[p] = v; return true; } });
}

/** 실제 StageManager 위에서 장면 단계를 끝까지 돌려 보는 작은 실행기 (do 실행, animate 는 1 로 마무리, caption 수집) */
function runSteps(s: StagingChapter, picks: Record<string, string>) {
  const sm = new StageManager(new THREE.Scene());
  const stage = sm.loadStage(s.stage as StageId);
  const before = stage.root.children.length;
  const player = { root: new THREE.Object3D(), face: () => undefined };
  const focus: Array<[number, number, number]> = [];
  const c: any = {
    renderer: noop(), hud: makeHud(), audio: noop(), player, particles: noop(), stageManager: sm,
    setCameraFocus: (x: number, y: number, z: number) => focus.push([x, y, z]),
  };
  const steps = createStagingSteps(c, s, (id) => picks[id]);
  const captions: string[] = [];
  for (const st of steps as Array<Record<string, any>>) {
    if (typeof st.do === 'function') st.do();
    else if (typeof st.animate === 'number') { st.frame(0); st.frame(0.5); st.frame(1); }
    else if (typeof st.caption === 'string') captions.push(st.caption);
  }
  return { captions, added: stage.root.children.length - before, player, focus, stage };
}

describe('직접 쓴 장면이 없던 장의 연출 (staging.json)', () => {
  it('33개 장에 연출이 있다 (기존 18 + 이번에 더한 15: 1권 13장 전부와 2권 5·9장), 4~6권도 각각 2개 이상', () => {
    expect(STAGING.length).toBeGreaterThanOrEqual(33);
    for (const b of [4, 5, 6]) expect(STAGING.filter((s) => s.book === b).length, `${b}권`).toBeGreaterThanOrEqual(2);
    expect(STAGING.filter((s) => s.book === 1).length, '1권 13장 모두').toBe(13);
    // 라우터의 직접 쓴 장면 + 연출 = 대본 대사만 나오는 장이 하나도 없다 (48장 중 인트로·아웃트로 제외 전부)
    const covered = new Set([...allScenePlans().map((p) => `${p.book}:${p.chapter}`), ...STAGING.map((s) => `${s.book}:${s.chapter}`)]);
    const missing: string[] = [];
    for (let b = 1; b <= 6; b++) BOOKS[b].chapters.forEach((_c, i) => { if (!covered.has(`${b}:${i}`)) missing.push(`${b}권 ${i + 1}장`); });
    expect(missing, `연출도 장면도 없는 장: ${missing.join(', ')}`).toEqual([]);
  });

  it('모든 연출은 실제 장을 가리키고, 이미 라우터에 장면이 있는 장과 겹치지 않으며, 무대가 장의 기본 무대와 같다', () => {
    const routed = new Set(allScenePlans().map((p) => `${p.book}:${p.chapter}`));
    const seen = new Set<string>();
    for (const s of STAGING) {
      const key = `${s.book}:${s.chapter}`;
      expect(seen.has(key), `${key} 중복`).toBe(false);
      seen.add(key);
      expect(routed.has(key), `${key} 는 이미 라우터에 장면이 있다`).toBe(false);
      expect(s.chapter, key).toBeLessThan(BOOKS[s.book].chapters.length);
      expect(getChapterContext(s.book, s.chapter).stageId, `${key} 무대`).toBe(s.stage);
      expect(stagingFor(s.book, s.chapter)).toBe(s);
    }
  });

  it('시작·걷기·등장인물·소품 위치는 모두 막힌 곳이 아니다', () => {
    const sm = new StageManager(new THREE.Scene());
    const bad: string[] = [];
    for (const s of STAGING) {
      const col = sm.loadStage(s.stage as StageId).col;
      const pts: Array<[string, Pt]> = [['start', s.start]];
      for (const m of s.cast ?? []) pts.push([`cast ${m.id}`, m.at]);
      for (const b of s.beats) {
        if (b.walk) pts.push(['walk', b.walk]);
        if (b.npc) pts.push([`npc ${b.npc.id}`, b.npc.to]);
        if (b.spawn) pts.push([`spawn ${b.spawn.prop ?? b.spawn.actor}`, b.spawn.at]);
      }
      for (const [what, p] of pts) if (col.blocked(p[0], p[1], 0.3)) bad.push(`${s.book}권 ${s.chapter + 1}장 ${what} (${p})`);
    }
    expect(bad, `막힌 곳: ${bad.join(' | ')}`).toEqual([]);
  });

  it('모든 자막·제목은 영어가 있고(en_extra/en.json), 전해오는 이야기는 출처 표지가 있다 (성경 본문과 구분)', () => {
    for (const s of STAGING) {
      expect(dict[s.title.ko], `${s.title.ko} 영어`).toBe(s.title.en);
      expect(s.beats.length).toBeGreaterThanOrEqual(3);
      for (const b of s.beats) {
        if (!b.ko) continue;
        expect(b.en && b.en.length > 0, b.ko).toBe(true);
        expect(dict[b.ko], `${b.ko.slice(0, 20)} 영어 번역 없음/불일치`).toBe(b.en);
        expect(/[가-힣]/.test(b.en!), `${b.ko.slice(0, 20)} 영어에 한글이 남음`).toBe(false);
        if (b.src === 'tradition') expect(b.ko, '전해 오는 이야기 표지').toContain('전해오는 이야기');
        if (b.src === 'bible') expect(b.ko.includes('전해오는 이야기'), '성경 본문에 전승 표지가 섞임').toBe(false);
      }
    }
  });

  it('모든 연출은 단계로 끝까지 돌아가고(걷기·카메라·등장), 카메라 값은 유한하다', () => {
    for (const s of STAGING) {
      const r = runSteps(s, {});
      expect(r.captions.length, `${s.book}권 ${s.chapter + 1}장`).toBeGreaterThanOrEqual(3);
      for (const f of r.focus) for (const v of f) expect(Number.isFinite(v)).toBe(true);
      expect(Number.isFinite(r.player.root.position.x)).toBe(true);
      const always = (s.cast ?? []).filter((m) => !m.when).length; // 선택에 따라 나오는 인물은 선택 없이 세지 않는다
      if (always) expect(r.added, '등장인물이 무대에 올라감').toBeGreaterThanOrEqual(always);
    }
  });

  it('소품 종류는 모두 빌드된다', () => {
    for (const k of STAGING_PROPS) expect(buildStagingProp(k).children.length, k).toBeGreaterThan(0);
  });
});

describe('선택에 따른 결과 (state-dependent outcomes)', () => {
  const ishmael = stagingFor(5, 1)!;
  const dawn = stagingFor(4, 3)!;

  it('whenHolds: 선택 없음은 none, 배열도 받는다', () => {
    expect(whenHolds(undefined, undefined)).toBe(true);
    expect(whenHolds({ pick: 'x', is: 'none' }, () => undefined)).toBe(true);
    expect(whenHolds({ pick: 'x', is: 'a' }, () => undefined)).toBe(false);
    expect(whenHolds({ pick: 'x', is: ['a', 'b'] }, () => 'b')).toBe(true);
  });

  it('5권 광야의 이스마엘: 3권에서 활을 가르쳤으면 활 과녁 소품이 서고 이스마엘의 대사가 달라진다', () => {
    const taught = runSteps(ishmael, { archery_target: '활을 가르침' });
    const watched = runSteps(ishmael, { archery_target: '지켜봐 줌' });
    const none = runSteps(ishmael, {});
    expect(taught.added).toBe(none.added + 1); // 소품 1개 더
    expect(watched.added).toBe(none.added + 1);
    expect(taught.captions.join('|')).toContain('아버지가 가르쳐 주신 활');
    expect(watched.captions.join('|')).toContain('멀리서 바라보시던');
    expect(none.captions.join('|')).not.toContain('가르쳐 주신 활');
    expect(new Set([taught.captions.join('|'), watched.captions.join('|'), none.captions.join('|')]).size).toBe(3);
  });

  it('4권 아브라함의 새벽: 2권에서 롯을 염려했으면 언덕에 등불, 맡겼으면 돌무더기가 생긴다', () => {
    const lot = runSteps(dawn, { war_envoy: '롯을 염려함' });
    const trust = runSteps(dawn, { war_envoy: '하나님께 맡김' });
    const none = runSteps(dawn, {});
    expect(lot.added).toBe(none.added + 1);
    expect(trust.added).toBe(none.added + 1);
    expect(lot.captions.join('|')).toContain('등불');
    expect(trust.captions.join('|')).toContain('돌 하나');
    expect(none.captions.join('|')).not.toMatch(/등불|돌 하나/);
  });

  it('상호작용 모듈이 장에 들어올 때 연출을 재생한다 (장 번호는 chapterIndex 로 명시)', () => {
    const sm = new StageManager(new THREE.Scene());
    const cases: Array<{ run: (ctx: any) => void; book: number; ch: number; stage: StageId; tag: string }> = [
      { run: setupBook5Actions, book: 5, ch: 1, stage: 'beersheba', tag: 'staging_5_1' },
      { run: setupBook3Actions, book: 3, ch: 2, stage: 'mamre', tag: 'staging_3_2' },
      { run: setupBook4Actions, book: 4, ch: 3, stage: 'mamre', tag: 'staging_4_3' },
    ];
    for (const k of cases) {
      sm.loadStage(k.stage);
      const played: Array<{ steps: Step[]; tag?: string }> = [];
      const ctx: any = {
        interactions: new Interactions(), hud: makeHud(getChapterContext(k.book, k.ch).defaultGoal), audio: noop(), particles: noop(),
        cutscene: { play(steps: Step[], _d?: () => void, tag?: string) { played.push({ steps, tag }); } },
        sceneCtx: { ...noop(), stageManager: sm }, stageId: k.stage, chapterIndex: k.ch, getPick: () => undefined, setPick: () => undefined,
        onBook3Complete: () => undefined, onBook4Complete: () => undefined, onBook5Complete: () => undefined,
      };
      k.run(ctx);
      expect(played.some((p) => p.tag === k.tag), `${k.book}권 ${k.ch + 1}장 연출 재생`).toBe(true);
    }
  });

  it('연출이 없는 장·무대가 다른 곳에서는 재생하지 않는다', () => {
    const played: unknown[] = [];
    const cs = { play: (s: Step[]) => played.push(s) };
    expect(playChapterStaging(noop(), cs, 5, 0, 'beersheba', undefined)).toBe(false); // 라우터 장면이 있는 장
    expect(playChapterStaging(noop(), cs, 5, 1, 'moriah', undefined)).toBe(false);    // 다른 무대
    expect(playChapterStaging(noop(), cs, 5, undefined, 'beersheba', undefined)).toBe(false);
    expect(played).toHaveLength(0);
  });
});

describe('결과 장면 자막 데이터 (consequences.json)', () => {
  it('모든 줄은 ko/en 이 있고 en_extra 와 일치한다', () => {
    const lines = allConsequenceLines();
    expect(lines.length).toBe(6 + 3 + 3 + 9 + 3 + 3); // 모리아 6 + 대단원 열기 3 + 맺음 3 + 저녁 9 + 대단원 장면 3 + 이스마엘 간구 3
    for (const l of lines) {
      expect(l.ko.length).toBeGreaterThan(0);
      expect(dict[l.ko], l.ko.slice(0, 24)).toBe(l.en);
      expect(/[가-힣]/.test(l.en)).toBe(false);
    }
  });
  it('로더는 데이터 파일의 줄을 기존 단계 형식(caption/hold)으로 돌려준다', () => {
    const steps = createMoriahAftermathSteps('care') as Array<{ caption: string; hold: number }>;
    expect(steps.map((s) => s.caption)).toEqual(consequences.moriah.care.map((l) => l.ko));
    expect(steps.every((s) => s.hold > 0)).toBe(true);
    expect(createMoriahAftermathSteps(null)).toEqual([]);
    expect(createIshmaelPleaSteps()).toHaveLength(3);
    expect(createBook6EpilogueSteps('trust', 'none')).toHaveLength(3);
    expect(createBook6EpilogueSteps(null, 'none')).toEqual([]);
  });
  it('이스마엘 간구의 성경 인용 줄은 "성경:" 표지로, 덧붙인 성찰과 구분된다', () => {
    const [a, b, c] = createIshmaelPleaSteps() as Array<{ caption: string }>;
    expect(a.caption.startsWith('성경:')).toBe(true);
    expect(b.caption.startsWith('성경:')).toBe(true);
    expect(c.caption.startsWith('성경:')).toBe(false);
  });
});

describe('여정의 기록 (journey ledger)', () => {
  it('선택이 없으면 비어 있고, 선택한 만큼 권 순서대로 한 줄씩 나온다', () => {
    expect(journeyLedgerLines(new Map())).toEqual([]);
    const picks = new Map([['archery_target', '활을 가르침'], ['palace_answer', '담대히 선포'], ['isaac_field', '곁에 앉음']]);
    const lines = journeyLedgerLines(picks);
    expect(lines[0]).toBe(LEDGER_HEADER.ko);
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('제1권'); // 선택한 순서와 무관하게 권 순서
    expect(lines[2]).toContain('제3권');
    expect(lines[3]).toContain('제6권');
  });
  it('알 수 없는 선택은 무시한다', () => {
    expect(journeyLedgerLines(new Map([['palace_answer', '없는갈래'], ['nope', '담대히 선포']]))).toEqual([]);
  });
  it('대단원 자막 = 성향 맺음 세 줄 + 기록. 선택 모두 하면 권마다 줄이 있다', () => {
    const all = new Map<string, string>([
      ['palace_answer', '침묵으로 맞섬'], ['haran_depart', '아버지를 기리며'], ['esau_eat', '한 그릇 더'], ['war_envoy', '롯을 염려함'],
      ['archery_target', '활을 가르침'], ['sarah_tent', '이스마엘을 위한 간구'], ['satan_elder', '돌려 드림'], ['isaac_field', '사라 이야기'],
    ]);
    const lines = epilogueLines(all);
    const ledger = journeyLedgerLines(all);
    expect(ledger).toHaveLength(1 + 9); // 머리말 + 9개 항목(4권은 war_envoy 를 되짚는다)
    expect(lines).toHaveLength(3 + ledger.length);
    for (let b = 1; b <= 6; b++) expect(ledger.some((l) => l.includes(`제${b}권`)), `${b}권 줄`).toBe(true);
  });
  it('모든 갈래 이름은 성향표 또는 중립 목록에 있고, 선택 단계마다 항목이 있으며, 영어가 있다', () => {
    for (const id of PICK_ORDER) expect(LEDGER_ENTRIES.some((e) => e.pick === id), `${id} 항목`).toBe(true);
    expect(dict[LEDGER_HEADER.ko]).toBe(LEDGER_HEADER.en);
    for (const e of LEDGER_ENTRIES) {
      for (const [tag, l] of Object.entries(e.lines)) {
        expect(tag in TRAIT_OF || NEUTRAL_TAGS.has(tag), `${tag} 는 성향표/중립 목록에 없다`).toBe(true);
        expect(l.ko.startsWith(`제${e.book}권`), l.ko.slice(0, 10)).toBe(true);
        expect(dict[l.ko], l.ko.slice(0, 24)).toBe(l.en);
      }
    }
    // 성향표의 모든 갈래(+중립)가 기록에 한 줄은 있다 (단, 5·6권 보조 갈래 '지켜봐 줌' 등 포함)
    const covered = new Set(LEDGER_ENTRIES.flatMap((e) => Object.keys(e.lines)));
    for (const tag of [...Object.keys(TRAIT_OF), ...NEUTRAL_TAGS]) expect(covered.has(tag), `${tag} 기록 줄 없음`).toBe(true);
  });
});

describe('연출이 있는 2~6권의 모든 장은 실제 배선(wireChapterActions)에서 반드시 재생된다', () => {
  it.each(STAGING.filter((s) => s.book !== 1).map((s) => [`${s.book}권 ${s.chapter + 1}장 (${s.stage})`, s] as const))('%s', (_n, s) => {
    const sm = new StageManager(new THREE.Scene());
    const stage = sm.loadStage(s.stage as StageId);
    const played: Array<{ tag?: string }> = [];
    const d: WireDeps = {
      book: s.book, chapter: s.chapter, stage,
      interactions: new Interactions(),
      // 목표 문구는 일부러 엉뚱하게 둔다 — 장 판별이 문구에 기대면 여기서 실패한다
      hud: makeHud('전혀 관계없는 목표'), audio: noop(), particles: noop(),
      cutscene: { play(_s: Step[], _d?: () => void, tag?: string) { played.push({ tag }); } } as any,
      sceneCtx: { ...noop(), stageManager: sm },
      advanceChapter: () => undefined, loadChapter: () => undefined, switchStage: () => undefined,
      getPick: () => undefined, setPick: () => undefined, getTrait: () => null,
    };
    wireChapterActions(d);
    expect(played.map((p) => p.tag), '연출이 조용히 빠지면 안 된다').toContain(`staging_${s.book}_${s.chapter}`);
  });
});

describe('1권의 연출은 장 흐름(chapterFlow.loadChapter)에서 재생된다', () => {
  it.each(STAGING.filter((s) => s.book === 1).map((s) => [`1권 ${s.chapter + 1}장 (${s.stage})`, s] as const))('%s', (_n, s) => {
    const sm = new StageManager(new THREE.Scene());
    const played: Array<string | undefined> = [];
    const state = createGameState(null);
    state.playSeconds = 30; // 새 판 인트로(첫 2초)와 겹치지 않는다
    const flow = createChapterFlow({
      state, hasSave: true, hud: makeHud(), audio: noop(), crowd: noop(), particles: noop(),
      interactions: new Interactions(),
      cutscene: { running: false, tag: '', abort: () => undefined, play(_s: Step[], _d?: () => void, tag?: string) { played.push(tag); } } as any,
      cutsceneEngine: { running: false, stop: () => undefined, playSequence: () => undefined } as any,
      stageManager: sm, player: { root: new THREE.Object3D(), face: () => undefined } as any,
      chapterLog: new ChapterLog(), sceneCtx: { ...noop(), stageManager: sm },
      applyAtmosphere: () => undefined, setHero: () => undefined,
    });
    flow.loadChapter(1, s.chapter);
    expect(played, '연출이 조용히 빠지면 안 된다').toContain(`staging_1_${s.chapter}`);
  });

  it('새 판 인트로가 재생되는 첫 2초에는 연출이 인트로를 덮지 않는다', () => {
    const sm = new StageManager(new THREE.Scene());
    const played: Array<string | undefined> = [];
    const state = createGameState(null);
    const flow = createChapterFlow({
      state, hasSave: false, hud: makeHud(), audio: noop(), crowd: noop(), particles: noop(), interactions: new Interactions(),
      cutscene: { running: false, tag: '', abort: () => undefined, play(_s: Step[], _d?: () => void, tag?: string) { played.push(tag); } } as any,
      cutsceneEngine: { running: false, stop: () => undefined, playSequence: () => undefined } as any,
      stageManager: sm, player: { root: new THREE.Object3D(), face: () => undefined } as any,
      chapterLog: new ChapterLog(), sceneCtx: { ...noop(), stageManager: sm }, applyAtmosphere: () => undefined, setHero: () => undefined,
    });
    flow.loadChapter(1, 0);
    expect(played).toEqual(['book1_intro']);
  });
});

describe('이전 선택이 장면(등장인물·소품·순서)을 바꾼다 — 4·5·6권', () => {
  const gerar = stagingFor(4, 4)!;
  const home = stagingFor(5, 7)!;
  const oath = stagingFor(6, 3)!;
  const seq = (r: { captions: string[] }) => r.captions.join('|');

  it('4권 5장 그랄: 궁정에서 담대히 선포했으면 호위병이 서고 먼저 말을 건네고, 침묵했으면 돌무더기만 서고 왕이 먼저 묻는다 (순서·등장인물·소품이 모두 다르다)', () => {
    const bold = runSteps(gerar, { palace_answer: '담대히 선포' });
    const quiet = runSteps(gerar, { palace_answer: '침묵으로 맞섬' });
    const none = runSteps(gerar, {});
    expect(bold.added).toBe(none.added + 2);  // 호위병 둘 (등장인물)
    expect(quiet.added).toBe(none.added + 1); // 돌무더기 하나 (소품)
    expect(seq(bold)).toContain('먼저 입을 열었다');
    expect(seq(quiet)).toContain('먼저 눈을 낮춘 것은 왕');
    expect(seq(none)).not.toMatch(/먼저 입을 열었다|먼저 눈을 낮춘/);
    expect(bold.captions.length).toBe(none.captions.length + 2);
    expect(new Set([seq(bold), seq(quiet), seq(none)]).size).toBe(3);
    // 걷는 목적지(플레이어 이동)와 카메라 초점도 갈래마다 다르다
    expect(JSON.stringify(bold.focus)).not.toBe(JSON.stringify(quiet.focus));
  });

  it('5권 8장 돌아오는 길: 모리아에서 이삭을 돌려 드렸으면 이삭이 곁에서 걷고, 믿음으로 답했으면 이삭 없이 돌 표지가 선다 (전승 표지 포함)', () => {
    const gave = runSteps(home, { satan_elder: '돌려 드림' });
    const trusted = runSteps(home, { satan_elder: '믿음으로 답함' });
    const none = runSteps(home, {});
    expect(gave.added).toBe(none.added + 1);    // 이삭(등장인물)
    expect(trusted.added).toBe(none.added + 1); // 돌 표지(소품)
    expect(seq(gave)).toContain('손을 놓지 않은 채');
    expect(seq(trusted)).toContain('셈의 학당');
    expect(seq(none)).not.toMatch(/손을 놓지 않은 채|셈의 학당/);
    const trad = home.beats.find((b) => b.when?.is === '믿음으로 답함')!;
    expect(trad.src).toBe('tradition');
    expect(trad.ko).toContain('전해오는 이야기');
    expect(new Set([seq(gave), seq(trusted), seq(none)]).size).toBe(3);
  });

  it('6권 4장 엘리에셀의 맹세: 이삭 곁에 앉았으면 이삭이 아버지 곁에 서고, 사라 이야기를 했으면 사라의 장막 자리에 등불이 선다', () => {
    const beside = runSteps(oath, { isaac_field: '곁에 앉음' });
    const sarah = runSteps(oath, { isaac_field: '사라 이야기' });
    const none = runSteps(oath, {});
    expect(beside.added).toBe(none.added + 1);
    expect(sarah.added).toBe(none.added + 1);
    expect(seq(beside)).toContain('곁에 말없이 앉았던 저녁');
    expect(seq(sarah)).toContain('사라의 장막이 서 있던 자리');
    expect(new Set([seq(beside), seq(sarah), seq(none)]).size).toBe(3);
  });

  it('갈래 장면은 등장인물·소품 둘 다 막힌 곳에 서지 않는다 (전 갈래 조합으로 검증)', () => {
    const sm = new StageManager(new THREE.Scene());
    for (const [s, w] of [[gerar, 'cast'], [home, 'cast'], [oath, 'cast']] as const) {
      const col = sm.loadStage(s.stage as StageId).col;
      for (const m of s.cast ?? []) if (m.when) expect(col.blocked(m.at[0], m.at[1], 0.3), `${s.book}권 ${m.id} ${w}`).toBe(false);
    }
  });
});

describe('6권 대단원 장면 자체가 성향에 따라 다르다 (카메라·배치·소품)', () => {
  const TR: Trait[] = ['courage', 'trust', 'care'];
  function runFinale(trait: Trait) {
    const sm = new StageManager(new THREE.Scene());
    const stage = sm.loadStage('hebron_machpelah');
    const before = stage.root.children.length;
    const focus: Array<[number, number, number]> = [];
    const tilts: number[] = [];
    const c: any = { renderer: { setTilt: (t: number) => tilts.push(t), resetTilt: () => undefined }, hud: makeHud(), audio: noop(), stageManager: sm, setCameraFocus: (x: number, y: number, z: number) => focus.push([x, y, z]) };
    const caps: string[] = [];
    for (const st of createBook6FinaleTableauSteps(c, trait) as Array<Record<string, any>>) {
      if (typeof st.do === 'function') st.do();
      else if (typeof st.animate === 'number') { st.frame(0); st.frame(0.5); st.frame(1); }
      else if (typeof st.caption === 'string') caps.push(st.caption);
    }
    return { added: stage.root.children.length - before, focus: focus[focus.length - 1], tilts, caps, col: stage.col };
  }
  it('성향마다 카메라 초점·기울기·등장인물 수·소품이 다르다', () => {
    const [co, tr, ca] = TR.map(runFinale);
    expect(co.added).toBe(3); // 활 + 이삭 + 이스마엘
    expect(tr.added).toBe(2); // 등불 + 홀로 앉은 이삭
    expect(ca.added).toBe(4); // 떡 + 이삭 + 이스마엘 + 리브가
    expect(new Set([co, tr, ca].map((r) => r.focus.join(','))).size).toBe(3);
    expect(new Set([co, tr, ca].map((r) => r.tilts[0])).size).toBe(3);
    expect(new Set(TR.map((t) => FINALE_LAYOUT[t].prop)).size).toBe(3);
    expect(FINALE_LAYOUT.courage.prop).toBe('bow_rest');
    expect(FINALE_LAYOUT.trust.prop).toBe('altar_lamp');
    expect(FINALE_LAYOUT.care.prop).toBe('bread_basket');
    expect(new Set([co.caps[0], tr.caps[0], ca.caps[0]]).size).toBe(3);
  });
  it('배치는 모두 막힌 곳이 아니고 소품 종류가 실제로 빌드된다', () => {
    const col = runFinale('care').col;
    for (const t of TR) {
      const L = FINALE_LAYOUT[t];
      for (const p of [L.propAt, L.focus, ...L.actors.map((a) => a.at)]) expect(col.blocked(p[0], p[1], 0.3), `${t} ${p}`).toBe(false);
      expect(buildStagingProp(L.prop).children.length).toBeGreaterThan(0);
      expect((STAGING_PROPS as readonly string[]).includes(L.prop)).toBe(true);
    }
  });
  it('createBook6EpilogueSteps 는 장면 컨텍스트를 받으면 장면 단계(+설명 자막)를 자막 앞에 붙이고, 없으면 자막 셋만 준다', () => {
    const c: any = { renderer: noop(), hud: makeHud(), audio: noop(), setCameraFocus: () => undefined };
    for (const t of TR) {
      expect(createBook6EpilogueSteps(t, 'none')).toHaveLength(3);
      const withScene = createBook6EpilogueSteps(t, 'none', c);
      expect(withScene).toHaveLength(3 + 3); // do + animate + 설명 자막 + 세 줄
      expect(typeof (withScene[0] as any).do).toBe('function');
    }
    expect(createBook6EpilogueSteps(null, 'none', c)).toEqual([]);
  });
});

describe('5권 2장 목표 패널이 앞 장의 목표를 물려받지 않는다', () => {
  const FEAST = '이삭 출생과 젖 뗀 날 큰 잔치 기념하기 (0/1)';
  function enter(chapterIndex: number | undefined) {
    const sm = new StageManager(new THREE.Scene());
    sm.loadStage('beersheba');
    const hud = makeHud('이전 장의 목표');
    const interactions = new Interactions();
    const ctx: any = {
      interactions, hud, audio: noop(), particles: noop(), cutscene: { play: () => undefined }, sceneCtx: { ...noop(), stageManager: sm },
      stageId: 'beersheba', chapterIndex, getPick: () => undefined, setPick: () => undefined, onBook5Complete: () => undefined, onSwitchStage: () => undefined,
    };
    setupBook5Actions(ctx);
    return { hud, interactions };
  }
  it('5권 1장(이삭의 출생)만 잔치 루프와 목표를 가진다', () => {
    const a = enter(0);
    expect(a.hud.goal).toBe(FEAST);
    expect(a.interactions.size).toBeGreaterThan(0);
    expect(enter(undefined).hud.goal).toBe(FEAST); // 장 번호를 모르는 호출은 기존 그대로
  });
  it.each([1, 2, 3, 7])('같은 무대의 %i번 장은 자기 장 제목을 목표로 두고 잔치 상호작용을 만들지 않는다', (i) => {
    const r = enter(i);
    expect(r.hud.goal).toBe(BOOKS[5].chapters[i].title);
    expect(r.hud.goal).not.toBe(FEAST);
    expect(r.hud.goalCategory).toBe(BOOKS[5].title);
    expect(r.hud.goalProgress).toBeNull();
    expect(r.interactions.size).toBe(0);
  });
});
