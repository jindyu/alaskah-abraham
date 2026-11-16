import { dev, pooledFrame, hudScale, inset, policyTextSize, snapRect, TEXT_POLICY_NONE, textGrow, textWiden, widenWidth, type Frame, type TextPolicy } from './uiScale';
import { densityOf, pixelText } from './pixelText';
import type { CaptionState } from '../systems/cutscene/cutscene';
import { CREAM, INK, OUTLINE, PAPER_SHADOW, WOOD, WOOD_LIGHT } from './theme';
import { wrapLines } from './wrap';
import { tr } from '../i18n/tr';
import { handleChapterSelectClick, handlePauseMenuClick, handleHelpClick, handleCodexClick, handleChoiceClick } from './hudClicks';
import { drawFrame } from './hudFrame';
import { createCodexEntries } from './hudCodex';
import { layoutCaption, type CaptionLayout } from './hudLayout';
import { NO_INSETS, safeAreaCss, toUiInsets, type Insets } from './safeArea';
import { touchSideClearCss } from './touchControls';
import { narrationLife } from './dialogueLayout';
import { newOnboard, onboardSeen, type OnboardState } from './onboarding';
import type { ActiveDialogue, CodexEntry, DialogueChoice, DialogueOption, GoalProgress, Heart, Prompt, Speech, Toast } from './hudTypes';

type DropFirst<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never;
export type { ActiveDialogue, GoalProgress, DialogueOption, DialogueChoice, CodexEntry, Prompt } from './hudTypes';

/** 풍경을 덜 가리면서 읽을 수 있는 할 일 글자 크기 */
/** 할 일 본문 기본 글자 크기 (실제 크기는 textSize.goalPx — 작은 창에서 더 크게) */
export const GOAL_PX = 13;
/** 할 일 패널 글 최대 줄 수 (핵심 줄 + 세부 목표 + 획득처) */
export const GOAL_MAX_LINES = 6;
/** 할 일 완료 띠 높이 (UI 좌표) */
export const BANNER_H = 46;

/**
 * 화면 해상도 캔버스에 그리는 UI. 기본 배율은 월드와 같고,
 * 작은 화면에서는 고정 폭 패널이 들어가도록 UI만 더 작게 맞춘다.
 * 구성: 시계 패널 · 은 조각 · 핫바 · 선택 아이템 이름 · 획득 토스트 · 상호작용 프롬프트 · 하트
 */
