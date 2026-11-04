import { dev, frame, hudScale, inset, policyTextSize, snapRect, TEXT_POLICY_NONE, textGrow, textWiden, widenWidth, type Frame, type TextPolicy } from './uiScale';
import { centerY, densityOf, drawDigits, pixelText } from './pixelText';
import type { CaptionState } from '../systems/caption';
import { ACCENT, CREAM, INK, INK_SOFT, INK_WARM, OUTLINE, PAPER, PAPER_SHADOW, WOOD, WOOD_LIGHT } from './theme';
import { wrapLines, wrapParagraphs } from './wrap';
import { tr } from '../i18n/tr';
import { CATALOG } from '../systems/story';
export interface ActiveDialogue {
  speaker: string | null;
  text: string;
  age: number;
  life: number;
}

/** 풍경을 덜 가리면서 읽을 수 있는 할 일 글자 크기 */
const GOAL_PX = 12;
import { NO_INSETS, safeAreaCss, toUiInsets, type Insets } from './safeArea';
import { touchClusterTopCss, touchSideClearCss } from './touchControls';
import { TOAST_LINE_H, TOAST_H, TOAST_GAP, toastCenterX, toastHeight, toastSlideY, toastSpan } from './toastLayout';


/** 할 일 패널 글 최대 줄 수 (핵심 줄 + 부가 줄: 방주 재료의 획득처까지 보이도록 4줄) */
const GOAL_MAX_LINES = 4;
/** 터치 기기 왼쪽 위 도움말 DOM 단추의 폭 (CSS px, 안전 영역 여백 안쪽부터. 알림이 그 오른쪽부터 시작) */
const TOUCH_GUIDE_BTN_CSS = 124;
/** 할 일 완료 띠 높이 (UI 좌표) */
const BANNER_H = 46;
/** 상호작용 프롬프트 키캡 옆에 'Space' 도 같은 행동임을 덧붙이는 처음 몇 번 (그 뒤엔 E 만 보임) */
const SPACE_HINT_PROMPTS = 5;
const DIAL_STARS: readonly [number, number][] = [[-9, -8], [-3, -12], [6, -10], [10, -5], [-12, -4]];
const RAIN_DROPS: readonly [number, number][] = [[3, 8], [7, 9], [11, 8], [5, 11], [9, 12]];
const SUN_RAYS: readonly [number, number][] = [[6, 0], [6, 12], [0, 6], [12, 6], [2, 2], [10, 2], [2, 10], [10, 10]];

interface Toast { key: string; iconId: string | null; name: string; count: number; age: number; life: number }
interface Heart { x: number; y: number; z: number; age: number }
interface Speech { x: number; y: number; z: number; text: string; age: number; life: number; delay: number; follow?: () => { x: number; z: number } }
export interface Prompt { x: number; y: number; label: string; hint?: string }

/**
 * 화면 해상도 캔버스에 그리는 UI. 기본 배율은 월드와 같고,
 * 작은 화면에서는 고정 폭 패널이 들어가도록 UI만 더 작게 맞춘다.
 * 구성: 시계 패널 · 은 조각 · 핫바 · 선택 아이템 이름 · 획득 토스트 · 상호작용 프롬프트 · 하트
 */
