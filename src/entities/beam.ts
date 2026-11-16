import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { FxLevel } from '../renderer/fx';
import { PAL } from '../world/palette';
import { VoxelBuilder } from '../world/voxel';

/**
 * 하늘에서 내려오는 빛기둥 (부르심·문 닫힘 컷신).
 * 더하기 섞기 기둥 세 겹 + 내려앉는 빛 알갱이. 주변 조명은 DayNight의 기존 광원 풀을 빌린다.
 */
export class Beam {
  /** 루트: 항상 보임. position = 컷신 빛기둥 자리 (조명이 읽는다). 안내 표식은 이 아래에서 월드 좌표로 보정 */
  readonly group = new THREE.Group();
  private readonly pillar = new THREE.Group();
  private readonly layers: THREE.Mesh[] = [];
  private readonly motes: { m: THREE.Mesh; y: number; sp: number; ox: number; oz: number }[] = [];
  private readonly ring: THREE.Mesh;
  /** 0~1: 켜진 정도 (컷신이 서서히 올리고 내림) */
  strength = 0;
  private t = 0;

  constructor(radius = 0.6, height = 7) {
    const rng = new Rng(77);
    for (const [k, op] of [[1, 0.08], [0.62, 0.12], [0.3, 0.2]] as const) {
      const m = new THREE.Mesh(
        // 팔각기둥, 위쪽이 조금 넓어 하늘에서 쏟아지는 느낌
        new THREE.CylinderGeometry(radius * k * 1.25, radius * k, height, 8, 1, true).translate(0, height / 2, 0),
        new THREE.MeshBasicMaterial({ color: PAL.plaster[3], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      m.userData.op = op;
      this.layers.push(m);
      this.pillar.add(m);
    }
    this.ring = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.5, radius * 1.5, 0.02, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.straw[3]).multiplyScalar(1.8), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    this.ring.position.y = 0.02;
    this.pillar.add(this.ring);
    const moteGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const moteMat = new THREE.MeshBasicMaterial({ color: PAL.straw[3], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(moteGeo, moteMat);
      this.motes.push({ m, y: rng.range(0, 6), sp: rng.range(0.6, 1.4), ox: rng.range(-radius, radius), oz: rng.range(-radius, radius) });
      this.pillar.add(m);
    }
    this.group.add(this.pillar);
    this.pillar.visible = false;
    this.guideRing = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.5, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.straw[3]).multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    this.guideRing.position.y = 0.03;
    this.guideColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.16, 1.7, 6, 1, true).translate(0, 0.85, 0),
      new THREE.MeshBasicMaterial({ color: PAL.straw[3], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.guideColumn.visible = false;
    this.guideGroup.add(this.guideRing, this.guideColumn);
    this.guideGroup.visible = false;
    this.group.add(this.guideGroup);
  }

  at(x: number, z: number) {
    this.group.position.set(x, 0, z);
  }

  // ── 목표 안내 표식 (컷신 빛기둥과 별개): 평소엔 바닥의 작은 고리만, 가만히 있거나 목표가 바뀌면 가늘고 짧은 빛줄기가 잠깐 오른다 ──
  readonly guideGroup = new THREE.Group();
  private readonly guideRing: THREE.Mesh;
  private readonly guideColumn: THREE.Mesh;
  private guideLevel = 0;
  private guideBeamLevel = 0;
  private guideIdle = 0;
  private guideHint = 0;
  private guideX = 0;
  private guideZ = 0;
  private guideHas = false;
  private guideLastPx = 1e9;
  private guideLastPz = 1e9;
  private guideT = 0;

  /**
   * 프레임마다 호출. active=false(대화·컷신·메뉴)면 즉시 사라지는 쪽으로 간다.
   * 할당 없음 — 숫자 필드만 갱신.
   */
  updateGuide(dt: number, active: boolean, has: boolean, tx: number, tz: number, px: number, pz: number) {
    this.guideT += dt;
    if (has && (!this.guideHas || Math.abs(tx - this.guideX) + Math.abs(tz - this.guideZ) > 0.4)) {
      this.guideHint = 6; // 목표가 바뀜: 잠깐 줄기로 알린다
      this.guideIdle = 0;
    }
    this.guideHas = has;
    if (has) { this.guideX = tx; this.guideZ = tz; }
    const moved = Math.abs(px - this.guideLastPx) + Math.abs(pz - this.guideLastPz) > 0.02;
    this.guideLastPx = px; this.guideLastPz = pz;
    if (moved) this.guideIdle = 0; else this.guideIdle += dt;
    if (this.guideHint > 0) this.guideHint -= dt;
    const show = active && has;
    const wantBeam = show && (this.guideIdle >= 4 || this.guideHint > 0);
    // 목표 앞에 거의 다 왔으면 줄기는 접는다
    const near = Math.abs(px - this.guideX) + Math.abs(pz - this.guideZ) < 2.2;
    const k = Math.min(1, dt * (show ? 2.5 : 8));
    this.guideLevel += ((show ? 1 : 0) - this.guideLevel) * k;
    this.guideBeamLevel += ((wantBeam && !near ? 1 : 0) - this.guideBeamLevel) * Math.min(1, dt * (wantBeam ? 1.6 : 4));
    const vis = this.guideLevel > 0.02;
    this.guideGroup.visible = vis;
    if (!vis) return;
    this.guideGroup.position.set(this.guideX - this.group.position.x, 0, this.guideZ - this.group.position.z);
    const soft = 0.75 + Math.sin(this.guideT * 2.2) * 0.25;
    (this.guideRing.material as THREE.MeshBasicMaterial).opacity = 0.34 * this.guideLevel * (0.8 + 0.2 * soft);
    const colOn = this.guideBeamLevel > 0.02;
    this.guideColumn.visible = colOn;
    if (colOn) (this.guideColumn.material as THREE.MeshBasicMaterial).opacity = 0.16 * this.guideBeamLevel * soft;
  }

  update(dt: number) {
    this.t += dt;
    this.pillar.visible = this.strength > 0.01;
    if (!this.pillar.visible) return;
    // 계단진 숨결 (여섯 단계로 끊어 픽셀 느낌)
    const pulse = Math.round((0.85 + Math.sin(this.t * 1.6) * 0.15) * 6) / 6;
    const layers = this.layers;
    for (let i = 0; i < layers.length; i++) { const l = layers[i]; (l.material as THREE.MeshBasicMaterial).opacity = (l.userData.op as number) * this.strength * pulse; }
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 * this.strength * pulse;
    const mm = this.motes[0].m.material as THREE.MeshBasicMaterial;
    mm.opacity = 0.9 * this.strength;
    const motes = this.motes;
    for (let i = 0; i < motes.length; i++) {
      const p = motes[i];
      p.y -= p.sp * dt;
      if (p.y < 0) p.y += 6;
      p.m.position.set(p.ox + Math.sin(this.t + p.y) * 0.05, p.y, p.oz);
    }
  }
}

/**
 * 방주 옆구리 문: 어두운 문간(어두운 면)과 경첩 달린 문짝. 방주 모델에는 문짝이 없고(바다 위 컷 제외) 이 문이 열리고 닫힘.
 * 마을에서는 방주를 다 지은 뒤 보이고(짐승을 태울 때 열려 있음), 문 닫힘 컷신이 닫으면 방주 안으로 넘어가며 치운다.
 */
export class ArkDoor {
  readonly group = new THREE.Group();
  private readonly hinge = new THREE.Group();
  private readonly gap: THREE.Mesh;
  /** 1 = 활짝 열림, 0 = 닫힘 */
  open = 1;

  /** (ax, az) = 문짝 위치 기준 */
  constructor(ax = 0, az = 0) {
    const dx = 1.4, z = 2.0;
    this.gap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.75, 0.04), new THREE.MeshBasicMaterial({ color: 0x2a1c14 }));
    this.gap.position.set(ax + dx, 0.94 + 0.875, az + z + 0.11);
    // 선체와 같은 나무 질감의 세로 널빤지 문짝 + 가로대·쇠 손잡이 (경첩 기준 좌표)
    const lb = new VoxelBuilder(7711, false);
    for (let i = 0; i < 5; i++) lb.box(0.11 + i * 0.22, 0, 0, 0.215, 1.75, 0.08, PAL.wood[2 + i % 2], { tex: 'wood', ao: false, jitter: 0.05 });
    for (const y of [0.3, 1.3]) lb.box(0.55, y, 0.05, 1.1, 0.12, 0.05, PAL.wood[1], { tex: 'wood', ao: false });
    for (const y of [0.34, 1.34]) lb.box(0.06, y, 0.08, 0.14, 0.05, 0.02, PAL.stone[1], { tex: 'metal', ao: false, jitter: 0 });
    lb.box(0.95, 0.85, 0.08, 0.1, 0.14, 0.04, PAL.stone[2], { tex: 'metal', ao: false, jitter: 0 });
    this.hinge.add(lb.build(true, true));
    this.hinge.position.set(ax + dx - 0.55, 0.94, az + z + 0.14);
    this.group.add(this.gap, this.hinge);
    this.group.visible = false;
  }

  update() {
    // 문짝은 문간 앞쪽(+z)으로 열려 있다가 닫힘. 여섯 단계로 끊어서
    const k = Math.round(this.open * 6) / 6;
    this.hinge.rotation.y = -k * 1.7;
  }
}

/** 제단 연기: 따뜻한 밑불 불티와 두 톤의 향연이 천천히 솟으며 커지고 옅어짐 (광원 아님) */
export class Smoke {
  readonly group = new THREE.Group();
  private readonly puffs: { m: THREE.Mesh; t: number; warm: boolean }[] = [];
  private readonly embers: { m: THREE.Mesh; t: number; ox: number; oz: number }[] = [];
  on = false;
  constructor(x: number, y: number, z: number) {
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    for (let i = 0; i < 14; i++) {
      const warm = i % 3 === 0;
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: warm ? 0xe8dfd0 : PAL.stone[3], transparent: true, opacity: 0, depthWrite: false,
      }));
      this.group.add(m);
      this.puffs.push({ m, t: i * (3.4 / 14), warm });
    }
    const emberGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xffc864, transparent: true, opacity: 0.9, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(emberGeo, emberMat);
      const a = (i / 6) * Math.PI * 2;
      this.group.add(m);
      this.embers.push({ m, t: i * 0.28, ox: Math.cos(a) * 0.16, oz: Math.sin(a) * 0.12 });
    }
    this.group.position.set(x, y, z);
  }
  update(dt: number, fx: FxLevel = 'normal') {
    this.group.visible = this.on;
    if (!this.on) return;
    const puffs = this.puffs, embers = this.embers;
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      p.t = (p.t + dt) % 3.4;
      const k = p.t / 3.4;
      const stepK = Math.floor(k * 24) / 24;
      p.m.position.set(Math.sin(p.t * 1.4 + (p.warm ? 1 : 0)) * 0.14 + stepK * 0.34, stepK * 3.1, Math.cos(p.t * 1.1) * 0.09);
      p.m.scale.setScalar(0.65 + stepK * 1.75);
      (p.m.material as THREE.MeshBasicMaterial).opacity = (k < 0.15 ? k / 0.15 : 1 - k) * (p.warm ? 0.48 : 0.58);
    }
    if (fx === 'off') {
      for (let i = 0; i < embers.length; i++) embers[i].m.visible = false;
      return;
    }
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      e.t = (e.t + dt) % 1.5;
      const k = e.t / 1.5;
      e.m.position.set(e.ox + Math.sin(e.t * 5) * 0.04, 0.05 + k * 1.15, e.oz + Math.cos(e.t * 4) * 0.04);
      e.m.visible = k < 0.85 && ((e.t * 10) | 0) % 4 !== 0;
    }
  }
}
