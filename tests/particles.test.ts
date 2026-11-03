import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ParticleManager, type ParticleEffectType } from '../src/renderer/particles';
import { Actor } from '../src/entities/actor';
import { CutsceneEngine } from '../src/systems/cutscene/cutsceneEngine';
import { AudioManager } from '../src/audio/audioManager';
import { CrowdManager } from '../src/entities/crowd';

describe('그래픽 및 파티클 이펙트 시스템 (Graphics & VFX)', () => {
  it('ParticleManager 가 8대 핵심 파티클 이펙트를 제로 메모리 누수로 방출하고 업데이트한다', () => {
    const pm = new ParticleManager();
    expect(pm.group).toBeInstanceOf(THREE.Group);

    const effects: ParticleEffectType[] = [
      'collapse_dust',
      'impact_dust',
      'embers',
      'trail_dust',
      'charge_dust',
      'fallen_haze',
      'glory_sparkles',
      'altar_smoke',
    ];

    for (const eff of effects) {
      pm.emit(eff, 0, 1, 0, 10);
    }

    // 인스턴스 메시 카운트가 활성 파티클 수로 갱신되는지 확인
    pm.update(0.016);
    const mesh = pm.group.children[0] as THREE.InstancedMesh;
    expect(mesh.count).toBeGreaterThan(0);

    // 시간 경과에 따른 수명 소진 및 소멸
    for (let i = 0; i < 300; i++) {
      pm.update(0.016);
    }

    // 정리
    pm.clear();
    expect(mesh.count).toBe(0);
    pm.dispose();
  });

  it('Actor 의 spin, rotate, swingEquippedAction 메소드가 회전 및 애니메이션을 동작시킨다', () => {
    const actor = new Actor('test_actor', 'abram');

    // 1. rotate (각도 z축 회전)
    actor.rotate(-90);
    expect(actor.root.rotation.z).toBeCloseTo(-Math.PI / 2);

    // 2. spin (회전 턴)
    actor.spin(1, 0.2, true);
    actor.updateAnimation(0.1, false);
    expect(actor.root.rotation.y).not.toBe(0);

    // 3. swingEquippedAction (도끼 휘두르기 액션)
    actor.attachProp('axe');
    actor.swingEquippedAction('left');
    expect(actor.facing).toBeCloseTo(Math.PI / 2);

    actor.updateAnimation(0.05, false);
    actor.updateAnimation(0.35, false); // 휘두르기 완료

    actor.dispose();
  });

  it('CutsceneEngine 이 particles, flash, spin_actor, play_equipped_action 스텝을 원활히 처리한다', () => {
    const scene = new THREE.Scene();
    const pm = new ParticleManager();
    const audio = new AudioManager();
    const crowd = new CrowdManager();

    const mockFlash = vi.fn();
    const mockHud: any = {
      flash: mockFlash,
      dialogue: null,
      cinematicTitle: null,
      fadeTo: () => {},
    };

    // mock renderer
    const renderer: any = {
      camera: new THREE.PerspectiveCamera(),
      follow: () => {},
      shake: () => {},
      applyTint: () => {},
      applyTintPreset: () => {},
    };

    const engine = new CutsceneEngine({
      scene,
      renderer,
      hud: mockHud,
      audio,
      crowd,
      particles: pm,
    });

    // 연출 시퀀스 실행
    engine.playSequence([
      { step_type: 'spawn', id: 'abram', character: 'abram', at: { x: 12, y: 8 } },
      { step_type: 'flash', color: { r: 1, g: 1, b: 0.8, a: 1 }, duration: 0.2 },
      { step_type: 'particles', effect: 'impact_dust', at: { x: 12, y: 8 }, amount: 12 },
      { step_type: 'spin_actor', id: 'abram', turns: 1, seconds_per_turn: 0.1 },
      { step_type: 'play_equipped_action', id: 'abram', face: 'down' },
      { step_type: 'wait', duration: 1.0 },
    ]);

    expect(engine.running).toBe(true);
    expect(mockFlash).toHaveBeenCalledTimes(1);

    engine.update(0.05);
    pm.update(0.05);

    const mesh = pm.group.children[0] as THREE.InstancedMesh;
    expect(mesh.count).toBeGreaterThan(0);

    engine.stop();
    pm.dispose();
  });
});
