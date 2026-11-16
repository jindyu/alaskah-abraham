import { DEFAULT_APPEARANCE, type Appearance } from '../entities/appearance';
import type { ProtagonistId } from '../entities/cast';

/** 조작 인물별 겉모습 (장의 주인공이 바뀔 때 Player.setAppearance 로 적용) */
export const PROTAGONIST_APPEARANCES: Record<ProtagonistId, Appearance> = {
  abram_young: {
    ...DEFAULT_APPEARANCE,
    name: '청년 아브람',
    skin: 1,
    hair: 0,
    hairColor: 0,
    head: 0,
    beard: 0,
    tunic: 3,
    stripe: 1,
    mantle: 0,
  },
  abram: {
    ...DEFAULT_APPEARANCE,
    name: '아브람',
    skin: 2,
    hair: 0,
    hairColor: 0,
    head: 2,
    beard: 1,
    tunic: 1,
    stripe: 0,
    mantle: 2,
  },
  abraham: {
    ...DEFAULT_APPEARANCE,
    name: '아브라함',
    skin: 1,
    hair: 3,
    hairColor: 3,
    head: 2,
    beard: 1,
    tunic: 4,
    stripe: 2,
    mantle: 1,
  },
  lot: {
    ...DEFAULT_APPEARANCE,
    name: '롯',
    skin: 1,
    hair: 1,
    hairColor: 0,
    head: 2,
    beard: 1,
    tunic: 1,
    stripe: 2,
    mantle: 0,
  },
  eliezer: {
    ...DEFAULT_APPEARANCE,
    name: '엘리에셀',
    skin: 2,
    hair: 0,
    hairColor: 3,
    head: 2,
    beard: 1,
    tunic: 3,
    stripe: 2,
    mantle: 0,
  },
  esau: {
    ...DEFAULT_APPEARANCE,
    name: '에서',
    skin: 2,
    hair: 1,
    hairColor: 2,
    head: 1,
    beard: 1,
    tunic: 0,
    stripe: 3,
    mantle: 2,
  },
};

/** 알 수 없는 인물이면 기본 겉모습 */
export function appearanceFor(hero: ProtagonistId): Appearance {
  return PROTAGONIST_APPEARANCES[hero] ?? DEFAULT_APPEARANCE;
}
