import { noteError } from '../core/diagnostics';
import sfxData from '../data/sfxManifest.json';
import voiceData from '../data/voiceManifest.json';
import { isKo } from '../i18n/lang';
import { after } from '../game/timers';

interface SfxInfo {
  path: string;
  volumeDb: number;
  category: string;
  duration: number;
  loop: boolean;
}

const SFX_MAP = sfxData as Record<string, SfxInfo>;
const VOICE_MAP = voiceData as Record<string, string>;
const VALID_VOICE_PATHS = new Set(Object.values(VOICE_MAP));

let activeAudioManager: AudioManager | null = null;

export function getAudioManager(): AudioManager | null {
  return activeAudioManager;
}

const ROLE_TO_ID: Record<string, string> = {
  '아브람': 'abram',
  '청년 아브람': 'abram',
  '아브라함': 'abraham',
  '사래': 'sarah',
  '사라': 'sarah',
  '롯': 'lot',
  '데라': 'terah',
  '니므롯': 'nimrod',
  '노아': 'noah',
  '셈': 'shem',
  '함': 'ham',
  '야벳': 'japheth',
  '엘리에셀': 'eliezer',
  '하갈': 'hagar',
  '이스마엘': 'ishmael',
  '이삭': 'isaac',
  '리브가': 'rebekah',
  '에브론': 'ephron',
  '멜기세덱': 'melchizedek',
  '아비멜렉': 'abimelech',
  '바로': 'pharaoh',
  '라반': 'laban',
  '에서': 'esau',
  '야곱': 'jacob',
  '해설': 'narrator',
  '나레이터': 'narrator',
  '천사': 'angel',
  '주의 사자': 'angel',
  '하나님': 'god',
  '여호와': 'god',
  '음성': 'voice',
  '세관': 'customs',
  '세관 관리': 'customs',
  '세관 관헌': 'customs',
};