export class Hud {
  readonly canvas = document.createElement('canvas');
  readonly ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private toasts: Toast[] = [];
  /** 터치 알림이 쓸 수 있는 오른쪽 끝: 시계·할 일 패널의 왼쪽 (clockPanel 이 매 프레임 채움) */
  private toastRight = 0;
  /** 완료 띠가 떠 있을 때 터치 알림을 아래로 내린 양 (UI 좌표, 띠가 사라지면 서서히 0) */
  private toastDrop = 0;
  private hearts: Heart[] = [];
  private speech: Speech[] = [];
  /** 커스터마이징 화면 등에서 게임 UI(핫바·토스트·프롬프트)를 숨김 */
  gameUi = true;
  /** 화면 전환용 검은 막 (0=없음, 1=완전히 가림) */
  fade = 0;
  /** 페이드 효과 편의 함수 */
  fadeTo(fadeIn: boolean, duration = 0.6): void {
    const start = fadeIn ? 1 : 0;
    const end = fadeIn ? 0 : 1;
    this.fade = start;
    let t = 0;
    const timer = setInterval(() => {
      t += 0.03;
      const p = Math.min(1, t / duration);
      this.fade = start + (end - start) * p;
      if (p >= 1) clearInterval(timer);
    }, 30);
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
  /** 캐릭터 아래 활성 대사창 (크고 또렷하게 표시) */
  activeDialogue: ActiveDialogue | null = null;
  /** 시네마틱 챕터 타이틀 */
  cinematicTitle: string | null = null;
  /** 권/장 선택 오버레이 [Tab] */
  chapterSelect = { open: false, bookIndex: 1, chapterIndex: 0 };
  /** 일시정지 메뉴 [Esc] */
  pauseMenu = { open: false, selectedItem: 0 };
  /** 시계 패널의 날짜 대신 쓸 글 (방주 안: "비 n일째") */
  dayOverride: string | null = null;
  /** 지금 할 일 (시계 아래 작은 패널). main.ts의 objective()가 매 프레임 채움 */
  goal: string | null = null;
  /** 좌상단 고대 메소포타미아 미니맵 */
  minimap = {
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
  /** 할 일 아래 작은 조작 안내 (첫날) */
  hint: string | null = null;
  /** 안내 글을 줄로 나눈 결과 (글이 바뀔 때만 다시 나눔) */
  private hintSrc: string | null = null;
  private hintLines: string[] = [];
  private readonly hsBuf: HTMLCanvasElement[] = [];
  /** 할 일 글을 폭에 맞춰 나눈 결과 (글·폭·글자 크기·자리가 바뀔 때만 다시 나눔) */
  private goalSrc: string | null = null;
  private goalKey = '';
  private goalLines: string[] = [''];
  private readonly gsBuf: HTMLCanvasElement[] = [];
  /** 시계 패널까지 숨김 (컷신 중) */
  hideClock = false;
  /** 터치 기기: 키보드 안내(Space 병기 등)를 빼고 터치 안내를 씀 */
  touch = false;
  /** 화면 픽셀 비율 (고해상도 폰에서 글자·패널을 또렷하게 그림) */
  private dpr = 1;
  /** 캔버스 CSS 높이 (터치 단추 무리의 UI 자리를 셀 때) */
  private cssH = 0;
  /** 플레이어 자리 (화면 밖 할 일 화살표: 같은 공간 안의 대상만 — 방·아라랏은 멀리 떨어진 좌표) */
  readonly markerFrom = { x: 0, z: 0 };
  /** 할 일 패널 반짝임 (진행이 한 칸 나아갈 때 1 → 0) */
  goalFlash = 0;
  /** 화면 위 가운데 '완료!' 띠 */
  private banner: { title: string; sub: string; age: number; compact?: boolean } | null = null;
  /** 할 일을 하나 마쳤을 때 위 가운데에 띄움 (sub = 마친 일) */
  celebrate(title: string, sub: string, compact = false) { this.banner = { title, sub, age: 0, compact }; }
  private time = 0;
  /** 프롬프트가 새로 떴던 횟수 (SPACE_HINT_PROMPTS 번까지 'Space' 병기)와 지금 떠 있는지 */
  private promptSeen = 0;
  private promptOn = false;
  /** 이번 프레임에 그린 상호작용 프롬프트 상자 (없으면 null) */
  private promptRect: { x: number; y: number; w: number; h: number } | null = null;
  /** UI 좌표에서 화면 픽셀로 가는 배율 */
  private d = 1;

  /** 격자 맞춤 전의 원래 fillRect (장치 픽셀 좌표를 /d 해서 넘김 — fillDev) */
  private readonly rawFill: (x: number, y: number, w: number, h: number) => void;

  constructor(parent: HTMLElement, private readonly project: (x: number, y: number, z: number) => { x: number; y: number }) {
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
  resize(w: number, h: number, scale: number) {
    const s = hudScale(w, h, scale, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
    if (s.d !== this.d || s.dpr !== this.dpr) this.textRevN++; // 터치 최소 크기(CSS px)는 배율에 따라 UI 크기가 달라짐
    this.dpr = s.dpr; this.cssH = s.cssH;
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
  private fillDev(color: string, x0: number, y0: number, x1: number, y1: number) {
    if (x1 <= x0 || y1 <= y0) return;
    const d = this.d;
    this.ctx.fillStyle = color;
    this.rawFill(x0 / d, y0 / d, (x1 - x0) / d, (y1 - y0) / d);
  }
  /** 여러 겹 그림의 틀 (uiScale.frame, 지금 배율) */
  frame(x: number, y: number, w: number, h: number): Frame { return frame(x, y, w, h, this.d); }
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
      this.showDialogue(speaker, text, life ?? (speaker ? 4.5 : 3.8));
      return;
    }

    const t = this.toasts.find((x) => x.key === key && x.age < x.life - 0.5);
    // 같은 알림: 개수는 합치고, 글만 있는 알림(목표 진행 등)은 새 글로 바꿈
    if (t) { t.count += count; if (!count) t.name = name; if (life) t.life = life; t.age = Math.min(t.age, 0.25); return; }
    this.toasts.push({ key, iconId, name, count, age: 0, life: life ?? (count ? 3 : 3.6) });
    // 한꺼번에 셋까지만 (화면 왼쪽 아래가 알림 탑이 되지 않게, 오래된 것부터 뺌)
    if (this.toasts.length > 3) this.toasts.shift();
  }

  /** 떠 있는 알림을 지움 (다 이룬 목표 등) */
  clearToast(key: string) { this.toasts = this.toasts.filter((t) => t.key !== key); }

  /** 머리 위 짧은 말풍선 (follow를 주면 대상을 따라감) */
  say(text: string, y: number, follow: () => { x: number; z: number }, life = 1.8, delay = 0) {
    const p = follow();
    this.speech = this.speech.filter((s) => s.follow !== follow);
    this.speech.push({ x: p.x, y, z: p.z, text, age: 0, life, delay, follow });
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
  private get edge(): Insets {
    const css = safeAreaCss(), s = this.cssScale;
    if (css !== this.edgeSrc || s !== this.edgeScale) { this.edgeSrc = css; this.edgeScale = s; this.edgeUi = toUiInsets(css, s); }
    return this.edgeUi;
  }

  heart(x: number, y: number, z: number) {
    this.hearts.push({ x, y, z, age: 0 });
  }


  draw(dt: number, prompt: Prompt | null) {
    this.time += dt;
    this.goalFlash = Math.max(0, this.goalFlash - dt * 1.2);
    this.promptRect = null;
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(this.d, 0, 0, this.d, 0, 0);
    g.imageSmoothingEnabled = false;

    // 컷신 등으로 게임 UI 가 꺼지면 '완료!' 띠도 버림 (띠 시간은 그릴 때만 흐르므로, 두면 컷신이 끝난 뒤 다시 나타남)
    if (!this.gameUi) this.banner = null;
    const e = this.edge;
    this.toastRight = this.w - 8 - e.right;
    if (this.gameUi) {
      // ── 미니맵 (왼쪽 위) ──
      if (this.minimap.visible && !this.letterbox) {
        this.drawMinimap(8 + e.left, 8 + e.top);
      }

      // ── 할 일 (오른쪽 위) ──
      if (!this.hideClock && this.goal) this.goalPanel(this.goal, 8 + e.top);

      // ── 알림 토스트 (왼쪽 아래, 새 것이 아래) ──
      { // 지난 알림 빼기 (새 배열을 만들지 않고 제자리에서)
        const ts = this.toasts;
        let j = 0;
        for (let i = 0; i < ts.length; i++) { const t = ts[i]; t.age += dt; if (t.age < t.life) ts[j++] = t; }
        ts.length = j;
      }
      // 터치 기기: 왼쪽 아래는 이동 스틱이 덮으므로 위 가운데로 (아래로 쌓임)
      if (this.touch) this.toastsTop(dt, e.top, e.left + Math.ceil(TOUCH_GUIDE_BTN_CSS / this.cssScale));
      let ty = this.h - 12 - e.bottom;
      for (let i = this.toasts.length - 1; !this.touch && i >= 0; i--) { // 터치는 위에서 이미 그림
        const t = this.toasts[i];
        const text = t.count ? `+${t.count} ${t.name}` : t.name;
        const label = this.txt(text, 13, INK);
        const tw = Math.ceil(this.tw(label)) + 14, th = 26 + this.grow(13);
        ty -= th;
        // 들어올 때 계단식으로 밀려 들어오고, 나갈 때 두 단계로 흐려짐
        const slide = t.age < 0.2 ? Math.round((1 - t.age / 0.2) * 4) * -(tw / 4) : 0;
        const fade = t.life - t.age;
        g.globalAlpha = fade < 0.2 ? 0.35 : fade < 0.45 ? 0.7 : 1;
        const tx = 8 + e.left + slide;
        this.panel(tx, ty, tw, th);
        this.put(label, tx + 7, centerY(label, ty + 5, ty + th - 6));
        g.globalAlpha = 1;
        ty -= 3;
      }

      // ── 할 일 완료 띠 ──
      if (this.banner) {
        const b = this.banner; b.age += dt;
        if (b.age > 2.8) this.banner = null; else this.drawBanner(b);
      }

      // ── 상호작용 프롬프트 ──
      if (prompt) {
        if (!this.promptOn) { this.promptOn = true; this.promptSeen++; }
        this.prompt(prompt, !this.touch && this.promptSeen <= SPACE_HINT_PROMPTS);
      } else this.promptOn = false;
    }

    // ── 하트 (쓰다듬기) — 프롬프트 위에 그려서 가려지지 않게 ──
    { const hs = this.hearts; let j = 0; for (let i = 0; i < hs.length; i++) { const h = hs[i]; h.age += dt; if (h.age < 1.1) hs[j++] = h; } hs.length = j; }
    for (const h of this.hearts) {
      const p = this.project(h.x, h.y, h.z);
      this.heartIcon(Math.round(p.x) - 3, Math.round(p.y - 6 - Math.floor(h.age * 18)), h.age > 0.8);
    }

    // ── 말풍선 (동료 양 "음메~") ──
    { const sp = this.speech; let j = 0; for (let i = 0; i < sp.length; i++) { const s = sp[i]; s.age += dt; if (s.age < s.delay + s.life) sp[j++] = s; } sp.length = j; }
    for (const s0 of this.speech) {
      if (s0.age < s0.delay) continue; // 앞 줄이 끝난 뒤에 뜨는 말풍선
      const sp = s0, age = s0.age - s0.delay;
      const at = sp.follow ? sp.follow() : sp;
      const p = this.project(at.x, sp.y, at.z);
      const t = this.txt(sp.text, 11, INK);
      const w = Math.ceil(this.tw(t)) + 10, h = 17 + this.grow(11);
      const x = Math.round(p.x - w / 2);
      let y = Math.round(p.y - h - 4 - Math.min(3, Math.floor(age * 10)));
      // 상호작용 안내 상자와 겹치면 그 위로 비킴 (꼬리는 말하는 이를 가리키지 못하니 생략)
      const pr = this.promptRect as { x: number; y: number; w: number; h: number } | null; // 위에서 null 로 비웠다가 prompt() 가 채우므로 TS 좁힘을 풂
      const dodge = !!pr && x < pr.x + pr.w && x + w > pr.x && y < pr.y + pr.h && y + h + 3 > pr.y;
      if (dodge && pr) y = Math.max(4, pr.y - h - 3);
      g.globalAlpha = age > sp.life - 0.3 ? 0.5 : 1;
      const bf = this.frame(x, y, w, h);
      this.fillIn(OUTLINE, bf, 1, 0, 1, 0); this.fillIn(OUTLINE, bf, 0, 1, 0, 1);
      this.fillIn(PAPER, bf, 1, 1, 1, 1);
      g.fillStyle = OUTLINE;
      if (!dodge) { g.fillRect(Math.round(p.x) - 1, y + h, 3, 1); g.fillRect(Math.round(p.x), y + h + 1, 1, 2); }
      this.put(t, x + 5, centerY(t, y + 2, y + h - 3));
      g.globalAlpha = 1;
    }

    // ── 컷신: 레터박스와 자막 ──
    if (this.letterbox > 0) {
      const bh = Math.round(this.h * 0.12 * this.letterbox);
      g.fillStyle = '#0a0806';
      g.fillRect(0, 0, this.w, bh);
      g.fillRect(0, this.h - bh, this.w, bh);
    }
    if (this.fade > 0) {
      g.globalAlpha = Math.min(1, this.fade);
      g.fillStyle = '#120c08';
      g.fillRect(0, 0, this.w, this.h);
      g.globalAlpha = 1;
    }
    if (this.screenFlash) {
      this.screenFlash.age += dt;
      const progress = this.screenFlash.age / this.screenFlash.duration;
      if (progress >= 1) {
        this.screenFlash = null;
      } else {
        const curAlpha = (1 - progress) * this.screenFlash.a;
        g.globalAlpha = Math.min(1, Math.max(0, curAlpha));
        g.fillStyle = `rgb(${this.screenFlash.r},${this.screenFlash.g},${this.screenFlash.b})`;
        g.fillRect(0, 0, this.w, this.h);
        g.globalAlpha = 1;
      }
    }
    if (this.caption) this.drawCaption(this.caption);
    if (this.cinematicTitle) this.drawCinematicTitle(this.cinematicTitle);
    this.drawDialogue(dt);
    if (this.dialogue) this.drawDialoguePanel(this.dialogue);
    if (this.chapterSelect.open) this.drawChapterSelect();
    if (this.pauseMenu.open) this.drawPauseMenu();
  }

  private drawCinematicTitle(titleText: string): void {
    const g = this.ctx;
    const lines = titleText.split('\n');
    const base = 22;
    const lh = 32;
    const totalH = lines.length * lh + 20;
    const maxW = Math.max(...lines.map((l) => this.tw(this.txt(l, base, '#ffd700')))) + 40;
    const x = Math.round(this.w / 2 - maxW / 2);
    const y = Math.round(this.h / 2 - totalH / 2);

    g.fillStyle = 'rgba(10, 8, 6, 0.75)';
    g.fillRect(0, y - 10, this.w, totalH + 20);

    lines.forEach((l, i) => {
      const isHeader = i === 0 && lines.length > 1;
      const size = isHeader ? 14 : base;
      const col = isHeader ? '#d0c8b0' : '#ffe484';
      const c = this.txt(l, size, col);
      const lx = Math.round(this.w / 2 - this.tw(c) / 2);
      const ly = y + 10 + i * lh;
      this.put(c, lx, ly);
    });
  }

  /** 주인공 캐릭터 아래 대사 패널 렌더링 ("대사가 주인공 캐릭터 아래쪽으로 좀 아래에 좀크게 나오게") */
  private drawDialogue(dt: number): void {
    if (!this.activeDialogue) return;
    const d = this.activeDialogue;
    d.age += dt;
    if (d.age >= d.life) {
      this.activeDialogue = null;
      return;
    }

    const g = this.ctx;
    const e = this.edge;

    // 1) 주인공 캐릭터의 화면 투영 좌표 (markerFrom)
    const p = this.project(this.markerFrom.x, 0, this.markerFrom.z);

    // 2) 대사 글자 크기 (16px) 및 줄바꿈
    const baseFontSize = 16;
    const cleanText = d.text.trim();
    const maxInnerW = Math.min(520, Math.round(this.w * 0.82) - 40);
    const lines = wrapLines(cleanText, maxInnerW, (s) => this.tw(this.txt(s, baseFontSize, INK)), 3);

    const lineElements = lines.map((l) => this.txt(l, baseFontSize, INK));
    const maxTextW = Math.max(...lineElements.map((el) => this.tw(el)));

    let speakerW = 0;
    let badgeTextEl: HTMLCanvasElement | null = null;
    if (d.speaker) {
      badgeTextEl = this.txt(d.speaker, 13, '#ffe484', '#1f1308');
      speakerW = this.tw(badgeTextEl) + 24;
    }

    const panelW = Math.max(Math.max(speakerW + 36, 240), Math.min(maxInnerW + 36, Math.ceil(maxTextW) + 36));
    const lineH = 24;
    const textH = lines.length * lineH;
    const padTop = d.speaker ? 18 : 12;
    const padBottom = 12;
    const panelH = padTop + textH + padBottom;

    // 3) X 좌표: 캐릭터 수평 중심에 배치, 화면 가장자리 벗어나지 않게 클램핑
    let panelX = Math.round(p.x - panelW / 2);
    const minX = 20 + e.left;
    const maxX = this.w - panelW - 20 - e.right;
    panelX = Math.max(minX, Math.min(maxX, panelX));

    // 4) Y 좌표: 주인공 캐릭터의 아래쪽으로 좀 아래에, 하단에서 어느 정도 떨어진 곳
    // p.y = 발 위치. 캐릭터 아래쪽으로 40px
    const pBelowChar = Math.round(p.y + 40);
    // 화면 하단(this.h - e.bottom)에서 적어도 48px 이상 띄워 하단 여유 확보
    const maxPanelY = this.h - panelH - 48 - e.bottom;
    // 캐릭터가 화면 중앙 근처일 때 자연스러운 위치(0.58*h)와 캐릭터 아래쪽 위치 중 알맞은 곳 선택
    const preferredY = Math.max(pBelowChar, Math.round(this.h * 0.58));
    let panelY = preferredY;
    if (panelY > maxPanelY) panelY = maxPanelY;
    if (panelY < 32 + e.top) panelY = 32 + e.top;

    // 5) 부드러운 페이드인 / 페이드아웃 및 팝업 애니메이션
    const fadeIn = Math.min(1, d.age / 0.15);
    const fadeOut = Math.min(1, (d.life - d.age) / 0.35);
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0) return;

    g.save();
    g.globalAlpha = alpha;

    // 위로 살짝 부드럽게 안착
    const slideOffset = Math.round((1 - fadeIn) * 4);
    const curY = panelY + slideOffset;

    // 6) 대화 패널 본체 (우아한 양피지/원목 패널)
    this.panel(panelX, curY, panelW, panelH);

    // 7) 캐릭터를 향하는 말풍선 꼬리 포인터
    const pointerX = Math.max(panelX + 24, Math.min(panelX + panelW - 24, Math.round(p.x)));
    if (curY > p.y + 10) {
      g.fillStyle = WOOD;
      g.fillRect(pointerX - 4, curY - 3, 8, 3);
      g.fillRect(pointerX - 2, curY - 5, 4, 2);
      g.fillStyle = CREAM;
      g.fillRect(pointerX - 2, curY - 2, 4, 2);
    }

    // 8) 화자 뱃지 (있을 때만)
    if (d.speaker && badgeTextEl) {
      const bw = Math.round(this.tw(badgeTextEl)) + 18;
      const bh = 22;
      const bx = panelX + 14;
      const by = curY - 10;

      const f = this.frame(bx, by, bw, bh);
      this.fillIn(OUTLINE, f, 1, 0, 1, 0);
      this.fillIn(OUTLINE, f, 0, 1, 0, 1);
      this.fillIn('#382315', f, 1, 1, 1, 1);
      this.put(badgeTextEl, bx + 9, centerY(badgeTextEl, by, by + bh - 1));
    }

    // 9) 본문 텍스트 (16px, INK)
    const textStartX = panelX + 18;
    const textStartY = curY + padTop + 2;

    lineElements.forEach((lineEl, idx) => {
      this.put(lineEl, textStartX, textStartY + idx * lineH);
    });

    g.restore();
  }

  private drawDialoguePanel(d: { speaker: string; text: string; portrait: string | null }): void {
    const e = this.edge;
    const panelW = Math.min(600, Math.round(this.w * 0.92));
    const panelH = 96;
    const x = Math.round((this.w - panelW) / 2);
    const y = this.h - panelH - 16 - e.bottom;

    this.panel(x, y, panelW, panelH);

    // 화자 뱃지
    if (d.speaker) {
      const badgeText = this.txt(d.speaker, 12, '#ffffff');
      const bw = Math.round(this.tw(badgeText)) + 18;
      const bh = 22;
      const bx = x + 12;
      const by = y - 12;

      const f = this.frame(bx, by, bw, bh);
      this.fillIn(OUTLINE, f, 1, 0, 1, 0);
      this.fillIn(OUTLINE, f, 0, 1, 0, 1);
      this.fillIn('#3d2817', f, 1, 1, 1, 1);
      this.put(badgeText, bx + 9, centerY(badgeText, by, by + bh - 1));
    }

    // 본문 텍스트 (줄바꿈)
    const contentX = x + 20;
    const contentY = y + 18;
    const maxTextW = panelW - 40;
    const lines = wrapLines(d.text, maxTextW, (s) => this.tw(this.txt(s, 14, INK)), 3);

    lines.forEach((l, idx) => {
      const t = this.txt(l, 14, INK);
      this.put(t, contentX, contentY + idx * 22);
    });

    // 다음 대사 넘기기 힌트
    const advanceHint = this.txt('▼ Enter / 클릭', 10, INK_SOFT);
    this.put(advanceHint, x + panelW - this.tw(advanceHint) - 16, y + panelH - 18);
  }

  private drawChapterSelect(): void {
    const g = this.ctx;
    g.fillStyle = 'rgba(0, 0, 0, 0.7)';
    g.fillRect(0, 0, this.w, this.h);

    const mw = Math.min(640, Math.round(this.w * 0.94));
    const mh = Math.min(460, Math.round(this.h * 0.88));
    const mx = Math.round((this.w - mw) / 2);
    const my = Math.round((this.h - mh) / 2);

    this.panel(mx, my, mw, mh);

    const title = this.txt('성경 대서사 권 / 장 선택 (Chapter Select)', 16, INK);
    this.put(title, mx + 20, my + 14);

    // 8개 권 탭 (상단 가로)
    const bookNames = ['인트로', '1권: 불·팥죽', '2권: 약속의 땅', '3권: 별·언약', '4권: 소돔의 불', '5권: 모리아', '6권: 막벨라', '아우트로'];
    const tabY = my + 42;
    const tabW = Math.floor((mw - 40) / bookNames.length);

    bookNames.forEach((name, idx) => {
      const isSel = idx === this.chapterSelect.bookIndex;
      const tx = mx + 20 + idx * tabW;
      const col = isSel ? '#ffffff' : INK_SOFT;
      const bg = isSel ? '#8e4a2e' : '#e2d5be';
      g.fillStyle = bg;
      g.fillRect(tx, tabY, tabW - 4, 22);
      const t = this.txt(name, 10, col);
      this.put(t, tx + 4, tabY + 4);
    });

    // 선택된 권의 챕터 목록 (세로 리스트, 좌측)
    const listY = tabY + 30;
    const listH = mh - 130;
    const bookData = CATALOG[this.chapterSelect.bookIndex];
    const chList = bookData?.chapters || [];

    // 스크롤 가시 범위 (최대 10개)
    const visibleCount = 10;
    const scrollOffset = Math.max(0, Math.min(chList.length - visibleCount, this.chapterSelect.chapterIndex - 4));
    const slice = chList.slice(scrollOffset, scrollOffset + visibleCount);

    slice.forEach((ch, sIdx) => {
      const actualIdx = scrollOffset + sIdx;
      const isSel = actualIdx === this.chapterSelect.chapterIndex;
      const itemY = listY + sIdx * 24;
      const col = isSel ? ACCENT : INK;
      if (isSel) {
        g.fillStyle = '#eddcc2';
        g.fillRect(mx + 20, itemY - 2, 280, 22);
      }
      const t = this.txt((isSel ? '▶ ' : '  ') + ch.title, 11, col);
      this.put(t, mx + 24, itemY + 2);
    });

    // 우측 챕터 상세 정보 및 요약
    const selChapter = chList[this.chapterSelect.chapterIndex];
    if (selChapter) {
      const infoX = mx + 310;
      const infoW = mw - 330;
      const chTitle = this.txt(selChapter.title, 13, INK);
      this.put(chTitle, infoX, listY);

      if (selChapter.location) {
        const loc = this.txt('배경: ' + selChapter.location, 10, INK_WARM);
        this.put(loc, infoX, listY + 22);
      }

      if (selChapter.characters && selChapter.characters.length > 0) {
        const chars = this.txt('등장: ' + selChapter.characters.join(', '), 10, INK_SOFT);
        this.put(chars, infoX, listY + 40);
      }

      // 요약 줄바꿈
      if (selChapter.summary) {
        const sumLines = wrapLines(selChapter.summary, infoW - 10, (s) => this.tw(this.txt(s, 11, INK)), 7);
        sumLines.forEach((l, lIdx) => {
          const st = this.txt(l, 11, INK);
          this.put(st, infoX, listY + 68 + lIdx * 20);
        });
      }
    }

    const hint = this.txt('[←/→] 권 이동 · [↑/↓] 장 선택 · [Enter] 즉시 이동 · [Tab/Esc] 닫기', 11, INK_WARM);
    this.put(hint, mx + 20, my + mh - 24);
  }

  private drawPauseMenu(): void {
    const g = this.ctx;
    g.fillStyle = 'rgba(0, 0, 0, 0.6)';
    g.fillRect(0, 0, this.w, this.h);

    const pw = 280;
    const ph = 240;
    const px = Math.round((this.w - pw) / 2);
    const py = Math.round((this.h - ph) / 2);

    this.panel(px, py, pw, ph);

    const title = this.txt('일시 정지 (Paused)', 15, INK);
    this.put(title, Math.round(px + (pw - this.tw(title)) / 2), py + 16);

    const items = [
      '계속하기 (Resume)',
      '배경음악 (BGM)',
      '효과음 (SFX)',
      '음성 안내 (Voice)',
      '닫기 [Esc]',
    ];

    items.forEach((item, idx) => {
      const selected = idx === this.pauseMenu.selectedItem;
      const color = selected ? ACCENT : INK;
      const t = this.txt((selected ? '▶ ' : '   ') + item, 12, color);
      this.put(t, px + 28, py + 54 + idx * 32);
    });
  }

  /**
   * 자막. voice = 하늘의 음성: 화면 가운데 금빛 글자, 사람 이름·초상 없이 (빛과 글로만 표현)
   * narration = 이야기꾼: 아래 레터박스 안 크림색 글자
   */
  private drawCaption(c: CaptionState) {
    const g = this.ctx;
    const title = c.style === 'title';
    const voice = c.style === 'voice' || title;
    // 제목: 크게, 화면 한가운데. base = 보통 단계 크기 (음성 16 · 이야기꾼 13 — 글자 크기 단계는 정책이 키움), size = 실제 UI 크기
    const base = title ? 30 : voice ? 16 : 13, size = this.fs(base);
    // 긴 음성은 가운데 가까운 띄어쓰기에서 두 줄로 (글자 띠가 화면을 덮지 않게)
    const measure = (s: string) => this.tw(this.txt(s, base, '#000000', null));
    let lines = [c.text];
    if (voice && measure(c.text) > this.w * 0.6) {
      const mid = c.text.length / 2;
      let cut = -1;
      for (let i = 0; i < c.text.length; i++) if (c.text[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
      if (cut > 0) lines = [c.text.slice(0, cut), c.text.slice(cut + 1)];
    }
    // 화면 폭을 넘는 글(영어 번역·큰 글자 크기)은 줄을 나눔: 이야기꾼 자막은 두 줄까지(레터박스 안), 음성·제목은 세 줄·두 줄까지
    if (lines.some((l) => measure(l) > this.w * 0.9)) lines = wrapLines(c.text, this.w * 0.9, measure, title ? 2 : voice ? 3 : 2);
    // 글자가 한 자씩 나오고, 들어올 때·나갈 때 두 단계로 흐려짐
    let n = Math.min(c.text.length, Math.floor(c.age * (voice ? 16 : 26)));
    if (n <= 0) return;
    const a = c.age < 0.15 ? 0.5 : c.hold - c.age < 0.25 ? 0.5 : 1;
    const lh = size + 8;
    const widths = lines.map((l) => this.tw(this.txt(l, base, '#000000', null)));
    const bh = Math.round(this.h * 0.12 * this.letterbox);
    // 이야기꾼 자막은 아래 안전 영역(둥근 모서리·제스처 막대) 위의 띠 안에 가운데 맞춤 (여백이 0 이면 예전과 같음)
    const barH = Math.max(bh, 30), textH = Math.max(30, barH - this.edge.bottom), barTop = this.h - this.edge.bottom - textH;
    const y0 = title ? Math.round(this.h * 0.45 - (lines.length * lh - 8) / 2) : voice ? Math.round(this.h * 0.2)
      : lines.length === 1 ? barTop + Math.round((textH - 16 - this.grow(13)) / 2) : barTop + Math.max(0, Math.round((textH - (lines.length * lh - 8)) / 2));
    g.globalAlpha = a;
    if (voice) {
      // 글자 뒤 은은한 빛 띠 (계단진 세 겹)
      // 높이: 마지막 줄 뒤 줄 간격(8)은 빼서 위아래 여백을 같게. 화면이 어두워지면(엔딩 검은 화면) 띠가 상자처럼 보이므로 흐리게
      const w = Math.max(...widths) + 40, h = lines.length * lh - 8 + 14;
      const glow = 1 - Math.min(1, this.fade) * 0.85;
      // 부르심의 흰 빛기둥처럼 밝은 배경 위에서도 읽히게 어두운 바탕을 먼저 깖 (금빛 띠는 그 위에서 따뜻한 기운만 더함)
      g.globalAlpha = a * 0.55 * glow;
      g.fillStyle = '#140c06';
      g.fillRect(Math.round(this.w / 2 - w / 2) - 10, y0 - 7 - 5, w + 20, h + 10);
      for (const [pad, al] of [[18, 0.1], [10, 0.14], [4, 0.18]] as const) {
        g.globalAlpha = a * al * glow;
        g.fillStyle = '#ffd98a';
        g.fillRect(Math.round(this.w / 2 - w / 2) - pad, y0 - 7 - pad / 2, w + pad * 2, h + pad);
      }
      g.globalAlpha = a;
    }
    lines.forEach((line, i) => {
      if (n <= 0) return;
      const cnt = Math.min(n, line.length);
      n -= line.length + 1;
      // 줄 전체를 한 번만 그려 캐시하고 보이는 만큼만 잘라 냄 (글자마다 새 글자판을 만들지 않음 — 대화창 본문과 같은 방식)
      const t = this.txt(line, base, voice ? '#ffe7a8' : '#f0e2c0', voice ? '#6a4818' : OUTLINE);
      const x = Math.round(this.w / 2 - widths[i] / 2), y = y0 + i * lh;
      if (cnt >= line.length) this.put(t, x, y);
      else {
        g.save();
        g.beginPath();
        // 자르는 선도 장치 픽셀에 맞춤 (흐린 반 픽셀 열이 생기지 않게)
        const cr = snapRect(x, y - 2, Math.ceil((this.tw(t) * cnt) / Math.max(1, line.length)) + 1, size + 8, this.d), dd = this.d;
        g.rect(cr.x0 / dd, cr.y0 / dd, (cr.x1 - cr.x0) / dd, (cr.y1 - cr.y0) / dd);
        g.clip();
        this.put(t, x, y);
        g.restore();
      }
    });
    g.globalAlpha = 1;
  }



  /** 목표: 오른쪽 위, 은 조각 아래. 글 길이에 맞춰 폭을 정하되 화면 폭의 55%(최대 360)를 넘으면 세 줄까지 줄바꿈 (넘치면 …) */
  private goalPanel(text: string, y0: number) {
    const lab = this.txt('할 일', 10, INK_SOFT);
    // 줄 높이는 글자 크기를 따라감 (기본: 할 일 15 · 안내 13, 글 시작 16)
    const top = 16 + this.grow(10), LH = GOAL_PX + 3 + this.grow(GOAL_PX), HL = 13 + this.grow(10);
    const height = (n: number, m: number) => top + 6 + n * LH + m * HL;
    const base = Math.max(120, Math.min(this.wide(310), Math.round(this.w * 0.43)) - 18);
    // 터치: 오른쪽 아래 단추 무리 위에서 멈춤 (글자가 커져 줄이 늘면 패널이 단추 밑으로 들어가 읽을 수 없으므로)
    const floor = this.touch ? this.h - this.edge.bottom - Math.ceil(touchClusterTopCss(this.cssH) / this.cssScale) - 4 : Infinity;
    const translatedGoal = tr(text), translatedHint = this.hint ? tr(this.hint) : '';
    const key = `${base}|${floor}|${this.textRev}|${y0}`;
    if (translatedGoal !== this.goalSrc || translatedHint !== this.hintSrc || key !== this.goalKey) {
      this.goalSrc = translatedGoal; this.hintSrc = translatedHint; this.goalKey = key;
      const lay = (maxText: number, goalMax: number) => {
        const goal = wrapParagraphs(text, maxText, (s) => this.tw(this.txt(s, GOAL_PX, INK)), goalMax);
        // 안내는 '\n' 으로 나눈 줄마다 폭(할 일 패널과 같은 한도)을 넘으면 최대 2줄로 줄바꿈
        const hint = translatedHint ? translatedHint.split('\n').flatMap((l) => wrapLines(l, maxText, (s) => this.tw(this.txt(s, 10, INK_WARM)), 2)) : [];
        return { goal, hint };
      };
      const avail = floor - y0;
      let r = lay(base, GOAL_MAX_LINES);
      if (height(r.goal.length, r.hint.length) > avail) {
        // 넘치면 먼저 패널을 넓혀 줄 수를 줄이고, 그래도 넘치면 안내 줄 → 할 일 줄 순으로 덜어 냄 (할 일은 적어도 한 줄)
        const wider = Math.max(base, Math.min(Math.round(this.w * 0.55), this.wide(400)) - 18);
        if (wider > base) r = lay(wider, GOAL_MAX_LINES);
        const fitGoal = Math.max(1, Math.floor((avail - top - 6) / LH));
        if (r.goal.length > fitGoal) r = { goal: wrapParagraphs(text, wider, (s) => this.tw(this.txt(s, GOAL_PX, INK)), fitGoal), hint: r.hint };
        const fitHint = Math.max(0, Math.floor((avail - height(r.goal.length, 0)) / HL));
        if (r.hint.length > fitHint) r.hint = r.hint.slice(0, fitHint);
      }
      this.goalLines = r.goal; this.hintLines = r.hint;
    }
    const gs = this.gsBuf;
    gs.length = 0;
    let wide = 0;
    for (const s of this.goalLines) { const c = this.txt(s, GOAL_PX, INK); gs.push(c); wide = Math.max(wide, this.tw(c)); }
    const hs = this.hsBuf;
    hs.length = 0;
    for (const s of this.hintLines) { const h = this.txt(s, 10, INK_WARM); hs.push(h); wide = Math.max(wide, this.tw(h)); }
    const extra = (gs.length - 1) * LH;
    const W = Math.max(78, Math.round(wide) + 18), H = height(gs.length, hs.length), x0 = this.w - W - 8 - this.edge.right;
    this.toastRight = Math.min(this.toastRight, x0);
    this.panel(x0, y0, W, H);
    if (this.goalFlash > 0) {
      // 진행이 한 칸 나아갔을 때 금빛 테두리가 잠깐 빛남
      const g = this.ctx;
      g.globalAlpha = Math.min(1, this.goalFlash);
      g.fillStyle = '#ffd23a';
      g.fillRect(x0 - 2, y0 - 2, W + 4, 2); g.fillRect(x0 - 2, y0 + H, W + 4, 2); g.fillRect(x0 - 2, y0, 2, H); g.fillRect(x0 + W, y0, 2, H);
      g.globalAlpha = 1;
    }
    this.put(lab, x0 + 9, y0 + 5);
    for (let i = 0; i < gs.length; i++) this.put(gs[i], x0 + 9, centerY(gs[i], y0 + top + i * LH, y0 + top + (i + 1) * LH));
    for (let i = 0; i < hs.length; i++) {
      const hy = y0 + top + 2 + LH + extra + i * HL;
      this.put(hs[i], x0 + 9, centerY(hs[i], hy, hy + HL - 1));
    }
  }





  /**
   * 터치 기기의 알림: 위 가운데, 오래된 것이 위·새 것이 아래로 쌓임. 가로는 왼쪽 도움말 단추·지도(leftEdge)와
   * 오른쪽 시계·할 일 패널 사이, 글이 길면 두 줄까지. 들어올 때 위에서 내려오고 나갈 때는 PC 와 같이 두 단계로 흐려짐.
   * 완료 띠(위 가운데)가 떠 있는 동안은 그 아래로 내려가 있다가 띠가 사라지면 올라옴
   */
  private toastsTop(dt: number, edgeTop: number, leftEdge: number) {
    const g = this.ctx, e = this.edge;
    const span = toastSpan(this.w, leftEdge, this.toastRight, e.left, e.right);
    const bannerBottom = this.banner ? 10 + this.bannerH() + 4 : 0;
    const base = 8 + edgeTop, target = Math.max(0, bannerBottom - base);
    this.toastDrop += Math.sign(target - this.toastDrop) * Math.min(Math.abs(target - this.toastDrop), 160 * dt);
    let ty = base + Math.round(this.toastDrop);
    const gr = this.grow(13), LH = TOAST_LINE_H + gr, H1 = TOAST_H + gr;
    for (const t of this.toasts) {
      const text = t.count ? `+${t.count} ${t.name}` : t.name;
      const inner = span.x1 - span.x0 - (t.iconId ? 30 : 14);
      const lines = wrapLines(text, inner, (s) => this.tw(this.txt(s, 13, INK)), 2).map((s) => this.txt(s, 13, INK));
      const th = toastHeight(lines.length, gr);
      const tw = Math.ceil(Math.max(...lines.map((l) => this.tw(l)))) + 14;
      const fade = t.life - t.age;
      g.globalAlpha = fade < 0.2 ? 0.35 : fade < 0.45 ? 0.7 : 1;
      const tx = toastCenterX(span, tw), y = ty + toastSlideY(t.age, th);
      this.panel(tx, y, tw, th);
      lines.forEach((l, i) => this.put(l, tx + 7, centerY(l, y + 5 + i * LH, y + H1 - 6 + i * LH)));
      g.globalAlpha = 1;
      ty += th + TOAST_GAP;
    }
  }

  /** 완료 띠 높이: 제목(18)·부제(11) 글자가 커진 만큼 높아짐 (기본 BANNER_H) */
  private bannerH() { return BANNER_H + this.grow(18) + this.grow(11); }

  private drawBanner(b: { title: string; sub: string; age: number; compact?: boolean }) {
    const g = this.ctx;
    const translated = tr(b.sub);
    const sub = b.compact ? translated.split('\n')[0].replace(/\s*\([^)]*\)/g, '').trim() : translated;
    const short = wrapLines(sub, this.w - 64, text => this.tw(this.txt(text, 11, CREAM, OUTLINE)), 1)[0];
    const t = this.txt(b.title, 18, '#ffe7a8', '#6a4818'), s = this.txt(short, 11, CREAM, OUTLINE);
    const W = Math.max(this.tw(t), this.tw(s)) + 40, H = this.bannerH();
    const x0 = Math.round(this.w / 2 - W / 2);
    // 위에서 내려왔다가 끝에 흐려짐
    const y0 = 10 + Math.round(Math.min(0, b.age * 120 - 18));
    g.globalAlpha = b.age > 2.4 ? Math.max(0, (2.8 - b.age) / 0.4) : 1;
    const f = this.frame(x0, y0, W, H);
    this.fillIn(OUTLINE, f, 0, 0, 0, 0);
    this.fillIn('#3a2a1c', f, 1, 1, 1, 1);
    this.fillDev('#c99a3a', f.L(1), f.T(1), f.R(1), f.T(3)); this.fillDev('#c99a3a', f.L(1), f.B(3), f.R(1), f.B(1));
    this.put(t, Math.round(this.w / 2 - this.tw(t) / 2), y0 + 5);
    this.put(s, Math.round(this.w / 2 - this.tw(s) / 2), y0 + 29 + this.grow(18));
    // 반짝이 (양옆에서 튀는 별 몇 개)
    for (let k = 0; k < 6; k++) {
      const a = b.age * 3 + k;
      const sx = x0 + (k % 2 ? W + 6 + (k * 7) % 14 : -10 - (k * 7) % 14), sy = y0 + 8 + ((k * 13 + Math.floor(a * 6)) % 30);
      g.fillStyle = k % 3 ? '#ffe070' : '#ffffff'; g.fillRect(sx, sy, 2, 2);
    }
    g.globalAlpha = 1;
  }


  private promptHintSrc = '';
  private promptHintMaxW = 0;
  private promptHintLines: string[] = [];
  private promptHintWidth = 0;
  private promptHintRev = -1;
  private prompt(p: Prompt, withSpace: boolean) {
    const g = this.ctx;
    const label = this.txt(p.label, 13, INK);
    const key = this.txt(this.touch ? '행동' : 'E', 11, PAPER, null);
    // 글자가 커지면 키캡·첫 줄·안내 줄이 그만큼 높아짐 (기본: 키캡 14, 첫 줄 15, 안내 줄 13)
    const ks = 14 + this.grow(11), kw = this.touch ? Math.ceil(this.tw(key)) + 8 : ks;
    const rowH = Math.max(15 + this.grow(13), ks + 1), HL = 13 + this.grow(10);
    const labelX = 7 + kw + 5;
    // 처음 몇 번만 라벨 뒤에 작게 'Space' (도움말의 'E / Space' 와 같은 뜻). 폭은 글자 폭으로 계산
    const space = withSpace ? this.txt('Space', 9, INK_SOFT) : null;
    const labelW = Math.ceil(this.tw(label)) + labelX + 6 + (space ? Math.ceil(this.tw(space)) + 5 : 0);
    const hint = p.hint ? tr(p.hint) : '';
    const maxHintW = Math.min(this.wide(300), this.w - 32);
    if (hint !== this.promptHintSrc || maxHintW !== this.promptHintMaxW || this.textRev !== this.promptHintRev) {
      this.promptHintSrc = hint; this.promptHintMaxW = maxHintW; this.promptHintRev = this.textRev;
      this.promptHintLines = hint ? wrapLines(hint, maxHintW, s => this.tw(this.txt(s, 10, INK_WARM)), 2) : [];
      this.promptHintWidth = 0;
      for (const line of this.promptHintLines) this.promptHintWidth = Math.max(this.promptHintWidth, this.tw(this.txt(line, 10, INK_WARM)) + 16);
    }
    const hintLines = this.promptHintLines;
    const h0 = 11 + rowH, w = Math.max(labelW, this.promptHintWidth), h = h0 + (hintLines.length ? 4 + hintLines.length * HL : 0);
    const bob = Math.floor(this.time * 3) % 2;
    const e = this.edge;
    const x = Math.max(4 + e.left, Math.min(this.w - w - 4 - e.right, Math.round(p.x - w / 2)));
    const y = Math.max(4 + e.top, Math.round(p.y - h - 10) - bob);
    this.promptRect = { x, y, w, h: h + 3 }; // 말풍선이 이 상자를 가리지 않게 (아래 말풍선 단계에서 비킴)
    this.panel(x, y, w, h);
    // 키캡 (속지 안에서 세로 가운데)
    const ky = y + 5 + Math.round((rowH - ks) / 2);
    this.keycap(x + 7, ky, kw, ks);
    this.put(key, x + 7 + (kw - this.tw(key) + 2) / 2, centerY(key, ky + 1, ky + ks - 3));
    this.put(label, x + labelX, centerY(label, y + 5, y + 5 + rowH));
    if (space) this.put(space, x + labelX + Math.ceil(this.tw(label)) + 5, centerY(space, y + 5, y + 5 + rowH));
    for (let i = 0; i < hintLines.length; i++) this.put(this.txt(hintLines[i], 10, INK_WARM), x + 8, y + h0 - 1 + i * HL);
    // 말풍선 꼬리
    g.fillStyle = OUTLINE;
    g.fillRect(Math.round(p.x) - 3, y + h, 7, 1);
    g.fillRect(Math.round(p.x) - 2, y + h + 1, 5, 1);
    g.fillRect(Math.round(p.x) - 1, y + h + 2, 3, 1);
    g.fillStyle = WOOD;
    g.fillRect(Math.round(p.x) - 2, y + h, 5, 1);
    g.fillRect(Math.round(p.x) - 1, y + h + 1, 3, 1);
  }

  private heartIcon(x: number, y: number, faded: boolean) {
    const g = this.ctx;
    const rows = ['.kk.kk.', 'kRRkrrk', 'kRrrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
    const col: Record<string, string> = { k: '#5a1a22', r: '#e0485a', R: '#ffb0b8' };
    g.globalAlpha = faded ? 0.5 : 1;
    rows.forEach((row, yy) => [...row].forEach((ch, xx) => {
      if (!col[ch]) return;
      g.fillStyle = col[ch];
      g.fillRect(x + xx, y + yy, 1, 1);
    }));
    g.globalAlpha = 1;
  }

  /**
   * 나무 테 + 양피지 속지 (코드로 그린 9-slice). 바깥 사각형만 장치 픽셀에 맞추고 겹은 각 가장자리에서
   * inset(k) 만큼 들어가 그려서, 정수가 아닌 배율에서도 네 변의 테 두께가 같고 패널마다 같은 모양 (U10)
   */
  panel(x: number, y: number, w: number, h: number) {
    const f = this.frame(x, y, w, h);
    const fill = (c: string, l: number, t: number, r: number, b: number) => this.fillIn(c, f, l, t, r, b);
    const { L, R, T, B } = f;
    fill(OUTLINE, 2, 0, 2, 0);
    fill(OUTLINE, 0, 2, 0, 2);
    fill(OUTLINE, 1, 1, 1, 1);
    fill(WOOD, 2, 2, 2, 2);
    this.fillDev(WOOD_LIGHT, L(2), T(2), R(2), T(3));
    this.fillDev('#5e3b22', L(2), B(3), R(2), B(2));
    fill(OUTLINE, 4, 4, 4, 4);
    fill(CREAM, 5, 5, 5, 5);
    this.fillDev(PAPER_SHADOW, L(5), B(7), R(5), B(5));
    this.fillDev('#fff0cc', L(5), T(5), R(5), T(6));
    for (const [x0, x1] of [[L(3), L(4)], [R(4), R(3)]])
      for (const [y0, y1] of [[T(3), T(4)], [B(4), B(3)]]) this.fillDev('#d8b070', x0, y0, x1, y1);
  }

  private drawMinimap(x: number, y: number): void {
    const g = this.ctx;
    const w = 78, h = 78;
    this.panel(x, y, w, h);

    const innerX = x + 6;
    const innerY = y + 6;
    const innerW = w - 12;
    const innerH = h - 12;
    const cx = innerX + innerW / 2;
    const cy = innerY + innerH / 2;

    g.save();
    // 미니맵 속지 클리핑
    g.beginPath();
    g.rect(innerX, innerY, innerW, innerH);
    g.clip();

    // 양피지 지도 바닥
    g.fillStyle = '#ecd8b0';
    g.fillRect(innerX, innerY, innerW, innerH);

    // 미니맵 축척: 월드 1유닛 = 1.05px
    const zoom = 1.05;
    const toMapX = (wx: number) => cx + (wx - this.minimap.playerX * 0.3) * zoom;
    const toMapY = (wz: number) => cy + (wz - this.minimap.playerZ * 0.3) * zoom;

    // 주 도로 십자선 (동서 대로 & 남북 길)
    g.fillStyle = '#caa070';
    g.fillRect(innerX, toMapY(3.5) - 2, innerW, 4);
    g.fillRect(toMapX(0) - 2, innerY, 4, innerH);

    // 랜드마크 렌더링
    for (const lm of this.minimap.landmarks) {
      const mx = Math.round(toMapX(lm.x));
      const my = Math.round(toMapY(lm.z));
      g.fillStyle = lm.color;
      g.fillRect(mx - 2, my - 2, 5, 5);
      g.strokeStyle = '#3a2210';
      g.lineWidth = 1;
      g.strokeRect(mx - 2.5, my - 2.5, 6, 6);
    }

    // 퀘스트 목표 핀 (타겟 핀이 있을 때)
    if (this.minimap.targetPin) {
      const tx = Math.round(toMapX(this.minimap.targetPin.x));
      const ty = Math.round(toMapY(this.minimap.targetPin.z));
      const pulse = 3 + Math.sin(this.time * 8) * 1.5;
      g.fillStyle = '#e03030';
      g.beginPath();
      g.arc(tx, ty, pulse, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillRect(tx - 1, ty - 1, 2, 2);
    }

    // 플레이어 마커 (현재 위치 & 시선 방향)
    const px = Math.round(toMapX(this.minimap.playerX));
    const py = Math.round(toMapY(this.minimap.playerZ));
    const facing = this.minimap.playerFacing;

    // 시선 방향 콘 화살표
    g.fillStyle = 'rgba(240, 200, 80, 0.45)';
    g.beginPath();
    g.moveTo(px, py);
    g.arc(px, py, 9, facing - 0.4, facing + 0.4);
    g.closePath();
    g.fill();

    // 플레이어 중심 마커
    g.fillStyle = '#f0c030';
    g.beginPath();
    g.arc(px, py, 2.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2a1a0e';
    g.lineWidth = 1;
    g.stroke();

    g.restore();

    // 나침반 N 마커 (우측 상단 작은 글씨)
    g.fillStyle = '#8a2020';
    g.font = 'bold 9px monospace';
    g.fillText('N', innerX + innerW - 9, innerY + 9);
    // 지도 이름 표기 (좌측 하단 '우르')
    this.put(this.txt('우르', 9, INK_WARM), innerX + 2, innerY + innerH - 9);
  }
}
