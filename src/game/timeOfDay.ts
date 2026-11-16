/**
 * 책·무대별 시간대(하늘색·태양 색/세기/방향·반구광) 프리셋 (순수, three.js 없음).
 * 같은 무대(예: 마므레)도 3권은 별빛 밤, 4권은 한낮처럼 첫인상이 달라지고 그림자 방향도 바뀐다.
 * null 이면 지역 기본 대기(createGame.applyAtmosphere)를 그대로 쓴다.
 */
export interface TimeOfDay {
  /** 하늘(배경) 색. 없으면 지역 기본 */
  sky?: number;
  sunColor: number;
  sunIntensity: number;
  hemiColor: number;
  hemiGround: number;
  hemiIntensity: number;
  /** 태양 위치 (그림자 방향) */
  sunPos: readonly [number, number, number];
}

// 달빛 밤: 하늘은 깊은 남색이되 완전한 검정은 피하고, 달빛(차가운 키라이트)+보라빛 반구광으로 지면·윤곽이 읽히게
const NIGHT: TimeOfDay = { sky: 0x101e52, sunColor: 0xa8c0ff, sunIntensity: 2.1, hemiColor: 0x6a7cd8, hemiGround: 0x34407c, hemiIntensity: 1.5, sunPos: [-10, 14, -6] };
const NOON: TimeOfDay = { sunColor: 0xfffbe8, sunIntensity: 2.8, hemiColor: 0xfff8f0, hemiGround: 0x9a7448, hemiIntensity: 1.3, sunPos: [1, 20, 2] };
const GOLDEN: TimeOfDay = { sunColor: 0xffd890, sunIntensity: 2.5, hemiColor: 0xffe8c8, hemiGround: 0x9c7a50, hemiIntensity: 1.6, sunPos: [12, 9, -8] };
const DAWN: TimeOfDay = { sky: 0xe8a888, sunColor: 0xffc8a0, sunIntensity: 2.4, hemiColor: 0xf6d6c8, hemiGround: 0xa08068, hemiIntensity: 1.9, sunPos: [-14, 7, 8] };
const DUSK: TimeOfDay = { sky: 0x7a4c6e, sunColor: 0xff9a60, sunIntensity: 2.2, hemiColor: 0xe0a8a8, hemiGround: 0x7a5658, hemiIntensity: 1.55, sunPos: [-12, 5, 6] };
const AFTERNOON: TimeOfDay = { sunColor: 0xffe0a8, sunIntensity: 2.5, hemiColor: 0xe8e0d0, hemiGround: 0x8a7050, hemiIntensity: 1.4, sunPos: [12, 10, 6] };

/** 이 책·무대의 시간대 프리셋 (없으면 null) */
export function timeOfDayFor(book: number, stageId: string): TimeOfDay | null {
  switch (book) {
    case 3: return NIGHT;                              // 별과 언약: 별빛 밤
    case 4:
      if (stageId === 'sodom') return null;            // 소돔: 유황불 하늘은 지역 기본
      return NOON;                                     // 마므레 한낮 (세 나그네)
    case 5: return stageId === 'moriah' ? DAWN : AFTERNOON; // 모리아 새벽 / 브엘세바 오후
    case 6: return stageId === 'nahor_well' ? DUSK : GOLDEN; // 나홀 해질녘 / 헤브론 황금빛
    default: return null;
  }
}

/** 환경 입자(분위기용으로 플레이어 주변에 가볍게 뿌림). 없으면 null */
export type AmbientKind = 'glory_sparkles' | 'embers' | 'trail_dust';

export function ambientFor(book: number, stageId: string): AmbientKind | null {
  if (stageId === 'sodom') return 'embers';                  // 유황불 속 불씨
  if (book === 3) return 'glory_sparkles';                   // 별빛 밤의 반딧불
  if (book === 6 && stageId === 'nahor_well') return 'glory_sparkles'; // 해질녘 빛 알갱이
  if (stageId === 'beersheba' || stageId === 'hebron_machpelah' || stageId === 'siddim_hobah') return 'trail_dust'; // 마른 땅의 먼지
  return null;
}
