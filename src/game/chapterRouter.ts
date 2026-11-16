/**
 * (권, 장) → 직접 쓴 컷신 장면 라우팅 표 (순수, three.js/DOM 없음).
 *
 * 장에 직접 쓴 장면이 있으면 그것을 재생하고, 없으면 챕터 대본(JSON)의 대사(chapterScript.ts)를 재생한다.
 * 상호작용 루프(액션)는 권·무대 단위로 따로 정해진다 (systems/actions/book*Actions.ts).
 * 1권은 우르 통합 루프라 첫 시작 인트로만 따로 다룬다 (createGame.ts).
 */
export type SceneKey =
  | 'book2_shechem' | 'book2_egypt' | 'book2_hobah'
  | 'book3_stars'
  | 'book4_visitors' | 'book4_sodom'
  | 'book5_isaac_birth' | 'book5_moriah_road' | 'book5_moriah_akedah'
  | 'book6_sarah' | 'book6_ephron' | 'book6_rebekah' | 'book6_abraham_death';

const SCENES: Readonly<Record<number, Readonly<Record<number, SceneKey>>>> = {
  2: { 0: 'book2_shechem', 1: 'book2_egypt', 6: 'book2_hobah' },
  3: { 0: 'book3_stars' },
  4: { 0: 'book4_visitors', 1: 'book4_sodom', 2: 'book4_sodom' },
  5: { 0: 'book5_isaac_birth', 4: 'book5_moriah_road', 5: 'book5_moriah_road', 6: 'book5_moriah_akedah' },
  6: { 0: 'book6_sarah', 1: 'book6_ephron', 4: 'book6_rebekah', 6: 'book6_abraham_death' },
};

/** 이 장에서 재생할 직접 쓴 장면 키 (없으면 null → 챕터 대본 대사로 대체) */
export function sceneKeyFor(book: number, chapter: number): SceneKey | null {
  return SCENES[book]?.[chapter] ?? null;
}

/** 표에 등록된 모든 (권, 장, 키) — 테스트와 점검용 */
export function allScenePlans(): Array<{ book: number; chapter: number; key: SceneKey }> {
  const out: Array<{ book: number; chapter: number; key: SceneKey }> = [];
  for (const [b, chapters] of Object.entries(SCENES)) {
    for (const [c, key] of Object.entries(chapters)) out.push({ book: Number(b), chapter: Number(c), key });
  }
  return out;
}