function resolveVoicePath(
  textOrKey: string,
  role = 'narrator',
  chapter = '',
  directPath?: string,
): string | null {
  if (directPath) {
    const cleaned = directPath.replace(/^res:\/\/assets\//, '');
    if (VALID_VOICE_PATHS.has(cleaned)) return cleaned;
  }
  const trimmed = textOrKey.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('res://assets/') || trimmed.startsWith('audio/voice/')) {
    const cleaned = trimmed.replace(/^res:\/\/assets\//, '');
    if (VALID_VOICE_PATHS.has(cleaned)) return cleaned;
  }

  if (VOICE_MAP[trimmed]) return VOICE_MAP[trimmed];

  const roleId = ROLE_TO_ID[role] || role.toLowerCase();
  const candidates = [
    `${chapter}|${role}|${trimmed}`,
    `${chapter}|${roleId}|${trimmed}`,
    `*|${role}|${trimmed}`,
    `*|${roleId}|${trimmed}`,
    `*|*|${trimmed}`,
  ];

  for (const k of candidates) {
    if (VOICE_MAP[k]) return VOICE_MAP[k];
  }

  const unquoted = trimmed.replace(/^["'“](.*)["'”]$/, '$1').trim();
  if (unquoted !== trimmed) {
    const unquotedCandidates = [
      `${chapter}|${role}|${unquoted}`,
      `${chapter}|${roleId}|${unquoted}`,
      `*|${role}|${unquoted}`,
      `*|${roleId}|${unquoted}`,
      `*|*|${unquoted}`,
    ];
    for (const k of unquotedCandidates) {
      if (VOICE_MAP[k]) return VOICE_MAP[k];
    }
  }

  const colonIdx = trimmed.indexOf(': ');
  if (colonIdx > 0 && colonIdx < 15) {
    const afterColon = trimmed.slice(colonIdx + 2).replace(/^["'“](.*)["'”]$/, '$1').trim();
    const colonSpeaker = trimmed.slice(0, colonIdx).trim();
    const speakerId = ROLE_TO_ID[colonSpeaker] || colonSpeaker.toLowerCase();
    const colonCandidates = [
      `${chapter}|${speakerId}|${afterColon}`,
      `*|${speakerId}|${afterColon}`,
      `*|*|${afterColon}`,
    ];
    for (const k of colonCandidates) {
      if (VOICE_MAP[k]) return VOICE_MAP[k];
    }
  }

  return null;
}

export interface VoiceBlipProfile {
  freq: number;
  type: OscillatorType;
}

export const DEFAULT_VOICE_BLIP: VoiceBlipProfile = {
  freq: 340,
  type: 'sine',
};

/**
 * 인물별 고유 음성 칩 사운드(Typewriter Voice Pitch Blip) 프리셋 매핑.
 * 영문 ID 및 한국어 화자명(hud.toast 등에서 전달) 모두를 지원합니다.
 * 기존에 정의되어 있던 ID의 freq와 type은 완전히 동일하게 유지됩니다.
 */
export const VOICE_BLIP_MAP: Record<string, VoiceBlipProfile> = {
  // === 기존 처리된 ID 및 한국어 대응 (Existing behaviour preserved) ===
  terah: { freq: 210, type: 'sawtooth' },
  '데라': { freq: 210, type: 'sawtooth' },

  nimrod: { freq: 160, type: 'sawtooth' },
  '니므롯': { freq: 160, type: 'sawtooth' },

  abram: { freq: 320, type: 'triangle' },
  abram_young: { freq: 320, type: 'triangle' },
  '아브람': { freq: 320, type: 'triangle' },
  '청년 아브람': { freq: 320, type: 'triangle' },
  '청년아브람': { freq: 320, type: 'triangle' },

  sarai: { freq: 480, type: 'sine' },
  sarah: { freq: 480, type: 'sine' },
  '사래': { freq: 480, type: 'sine' },
  '사라': { freq: 480, type: 'sine' },

  lot: { freq: 580, type: 'triangle' },
  lot_young: { freq: 580, type: 'triangle' },
  '롯': { freq: 580, type: 'triangle' },
  '어린 롯': { freq: 580, type: 'triangle' },
  '어린롯': { freq: 580, type: 'triangle' },

  jacob: { freq: 360, type: 'triangle' },
  '야곱': { freq: 360, type: 'triangle' },

  esau: { freq: 270, type: 'sawtooth' },
  '에서': { freq: 270, type: 'sawtooth' },

  customer: { freq: 230, type: 'sawtooth' },
  old_man: { freq: 230, type: 'sawtooth' },
  '노인 손님': { freq: 230, type: 'sawtooth' },
  '노인손님': { freq: 230, type: 'sawtooth' },
  '노인': { freq: 230, type: 'sawtooth' },
  '손님': { freq: 230, type: 'sawtooth' },

  god: { freq: 130, type: 'sine' },
  voice: { freq: 130, type: 'sine' },
  '하나님': { freq: 130, type: 'sine' },
  '여호와': { freq: 130, type: 'sine' },
  '음성': { freq: 130, type: 'sine' },

  narrator: { freq: 340, type: 'sine' },
  '해설': { freq: 340, type: 'sine' },
  '나레이터': { freq: 340, type: 'sine' },

  // === 제2~6권 인물군 (Book 2-6 Cast: 200-520Hz 쾌적 주파수 대역) ===
  // 아브라함 (열국의 아버지 / 노년 족장: 중후하고 침착한 음색)
  abraham: { freq: 300, type: 'triangle' },
  '아브라함': { freq: 300, type: 'triangle' },

  // 하갈 (사래의 여종 · 이집트 여인: 여성 고유 440Hz)
  hagar: { freq: 440, type: 'sine' },
  '하갈': { freq: 440, type: 'sine' },

  // 이스마엘 (소년 및 청년 사냥꾼: 밝고 역동적인 420Hz)
  ishmael: { freq: 420, type: 'triangle' },
  ishmael_young: { freq: 420, type: 'triangle' },
  '이스마엘': { freq: 420, type: 'triangle' },
  '어린 이스마엘': { freq: 420, type: 'triangle' },
  '어린이스마엘': { freq: 420, type: 'triangle' },

  // 이삭 (순종의 아들 · 약속의 자녀: 맑고 정돈된 390Hz)
  isaac: { freq: 390, type: 'triangle' },
  isaac_young: { freq: 390, type: 'triangle' },
  '이삭': { freq: 390, type: 'triangle' },
  '어린 이삭': { freq: 390, type: 'triangle' },
  '어린이삭': { freq: 390, type: 'triangle' },

  // 리브가 (우물가의 활기찬 여인 / 이삭의 아내: 밝고 높은 500Hz)
  rebekah: { freq: 500, type: 'sine' },
  '리브가': { freq: 500, type: 'sine' },

  // 엘리에셀 (다메섹 사람 · 아브라함 집의 충직한 늙은 종: 낮은 노년 240Hz)
  eliezer: { freq: 240, type: 'sawtooth' },
  '엘리에셀': { freq: 240, type: 'sawtooth' },

  // 에브론 (헷 족속 지주: 굵직한 상인 260Hz)
  ephron: { freq: 260, type: 'sawtooth' },
  '에브론': { freq: 260, type: 'sawtooth' },

  // 멜기세덱 (살렘 왕이자 지극히 높으신 하나님의 제사장: 성스러운 280Hz)
  melchizedek: { freq: 280, type: 'sine' },
  '멜기세덱': { freq: 280, type: 'sine' },

  // 아비멜렉 (그랄 왕: 권위 있는 군주 220Hz)
  abimelech: { freq: 220, type: 'sawtooth' },
  '아비멜렉': { freq: 220, type: 'sawtooth' },

  // 천사 (주의 사자: 맑고 영롱한 520Hz)
  angel: { freq: 520, type: 'sine' },
  '천사': { freq: 520, type: 'sine' },

  // 기타 작중 대사 등장 인물
  lots_wife: { freq: 460, type: 'sine' },
  '롯의 아내': { freq: 460, type: 'sine' },
  '롯의아내': { freq: 460, type: 'sine' },

  haran: { freq: 310, type: 'triangle' },
  '하란': { freq: 310, type: 'triangle' },

  pharaoh: { freq: 200, type: 'sawtooth' },
  '바로': { freq: 200, type: 'sawtooth' },

  laban: { freq: 350, type: 'triangle' },
  '라반': { freq: 350, type: 'triangle' },

  noah: { freq: 220, type: 'sawtooth' },
  '노아': { freq: 220, type: 'sawtooth' },

  shem: { freq: 310, type: 'triangle' },
  '셈': { freq: 310, type: 'triangle' },

  ham: { freq: 250, type: 'sawtooth' },
  '함': { freq: 250, type: 'sawtooth' },

  japheth: { freq: 330, type: 'triangle' },
  '야벳': { freq: 330, type: 'triangle' },

  merchant: { freq: 280, type: 'sawtooth' },
  '상인': { freq: 280, type: 'sawtooth' },

  guard: { freq: 250, type: 'sawtooth' },
  '호위병': { freq: 250, type: 'sawtooth' },

  soldier: { freq: 250, type: 'sawtooth' },
  '가신 용사': { freq: 250, type: 'sawtooth' },
  '가신용사': { freq: 250, type: 'sawtooth' },

  citizen: { freq: 310, type: 'triangle' },
  '주민': { freq: 310, type: 'triangle' },

  stranger: { freq: 310, type: 'triangle' },
  '나그네': { freq: 310, type: 'triangle' },
};

export class AudioManager {
  private bgmAudio: HTMLAudioElement | null = null;
  private currentBgmKey = '';
  private ambAudio: HTMLAudioElement | null = null;
  private currentAmbKey = '';
  private currentVoiceAudio: HTMLAudioElement | null = null;
  private sfxPool = new Map<string, HTMLAudioElement[]>();
  private static readonly MAX_SFX_PER_KEY = 4;

  masterVol = 0.8;
  bgmVol = 0.7;
  sfxVol = 0.8;
  voiceVol = 0.9;
  muted = false;

  constructor() {
    activeAudioManager = this;
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem('abraham_audio_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.masterVol === 'number') this.masterVol = parsed.masterVol;
        if (typeof parsed.bgmVol === 'number') this.bgmVol = parsed.bgmVol;
        if (typeof parsed.sfxVol === 'number') this.sfxVol = parsed.sfxVol;
        if (typeof parsed.voiceVol === 'number') this.voiceVol = parsed.voiceVol;
        if (typeof parsed.muted === 'boolean') this.muted = parsed.muted;
      }
    } catch (e) { noteError('audio:loadSettings', e); }
  }

  saveSettings(): void {
    try {
      localStorage.setItem(
        'abraham_audio_settings',
        JSON.stringify({
          masterVol: this.masterVol,
          bgmVol: this.bgmVol,
          sfxVol: this.sfxVol,
          voiceVol: this.voiceVol,
          muted: this.muted,
        }),
      );
    } catch (e) { noteError('audio:saveSettings', e); }
  }

  /** 요소별 진행 중인 페이드 (같은 요소에 새 페이드를 걸면 이전 것을 취소 — 빠른 곡 전환에서도 겹치지 않음) */
  private fadeTimers = new Map<HTMLAudioElement, ReturnType<typeof setInterval>>();
  private fadeAudio(el: HTMLAudioElement, to: number, seconds: number, done?: () => void): void {
    const old = this.fadeTimers.get(el);
    if (old !== undefined) clearInterval(old);
    const from = el.volume;
    const t0 = performance.now();
    const ms = Math.max(1, seconds * 1000);
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * p));
      if (p >= 1) {
        clearInterval(id);
        this.fadeTimers.delete(el);
        if (done) done();
      }
    }, 50);
    this.fadeTimers.set(el, id);
  }

  playBgm(key: string, fadeDuration = 1.5): void {
    if (!key || key === this.currentBgmKey) return;
    this.currentBgmKey = key;

    const targetUrl = `audio/bgm/${key.replace(/^bgm_/, 'bgm_')}.ogg`;

    // 기존 BGM 은 페이드 아웃 뒤 정리
    const prev = this.bgmAudio;
    if (prev) this.fadeAudio(prev, 0, fadeDuration, () => { prev.pause(); prev.src = ''; });

    const next = new Audio(targetUrl);
    next.loop = true;
    const targetVol = this.muted ? 0 : this.masterVol * this.bgmVol;
    next.volume = 0;
    this.bgmAudio = next;

    next.play().catch((e) => noteError('audio:playBgm', e));
    this.fadeAudio(next, targetVol, fadeDuration);
  }

  stopBgm(fadeDuration = 1.0): void {
    if (!this.bgmAudio) return;
    const cur = this.bgmAudio;
    this.currentBgmKey = '';
    this.fadeAudio(cur, 0, fadeDuration, () => {
      cur.pause();
      cur.src = '';
      if (this.bgmAudio === cur) this.bgmAudio = null;
    });
  }

  playAmbience(key: string): void {
    if (!key || key === this.currentAmbKey) return;
    this.currentAmbKey = key;

    if (this.ambAudio) {
      this.ambAudio.pause();
      this.ambAudio.src = '';
    }

    const targetUrl = `audio/ambience/${key}.ogg`;
    const amb = new Audio(targetUrl);
    amb.loop = true;
    amb.volume = this.muted ? 0 : this.masterVol * this.bgmVol * 0.6;
    this.ambAudio = amb;
    amb.play().catch((e) => noteError('audio:playAmbience', e));
  }

  playSfx(key: string): void {
    if (this.muted) return;
    try {
      if (typeof Audio === 'undefined') return;
      let pool = this.sfxPool.get(key);
      if (!pool) {
        pool = [];
        this.sfxPool.set(key, pool);
      }
      let audio = pool.find((a) => a.ended || a.paused);
      if (!audio) {
        if (pool.length < AudioManager.MAX_SFX_PER_KEY) {
          const info = SFX_MAP[key];
          const path = info ? info.path : `audio/sfx/${key}.ogg`;
          audio = new Audio(path);
          pool.push(audio);
        } else {
          audio = pool[0];
          pool.push(pool.shift()!);
        }
      }
      try { audio.currentTime = 0; } catch (e) { noteError('audioManager:1', e); }
      const info = SFX_MAP[key];
      const db = info?.volumeDb ?? 0;
      const scale = Math.pow(10, db / 20);
      audio.volume = Math.min(1, Math.max(0, this.masterVol * this.sfxVol * scale));
      audio.play().catch((e) => noteError('audio:playSfxElement', e));
    } catch (e) { noteError('audio:playSfx', e); }
  }

  playVoice(
    text: string,
    role = 'narrator',
    chapter = '',
    onEnded?: () => void,
    directPath?: string,
  ): HTMLAudioElement | null {
    this.stopVoice();
    // 보이스 클립은 한국어뿐이다: 영어 자막에 한국어 음성이 겹치지 않게 한국어 모드에서만 재생한다
    if (this.muted || !isKo()) {
      if (onEnded) after(onEnded, 1500);
      return null;
    }

    const relPath = resolveVoicePath(text, role, chapter, directPath);
    if (!relPath || !VALID_VOICE_PATHS.has(relPath)) {
      if (onEnded) after(onEnded, 1500);
      return null;
    }

    const audio = new Audio(relPath);
    audio.volume = Math.min(1, Math.max(0, this.masterVol * this.voiceVol));
    this.currentVoiceAudio = audio;

    if (onEnded) {
      audio.onended = () => {
        if (this.currentVoiceAudio === audio) this.currentVoiceAudio = null;
        onEnded();
      };
      audio.onerror = () => {
        if (this.currentVoiceAudio === audio) this.currentVoiceAudio = null;
        onEnded();
      };
    }

    audio.play().catch(() => {
      if (onEnded) onEnded();
    });
    return audio;
  }

  private audioCtx: AudioContext | null = null;

  /** 대사 출력 시 캐릭터별 음성 칩 사운드(Typewriter Voice Pitch Blip) 재생 */
  playVoiceBlip(character = 'narrator'): void {
    if (this.muted) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : null;
        if (!AudioContextClass) return;
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const now = this.audioCtx.currentTime;

      const profile =
        (character && VOICE_BLIP_MAP[character]) ||
        (character && VOICE_BLIP_MAP[character.toLowerCase()]) ||
        DEFAULT_VOICE_BLIP;
      const freq = profile.freq;
      const type = profile.type;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.045);

      gain.gain.setValueAtTime(this.masterVol * this.voiceVol * 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (e) { noteError('audio:blipDisconnect', e); }
      };

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) { noteError('audio:blipStart', e); }
  }

  stopVoice(): void {
    if (this.currentVoiceAudio) {
      try {
        this.currentVoiceAudio.pause();
        this.currentVoiceAudio.currentTime = 0;
        this.currentVoiceAudio.src = '';
      } catch (e) { noteError('audio:stopVoice', e); }
      this.currentVoiceAudio = null;
    }
  }
}
