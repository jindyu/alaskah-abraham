import { describe, expect, it } from 'vitest';
import { PICK_AT } from '../src/ui/pickAt';
import { CATALOG } from '../src/systems/story';

describe('장 선택 선택 요약 (PICK_AT)', () => {
  it('모든 선택의 [권, 장]이 카탈로그에 실제로 있다 (카탈로그 순서가 바뀌면 여기서 걸린다)', () => {
    for (const [id, [book, ch]] of Object.entries(PICK_AT)) {
      const chapter = CATALOG[book]?.chapters[ch];
      expect(chapter, `${id} → ${book}권 ${ch}번 장이 카탈로그에 없다`).toBeTruthy();
      expect(chapter!.title.length).toBeGreaterThan(0);
    }
  });
});
