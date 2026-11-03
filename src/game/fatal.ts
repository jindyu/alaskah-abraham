import { tr } from '../i18n/tr';
/**
 * 게임을 이어 갈 수 없을 때 보여 주는 DOM 안내 화면 (캔버스·HUD 가 없어도 뜸)과, WebGL 컨텍스트 손실·복구 감시.
 * 문구와 판정은 순수하게 두고, DOM 을 만지는 함수는 Document 를 받아서 테스트에서 가짜로 바꿀 수 있다.
 * 연결: createGame.ts 가 PixelRenderer 생성 실패를 GraphicsInitError 로 받아 showFatal, 프레임 연속 실패는 game/guard.ts FrameHealth → showOverlay.
 */
export const GRAPHICS_FATAL_TEXT = '이 브라우저에서 그래픽을 쓸 수 없다. 다른 브라우저나 하드웨어 가속 설정을 확인하자';
export const FATAL_OVERLAY_ID = 'abraham-fatal';

/** 렌더러를 만들지 못함 (WebGL 을 못 쓰는 브라우저·하드웨어 가속 꺼짐 등). detail = 원래 예외 */
export class GraphicsInitError extends Error {
  constructor(readonly detail: unknown) {
    super('graphics init failed');
    this.name = 'GraphicsInitError';
  }
}

export interface OverlayOptions {
  text: string;
  /** 있으면 안내 아래에 버튼을 둠 */
  button?: { label: string; onClick: () => void };
  /** 같은 id 의 안내는 하나만 (다시 부르면 문구만 바꿈) */
  id?: string;
}

/** 화면 전체를 덮는 안내를 띄움. 지우는 함수를 돌려줌 (이미 지워졌으면 아무 일 없음) */
export function showOverlay(doc: Document, opts: OverlayOptions): () => void {
  const id = opts.id ?? FATAL_OVERLAY_ID;
  const old = doc.getElementById(id);
  if (old) old.remove();
  const box = doc.createElement('div');
  box.id = id;
  box.setAttribute('role', 'alert');
  box.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;'
    + 'padding:24px;box-sizing:border-box;background:rgba(20,16,28,0.96);color:#f0e6d2;font:16px/1.6 sans-serif;text-align:center;word-break:keep-all';
  const p = doc.createElement('p');
  p.style.cssText = 'margin:0;max-width:30em';
  p.textContent = tr(opts.text);
  box.appendChild(p);
  if (opts.button) {
    const b = doc.createElement('button');
    b.textContent = tr(opts.button.label);
    b.style.cssText = 'font:inherit;padding:8px 20px;border:2px solid #f0e6d2;border-radius:4px;background:#3a2f4c;color:inherit;cursor:pointer';
    const click = opts.button.onClick;
    b.addEventListener('click', () => { try { click(); } catch { /* 안내 버튼이 실패해도 화면은 그대로 */ } });
    box.appendChild(b);
  }
  (doc.body ?? doc.documentElement).appendChild(box);
  return () => box.remove();
}

/** 그래픽을 쓸 수 없다는 안내 (게임은 더 진행하지 않음) */
export function showFatal(doc: Document, text: string = GRAPHICS_FATAL_TEXT): () => void {
  return showOverlay(doc, { text });
}

/**
 * WebGL 컨텍스트 손실·복구 감시. 잃은 동안에는 `lost` 가 true (그리기를 건너뛰게), 돌아오면 onRestore 로 렌더 타깃·텍스처를 다시 만들게 함.
 * onRestore 가 던지면 lost 를 그대로 두고 onFail 을 부름 (호출한 쪽이 새로 고침 안내를 띄움).
 * 손실 이벤트는 preventDefault 해야 브라우저가 컨텍스트를 되살려 줌
 */
export class GlContextWatch {
  private isLost = false;
  private isFailed = false;
  constructor(canvas: EventTarget, private readonly onRestore: () => void, private readonly onFail: (err: unknown) => void = () => {}) {
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.isLost = true; });
    canvas.addEventListener('webglcontextrestored', () => {
      try { this.onRestore(); this.isLost = false; this.isFailed = false; } catch (err) {
        this.isFailed = true;
        try { this.onFail(err); } catch { /* 알림 실패는 무시 */ }
      }
    });
  }
  /** 지금 컨텍스트가 없어 그릴 수 없나 */
  get lost() { return this.isLost; }
  /** 돌아왔지만 다시 만들지 못했나 (새로 고침해야 함) */
  get failed() { return this.isFailed; }
}
