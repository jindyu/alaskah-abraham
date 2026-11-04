import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { FxLevel } from '../renderer/fx';

const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
// 속불(노랑) → 겉불(빨강). 채도를 높여 밝게 비친 바닥과 구분되게
const COLORS = [0xffe060, 0xffa020, 0xf06018, 0xc83014];

/**
 * 모닥불 불꽃: 작은 발광 상자들이 8fps로 계단식으로 일렁이고, 불티가 올라간다.
 * (부드러운 보간 대신 프레임 스텝 → 픽셀아트 애니메이션 느낌)
 */
export class Flames {
  readonly group = new THREE.Group();
  private readonly tongues: { mesh: THREE.Mesh; ox: number; oz: number; base: number; seed: number }[] = [];
  private readonly sparks: { mesh: THREE.Mesh; t: number; life: number; vx: number; vz: number }[] = [];
  private readonly wisps: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number }[] = [];
  private step = -1;
  private readonly rng: Rng;

  constructor(x: number, z: number, seed = 1, withSmoke = false) {
    this.rng = new Rng(seed);
    this.group.position.set(x, 0.05, z);
    const layout: [number, number, number, number][] = [
      // ox, oz, 기본 높이, 색 인덱스(바깥=빨강 → 속=노랑)
      [0, 0.02, 0.62, 0], [0.12, 0.05, 0.72, 1], [-0.12, -0.04, 0.68, 1], [0.06, -0.14, 0.52, 2],
      [-0.1, 0.14, 0.5, 2], [0.2, -0.08, 0.36, 3], [-0.2, 0.06, 0.34, 3], [0.02, 0.2, 0.3, 3],
      [0.0, -0.2, 0.3, 3], [0.02, 0.0, 0.4, 0],
    ];
    layout.forEach(([ox, oz, h, ci], i) => {
      const w = ci === 0 ? 0.1 : ci === 1 ? 0.19 : 0.17;
      const mesh = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: COLORS[ci] }));
      mesh.scale.set(w, h, w);
      mesh.position.set(ox, 0, oz);
      // 안쪽 밝은 불꽃이 먼저 그려져도 가려지지 않게 약간 앞으로
      mesh.renderOrder = 5 - ci;
      this.group.add(mesh);
      this.tongues.push({ mesh, ox, oz, base: h, seed: i * 1.7 });
    });
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xffc050 }));
      mesh.scale.setScalar(0.05);
      this.group.add(mesh);
      this.sparks.push({ mesh, t: this.rng.range(0, 1.4), life: this.rng.range(0.9, 1.5), vx: 0, vz: 0 });
    }
    // 바깥 모닥불 위로만 피어오르는 옅은 연기 조각 넷 (실내 가마솥·후드 및 제단 연기와 겹치지 않게)
    if (withSmoke) {
      for (let i = 0; i < 4; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xc8beb0, transparent: true, opacity: 0, depthWrite: false });
        const mesh = new THREE.Mesh(BOX, mat);
        this.group.add(mesh);
        this.wisps.push({ mesh, mat, t: i * 0.55 });
      }
    }
  }

  update(dt: number, time: number, fx: FxLevel = 'normal') {
    const st = Math.floor(time * 8);
    if (st !== this.step) {
      this.step = st;
      for (const t of this.tongues) {
        const n = Math.sin(st * 1.9 + t.seed * 3.3) * 0.5 + Math.sin(st * 0.7 + t.seed) * 0.5;
        t.mesh.scale.y = t.base * (0.75 + 0.35 * (n * 0.5 + 0.5));
        t.mesh.position.x = t.ox + (((st + t.seed * 10) | 0) % 3 - 1) * 0.02;
      }
    }
    for (const s of this.sparks) {
      s.t += dt;
      if (s.t > s.life) {
        s.t = 0;
        s.life = this.rng.range(0.9, 1.6);
        s.vx = this.rng.range(-0.15, 0.15);
        s.vz = this.rng.range(-0.15, 0.15);
      }
      const k = s.t / s.life;
      s.mesh.position.set(s.vx * s.t + Math.sin(s.t * 6 + s.life * 9) * 0.05, 0.3 + s.t * 1.1, s.vz * s.t);
      s.mesh.visible = k < 0.9 && ((s.t * 12) | 0) % 5 !== 0; // 깜빡이며 사그라듦
    }
    if (fx === 'off') {
      for (let i = 0; i < this.wisps.length; i++) this.wisps[i].mesh.visible = false;
      return;
    }
    for (let i = 0; i < this.wisps.length; i++) {
      const w = this.wisps[i];
      w.t = (w.t + dt) % 2.2;
      const k = w.t / 2.2;
      const stepK = Math.floor(k * 16) / 16;
      w.mesh.visible = true;
      w.mesh.position.set(Math.sin(w.t * 2 + i) * 0.08 + stepK * 0.12, 0.85 + stepK * 1.35, Math.cos(w.t * 1.6 + i) * 0.06);
      w.mesh.scale.setScalar(0.11 + stepK * 0.14);
      w.mat.opacity = (k < 0.2 ? k / 0.2 : 1 - k) * 0.24;
    }
  }
}
