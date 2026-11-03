/**
 * 화면 효과(블룸 + 틸트 시프트) 설정. 순수 모듈 — three 를 끌어오지 않아 단위 테스트가 닿음.
 * 저장 칸과 별개로 브라우저에 한 번만 저장 (소리 설정과 같은 방식).
 */
export type FxLevel = 'off' | 'low' | 'normal' | 'high';
export const FX_LEVELS: readonly FxLevel[] = ['off', 'low', 'normal', 'high'];
export const FX_LABEL: Record<FxLevel, string> = { off: '끔', low: '낮음', normal: '보통', high: '높음' };
export const DEFAULT_FX: FxLevel = 'normal';
const KEY = 'abraham.fx.v1';

export interface FxParams {
  bloom: number;
  tilt: number;
  /** 해 그림자 맵 한 변(픽셀) */
  shadow: number;
  /** 그림자 맵을 몇 프레임마다 다시 그리나 (1 = 매 프레임) */
  shadowEvery: number;
  /** 켜 두는 동적 점광원 수 (등불 풀 크기 8 이하) */
  lights: number;
  /** 해 그림자를 아예 그리나 (false 면 castShadow 끄고 맵 해제) */
  shadowOn: boolean;
  /** 윤곽선 세기 (0 = 끔). 깊이가 급히 바뀌는 곳 바로 바깥 픽셀을 어둡게. 깊이 5탭뿐이라 낮음에서도 켬 */
  outline: number;
  /** 해 그림자 가장자리 PCF 반경 (텍셀) */
  shadowRadius: number;
  /** 비 오는 날 한 프레임에 계산·올리는 빗줄기 상한 (항해 컷은 여기에 density 를 곱함). 넓은 구도에서만 닿는 상한 */
  rainDrops: number;
}
/** 단계별 세기. bloom 0 이면 블룸 패스를 아예 돌리지 않음(가장 비싼 부분), tilt 0 이면 흐림 없음. 보통은 예전 화면 그대로 */
export const FX_PARAMS: Record<FxLevel, FxParams> = {
  off: { bloom: 0, tilt: 0, shadow: 512, shadowEvery: 4, lights: 2, shadowOn: false, outline: 0, shadowRadius: 1, rainDrops: 1200 },
  low: { bloom: 0, tilt: 0.6, shadow: 1024, shadowEvery: 2, lights: 5, shadowOn: true, outline: 0.22, shadowRadius: 1, rainDrops: 2400 },
  normal: { bloom: 0.5, tilt: 1, shadow: 2048, shadowEvery: 1, lights: 8, shadowOn: true, outline: 0.3, shadowRadius: 1.8, rainDrops: 4800 },
  // 고급: 그림자 해상도는 높이고 배경 흐림·후광은 줄여 표면의 결을 살린다.
  high: { bloom: 0.32, tilt: 0.3, shadow: 4096, shadowEvery: 1, lights: 8, shadowOn: true, outline: 0.4, shadowRadius: 2.2, rainDrops: 4800 },
};

/**
 * 기기 기본 단계 (순수). 저장값·?fx= 가 없을 때만 씀: 터치 기기(pointer: coarse)이거나 메모리 4GB 이하(알 때만)면 낮음, 아니면 보통.
 * 데스크톱은 예전 화면(보통) 그대로
 */
export function defaultFxFor(env: { coarse: boolean; memGB?: number | null }): FxLevel {
  const mem = env.memGB;
  return env.coarse || (typeof mem === 'number' && mem > 0 && mem <= 4) ? 'low' : 'normal';
}
/** 저용량 기기(터치·메모리 4GB 이하)인가 — 기기 기본 단계와 음원 캐시 상한이 같은 기준을 씀 */
export function isLowEndDevice(): boolean {
  try {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return defaultFxFor({ coarse, memGB: mem }) === 'low';
  } catch { return false; }
}

export const isFxLevel = (v: unknown): v is FxLevel => typeof v === 'string' && (FX_LEVELS as readonly string[]).includes(v);

/** 저장된 글 → 단계 (순수). 모르는 값·깨진 글은 기본값 */
export function parseFx(raw: string | null, fallback: FxLevel = DEFAULT_FX): FxLevel {
  try {
    const d: unknown = JSON.parse(raw ?? 'null');
    if (typeof d === 'object' && d !== null && !Array.isArray(d) && isFxLevel((d as Record<string, unknown>).level)) return (d as { level: FxLevel }).level;
  } catch { /* 기본값 */ }
  return fallback;
}
/** 저장값이 있으면 그것, 없을 때만 fallback(기기 기본 단계) */
export function loadFx(fallback: FxLevel = DEFAULT_FX): FxLevel {
  try { return parseFx(localStorage.getItem(KEY), fallback); } catch { return fallback; }
}
export function saveFx(level: FxLevel) {
  try { localStorage.setItem(KEY, JSON.stringify({ level })); } catch { /* 저장소 없음 */ }
}
/** 한 단계 돌리기 (끔 → 낮음 → 보통 → 높음 → 끔) */
export const nextFx = (l: FxLevel, dir: 1 | -1 = 1): FxLevel => FX_LEVELS[(FX_LEVELS.indexOf(l) + dir + FX_LEVELS.length) % FX_LEVELS.length];
/** 한 단계 낮추기 (이미 끔이면 null) */
export const lowerFx = (l: FxLevel): FxLevel | null => FX_LEVELS[FX_LEVELS.indexOf(l) - 1] ?? null;