/** 하트 아이콘 도트 (heartIcon 이 프레임마다 쓰는 읽기 전용 상수) */
/** 음성 자막 뒤 빛 띠(여백, 투명도) — 상수 */
export const GLOW_BANDS: ReadonlyArray<readonly [number, number]> = [[18, 0.1], [10, 0.14], [4, 0.18]];
const HEART_ROWS: readonly string[] = ['.kk.kk.', 'kRRkrrk', 'kRrrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
const HEART_COL: Record<number, string> = { 107: '#5a1a22', 114: '#e0485a', 82: '#ffb0b8' }; // k, r, R

export class Hud {
  readonly canvas = document.createElement('canvas');
  readonly ctx: CanvasRenderingContext2D;
  w = 1;
  h = 1;
  toasts: Toast[] = [];
  /** 터치 알림이 쓸 수 있는 오른쪽 끝: 시계·할 일 패널의 왼쪽 (clockPanel 이 매 프레임 채움) */
  toastRight = 0;
  /** 완료 띠가 떠 있을 때 터치 알림을 아래로 내린 양 (UI 좌표, 띠가 사라지면 서서히 0) */
  toastDrop = 0;
  hearts: Heart[] = [];
  speech: Speech[] = [];
  /** 커스터마이징 화면 등에서 게임 UI(핫바·토스트·프롬프트)를 숨김 */
  gameUi = true;
  /** 화면 전환용 검은 막 (0=없음, 1=완전히 가림) */
  fade = 0;
  /** 페이드 효과 편의 함수 */
  /** 진행 중인 페이드 (draw(dt) 가 dt 로 진행시킴 — 백그라운드 탭에서도 어긋나지 않고 겹치면 교체됨) */
  fadeAnim: { start: number; end: number; dur: number; t: number } | null = null;
  fadeTo(fadeIn: boolean, duration = 0.6): void {
    const start = fadeIn ? 1 : 0;
    const end = fadeIn ? 0 : 1;
    this.fade = start;
    this.fadeAnim = { start, end, dur: Math.max(0.001, duration), t: 0 };
  }

  /** 화면 번쩍임 효과 (번개, 폭발, 언약 황금빛 플래시) */
  screenFlash: { r: number; g: number; b: number; a: number; duration: number; age: number } | null = null;

  flash(color: { r: number; g: number; b: number; a?: number } = { r: 1, g: 1, b: 1, a: 1 }, duration = 0.3): void {
    this.screenFlash = {
      r: Math.round((color.r ?? 1) * 255),
      g: Math.round((color.g ?? 1) * 255),
      b: Math.round((color.b ?? 1) * 255),
      a: color.a ?? 1,
      duration: Math.max(0.05, duration),
      age: 0,
    };
  }
  /** 컷신 레터박스 (0~1) */
  letterbox = 0;
  /** 컷신 자막 (cutscene.caption) */
  caption: CaptionState | null = null;
  /** 대화 패널 */
  dialogue: { speaker: string; text: string; portrait: string | null } | null = null;
  /** 인터랙티브 대화 2지선다 선택지 패널 */
  choice: DialogueChoice | null = null;
  choiceOptionRects: { x: number; y: number; w: number; h: number }[] = [];
  /** 캐릭터 아래 활성 대사창 (크고 또렷하게 표시) */
  activeDialogue: ActiveDialogue | null = null;
  /** 시네마틱 챕터 타이틀 */
  cinematicTitle: string | null = null;
  /** 권/장 선택 오버레이 [Tab] */
  chapterSelect = { open: false, bookIndex: 1, chapterIndex: 0 };
  /** 일시정지 메뉴 [Esc] */
  pauseMenu = { open: false, selectedItem: 0 };
  /** 조작 안내 및 온보딩 도움말 [F1 / H] */
  help = { open: false };
  /** 성경 & 미드라시 도감 (Biblical Lore Codex) [C] */
  codex = {
    open: false,
    selectedIndex: 0,
    entries: createCodexEntries(),
  };
  codexItemRects: { x: number; y: number; w: number; h: number; index: number }[] = [];
  chapterBookRects: { x: number; y: number; w: number; h: number; index: number }[] = [];
  chapterItemRects: { x: number; y: number; w: number; h: number; index: number }[] = [];
  /** 끝낸 장 ("권:장") — 장 선택에서 ✓ 표시 */
  doneChapters: ReadonlySet<string> = new Set();
  /** 장 선택을 열 때의 '지금 하던 장' (이어하기 표시) */
  resumeAt: { book: number; chapter: number } | null = null;
  /** 첫 플레이 안내 상태 (hudFrame 이 진행) */
  readonly onboardEls: HTMLCanvasElement[] = [];
  onboard: OnboardState = newOnboard(onboardSeen());
  /** 지금까지 한 선택 (id → 갈래 이름) — 장 선택에 요약으로 보인다 */
  picks: ReadonlyMap<string, string> = new Map();
  chapterPanelRect = { x: 0, y: 0, w: 0, h: 0 };
  chapterCloseRect = { x: 0, y: 0, w: 0, h: 0 };
  pausePanelRect = { x: 0, y: 0, w: 0, h: 0 };
  pauseItemRects: { x: number; y: number; w: number; h: number; index: number }[] = [];
  helpPanelRect = { x: 0, y: 0, w: 0, h: 0 };

  /** 챕터 선택 화면에서 장을 골라 불러올 때 콜백 */
  onChapterSelectLoad?: (bookIndex: number, chapterIndex: number) => void;
  /** 일시정지 메뉴 항목 실행 콜백 */
  onPauseMenuSelect?: (index: number) => void;
  /** 음성 칩 사운드 발생 콜백 */
  onBlip?: (speaker: string) => void;
  /** 시계 패널의 날짜 대신 쓸 글 (방주 안: "비 n일째") */
  dayOverride: string | null = null;
  /** 지금 할 일 (우상단 퀘스트 패널). */
  goal: string | null = null;
  /** 목표 카테고리 (우상단 퀘스트 패널 헤더: 예: "주요 임무", "제1권 · 갈대아 우르") */
  goalCategory: string | null = null;
  /** 컷신(자막·제목 띠) 동안 목표 패널을 가리는 남은 시간(초). 자막 사이의 짧은 빈틈에 패널이 깜빡이지 않게 조금 더 유지한다 */
  goalHideLeft = 0;
  /** 목표 진행도 (우상단 퀘스트 패널 진행바 및 수치) */
  goalProgress: GoalProgress | null = null;
  /** 좌상단 고대 메소포타미아 미니맵 */
  minimap = {
    label: '우르',
    visible: true,
    playerX: 0,
    playerZ: 0,
    playerFacing: 0,
    targetPin: null as { x: number; z: number; label?: string } | null,
    landmarks: [
      { id: 'workshop', label: '공방', x: 0, z: -7, color: '#c08e60' },
      { id: 'terah_home', label: '안채', x: 13.5, z: -6.5, color: '#ab7650' },
      { id: 'well', label: '우물', x: -12.0, z: 3.5, color: '#3f86a8' },
      { id: 'market', label: '장터', x: 4.5, z: 10.5, color: '#e0a33a' },
      { id: 'ziggurat', label: '지구라트', x: -36.0, z: -28.0, color: '#224c88' },
      { id: 'gate', label: '성문', x: 22.0, z: 3.5, color: '#8f5f3e' },
    ],
  };
  /** 월드 HUD 공중에 띄울 목표 가이드 핀 위치 */
  targetMarker: { x: number; y: number; z: number } | null = null;
  /** 할 일 아래 작은 조작 안내 (첫날) */
  hint: string | null = null;
  /** 안내 글을 줄로 나눈 결과 (글이 바뀔 때만 다시 나눔) */
  hintSrc: string | null = null;
  hintLines: string[] = [];
  readonly hsBuf: HTMLCanvasElement[] = [];
  /** 할 일 글을 폭에 맞춰 나눈 결과 (글·폭·글자 크기·자리가 바뀔 때만 다시 나눔) */
  goalSrc: string | null = null;
  goalLines: string[] = [''];
  readonly gsBuf: HTMLCanvasElement[] = [];
  /** 시계 패널까지 숨김 (컷신 중) */
  hideClock = false;
  /** 터치 기기: 키보드 안내(Space 병기 등)를 빼고 터치 안내를 씀 */
  touch = false;
  /** 화면 픽셀 비율 (고해상도 폰에서 글자·패널을 또렷하게 그림) */
  private dpr = 1;
  /** 캔버스 CSS 높이 (터치 단추 무리의 UI 자리를 셀 때) */
  cssH = 0;
  cssW = 0;
  /** 플레이어 자리 (화면 밖 할 일 화살표: 같은 공간 안의 대상만 — 방·아라랏은 멀리 떨어진 좌표) */
  readonly markerFrom = { x: 0, z: 0 };
  /** 할 일 패널 반짝임 (진행이 한 칸 나아갈 때 1 → 0) */
  goalFlash = 0;
  /** 화면 위 가운데 '완료!' 띠 */
  banner: { title: string; sub: string; age: number; compact?: boolean } | null = null;
  /** 할 일을 하나 마쳤을 때 위 가운데에 띄움 (sub = 마친 일) */
  celebrate(title: string, sub: string, compact = false) { this.banner = { title, sub, age: 0, compact }; }
  time = 0;
  /** 프롬프트가 새로 떴던 횟수 (SPACE_HINT_PROMPTS 번까지 'Space' 병기)와 지금 떠 있는지 */
  promptSeen = 0;
  promptOn = false;
  /** 이번 프레임에 그린 상호작용 프롬프트 상자 (없으면 null) */
  promptRect: { x: number; y: number; w: number; h: number } | null = null;
  /** promptRect 가 가리키는 재사용 상자 (프레임마다 새 객체를 만들지 않으려고) */
  readonly promptRectBuf = { x: 0, y: 0, w: 0, h: 0 };
  /** UI 좌표에서 화면 픽셀로 가는 배율 */
  d = 1;

  /** 격자 맞춤 전의 원래 fillRect (장치 픽셀 좌표를 /d 해서 넘김 — fillDev) */
  private readonly rawFill: (x: number, y: number, w: number, h: number) => void;

  constructor(parent: HTMLElement, readonly project: (x: number, y: number, z: number) => { x: number; y: number }) {
    Object.assign(this.canvas.style, { pointerEvents: 'none', imageRendering: 'pixelated' });
    parent.appendChild(this.canvas);
    const g = this.ctx = this.canvas.getContext('2d')!;
    // 이 캔버스의 fillRect 는 늘 장치 픽셀 격자에 맞춘다 (U10): 가장자리마다 반올림해 흐린 테·틈이 없게.
    // 창(가방·상점·메뉴…)도 hud.ctx 로 그리므로 고치지 않고 함께 맞춰진다. 변환은 늘 scale(d) 하나뿐이라는 전제 (draw 가 건다)
    const raw = g.fillRect.bind(g);
    this.rawFill = raw;
    g.fillRect = (x: number, y: number, w: number, h: number) => {
      const d = this.d, r = snapRect(x, y, w, h, d);
      raw(r.x0 / d, r.y0 / d, (r.x1 - r.x0) / d, (r.y1 - r.y0) / d);
    };
  }

  /**
   * 캔버스는 화면 해상도(내부 × 월드 배율 × dpr). 패널·아이콘은 별도의 UI 배율로 그리고,
   * 글자는 그 배율의 화면 px 크기로 직접 만들어 1:1 로 찍는다 (배율·반올림 규칙은 uiScale.ts).
   */

  /** 화면 가장자리 어둡게 하는 그라디언트 캐시 (hudFrame.drawVignette 가 크기가 바뀔 때만 다시 만듦) */
  vignette: CanvasGradient | null = null;
  vignetteW = 0;
  vignetteH = 0;

  resize(w: number, h: number, scale: number) {
    const s = hudScale(w, h, scale, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
    if (s.d !== this.d || s.dpr !== this.dpr) this.textRevN++; // 터치 최소 크기(CSS px)는 배율에 따라 UI 크기가 달라짐
    this.dpr = s.dpr; this.cssH = s.cssH; this.cssW = s.cssW;
    this.w = s.uiW; this.h = s.uiH; this.d = s.d;
    this.canvas.width = s.canvasW;
    this.canvas.height = s.canvasH;
    this.canvas.style.width = `${s.cssW}px`;
    this.canvas.style.height = `${s.cssH}px`;
  }

  private policy: TextPolicy = TEXT_POLICY_NONE;
  private textRevN = 0;
  /**
   * 글자 크기 정책 (U3: 글자 크기 단계·터치 최소 크기 — textSize.textPolicyFor). 모든 HUD·창 글자가 txt 를 거치므로 여기 하나로 적용된다.
   * 배치는 fs·grow·wide 로 글자 크기를 따라간다 (기본 정책이면 셋 다 예전 값 그대로)
   */
  get textPolicy(): TextPolicy { return this.policy; }
  set textPolicy(p: TextPolicy) { if (p !== this.policy) { this.policy = p; this.textRevN++; } }
  /** 글자 크기 정책이나 배율이 바뀔 때마다 늘어나는 번호 (줄 나눔 캐시를 다시 만들 때 비교) */
  get textRev() { return this.textRevN; }
  /** 글자 캔버스 (현재 배율로). size 는 보통 단계의 UI 크기 — 정책이 키운다 */
  txt(s: string, size: number, color: string, shadow: string | null = PAPER_SHADOW) {
    return pixelText(tr(s), this.fs(size), color, shadow, this.d);
  }
  /** 정책을 적용한 실제 UI 글자 크기 */
  fs(size: number): number { return policyTextSize(size, this.cssScale, this.policy); }
  /** 글자 size 가 커진 만큼 (UI 칸, 정수). 그 글자에 맞춰 둔 고정 높이(줄 간격·행 높이)에 더한다 — 기본 정책이면 0 */
  grow(size: number): number { return textGrow(size, this.cssScale, this.policy); }
  /**
   * 고정 폭 base 를 글자 크기에 맞춰 넓힌 폭 (화면 폭 - 20 을 넘지 않음) — 기본 정책이면 base.
   * 터치 UI 에서는 양옆 조작 단추(스틱·단추 무리)를 덮지 않는 폭까지만 넓힘 (원래 폭보다 좁히지는 않음)
   */
  wide(base: number, max = this.w - 20): number {
    const side = this.touch ? this.w - 2 * (Math.ceil(touchSideClearCss(this.cssH) / this.cssScale) + Math.max(this.edge.left, this.edge.right)) : Infinity;
    return widenWidth(base, textWiden(this.cssScale, this.policy), Math.min(max, Math.max(Math.min(base, max), side)));
  }
  /** 한 줄 글자판: 폭 maxW 를 넘으면 끝을 … 로 줄임 (커진 글자·번역이 패널 밖으로 나가지 않게) */
  fitTxt(text: string, size: number, color: string, maxW: number, shadow: string | null = PAPER_SHADOW) {
    return this.txt(wrapLines(text, maxW, (s) => this.tw(this.txt(s, size, color, shadow)), 1)[0], size, color, shadow);
  }
  /** 폭 maxW 에 맞춰 최대 maxLines 줄로 나눈 글 (wrap.wrapLines + 이 글자 크기로 잰 폭) */
  wrap(text: string, size: number, maxW: number, maxLines = 2): string[] {
    return wrapLines(text, maxW, (s) => this.tw(this.txt(s, size, '#000000', null)), maxLines);
  }
  /** UI 좌표 기준 너비 */
  tw(c: HTMLCanvasElement) {
    return c.width / densityOf(c);
  }
  /**
   * 글자/아이콘을 UI 좌표에 그림. 왼쪽 위를 장치 픽셀에 맞추고, 글자(지금 배율로 만든 것)는 1:1,
   * 아이콘 같은 UI 해상도 그림은 inset(크기) 로 늘려서 — 어디에 놓아도 같은 모양
   */
  put(c: HTMLCanvasElement, x: number, y: number) {
    const k = densityOf(c), d = this.d;
    const W = k === d ? c.width : inset(c.width / k, d), H = k === d ? c.height : inset(c.height / k, d);
    this.ctx.drawImage(c, dev(x, d) / d, dev(y, d) / d, W / d, H / d);
  }

  /** 장치 픽셀 사각형 [x0,x1)×[y0,y1) 을 칠함 (frame 으로 구한 겹 그리기용) */
  fillDev(color: string, x0: number, y0: number, x1: number, y1: number) {
    if (x1 <= x0 || y1 <= y0) return;
    const d = this.d;
    this.ctx.fillStyle = color;
    this.rawFill(x0 / d, y0 / d, (x1 - x0) / d, (y1 - y0) / d);
  }
  /** 여러 겹 그림의 틀 (uiScale.frame, 지금 배율) */
  frame(x: number, y: number, w: number, h: number): Frame { return pooledFrame(x, y, w, h, this.d); }
  /** 틀 f 의 네 가장자리에서 각각 l·t·r·b 칸 들어간 사각형을 칠함 (네 변 두께가 늘 같음) */
  fillIn(color: string, f: Frame, l: number, t: number, r: number, b: number) {
    this.fillDev(color, f.L(l), f.T(t), f.R(r), f.B(b));
  }

  /** 키캡: 외곽선 + 나무 속 + 윗줄 빛. base = 아래 외곽선 두께(칸) — 눌리는 단추는 1, 키 글자 자리는 2 */
  keycap(x: number, y: number, w: number, h: number, base = 2) {
    const f = this.frame(x, y, w, h);
    this.fillIn(OUTLINE, f, 0, 0, 0, 0);
    this.fillIn('#6a4a34', f, 1, 1, 1, base);
    this.fillDev('#8a6a50', f.L(1), f.T(1), f.R(1), f.T(2));
  }

  /** 주인공 캐릭터 아래 대사 표시 */
  showDialogue(speaker: string | null, text: string, life = 4.5): void {
    if (speaker && this.onBlip) {
      this.onBlip(speaker);
    }
    this.activeDialogue = {
      speaker,
      text,
      age: 0,
      life,
    };
  }

  clearDialogue(): void {
    this.activeDialogue = null;
  }

  /** 좌상단 미니맵 지명 라벨 설정 */
  setMinimapLabel(name: string): void {
    this.minimap.label = name;
  }

  /** 획득 알림. 같은 key가 떠 있으면 개수를 합침 */
  toast(key: string, iconId: string | null, name: string, count = 0, life?: number) {
    // 시스템 알림(오디오 볼륨, 저장, 시스템 에러, 카운트 획득 등)을 제외한 스토리 대사 및 안내는
    // 좌하단이 아닌 주인공 캐릭터 아래쪽의 크고 또렷한 대사 패널로 노출
    const isSystemToast = key === 'audio' || key.startsWith('save-') || key.startsWith('act-') || count > 0 || iconId !== null;
    if (!isSystemToast) {
      let speaker: string | null = null;
      let text = name.trim();
      const colonIdx = text.indexOf(':');
      if (colonIdx > 0 && colonIdx < 12) {
        speaker = text.slice(0, colonIdx).trim();
        text = text.slice(colonIdx + 1).trim();
      } else {
        const knownSpeakers: Record<string, string> = {
          terah: '데라',
          lot: '롯',
          sarai: '사래',
          abram: '아브람',
          merchant: '상인',
          isaac: '이삭',
          esau: '에서',
          angel: '천사',
          rebekah: '리브가',
          melchizedek: '멜기세덱',
          nimrod: '니므롯',
        };
        if (knownSpeakers[key]) speaker = knownSpeakers[key];
      }
      this.showDialogue(speaker, text, speaker ? (life ?? 4.5) : narrationLife(life ?? 3.8, text.length));
      return;
    }

    const t = this.toasts.find((x) => x.key === key && x.age < x.life - 0.5);
    // 같은 알림: 개수는 합치고, 글만 있는 알림(목표 진행 등)은 새 글로 바꿈
    if (t) { t.count += count; if (!count) t.name = name; if (life) t.life = life; t.age = Math.min(t.age, 0.25); return; }
    this.toasts.push({ key, iconId, name, count, age: 0, life: life ?? (count ? 3 : 3.6) });
    // 한꺼번에 셋까지만 (화면 왼쪽 아래가 알림 탑이 되지 않게, 오래된 것부터 뺌)
    if (this.toasts.length > 3) this.toasts.shift();
  }

  /** 떠 있는 알림을 모두 지움 (장이 바뀔 때 이전 장의 알림이 남지 않게) */
  clearToasts() { this.toasts.length = 0; }

  /** 떠 있는 알림을 지움 (다 이룬 목표 등) */
  clearToast(key: string) {
    const ts = this.toasts;
    let j = 0;
    for (let i = 0; i < ts.length; i++) if (ts[i].key !== key) ts[j++] = ts[i];
    ts.length = j;
  }

  /** 머리 위 짧은 말풍선 (follow를 주면 대상을 따라감) */
  say(text: string, y: number, follow: () => { x: number; z: number }, life = 1.8, delay = 0) {
    const p = follow();
    const sp = this.speech;
    let j = 0;
    for (let i = 0; i < sp.length; i++) if (sp[i].follow !== follow) sp[j++] = sp[i];
    sp.length = j;
    sp.push({ x: p.x, y, z: p.z, text, age: 0, life, delay, follow });
  }

  get uiW() { return this.w; }
  get uiH() { return this.h; }
  get density() { return this.d; }
  /** UI 한 칸이 화면(CSS) 픽셀로 얼마인지 */
  get cssScale() { return this.d / this.dpr; }

  /** 안전 영역(노치·둥근 모서리) 여백을 UI 좌표로 환산한 값 (캐시: 안전 영역 객체·배율이 바뀔 때만 다시 계산). 네 모서리에 붙는 요소의 바깥 여백에 더한다 */
  private edgeSrc: Insets | null = null;
  private edgeScale = 0;
  private edgeUi: Insets = NO_INSETS;
  get edge(): Insets {
    const css = safeAreaCss(), s = this.cssScale;
    if (css !== this.edgeSrc || s !== this.edgeScale) { this.edgeSrc = css; this.edgeScale = s; this.edgeUi = toUiInsets(css, s); }
    return this.edgeUi;
  }

  heart(x: number, y: number, z: number) {
    this.hearts.push({ x, y, z, age: 0 });
  }


  draw(dt: number, prompt: Prompt | null): void { drawFrame(this, dt, prompt); }




  showChoice(prompt: string, options: DialogueOption[], onSelect: (index: number) => void): void {
    this.choice = {
      prompt,
      options,
      selectedIndex: 0,
      onSelect,
    };
  }

  handleChoiceClick(...a: DropFirst<Parameters<typeof handleChoiceClick>>): ReturnType<typeof handleChoiceClick> { return handleChoiceClick(this, ...a); }




  handleChapterSelectClick(...a: DropFirst<Parameters<typeof handleChapterSelectClick>>): ReturnType<typeof handleChapterSelectClick> { return handleChapterSelectClick(this, ...a); }

  handlePauseMenuClick(...a: DropFirst<Parameters<typeof handlePauseMenuClick>>): ReturnType<typeof handlePauseMenuClick> { return handlePauseMenuClick(this, ...a); }

  handleHelpClick(...a: DropFirst<Parameters<typeof handleHelpClick>>): ReturnType<typeof handleHelpClick> { return handleHelpClick(this, ...a); }


  unlockCodex(id: string): boolean {
    const entry = this.codex.entries.find((e) => e.id === id);
    if (entry && !entry.unlocked) {
      entry.unlocked = true;
      this.celebrate('미드라시 도감 기록', `[${entry.title}]`, true);
      this.toast('codex', null, `성경·미드라시 도감이 기록되었습니다: [${entry.title}] (C키로 열람)`);
      return true;
    }
    return false;
  }

  handleCodexClick(...a: DropFirst<Parameters<typeof handleCodexClick>>): ReturnType<typeof handleCodexClick> { return handleCodexClick(this, ...a); }











  /** 완료 띠 높이: 제목(18)·부제(11) 글자가 커진 만큼 높아짐 (기본 BANNER_H) */
  bannerH() { return BANNER_H + this.grow(18) + this.grow(11); }



  promptHintSrc = '';
  promptHintMaxW = 0;
  promptHintLines: string[] = [];
  promptHintWidth = 0;
  promptHintRev = -1;

  /** 같은 글·폭·글꼴·줄 수면 이전 줄바꿈 결과를 재사용한다 (프레임마다 새 배열/클로저를 만들지 않음) */
  private wrapMemoMap = new Map<string, { w: number; size: number; max: number; rev: number; out: string[] }>();
  wrapMemo(text: string, maxW: number, size: number, maxLines: number, color: string = INK): string[] {
    const e = this.wrapMemoMap.get(text);
    if (e && e.w === maxW && e.size === size && e.max === maxLines && e.rev === this.textRevN) return e.out;
    const out = wrapLines(text, maxW, (s) => this.tw(this.txt(s, size, color)), maxLines);
    if (e) { e.w = maxW; e.size = size; e.max = maxLines; e.rev = this.textRevN; e.out = out; }
    else {
      if (this.wrapMemoMap.size > 300) this.wrapMemoMap.clear();
      this.wrapMemoMap.set(text, { w: maxW, size, max: maxLines, rev: this.textRevN, out });
    }
    return out;
  }

  /** 자막 한 줄 배치(줄·폭)는 자막 객체와 화면 폭이 같으면 재사용 (계산은 hudLayout.layoutCaption) */
  captionLayout = new WeakMap<object, CaptionLayout>();
  layoutCaption(c: CaptionState, base: number, voice: boolean, title: boolean): CaptionLayout {
    return layoutCaption(this, c, base, voice, title);
  }

  /** 토스트 한 개의 줄·폭 배치 캐시 (토스트 객체별, 사용 가능 폭이 바뀌면 다시 계산) */
  toastLayout = new WeakMap<object, { inner: number; lines: ReturnType<Hud['txt']>[]; tw: number }>();

  heartIcon(x: number, y: number, faded: boolean) {
    const g = this.ctx;
    g.globalAlpha = faded ? 0.5 : 1;
    // 모듈 상수(HEART_ROWS/HEART_COL)를 인덱스 루프로 훑어 프레임당 배열·객체를 만들지 않는다
    for (let yy = 0; yy < HEART_ROWS.length; yy++) {
      const row = HEART_ROWS[yy];
      for (let xx = 0; xx < row.length; xx++) {
        const c = HEART_COL[row.charCodeAt(xx)];
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(x + xx, y + yy, 1, 1);
      }
    }
    g.globalAlpha = 1;
  }

  /**
   * 나무 테 + 양피지 속지 (코드로 그린 9-slice). 바깥 사각형만 장치 픽셀에 맞추고 겹은 각 가장자리에서
   * inset(k) 만큼 들어가 그려서, 정수가 아닌 배율에서도 네 변의 테 두께가 같고 패널마다 같은 모양 (U10)
   */
  panel(x: number, y: number, w: number, h: number) {
    // 프레임마다 여러 번 불리므로 클로저·배열 리터럴 없이 직접 칠한다 (할당 0)
    const f = this.frame(x, y, w, h);
    const L = f.L(2), R = f.R(2), T = f.T(2), B = f.B(2);
    this.fillIn(OUTLINE, f, 2, 0, 2, 0);
    this.fillIn(OUTLINE, f, 0, 2, 0, 2);
    this.fillIn(OUTLINE, f, 1, 1, 1, 1);
    this.fillIn(WOOD, f, 2, 2, 2, 2);
    this.fillDev(WOOD_LIGHT, L, T, R, f.T(3));
    this.fillDev('#5e3b22', L, f.B(3), R, B);
    this.fillIn(OUTLINE, f, 4, 4, 4, 4);
    this.fillIn(CREAM, f, 5, 5, 5, 5);
    this.fillDev(PAPER_SHADOW, f.L(5), f.B(7), f.R(5), f.B(5));
    this.fillDev('#fff0cc', f.L(5), f.T(5), f.R(5), f.T(6));
    // 네 모서리 장식
    this.fillDev('#d8b070', f.L(3), f.T(3), f.L(4), f.T(4));
    this.fillDev('#d8b070', f.L(3), f.B(4), f.L(4), f.B(3));
    this.fillDev('#d8b070', f.R(4), f.T(3), f.R(3), f.T(4));
    this.fillDev('#d8b070', f.R(4), f.B(4), f.R(3), f.B(3));
  }

}
