import { describe, expect, it } from 'vitest';
import { Interactions } from '../src/systems/interaction';
import { wireChapterActions, type WireDeps } from '../src/game/actionWiring';

function universal(): any {
  return new Proxy(function () {}, {
    get: (_t, p) => (p === 'then' || p === Symbol.toPrimitive ? undefined : universal()),
    apply: () => universal(),
    set: () => true,
  });
}
const mk = (book: number, chapter: number, stage: string | null): WireDeps => ({
  book, chapter,
  stage: stage ? ({ id: stage } as any) : null,
  interactions: new Interactions(),
  hud: universal(), audio: universal(), particles: universal(), cutscene: universal(), sceneCtx: universal(),
  advanceChapter: () => undefined, loadChapter: () => undefined, switchStage: () => undefined,
  getPick: () => undefined, setPick: () => undefined, getTrait: () => null,
});

describe('wireChapterActions', () => {
  it('3권은 무대와 상관없이 3권 액션을 건다', () => {
    const d = mk(3, 0, 'mamre');
    wireChapterActions(d);
    expect(d.interactions.size).toBeGreaterThan(0);
  });
  it('5권 5장(shechem_bethel)은 단계형 루프를 건다', () => {
    const d = mk(5, 4, 'shechem_bethel');
    wireChapterActions(d);
    expect(d.interactions.get('satan_elder')).toBeTruthy();
  });
  it('1권 에서 진영 11장은 단계형 루프, 그 밖은 팥죽 단일 상호작용', () => {
    const a = mk(1, 11, 'esau_camp');
    wireChapterActions(a);
    expect(a.interactions.get('esau_return')).toBeTruthy();
    const b = mk(1, 12, 'esau_camp');
    wireChapterActions(b);
    expect(b.interactions.size).toBe(1);
  });
});
