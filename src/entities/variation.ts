import { PAL } from '../world/palette';
import type { CastMember } from './cast';

export type Headpiece = NonNullable<CastMember['headpiece']> | 'helmet';

/** 한 NPC 의 겉모습 변주. 같은 id 는 항상 같은 값 (순수 함수, 난수 없음) */
export interface NpcLook {
  scale: number; // 0.92~1.08 (일반 배역만 변주)
  skinColor: number;
  tunicColor: number;
  accentColor: number; // 허리띠·두건·밑단 색
  hairColor: number;
  beardColor: number | undefined;
  headpiece: Headpiece;
  hairStyle: 0 | 1 | 2; // 0 짧은 머리, 1 곱슬(부피), 2 긴 머리(어깨까지)
  robe: boolean; // 발목까지 긴 겉옷
  pattern: 0 | 1 | 2 | 3; // 0 무늬 없음, 1 밑단 띠, 2 가슴 세로줄, 3 어깨 가로띠
  sash: boolean; // 허리에서 비스듬히 두른 띠
  prop: string | undefined; // 'staff' | 'jar' | undefined
}

/** 변주를 쓰는 일반 배역. 이름 있는 인물은 어느 장면에서나 같은 모습 */
export const GENERIC_CASTS: ReadonlySet<string> = new Set(['citizen', 'guard', 'soldier', 'stranger']);

/** FNV-1a 문자열 해시 → 32비트 */
export function hashId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** 해시에서 독립적인 0..n-1 값을 뽑음 (slot 마다 다른 비트) */
function pick(h: number, slot: number, n: number): number {
  let x = (h ^ Math.imul(slot + 1, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) % n;
}

const ROBES = [PAL.fabric.red, PAL.fabric.indigo, PAL.fabric.teal, PAL.fabric.ochre, PAL.fabric.cream, PAL.fabric.rose, 0x6b5c4e, 0x8e3b5e, 0x4f6b3a, 0x7a5238];
const ACCENTS = [PAL.fabric.saffron, PAL.fabric.cream, PAL.fabric.indigo, PAL.fabric.redDark, PAL.fabric.teal, PAL.fabric.ochre];
const HAIRS = [0x1a120c, 0x2a1a14, 0x3b281a, 0x5a3a26, 0x7a3a22, 0x8a8480];
const SKINS = [PAL.skin[0], PAL.skin[1], PAL.skin[2], PAL.skin[3]];
const HEADS: Headpiece[] = ['none', 'band', 'turban', 'turban'];

export function npcLook(id: string, cast: CastMember): NpcLook {
  const base: NpcLook = {
    scale: 1, skinColor: cast.skinColor, tunicColor: cast.tunicColor, accentColor: cast.accentColor,
    hairColor: cast.hairColor, beardColor: cast.beardColor, headpiece: cast.id === 'guard' || cast.id === 'soldier' ? 'helmet' : (cast.headpiece ?? 'none'),
    hairStyle: 0, robe: false, pattern: 0, sash: false, prop: cast.defaultProp,
  };
  const r = ROLE_LOOK[cast.id];
  if (r) Object.assign(base, r);
  base.scale = cast.scale;
  // 이름 있는 인물은 (dep_abram 같은 보조 인스턴스도) 어디서나 본체와 같은 모습
  if (!GENERIC_CASTS.has(cast.id)) return base;

  const h = hashId(id);
  base.scale = cast.scale * (0.92 + pick(h, 0, 17) * 0.01);
  base.skinColor = SKINS[pick(h, 1, SKINS.length)];
  base.hairColor = HAIRS[pick(h, 2, HAIRS.length)];
  base.hairStyle = pick(h, 3, 3) as 0 | 1 | 2;
  base.pattern = pick(h, 4, 4) as 0 | 1 | 2 | 3;
  base.sash = pick(h, 5, 2) === 1;
  base.robe = pick(h, 6, 3) === 0;
  if (cast.id === 'citizen' || cast.id === 'stranger') {
    base.tunicColor = ROBES[pick(h, 7, ROBES.length)];
    base.accentColor = ACCENTS[pick(h, 8, ACCENTS.length)];
    if (base.accentColor === base.tunicColor) base.accentColor = PAL.fabric.cream;
    base.headpiece = HEADS[pick(h, 9, HEADS.length)];
    base.beardColor = pick(h, 10, 3) === 0 ? undefined : base.hairColor;
    const p = pick(h, 11, 4);
    base.prop = p === 0 ? 'staff' : p === 1 ? 'jar' : undefined;
    if (cast.id === 'stranger') { base.robe = true; base.prop = 'staff'; base.headpiece = 'turban'; }
  } else {
    // 근위병·가신: 투구 + 창은 유지하되 겉옷·띠 색만 변주
    base.tunicColor = [0x5a3220, 0x4a3a2c, 0x6a2a20, 0x3d4a3a][pick(h, 7, 4)];
    base.accentColor = [0xb5822e, 0xc8963e, 0x9e9ea6, 0x7a2818][pick(h, 8, 4)];
    base.beardColor = pick(h, 10, 2) === 0 ? undefined : base.hairColor;
    base.headpiece = 'helmet';
    base.robe = false;
    base.prop = 'spear';
  }
  return base;
}

/** 핵심 인물의 고정 실루엣 (색·크기는 cast.ts 값 그대로) */
const ROLE_LOOK: Record<string, Partial<NpcLook>> = {
  abraham: { robe: true, prop: 'staff', pattern: 1, sash: true, hairStyle: 2 },
  abram: { robe: true, prop: 'staff', pattern: 3, sash: true },
  sarah: { robe: true, pattern: 1, hairStyle: 2 },
  sarai: { robe: true, pattern: 1 },
  hagar: { robe: true, prop: 'jar', pattern: 2, sash: true },
  ishmael: { prop: 'bow', pattern: 3, sash: true, hairStyle: 1 },
  ishmael_young: { prop: 'bow', hairStyle: 1 },
  isaac: { pattern: 2, hairStyle: 1 },
  lot: { robe: true, pattern: 3, sash: true },
  eliezer: { robe: true, prop: 'staff', pattern: 1 },
  nimrod: { robe: true, pattern: 3, sash: true, prop: 'scepter' },
  melchizedek: { robe: true, pattern: 2, sash: true, hairStyle: 2 },
  abimelech: { robe: true, pattern: 1, sash: true, prop: 'scepter' },
  pharaoh: { robe: true, pattern: 3 },
  terah: { robe: true, pattern: 1, prop: 'staff' },
  guard: { headpiece: 'helmet', prop: 'spear' },
  angel: { robe: true, hairStyle: 2 },
};
