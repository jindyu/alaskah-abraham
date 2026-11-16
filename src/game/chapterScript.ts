/**
 * Godot 에서 옮겨 온 챕터 대본(abraham_1..6.json)을 3D 복셀 무대에서 재생할 수 있는 부분만 추린다 (순수).
 *
 * 대본에는 Godot 2D 타일 좌표 기반의 연출(spawn/move_actor/camera_move …)이 섞여 있어 그대로는 재현이 안 된다.
 * 그러나 대사(dialogue: 화자·본문·보이스 경로)와 제목(title)은 연출과 무관하게 읽을 수 있다.
 * 직접 쓴 장면(src/systems/scenes)이 없는 챕터에서 이것을 재생해, 쓰고도 못 쓰던 대사와 보이스 클립을 살린다.
 */
export interface LegacyStep {
  step_type: string;
  [key: string]: unknown;
}

const KEEP = new Set(['dialogue', 'title']);

/** 재생 가능한 스텝만 (본문이 빈 대사는 버림). 대사가 하나도 없으면 빈 배열 */
export function dialogueOnlySteps(steps: ReadonlyArray<LegacyStep>): LegacyStep[] {
  const out: LegacyStep[] = [];
  let dialogues = 0;
  for (const s of steps) {
    if (!KEEP.has(s.step_type)) continue;
    if (s.step_type === 'dialogue') {
      const text = typeof s.text === 'string' ? s.text.trim() : '';
      if (!text) continue;
      dialogues++;
    }
    out.push(s);
  }
  return dialogues > 0 ? out : [];
}

/**
 * 챕터 요약(카탈로그 summary, 작가가 쓴 글)을 도입 내레이션으로 맨 앞에 붙인다.
 * 대사가 4~8줄뿐인 짧은 장도 장면의 맥락을 먼저 읽게 한다. 대사가 없는(빈) 재생에는 붙이지 않는다.
 */
export function withChapterIntro(steps: LegacyStep[], summary: string | undefined): LegacyStep[] {
  const text = (summary ?? '').trim();
  if (steps.length === 0 || !text) return steps;
  return [{ step_type: 'dialogue', text }, ...steps];
}

/** 대사 스텝 수 */
export function countDialogues(steps: ReadonlyArray<LegacyStep>): number {
  let n = 0;
  for (const s of steps) if (s.step_type === 'dialogue' && typeof s.text === 'string' && s.text.trim()) n++;
  return n;
}

/** 성경 본문 밖의 전승(미드라시·탈무드 등)을 가리키는 카탈로그 태그 낱말 */
export const TRADITION_TERMS = ['미드라시', '탈무드', '랍바', '산헤드린', '야셀', '야살', '요세푸스', '피르케 드 랍비 엘리에젤', '타르굼', '탄후마'] as const;

/**
 * 챕터 태그에서 전승 출처를 뽑는다 (순수). CLAUDE.md: 성경 본문과 미드라시/전승은 분명히 구분해 표기한다.
 * 전승 태그가 없으면 빈 배열 (표기 없음).
 */
export function traditionSources(tags: ReadonlyArray<string> | undefined): string[] {
  const out: string[] = [];
  for (const t of tags ?? []) {
    if (TRADITION_TERMS.some((term) => t.includes(term)) && !out.includes(t)) out.push(t);
  }
  return out;
}
