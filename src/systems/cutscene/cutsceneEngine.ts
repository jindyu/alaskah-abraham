import * as THREE from 'three';
import { Actor, type ActorPose, type EmoteType } from '../../entities/actor';
import { CrowdManager } from '../../entities/crowd';
import type { AudioManager } from '../../audio/audioManager';
import type { Hud } from '../../ui/hud';
import type { PixelRenderer } from '../../renderer/pixelRenderer';
import { tr } from '../../i18n/tr';

export interface CutsceneStep {
  step_type: string;
  [key: string]: any;
}

export interface CutsceneHost {
  scene: THREE.Scene;
  renderer: PixelRenderer;
  hud: Hud;
  audio: AudioManager;
  crowd: CrowdManager;
  onMapChange?: (mapId: string, location: string) => void;
  onChapterComplete?: () => void;
}

export class CutsceneEngine {
  private host: CutsceneHost;
  private actors = new Map<string, Actor>();
  private steps: CutsceneStep[] = [];
  private currentStepIndex = 0;
  private isRunning = false;
  private waitingTimer = 0;
  private waitingForAdvance = false;
  private movingActors = new Map<string, { toX: number; toZ: number; speed: number }>();
  private cameraTarget: { toX: number; toZ: number; startX: number; startZ: number; t: number; dur: number } | null = null;
  private followingActorId: string | null = null;

  constructor(host: CutsceneHost) {
    this.host = host;
  }

  get running(): boolean {
    return this.isRunning;
  }

  playSequence(steps: CutsceneStep[]): void {
    this.steps = steps;
    this.currentStepIndex = 0;
    this.isRunning = true;
    this.waitingTimer = 0;
    this.waitingForAdvance = false;
    this.movingActors.clear();
    this.cameraTarget = null;
    this.followingActorId = null;

    this.executeCurrentStep();
  }

  stop(): void {
    this.isRunning = false;
    this.waitingForAdvance = false;
    this.movingActors.clear();
    this.host.audio.stopVoice();
    this.host.hud.dialogue = null;
    this.host.hud.cinematicTitle = null;
  }

  advance(): void {
    if (!this.isRunning) return;
    if (this.waitingForAdvance) {
      this.waitingForAdvance = false;
      this.host.audio.stopVoice();
      this.currentStepIndex++;
      this.executeCurrentStep();
    } else if (this.waitingTimer > 0.2) {
      // 대기 시간 단축 스킵
      this.waitingTimer = 0.01;
    }
  }

  update(dt: number): void {
    if (!this.isRunning) return;

    // ── 카메라 추적/이동 ──
    if (this.followingActorId) {
      const actor = this.actors.get(this.followingActorId);
      if (actor) {
        this.host.renderer.follow(actor.root.position);
      }
    } else if (this.cameraTarget) {
      const ct = this.cameraTarget;
      ct.t += dt;
      const progress = Math.min(1, ct.t / Math.max(0.01, ct.dur));
      const curX = ct.startX + (ct.toX - ct.startX) * progress;
      const curZ = ct.startZ + (ct.toZ - ct.startZ) * progress;
      this.host.renderer.camera.position.x = curX;
      this.host.renderer.camera.position.z = curZ;
      if (progress >= 1) this.cameraTarget = null;
    }

    // ── 이동 중인 액터들 업데이트 ──
    if (this.movingActors.size > 0) {
      const arrivedIds: string[] = [];
      for (const [id, move] of this.movingActors) {
        const actor = this.actors.get(id);
        if (!actor) {
          arrivedIds.push(id);
          continue;
        }
        const arrived = actor.moveTo(move.toX, move.toZ, move.speed, dt);
        if (arrived) {
          actor.setPose('stand');
          arrivedIds.push(id);
        }
      }
      for (const id of arrivedIds) this.movingActors.delete(id);
    }

    // ── 정지 상태 액터 애니메이션 ──
    for (const [id, actor] of this.actors) {
      if (!this.movingActors.has(id)) {
        actor.updateAnimation(dt, false);
      }
    }

    // ── 타이머 대기 단계 ──
    if (this.waitingTimer > 0) {
      this.waitingTimer -= dt;
      if (this.waitingTimer <= 0) {
        this.currentStepIndex++;
        this.executeCurrentStep();
      }
    }
  }

