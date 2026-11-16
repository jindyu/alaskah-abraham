import { noteError } from '../core/diagnostics';
import type { TextPolicy } from './uiScale';

// 글자 크기 단계: 설정에서 바꾸고 브라우저 저장소에 기억한다. HUD·창·대사·자막 글자 전체에 같은 배율로 적용된다 (U3).
export type TextStep = 0 | 1 | 2;
export const TEXT_STEPS: readonly TextStep[] = [0, 1, 2];
export const TEXT_STEP_LABEL: Record<TextStep, string> = { 0: '보통', 1: '크게', 2: '아주 크게' };
/** 단계별 본문 글자 크기(px). 보통 = 예전 크기 13 */
const BODY: Record<TextStep, number> = { 0: 13, 1: 15, 2: 17 };
const KEY = 'abraham.textstep.v1';
/** 터치 모드에서 HUD·창 글자를 이보다 작게 그리지 않음 (CSS px — 팔 길이에서 읽을 수 있는 크기) */
export const TOUCH_MIN_CSS_PX = 12;

const valid = (v: unknown): v is TextStep => v === 0 || v === 1 || v === 2;

function load(): TextStep {
  try {
    const s = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    const n = s === null ? NaN : Number(s);
    if (valid(n)) return n;
  } catch (e) { noteError('textSize:1', e); /* 저장소를 못 쓰면 기본 */ }
  // 저장된 선택이 없으면: 손가락으로 하는 작은 화면은 '크게'부터
  try { if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return 1; } catch (e) { noteError('textSize:2', e); /* 미지원 */ }
  return 0;
}

let step: TextStep = load();

export const textStep = (): TextStep => step;
/** 본문 글자 크기 (대사 본문·선택지·나레이션 자막). 그릴 때는 hud.txt(…, 13) 처럼 보통 크기를 넘기면 정책이 이만큼 키운다 */
export const bodyPx = (): number => BODY[step];
/** 하늘의 음성 자막 글자 크기 (본문보다 3 큼, 예전 보통 16) */
export const voicePx = (): number => BODY[step] + 3;
/** 본문 줄 간격 (예전 보통 17) */
export const bodyLine = (): number => BODY[step] + 4;

/** 단계의 글자 배율 (보통 1, 크게 15/13, 아주 크게 17/13) — 대사 본문 13 이 예전 단계별 크기(13·15·17)와 똑같이 나오는 값 */
export const textScale = (s: TextStep): number => BODY[s] / BODY[0];

/** 데스크톱(터치 아님)에서도 HUD 글자를 이 CSS px 보다 작게 그리지 않음 — 960×600 처럼 배율 1 인 창에서 9~11px 글자가 읽히지 않던 문제 */
export const DESKTOP_MIN_CSS_PX = 12;

/** 할 일 패널 본문 글자 크기: UI 1칸이 1.5 CSS px 미만인 작은 창에서는 14, 그 밖은 13 (큰 화면은 이미 충분히 크다) */
export function goalPx(cssPerUi: number): number { return cssPerUi < 1.5 ? 14 : 13; }

// 단계(3) × 터치(2) 조합마다 한 객체 — 프레임마다 불러도 문자열·객체를 만들지 않는다
const policies: (TextPolicy | undefined)[] = [];
/**
 * 글자 단계와 터치 여부로 정한 글자 정책 (hud.textPolicy 에 넣음). 같은 조합은 같은 객체를 돌려줘 매 프레임 넣어도 캐시가 깨지지 않는다.
 * touch: 터치 UI 가 떠 있음 — 이때는 글자를 TOUCH_MIN_CSS_PX 아래로 내리지 않음
 */
export function textPolicyFor(s: TextStep, touch: boolean): TextPolicy {
  const st: TextStep = valid(s) ? s : 0;
  const key = st * 2 + (touch ? 1 : 0);
  let p = policies[key];
  if (!p) { p = Object.freeze({ scale: textScale(st), minCssPx: touch ? TOUCH_MIN_CSS_PX : DESKTOP_MIN_CSS_PX }); policies[key] = p; }
  return p;
}

export function setTextStep(s: TextStep, persist = true): void {
  if (!valid(s)) return;
  step = s;
  if (persist) { try { localStorage.setItem(KEY, String(s)); } catch (e) { noteError('textSize:3', e); /* 저장소를 못 써도 이번 실행에는 적용 */ } }
}

export function nextTextStep(s: TextStep, dir: 1 | -1 = 1): TextStep {
  return TEXT_STEPS[(s + dir + TEXT_STEPS.length) % TEXT_STEPS.length];
}
