import * as THREE from 'three';

export type ParticleEffectType =
  | 'collapse_dust'
  | 'impact_dust'
  | 'embers'
  | 'trail_dust'
  | 'charge_dust'
  | 'fallen_haze'
  | 'glory_sparkles'
  | 'altar_smoke';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  baseSize: number;
  r: number;
  g: number;
  b: number;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
}

const MAX_PARTICLES = 600;

export class ParticleManager {
  readonly group: THREE.Group;
  private instancedMesh: THREE.InstancedMesh;
  private particles: Particle[];
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'particle_system';

    // 16-texel voxel look small cube
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
    });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0;
    this.group.add(this.instancedMesh);

    this.particles = new Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles[i] = {
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 1,
        baseSize: 1,
        r: 1,
        g: 1,
        b: 1,
        life: 0,
        maxLife: 1,
        gravity: 0,
        drag: 0.98,
      };
    }
  }

  /** 파티클 그룹 방출 */
  emit(
    effect: ParticleEffectType | string,
    x: number,
    y: number,
    z: number,
    amount = 16,
    customColor?: { r: number; g: number; b: number },
  ): void {
    const eff = (effect || 'impact_dust') as ParticleEffectType;
    let count = 0;

    for (let i = 0; i < MAX_PARTICLES && count < amount; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.4;
      p.y = y + (Math.random() - 0.5) * 0.2;
      p.z = z + (Math.random() - 0.5) * 0.4;

      switch (eff) {
        case 'collapse_dust': {
          // 바벨탑 붕괴 대형 먼지구름
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.8 + Math.random() * 2.2;
          p.vx = Math.cos(angle) * speed;
          p.vy = 0.5 + Math.random() * 2.0;
          p.vz = Math.sin(angle) * speed;
          p.baseSize = 1.4 + Math.random() * 1.8;
          p.size = p.baseSize;
          p.r = 0.72; p.g = 0.65; p.b = 0.54; // 벽돌 먼지 황토색
          p.life = 1.2 + Math.random() * 1.5;
          p.maxLife = p.life;
          p.gravity = -0.4;
          p.drag = 0.94;
          break;
        }

        case 'impact_dust': {
          // 우상 타격 파편 먼지
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.2 + Math.random() * 2.4;
          p.vx = Math.cos(angle) * speed;
          p.vy = 1.0 + Math.random() * 2.0;
          p.vz = Math.sin(angle) * speed;
          p.baseSize = 0.8 + Math.random() * 0.8;
          p.size = p.baseSize;
          p.r = 0.85; p.g = 0.78; p.b = 0.68;
          p.life = 0.5 + Math.random() * 0.6;
          p.maxLife = p.life;
          p.gravity = -4.5;
          p.drag = 0.92;
          break;
        }

        case 'embers': {
          // 풀무불 & 소돔 유황 불씨
          p.vx = (Math.random() - 0.5) * 1.2;
          p.vy = 0.8 + Math.random() * 2.5; // 위로 상승
          p.vz = (Math.random() - 0.5) * 1.2;
          p.baseSize = 0.6 + Math.random() * 0.8;
          p.size = p.baseSize;
          p.r = 1.0; p.g = 0.35 + Math.random() * 0.45; p.b = 0.05; // 주황~황금 불꽃
          p.life = 1.0 + Math.random() * 1.2;
          p.maxLife = p.life;
          p.gravity = 0.3; // 부력으로 위로 가속
          p.drag = 0.96;
          break;
        }

        case 'trail_dust': {
          // 발걸음 모래 먼지
          p.vx = (Math.random() - 0.5) * 0.5;
          p.vy = 0.2 + Math.random() * 0.4;
          p.vz = (Math.random() - 0.5) * 0.5;
          p.baseSize = 0.5 + Math.random() * 0.5;
          p.size = p.baseSize;
          p.r = 0.8; p.g = 0.72; p.b = 0.6;
          p.life = 0.4 + Math.random() * 0.4;
          p.maxLife = p.life;
          p.gravity = -0.8;
          p.drag = 0.90;
          break;
        }

        case 'charge_dust': {
          // 싯딤 골짜기 전투 & 호바 기습 군중 돌격 먼지
          p.vx = (Math.random() - 0.5) * 1.8;
          p.vy = 0.4 + Math.random() * 1.2;
          p.vz = (Math.random() - 0.5) * 1.8;
          p.baseSize = 1.0 + Math.random() * 1.2;
          p.size = p.baseSize;
          p.r = 0.75; p.g = 0.68; p.b = 0.55;
          p.life = 0.8 + Math.random() * 0.8;
          p.maxLife = p.life;
          p.gravity = -0.5;
          p.drag = 0.94;
          break;
        }

        case 'fallen_haze': {
          // 전장 안개 & 지면 아지랑이
          p.vx = (Math.random() - 0.5) * 0.3;
          p.vy = 0.1 + Math.random() * 0.2;
          p.vz = (Math.random() - 0.5) * 0.3;
          p.baseSize = 1.5 + Math.random() * 1.5;
          p.size = p.baseSize;
          p.r = 0.6; p.g = 0.58; p.b = 0.55;
          p.life = 2.0 + Math.random() * 1.5;
          p.maxLife = p.life;
          p.gravity = 0;
          p.drag = 0.98;
          break;
        }

        case 'glory_sparkles': {
          // 뭇별 언약 & 모리아 영광의 구름 신성한 금빛 반짝임
          p.vx = (Math.random() - 0.5) * 0.8;
          p.vy = 0.3 + Math.random() * 1.2;
          p.vz = (Math.random() - 0.5) * 0.8;
          p.baseSize = 0.8 + Math.random() * 0.9;
          p.size = p.baseSize;
          p.r = 1.0; p.g = 0.88; p.b = 0.32; // 황금빛
          p.life = 1.2 + Math.random() * 1.0;
          p.maxLife = p.life;
          p.gravity = 0.1;
          p.drag = 0.96;
          break;
        }

        case 'altar_smoke': {
          // 세겜/벧엘/모리아 번제단 하늘로 오르는 연기
          p.vx = (Math.random() - 0.5) * 0.25;
          p.vy = 0.6 + Math.random() * 1.4; // 수직 상승
          p.vz = (Math.random() - 0.5) * 0.25;
          p.baseSize = 0.9 + Math.random() * 1.2;
          p.size = p.baseSize;
          p.r = 0.92; p.g = 0.92; p.b = 0.94; // 흰 연기
          p.life = 1.8 + Math.random() * 1.4;
          p.maxLife = p.life;
          p.gravity = 0.25;
          p.drag = 0.97;
          break;
        }

        default: {
          p.vx = (Math.random() - 0.5) * 1.0;
          p.vy = 0.5 + Math.random() * 1.0;
          p.vz = (Math.random() - 0.5) * 1.0;
          p.baseSize = 0.8;
          p.size = 0.8;
          p.r = 0.8; p.g = 0.8; p.b = 0.8;
          p.life = 0.8;
          p.maxLife = 0.8;
          p.gravity = -1.0;
          p.drag = 0.95;
        }
      }

      if (customColor) {
        p.r = customColor.r;
        p.g = customColor.g;
        p.b = customColor.b;
      }

      count++;
    }
  }

  /** 프레임 업데이트 (제로 힙 할당) */
  update(dt: number): void {
    let activeCount = 0;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vz *= p.drag;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // 수명에 따라 크기 조절 (등장 시 확대, 후반에 축소)
      const prog = p.life / p.maxLife; // 1 -> 0
      p.size = p.baseSize * Math.sin(prog * Math.PI);

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.set(p.size, p.size, p.size);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(activeCount, this.dummy.matrix);

      this.color.setRGB(p.r, p.g, p.b);
      this.instancedMesh.setColorAt(activeCount, this.color);

      activeCount++;
    }

    this.instancedMesh.count = activeCount;
    if (activeCount > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /** 모든 파티클 초기화 */
  clear(): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles[i].active = false;
    }
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.clear();
    this.instancedMesh.geometry.dispose();
    if (Array.isArray(this.instancedMesh.material)) {
      this.instancedMesh.material.forEach((m) => m.dispose());
    } else {
      this.instancedMesh.material.dispose();
    }
  }
}