  private executeCurrentStep(): void {
    if (this.currentStepIndex >= this.steps.length) {
      this.stop();
      if (this.host.onChapterComplete) this.host.onChapterComplete();
      return;
    }

    const step = this.steps[this.currentStepIndex];
    if (!step) {
      this.stop();
      return;
    }

    switch (step.step_type) {
      case 'dialogue': {
        const speaker = step.speaker ? tr(step.speaker) : '';
        const rawText = step.text || '';
        const translated = tr(rawText);

        this.host.hud.dialogue = {
          speaker,
          text: translated,
          portrait: step.speaker ? step.speaker.toLowerCase() : null,
        };

        this.host.audio.playVoice(
          rawText,
          step.id || step.speaker || 'narrator',
          step.chapter || '',
          () => {
            // 보이스 재생 종료
          },
        );
        this.waitingForAdvance = true;
        break;
      }

      case 'title': {
        const titleText = step.text ? tr(step.text) : '';
        this.host.hud.cinematicTitle = titleText || null;
        this.waitingTimer = titleText ? 2.2 : 0.05;
        break;
      }

      case 'wait': {
        const sec = typeof step.duration === 'number' ? (step.duration > 10 ? step.duration / 1000 : step.duration) : 0.5;
        this.waitingTimer = Math.max(0.05, sec);
        break;
      }

      case 'fade': {
        const duration = typeof step.duration === 'number' ? (step.duration > 10 ? step.duration / 1000 : step.duration) : 0.6;
        const fadeIn = Boolean(step.fade_in);
        this.host.hud.fadeTo(fadeIn, duration);
        this.waitingTimer = duration;
        break;
      }

      case 'tint': {
        const col = step.color;
        if (col && typeof col.r === 'number') {
          this.host.renderer.applyTint(col.r, col.g, col.b, col.a ?? 0.3);
        } else if (typeof step.preset === 'string') {
          this.host.renderer.applyTintPreset(step.preset as any);
        }
        this.nextStepImmediate();
        break;
      }

      case 'shake': {
        const dur = typeof step.duration === 'number' ? (step.duration > 10 ? step.duration / 1000 : step.duration) : 0.4;
        this.host.renderer.shake(step.intensity ?? 0.3, dur);
        this.waitingTimer = dur;
        break;
      }

      case 'play_bgm': {
        const fade = typeof step.fade === 'number' ? (step.fade > 10 ? step.fade / 1000 : step.fade) : 1.5;
        this.host.audio.playBgm(step.key, fade);
        this.nextStepImmediate();
        break;
      }

      case 'stop_bgm': {
        const fade = typeof step.fade === 'number' ? (step.fade > 10 ? step.fade / 1000 : step.fade) : 1.0;
        this.host.audio.stopBgm(fade);
        this.nextStepImmediate();
        break;
      }

      case 'play_sfx': {
        this.host.audio.playSfx(step.key);
        this.nextStepImmediate();
        break;
      }

      case 'play_ambience': {
        this.host.audio.playAmbience(step.key);
        this.nextStepImmediate();
        break;
      }

      case 'set_map': {
        if (this.host.onMapChange) {
          this.host.onMapChange(step.id, step.location || '');
        }
        this.nextStepImmediate();
        break;
      }

      case 'spawn': {
        const at = step.at || { x: 0, y: 0 };
        // Godot 그리드 좌표 (0~24)를 3D 월드 좌표 (-12~12)로 매핑
        const worldX = (at.x - 12) * 1.0;
        const worldZ = (at.y - 8) * 1.0;

        let actor = this.actors.get(step.id);
        if (!actor) {
          actor = new Actor(step.id, step.character || step.id);
          this.actors.set(step.id, actor);
          this.host.scene.add(actor.root);
        }
        actor.root.position.set(worldX, 0, worldZ);
        if (step.dir) actor.face(step.dir);
        this.nextStepImmediate();
        break;
      }

      case 'despawn': {
        const actor = this.actors.get(step.id);
        if (actor) {
          this.host.scene.remove(actor.root);
          actor.dispose();
          this.actors.delete(step.id);
        }
        this.nextStepImmediate();
        break;
      }

      case 'move_actor': {
        const actor = this.actors.get(step.id);
        if (actor && step.to) {
          const worldX = (step.to.x - 12) * 1.0;
          const worldZ = (step.to.y - 8) * 1.0;
          const speed = (step.speed ?? 24) * 0.15;
          this.movingActors.set(step.id, { toX: worldX, toZ: worldZ, speed });
          actor.setPose('walk');
        }
        this.nextStepImmediate();
        break;
      }

      case 'move_actors': {
        if (Array.isArray(step.moves)) {
          for (const m of step.moves) {
            const actor = this.actors.get(m.id);
            if (actor && m.to) {
              const worldX = (m.to.x - 12) * 1.0;
              const worldZ = (m.to.y - 8) * 1.0;
              const speed = (m.speed ?? 24) * 0.15;
              this.movingActors.set(m.id, { toX: worldX, toZ: worldZ, speed });
              actor.setPose('walk');
            }
          }
        }
        this.nextStepImmediate();
        break;
      }

      case 'face_actor': {
        const actor = this.actors.get(step.id);
        if (actor && step.dir) {
          actor.face(step.dir);
        }
        this.nextStepImmediate();
        break;
      }

      case 'rest_actor':
      case 'breathe_actor': {
        const actor = this.actors.get(step.id);
        if (actor) {
          actor.setPose(step.pose || 'stand');
        }
        this.nextStepImmediate();
        break;
      }

      case 'bubble': {
        const actor = this.actors.get(step.id);
        if (actor && step.type) {
          actor.showBubble(step.type as EmoteType);
        }
        this.nextStepImmediate();
        break;
      }

      case 'camera_move': {
        const dur = typeof step.duration === 'number' ? (step.duration > 10 ? step.duration / 1000 : step.duration) : 0.8;
        if (step.position) {
          const toX = ((step.position.x / 32) - 12) * 1.0;
          const toZ = ((step.position.y / 32) - 8) * 1.0;
          this.cameraTarget = {
            startX: this.host.renderer.camera.position.x,
            startZ: this.host.renderer.camera.position.z,
            toX,
            toZ,
            t: 0,
            dur,
          };
        }
        this.nextStepImmediate();
        break;
      }

      case 'camera_follow': {
        this.followingActorId = step.id || null;
        this.nextStepImmediate();
        break;
      }

      case 'equip_actor_action': {
        const actor = this.actors.get(step.id);
        if (actor && step.prop) {
          actor.attachProp(step.prop);
          if (step.pose) actor.setPose(step.pose as ActorPose);
        }
        this.nextStepImmediate();
        break;
      }

      case 'unequip_actor_action': {
        const actor = this.actors.get(step.id);
        if (actor) {
          actor.detachProp();
          actor.setPose('stand');
        }
        this.nextStepImmediate();
        break;
      }

      default:
        // 미구현 스텝 또는 보조 효과는 안전하게 다음으로 진행
        this.nextStepImmediate();
        break;
    }
  }

  private nextStepImmediate(): void {
    this.currentStepIndex++;
    this.executeCurrentStep();
  }

  getActor(id: string): Actor | undefined {
    return this.actors.get(id);
  }

  clearAllActors(): void {
    for (const [, actor] of this.actors) {
      this.host.scene.remove(actor.root);
      actor.dispose();
    }
    this.actors.clear();
    this.movingActors.clear();
  }
}
