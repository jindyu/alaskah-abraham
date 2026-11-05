import sfxData from '../data/sfxManifest.json';
import voiceData from '../data/voiceManifest.json';

interface SfxInfo {
  path: string;
  volumeDb: number;
  category: string;
  duration: number;
  loop: boolean;
}

const SFX_MAP = sfxData as Record<string, SfxInfo>;
const VOICE_MAP = voiceData as Record<string, string>;

export class AudioManager {
  private bgmAudio: HTMLAudioElement | null = null;
  private currentBgmKey = '';
  private ambAudio: HTMLAudioElement | null = null;
  private currentAmbKey = '';
  private currentVoiceAudio: HTMLAudioElement | null = null;

  masterVol = 0.8;
  bgmVol = 0.7;
  sfxVol = 0.8;
  voiceVol = 0.9;
  muted = false;

  constructor() {
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
    } catch {}
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
    } catch {}
  }

  playBgm(key: string, fadeDuration = 1.5): void {
    if (!key || key === this.currentBgmKey) return;
    this.currentBgmKey = key;

    const targetUrl = `audio/bgm/${key.replace(/^bgm_/, 'bgm_')}.ogg`;

    // 페이드 아웃 기존 BGM
    const prev = this.bgmAudio;
    if (prev) {
      let t = 0;
      const initialVol = prev.volume;
      const fadeOutTimer = setInterval(() => {
        t += 0.05;
        const ratio = Math.max(0, 1 - t / fadeDuration);
        prev.volume = initialVol * ratio;
        if (ratio <= 0) {
          clearInterval(fadeOutTimer);
          prev.pause();
          prev.src = '';
        }
      }, 50);
    }

    const next = new Audio(targetUrl);
    next.loop = true;
    const targetVol = this.muted ? 0 : this.masterVol * this.bgmVol;
    next.volume = 0;
    this.bgmAudio = next;

    next.play().catch(() => {});

    let t = 0;
    const fadeInTimer = setInterval(() => {
      t += 0.05;
      const ratio = Math.min(1, t / fadeDuration);
      if (this.bgmAudio === next) {
        next.volume = targetVol * ratio;
      }
      if (ratio >= 1) clearInterval(fadeInTimer);
    }, 50);
  }

  stopBgm(fadeDuration = 1.0): void {
    if (!this.bgmAudio) return;
    const cur = this.bgmAudio;
    this.currentBgmKey = '';
    let t = 0;
    const initialVol = cur.volume;
    const fadeOutTimer = setInterval(() => {
      t += 0.05;
      const ratio = Math.max(0, 1 - t / fadeDuration);
      cur.volume = initialVol * ratio;
      if (ratio <= 0) {
        clearInterval(fadeOutTimer);
        cur.pause();
        cur.src = '';
        if (this.bgmAudio === cur) this.bgmAudio = null;
      }
    }, 50);
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
    amb.play().catch(() => {});
  }

  playSfx(key: string): void {
    if (this.muted) return;
    const info = SFX_MAP[key];
    const path = info ? info.path : `audio/sfx/${key}.ogg`;
    const audio = new Audio(path);
    const db = info?.volumeDb ?? 0;
    const scale = Math.pow(10, db / 20);
    audio.volume = Math.min(1, Math.max(0, this.masterVol * this.sfxVol * scale));
    audio.play().catch(() => {});
  }

  playVoice(
    text: string,
    role = 'narrator',
    chapter = '',
    onEnded?: () => void,
  ): HTMLAudioElement | null {
    if (this.currentVoiceAudio) {
      this.currentVoiceAudio.pause();
      this.currentVoiceAudio = null;
    }
    if (this.muted) {
      if (onEnded) setTimeout(onEnded, 1500);
      return null;
    }

    const trimmed = text.trim();
    const exactKey = `${chapter}|${role}|${trimmed}`;
    const roleKey = `*|${role}|${trimmed}`;
    const textKey = `*|*|${trimmed}`;
    const relPath = VOICE_MAP[exactKey] || VOICE_MAP[roleKey] || VOICE_MAP[textKey];

    if (!relPath) {
      if (onEnded) setTimeout(onEnded, 1500);
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
        const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
        if (!AudioContextClass) return;
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const now = this.audioCtx.currentTime;

      let freq = 320;
      let type: OscillatorType = 'triangle';
      switch (character) {
        case 'terah': freq = 210; type = 'sawtooth'; break;
        case 'nimrod': freq = 160; type = 'sawtooth'; break;
        case 'abram':
        case 'abram_young': freq = 320; type = 'triangle'; break;
        case 'sarai':
        case 'sarah': freq = 480; type = 'sine'; break;
        case 'lot':
        case 'lot_young': freq = 580; type = 'triangle'; break;
        case 'jacob': freq = 360; type = 'triangle'; break;
        case 'esau': freq = 270; type = 'sawtooth'; break;
        case 'customer':
        case 'old_man': freq = 230; type = 'sawtooth'; break;
        case 'god':
        case 'voice': freq = 130; type = 'sine'; break;
        default: freq = 340; type = 'sine'; break;
      }

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.045);

      gain.gain.setValueAtTime(this.masterVol * this.voiceVol * 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {}
  }

  stopVoice(): void {
    if (this.currentVoiceAudio) {
      this.currentVoiceAudio.pause();
      this.currentVoiceAudio = null;
    }
  }
}
