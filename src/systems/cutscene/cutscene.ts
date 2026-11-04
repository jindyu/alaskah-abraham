/**
 * 노아 스타일 씬 진행기: Step 배열을 차례로 실행하며, 게임 시간(dt)으로만 흐르고 setTimeout을 쓰지 않는다.
 */
export interface VoiceSink {
  stop(): void;
}

export const SKIP_BEGIN = 'skip-begin';
export const SKIP_END = 'skip-end';

export type Step =
  | { wait: number }
  | { do: () => void }
  | { mark: typeof SKIP_BEGIN | typeof SKIP_END }
  | { until: () => boolean; max?: number; skippable?: boolean }
  | { animate: number; frame: (progress: number) => void }
  | { caption: string; style?: CaptionStyle; hold?: number };

export type CaptionStyle = 'voice' | 'narration' | 'title';

export interface CaptionState {
  text: string;
  style: CaptionStyle;
  age: number;
  hold: number;
}

export class Cutscene {
  running = false;
  private steps: Step[] = [];
  private i = 0;
  private t = 0;
  private onDone: (() => void) | null = null;
  caption: CaptionState | null = null;
  private skip = false;
  tag = '';

  play(steps: Step[], onDone?: () => void, tag = '') {
    this.steps = steps;
    this.i = 0;
    this.t = 0;
    this.running = true;
    this.onDone = onDone ?? null;
    this.caption = null;
    this.tag = tag;
    this.enter();
  }

  key(e: KeyboardEvent) {
    if (['KeyE', 'Enter', 'Space'].includes(e.code) && !e.repeat) this.skip = true;
    if (e.code === 'Escape' && !e.repeat && this.running) this.skipRegion();
  }

  private regionEnd(): number {
    let begin = -1;
    for (let k = Math.min(this.i, this.steps.length - 1); k >= 0; k--) {
      const s = this.steps[k];
      if ('mark' in s) {
        if (s.mark === SKIP_BEGIN) { begin = k; break; }
        if (k < this.i) return -1;
      }
    }
    if (begin < 0) return -1;
    for (let k = Math.max(this.i, begin + 1); k < this.steps.length; k++) {
      const s = this.steps[k];
      if ('mark' in s && s.mark === SKIP_END) return k;
    }
    return -1;
  }

  private skipRegion() {
    const end = this.regionEnd();
    if (end < 0) return;
    this.caption = null;
    this.i = end;
    this.skip = false;
    this.t = 0;
  }

  private enter() {
    while (this.i < this.steps.length) {
      const s = this.steps[this.i];
      if ('do' in s) {
        s.do();
        this.i++;
      } else if ('mark' in s) {
        this.i++;
      } else if ('caption' in s) {
        const hold = s.hold ?? Math.max(2.5, s.caption.length * 0.12);
        this.caption = { text: s.caption, style: s.style ?? 'narration', age: 0, hold };
        break;
      } else if ('wait' in s || 'until' in s || 'animate' in s) {
        break;
      } else {
        this.i++;
      }
    }
    if (this.i >= this.steps.length) this.finish();
  }

  update(dt: number) {
    if (!this.running || this.i >= this.steps.length) return;
    this.t += dt;
    const s = this.steps[this.i];

    if ('caption' in s && this.caption) {
      this.caption.age += dt;
      if (this.skip || this.caption.age >= this.caption.hold) {
        this.caption = null;
        this.skip = false;
        this.t = 0;
        this.i++;
        this.enter();
      }
      return;
    }

    if ('wait' in s) {
      if (this.skip || this.t >= s.wait) {
        this.skip = false;
        this.t = 0;
        this.i++;
        this.enter();
      }
      return;
    }

    if ('animate' in s) {
      const dur = Math.max(1e-4, s.animate);
      const progress = Math.min(1, this.t / dur);
      s.frame(progress);
      if (progress >= 1 || this.skip) {
        s.frame(1);
        this.skip = false;
        this.t = 0;
        this.i++;
        this.enter();
      }
      return;
    }

    if ('until' in s) {
      const ok = s.until();
      const timeout = s.max !== undefined && this.t >= s.max;
      if (ok || timeout || (this.skip && s.skippable)) {
        this.skip = false;
        this.t = 0;
        this.i++;
        this.enter();
      }
      return;
    }
  }

  finish() {
    this.running = false;
    this.caption = null;
    const done = this.onDone;
    this.onDone = null;
    if (done) done();
  }

  abort() {
    this.running = false;
    this.caption = null;
    this.steps = [];
  }
}