/** 한 단계 올리기 (cap = 사용자가 직접 고른 상한 — 넘지 않음. 이미 상한이면 null) */
export const raiseFx = (l: FxLevel, cap: FxLevel): FxLevel | null => {
  const up = FX_LEVELS[FX_LEVELS.indexOf(l) + 1] ?? null;
  return up !== null && FX_LEVELS.indexOf(up) <= FX_LEVELS.indexOf(cap) ? up : null;
};

/**
 * 프레임이 계속 느리면 효과를 한 단계 낮추자고 알려 줌.
 * 창(기본 4초)마다 평균 프레임 시간을 재고, 기준을 연속 windowsNeeded(기본 2)개 창 넘으면 강등 신호 한 번 (일시 끊김 한 번에 강등하지 않음).
 * firstWindows: 시작 후 첫 강등만 이 수만큼 연속 창으로 판단. 기본값은 windowsNeeded 와 같음(main.ts 는 1 을 넘겨 옛 동작 유지).
 * 승급(선택): upWindows > 0 이고 tick() 으로 쓸 때만 켜짐. 연속 upWindows 개 창이 모두 평균 upMaxAvg(기본 1/50 = 50fps) 이하이고
 * 현재 단계가 cap(사용자가 고른 단계) 아래이면 한 단계 승급. 승급 뒤 다시 강등되면 승급에 필요한 창 수를 2배로 늘림
 * (최대 MAX_UP_WINDOWS = 30개 ≈ 120초. 영구 금지 아님 — 오르내림 진동은 막되 여유가 오래가면 다시 오름).
 * 기존 feed() 는 강등 신호만 주고 승급은 하지 않음(하위 호환).
 * 보이지 않는 탭·아주 긴 프레임(탭 전환 등)은 호출한 쪽이 dt 를 잘라서 넣을 것
 */
export class FxGovernor {
  private sum = 0;
  private n = 0;
  private bad = 0;
  private good = 0;
  private fired = false;
  /** 마지막 변화가 승급이었나 — 이 상태에서 강등되면 승급 금지 */
  private lastUp = false;
  /** 승급 요구 창 수 배수 (승급 뒤 재강등될 때마다 2배, 상한 있음) */
  private upMul = 1;
  constructor(
    private readonly windowSec = 4, private readonly maxAvg = 1 / 26, private readonly windowsNeeded = 2,
    private readonly firstWindows = windowsNeeded,
    private readonly upWindows = 0, private readonly upMaxAvg = 1 / 50,
  ) {}
  /** 승급에 필요한 연속 창 수의 상한 (30개 = 120초 안팎). upWindows 가 이보다 크면 upWindows */
  static readonly MAX_UP_WINDOWS = 30;
  /** 지금 승급에 필요한 연속 여유 창 수 (재강등 백오프 반영, 상한 MAX_UP_WINDOWS) */
  get upWindowsNeeded(): number { return Math.min(this.upWindows * this.upMul, Math.max(this.upWindows, FxGovernor.MAX_UP_WINDOWS)); }
  /** 재강등 백오프 중인가 (승급을 영구 금지하지 않음 — 요구 창 수만 늘어남) */
  get upgradeBanned(): boolean { return this.upMul > 1; }
  private step(dt: number, canUp: boolean): 'down' | 'up' | null {
    if (!(dt > 0) || !Number.isFinite(dt)) return null;
    this.sum += dt; this.n++;
    if (this.sum < this.windowSec) return null;
    const avg = this.sum / this.n;
    this.sum = 0; this.n = 0;
    this.bad = avg > this.maxAvg ? this.bad + 1 : 0;
    this.good = canUp && this.upWindows > 0 && avg <= this.upMaxAvg ? this.good + 1 : 0;
    if (this.bad >= (this.fired ? this.windowsNeeded : this.firstWindows)) {
      this.bad = 0; this.good = 0; this.fired = true;
      if (this.lastUp) this.upMul = Math.min(this.upMul * 2, 1024);
      this.lastUp = false;
      return 'down';
    }
    if (this.good > 0 && this.good >= this.upWindowsNeeded) { this.good = 0; this.lastUp = true; return 'up'; }
    return null;
  }
  /** 프레임마다 dt(초)를 넣음. 낮추라는 신호면 true (승급은 하지 않음) */
  feed(dt: number): boolean { return this.step(dt, false) === 'down'; }
  /**
   * 프레임마다 dt 와 현재 단계·사용자 상한(cap)을 넣음. 바꿀 새 단계를 돌려주고(없으면 null), 바꾼 뒤 reset() 을 부를 것.
   * 사용자가 직접 단계를 바꾸면 호출한 쪽이 cap 을 그 값으로 갱신해야 함.
   */
  tick(dt: number, level: FxLevel, cap: FxLevel): FxLevel | null {
    const canUp = raiseFx(level, cap) !== null;
    const r = this.step(dt, canUp);
    if (r === 'down') return lowerFx(level);
    if (r === 'up') return raiseFx(level, cap);
    return null;
  }
  /** 단계를 바꾼 뒤(사용자·자동) 새로 재기 시작 (승급 백오프 기록은 유지) */
  reset() { this.sum = 0; this.n = 0; this.bad = 0; this.good = 0; }
}
