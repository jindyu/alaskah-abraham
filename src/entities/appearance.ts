import { PAL } from '../world/palette';

/** 캐릭터 외형. 각 값은 아래 OPTIONS 목록의 인덱스 */
export interface Appearance {
  name: string;
  /** 0 아들, 1 딸 — 식구들이 부르는 호칭이 바뀜 (형/오빠, 형수님/새언니) */
  sex: number;
  skin: number;
  hair: number;
  hairColor: number;
  head: number;
  beard: number;
  tunic: number;
  stripe: number;
  mantle: number;
  lambName: number;
}

export interface Choice { label: string; color?: number }

/** 커스터마이징 선택지. 색은 팔레트에서만 고른다 */
export const OPTIONS = {
  sex: [{ label: '아들' }, { label: '딸' }],
  skin: [
    { label: '밝은 올리브', color: PAL.skin[3] }, { label: '햇볕 탄 빛', color: PAL.skin[2] },
    { label: '구릿빛', color: PAL.skin[1] }, { label: '짙은 갈색', color: PAL.skin[0] },
  ],
  hair: [{ label: '짧은 머리' }, { label: '곱슬머리' }, { label: '묶은 머리' }, { label: '긴 머리' }],
  hairColor: [
    { label: '흑갈색', color: 0x2a1a14 }, { label: '갈색', color: 0x5a3a26 },
    { label: '적갈색', color: 0x7a3a22 }, { label: '회색', color: 0x8a8480 },
  ],
  head: [{ label: '없음' }, { label: '남색 머리띠' }, { label: '머릿수건' }],
  beard: [{ label: '없음' }, { label: '짧은 수염' }],
  tunic: [
    { label: '꼭두서니 빨강', color: PAL.fabric.red }, { label: '쪽빛', color: PAL.fabric.indigo },
    { label: '청록', color: PAL.fabric.teal }, { label: '황토', color: PAL.fabric.ochre },
    { label: '무명 흰빛', color: PAL.fabric.cream }, { label: '장밋빛', color: PAL.fabric.rose },
  ],
  stripe: [
    { label: '샛노랑', color: PAL.fabric.saffron }, { label: '무명 흰빛', color: PAL.fabric.cream },
    { label: '쪽빛', color: PAL.fabric.indigo }, { label: '짙은 빨강', color: PAL.fabric.redDark },
  ],
  mantle: [
    { label: '없음' }, { label: '양털 겉옷', color: 0xd8ccb4 },
    { label: '갈색 겉옷', color: 0x7a5238 }, { label: '쪽빛 겉옷', color: 0x2e4270 },
  ],
  lambName: [{ label: '보리' }, { label: '구름' }, { label: '솜이' }, { label: '달래' }, { label: '몽실' }],
} satisfies Record<string, Choice[]>;

export type OptionKey = keyof typeof OPTIONS;

export const DEFAULT_APPEARANCE: Appearance = {
  name: '아브람', sex: 0, skin: 1, hair: 0, hairColor: 0, head: 1, beard: 0, tunic: 3, stripe: 2, mantle: 0, lambName: 0,
};

const KEY = 'abraham.appearance.v1';

/** 이름 최대 글자 수 (글자 = 코드 포인트: 이모지 하나도 한 글자) */
export const NAME_MAX = 8;

/**
 * 입력한 이름을 안전하게 다듬음 (순수): 줄바꿈·제어 문자·보이지 않는 서식 문자(글자 폭 0, 방향 지정)를 없애고,
 * 대사 토큰 기호({ })는 빼고(이름 안의 '{lamb}' 가 토큰으로 읽히지 않게), 공백은 하나로 줄여 앞뒤를 자른 뒤 NAME_MAX 글자로 자름.
 * 결과가 비면 빈 글. 호출한 쪽이 기본 이름으로 바꿈
 */
export function sanitizeName(raw: unknown, typing = false): string {
  const s = String(raw ?? '').replace(/[\p{Cc}\p{Cf}\u2028\u2029{}]/gu, '');
  // 입력 중(typing)에는 공백을 건드리지 않음: 단어 사이에 띄어쓰려고 친 공백이 바로 지워지지 않게
  const t = typing ? s : s.replace(/\s+/g, ' ').trim();
  const cut = Array.from(t).slice(0, NAME_MAX).join('');
  return typing ? cut : cut.trim();
}

/** 선택지 개수가 줄었을 때를 대비해 범위 보정 */
export function normalizeAppearance(raw: unknown): Appearance {
  const a = { ...DEFAULT_APPEARANCE, ...(raw as object) } as Appearance;
  for (const k of Object.keys(OPTIONS) as OptionKey[]) a[k] = Math.max(0, Math.min(OPTIONS[k].length - 1, a[k] | 0));
  a.name = sanitizeName(a.name) || DEFAULT_APPEARANCE.name; // 글자(코드 포인트) 단위로 자름: 이모지가 깨지지 않게
  if (a.sex === 1) a.beard = 0; // 딸은 수염 줄이 숨겨져 있으니 옛 저장의 값도 떼어 줌
  return a;
}

/** 저장된 외형 (없거나 저장소를 못 쓰면 null) */
export function loadAppearance(): Appearance | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return normalizeAppearance(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveAppearance(a: Appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* 저장소를 못 쓰는 환경(비공개 창 등)에서는 이번 세션만 유지 */
  }
}

export const colorOf = (k: OptionKey, i: number) => (OPTIONS[k][i] as Choice).color ?? 0xffffff;
