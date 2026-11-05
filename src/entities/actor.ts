import * as THREE from 'three';
import { VoxelBuilder } from '../world/voxel';
import { PAL } from '../world/palette';
import { getCast, type CastMember } from './cast';

export type ActorPose =
  | 'stand'
  | 'walk'
  | 'kneel'
  | 'fallen'
  | 'pray'
  | 'carry_wood'
  | 'swing_axe'
  | 'offer'
  | 'bound'
  | 'cower'
  | 'command'
  | 'sit_throne';

export type EmoteType = '!' | '?' | '...' | 'heart' | 'anger' | 'sweat';

export class Actor {
  readonly id: string;
  readonly cast: CastMember;
  readonly root = new THREE.Group();

  private head = new THREE.Group();
  private body = new THREE.Group();
  private leftArm = new THREE.Group();
  private rightArm = new THREE.Group();
  private leftLeg = new THREE.Group();
  private rightLeg = new THREE.Group();
  private propContainer = new THREE.Group();
  private bubbleContainer = new THREE.Group();
  private wingsLeft?: THREE.Group;
  private wingsRight?: THREE.Group;
  private halo?: THREE.Group;
  private ropeMesh?: THREE.Group;

  private pose: ActorPose = 'stand';
  private walkTime = 0;
  private currentProp: string | null = null;
  private emote: { type: EmoteType; life: number } | null = null;
  private spinState: { speed: number; elapsed: number; duration: number } | null = null;
  private swingTimer = 0;

  facing = 0; // 라디안 (0 = 남쪽/앞)

  constructor(id: string, castId?: string) {
    this.id = id;
    this.cast = getCast(castId || id);
    this.buildMesh();
  }

  private buildMesh(): void {
    const c = this.cast;
    const s = c.scale;
    this.root.scale.set(s, s, s);

    // ── 다리 ──
    const legBuilderL = new VoxelBuilder(11, false);
    legBuilderL.box(0, -0.3, 0, 0.2, 0.6, 0.22, c.skinColor, { tex: 'soil' });
    this.leftLeg.add(legBuilderL.build());
    this.leftLeg.position.set(-0.14, 0.6, 0);

    const legBuilderR = new VoxelBuilder(11, false);
    legBuilderR.box(0, -0.3, 0, 0.2, 0.6, 0.22, c.skinColor, { tex: 'soil' });
    this.rightLeg.add(legBuilderR.build());
    this.rightLeg.position.set(0.14, 0.6, 0);

    // ── 몸통 (튜닉 + 허리띠) ──
    const bodyBuilder = new VoxelBuilder(11, false);
    // 튜닉
    bodyBuilder.box(0, 0.35, 0, 0.52, 0.7, 0.32, c.tunicColor, { tex: 'fabricCream' });
    // 허리띠
    bodyBuilder.box(0, 0.25, 0, 0.54, 0.12, 0.34, c.accentColor, { tex: 'stripeSaffron' });
    this.body.add(bodyBuilder.build());
    this.body.position.set(0, 0.6, 0);

    // ── 팔 ──
    const armBuilderL = new VoxelBuilder(11, false);
    armBuilderL.box(0, -0.25, 0, 0.15, 0.55, 0.18, c.tunicColor, { tex: 'fabricCream' });
    armBuilderL.box(0, -0.5, 0, 0.13, 0.15, 0.15, c.skinColor);
    this.leftArm.add(armBuilderL.build());
    this.leftArm.position.set(-0.35, 0.6, 0);

    const armBuilderR = new VoxelBuilder(11, false);
    armBuilderR.box(0, -0.25, 0, 0.15, 0.55, 0.18, c.tunicColor, { tex: 'fabricCream' });
    armBuilderR.box(0, -0.5, 0, 0.13, 0.15, 0.15, c.skinColor);
    this.rightArm.add(armBuilderR.build());
    this.rightArm.position.set(0.35, 0.6, 0);

    // 손 소품 슬롯
    this.propContainer.position.set(0, -0.45, 0.1);
    this.rightArm.add(this.propContainer);

    // ── 머리 (얼굴 + 머리카락 + 수염 + 두건) ──
    const headBuilder = new VoxelBuilder(11, false);
    // 얼굴
    headBuilder.box(0, 0.22, 0, 0.38, 0.38, 0.38, c.skinColor);
    // 눈 (검은 픽셀)
    headBuilder.box(-0.09, 0.23, 0.2, 0.05, 0.05, 0.02, 0x111111);
    headBuilder.box(0.09, 0.23, 0.2, 0.05, 0.05, 0.02, 0x111111);
    // 머리카락
    headBuilder.box(0, 0.36, -0.04, 0.42, 0.18, 0.42, c.hairColor);

    // 수염
    if (c.beardColor) {
      headBuilder.box(0, 0.08, 0.12, 0.36, 0.22, 0.22, c.beardColor);
    }

    // 모자/장식
    if (c.headpiece === 'crown') {
      headBuilder.box(0, 0.46, 0, 0.44, 0.12, 0.44, 0xf5c022);
    } else if (c.headpiece === 'turban') {
      headBuilder.box(0, 0.44, 0, 0.44, 0.16, 0.44, c.accentColor, { tex: 'fabricCream' });
    } else if (c.headpiece === 'veil') {
      headBuilder.box(0, 0.38, -0.08, 0.46, 0.5, 0.42, c.accentColor, { tex: 'fabricCream' });
    } else if (c.headpiece === 'band') {
      headBuilder.box(0, 0.38, 0, 0.42, 0.06, 0.42, c.accentColor);
    }

    this.head.add(headBuilder.build());
    this.head.position.set(0, 1.25, 0);

    // 머리 위 말풍선 컨테이너
    this.bubbleContainer.position.set(0, 1.85, 0);

    // ── 천사 전용: 날개와 황금 후광 (Angel Wings & Golden Halo) ──
    if (c.id === 'angel' || this.id.includes('angel')) {
      const wingMat = { tex: 'fabricCream' as const };
      // 좌측 날개
      const leftWingGroup = new THREE.Group();
      const lb = new VoxelBuilder(11, false);
      lb.box(-0.15, 0.25, -0.15, 0.12, 0.45, 0.12, 0xffffff, wingMat);
      lb.box(-0.32, 0.50, -0.22, 0.10, 0.65, 0.30, 0xffffff, wingMat);
      lb.box(-0.48, 0.72, -0.26, 0.08, 0.75, 0.26, 0xffffff, wingMat);
      lb.box(-0.42, 0.82, -0.24, 0.06, 0.22, 0.14, 0xffdf78); // 황금 깃털 테두리
      leftWingGroup.add(lb.build());
      leftWingGroup.position.set(-0.18, 0.45, -0.18);
      leftWingGroup.rotation.y = -0.25;
      this.wingsLeft = leftWingGroup;
      this.body.add(leftWingGroup);

      // 우측 날개
      const rightWingGroup = new THREE.Group();
      const rb = new VoxelBuilder(11, false);
      rb.box(0.15, 0.25, -0.15, 0.12, 0.45, 0.12, 0xffffff, wingMat);
      rb.box(0.32, 0.50, -0.22, 0.10, 0.65, 0.30, 0xffffff, wingMat);
      rb.box(0.48, 0.72, -0.26, 0.08, 0.75, 0.26, 0xffffff, wingMat);
      rb.box(0.42, 0.82, -0.24, 0.06, 0.22, 0.14, 0xffdf78); // 황금 깃털 테두리
      rightWingGroup.add(rb.build());
      rightWingGroup.position.set(0.18, 0.45, -0.18);
      rightWingGroup.rotation.y = 0.25;
      this.wingsRight = rightWingGroup;
      this.body.add(rightWingGroup);

      // 황금 후광 (Halo)
      const haloGroup = new THREE.Group();
      const hb = new VoxelBuilder(9, false);
      hb.box(0, 0.56, 0.18, 0.38, 0.05, 0.05, 0xffdf78);
      hb.box(0, 0.56, -0.18, 0.38, 0.05, 0.05, 0xffdf78);
      hb.box(-0.19, 0.56, 0, 0.05, 0.05, 0.38, 0xffdf78);
      hb.box(0.19, 0.56, 0, 0.05, 0.05, 0.38, 0xffdf78);
      haloGroup.add(hb.build());
      this.halo = haloGroup;
      this.head.add(haloGroup);
    }

    // 결박용 밧줄 메쉬 (기본 숨김)
    const ropeB = new VoxelBuilder(11, false);
    ropeB.box(0, 0.35, 0, 0.56, 0.34, 0.36, 0x7c5535, { tex: 'soil' });
    this.ropeMesh = ropeB.build();
    this.ropeMesh.visible = false;
    this.body.add(this.ropeMesh);

    // 계층 조립
    this.body.add(this.head);
    this.body.add(this.leftArm);
    this.body.add(this.rightArm);
    this.body.add(this.bubbleContainer);

    this.root.add(this.leftLeg);
    this.root.add(this.rightLeg);
    this.root.add(this.body);

    if (c.defaultProp) {
      this.attachProp(c.defaultProp);
    }
  }

  setPose(pose: ActorPose): void {
    this.pose = pose;
    this.resetJoints();

    switch (pose) {
      case 'kneel':
        this.body.position.y = 0.35;
        this.leftLeg.rotation.x = Math.PI / 2.5;
        this.rightLeg.rotation.x = Math.PI / 2.5;
        this.leftLeg.position.y = 0.35;
        this.rightLeg.position.y = 0.35;
        this.leftArm.rotation.x = -Math.PI / 6;
        this.rightArm.rotation.x = -Math.PI / 6;
        break;

      case 'fallen':
        this.root.rotation.x = -Math.PI / 2;
        this.root.position.y = 0.2;
        break;

      case 'pray':
        this.body.position.y = 0.35;
        this.leftLeg.rotation.x = Math.PI / 2.5;
        this.rightLeg.rotation.x = Math.PI / 2.5;
        this.leftLeg.position.y = 0.35;
        this.rightLeg.position.y = 0.35;
        this.leftArm.rotation.x = -Math.PI / 2.5;
        this.rightArm.rotation.x = -Math.PI / 2.5;
        this.leftArm.rotation.z = Math.PI / 8;
        this.rightArm.rotation.z = -Math.PI / 8;
        break;

      case 'carry_wood':
        this.body.rotation.x = Math.PI / 8;
        this.leftArm.rotation.x = -Math.PI / 3;
        this.rightArm.rotation.x = -Math.PI / 3;
        break;

      case 'swing_axe':
        this.rightArm.rotation.x = -Math.PI * 0.85;
        this.rightArm.rotation.z = -Math.PI / 6;
        break;

      case 'offer':
        this.leftArm.rotation.x = -Math.PI / 2.5;
        this.rightArm.rotation.x = -Math.PI / 2.5;
        break;

      case 'bound':
        this.leftArm.rotation.x = Math.PI / 6;
        this.leftArm.rotation.y = Math.PI / 3;
        this.leftArm.position.z = -0.12;
        this.rightArm.rotation.x = Math.PI / 6;
        this.rightArm.rotation.y = -Math.PI / 3;
        this.rightArm.position.z = -0.12;
        if (this.ropeMesh) this.ropeMesh.visible = true;
        break;

      case 'cower':
        this.body.position.y = 0.45;
        this.body.rotation.x = -Math.PI / 10;
        this.leftLeg.rotation.x = Math.PI / 5;
        this.rightLeg.rotation.x = Math.PI / 5;
        this.leftArm.rotation.x = -Math.PI * 0.65;
        this.leftArm.rotation.z = Math.PI / 4;
        this.rightArm.rotation.x = -Math.PI * 0.65;
        this.rightArm.rotation.z = -Math.PI / 4;
        this.head.rotation.x = Math.PI / 8;
        break;

      case 'command':
        this.rightArm.rotation.x = -Math.PI * 0.48;
        this.rightArm.rotation.z = -Math.PI / 12;
        this.leftArm.rotation.x = Math.PI / 8;
        this.leftArm.rotation.z = Math.PI / 8;
        break;

      case 'sit_throne':
        this.body.position.y = 0.45;
        this.leftLeg.rotation.x = -Math.PI / 2;
        this.leftLeg.position.y = 0.45;
        this.leftLeg.position.z = 0.22;
        this.rightLeg.rotation.x = -Math.PI / 2;
        this.rightLeg.position.y = 0.45;
        this.rightLeg.position.z = 0.22;
        this.leftArm.rotation.x = -Math.PI / 3;
        this.rightArm.rotation.x = -Math.PI / 3;
        break;

      case 'stand':
      case 'walk':
      default:
        break;
    }
  }

  private resetJoints(): void {
    if (this.ropeMesh) this.ropeMesh.visible = false;
    this.root.rotation.x = 0;
    this.root.rotation.z = 0;
    this.root.position.y = 0;
    this.body.position.y = 0.6;
    this.body.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.leftArm.rotation.set(0, 0, 0);
    this.rightArm.rotation.set(0, 0, 0);
    this.leftLeg.position.set(-0.14, 0.6, 0);
    this.rightLeg.position.set(0.14, 0.6, 0);
    this.leftLeg.rotation.set(0, 0, 0);
    this.rightLeg.rotation.set(0, 0, 0);
  }

  updateAnimation(dt: number, isMoving: boolean): void {
    if (this.emote) {
      this.emote.life -= dt;
      if (this.emote.life <= 0) {
        this.clearBubble();
      }
    }

    if (this.spinState) {
      this.spinState.elapsed += dt;
      this.root.rotation.y += this.spinState.speed * dt;
      if (this.spinState.elapsed >= this.spinState.duration) {
        this.spinState = null;
      }
    }

    if (this.swingTimer > 0) {
      this.swingTimer -= dt;
      const p = 1 - Math.max(0, this.swingTimer / 0.35);
      this.rightArm.rotation.x = -Math.PI * (0.85 - p * 0.95);
      if (this.swingTimer <= 0) {
        this.setPose('stand');
      }
    }

    if (this.wingsLeft && this.wingsRight) {
      const flap = Math.sin(this.walkTime * 2.8) * 0.16;
      this.wingsLeft.rotation.y = -0.25 + flap;
      this.wingsRight.rotation.y = 0.25 - flap;
    }
    if (this.halo) {
      this.halo.position.y = 0.05 + Math.sin(this.walkTime * 1.8) * 0.03;
    }
    if (this.pose === 'cower') {
      this.body.position.x = (Math.random() - 0.5) * 0.03;
      this.head.rotation.z = (Math.random() - 0.5) * 0.06;
    }

    if (this.pose === 'walk' || isMoving) {
      this.walkTime += dt * 10;
      const swing = Math.sin(this.walkTime) * 0.6;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      if (this.pose !== 'swing_axe' && this.pose !== 'carry_wood') {
        this.leftArm.rotation.x = -swing * 0.8;
        this.rightArm.rotation.x = swing * 0.8;
      }
      this.body.position.y = 0.6 + Math.abs(Math.sin(this.walkTime * 2)) * 0.04;
    } else if (this.pose === 'stand') {
      this.resetJoints();
      // 가벼운 호흡 바운스
      this.walkTime += dt * 2;
      this.body.position.y = 0.6 + Math.sin(this.walkTime) * 0.015;
    }
  }

  moveTo(targetX: number, targetZ: number, speed: number, dt: number): boolean {
    const p = this.root.position;
    const dx = targetX - p.x;
    const dz = targetZ - p.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.08) {
      p.x = targetX;
      p.z = targetZ;
      return true; // 도달
    }

    const moveDist = Math.min(dist, speed * dt);
    p.x += (dx / dist) * moveDist;
    p.z += (dz / dist) * moveDist;

    this.facing = Math.atan2(dx, dz);
    this.root.rotation.y = this.facing;
    this.updateAnimation(dt, true);
    return false;
  }

  face(dirOrTarget: 'up' | 'down' | 'left' | 'right' | { x: number; z: number } | number): void {
    if (typeof dirOrTarget === 'number') {
      this.facing = dirOrTarget;
    } else if (typeof dirOrTarget === 'string') {
      switch (dirOrTarget) {
        case 'down': this.facing = 0; break;
        case 'up': this.facing = Math.PI; break;
        case 'left': this.facing = Math.PI / 2; break;
        case 'right': this.facing = -Math.PI / 2; break;
      }
    } else {
      const dx = dirOrTarget.x - this.root.position.x;
      const dz = dirOrTarget.z - this.root.position.z;
      this.facing = Math.atan2(dx, dz);
    }
    this.root.rotation.y = this.facing;
  }

  spin(turns = 1, secondsPerTurn = 0.22, clockwise = true): void {
    const dir = clockwise ? 1 : -1;
    const totalAngle = turns * Math.PI * 2 * dir;
    const duration = Math.max(0.05, turns * secondsPerTurn);
    this.spinState = { speed: totalAngle / duration, elapsed: 0, duration };
  }

  rotate(degrees: number): void {
    const rad = (degrees * Math.PI) / 180;
    this.root.rotation.z = rad;
  }

  swingEquippedAction(face?: string): void {
    if (face) this.face(face as any);
    this.setPose('swing_axe');
    this.swingTimer = 0.35;
  }

  attachProp(propId: string): void {
    this.detachProp();
    this.currentProp = propId;

    const pb = new VoxelBuilder(11, false);
    switch (propId) {
      case 'axe':
        // 도끼 자루
        pb.box(0, 0, 0, 0.06, 0.7, 0.06, 0x6e4a2e);
        // 도끼날
        pb.box(0, 0.28, 0.1, 0.08, 0.2, 0.22, 0x9e9ea6, { tex: 'stone' });
        break;

      case 'torch':
        // 횃불 막대
        pb.box(0, 0, 0, 0.07, 0.8, 0.07, 0x5a3d24);
        // 불꽃 헤드
        pb.box(0, 0.42, 0, 0.18, 0.22, 0.18, 0xf39c12);
        pb.box(0, 0.44, 0, 0.1, 0.15, 0.1, 0xffeb3b);
        break;

      case 'staff':
        pb.box(0, 0.1, 0, 0.06, 1.2, 0.06, 0x7c5335);
        break;

      case 'knife':
        pb.box(0, -0.05, 0, 0.05, 0.15, 0.05, 0x4a3220);
        pb.box(0, 0.12, 0, 0.04, 0.25, 0.08, 0xb0b8c0);
        break;

      case 'pitcher': // 물동이
        pb.box(0, 0, 0, 0.28, 0.38, 0.28, 0xba6a44, { tex: 'soil' });
        break;

      case 'wood': // 번제 나무
        pb.box(0, 0.2, -0.15, 0.5, 0.25, 0.35, 0x7a5238);
        break;

      case 'jewelry': // 금 장신구 상자
        pb.box(0, 0, 0, 0.22, 0.16, 0.2, 0xf5c022);
        break;

      case 'scepter': // 니므롯 왕실 홀
        pb.box(0, 0, 0, 0.06, 0.85, 0.06, 0xd4af37);
        pb.box(0, 0.44, 0, 0.14, 0.14, 0.14, 0xb71c1c);
        pb.box(0, 0.52, 0, 0.22, 0.08, 0.08, 0xf5c022);
        break;

      case 'spear': // 바벨 왕실 근위병 장창
        pb.box(0, 0.2, 0, 0.05, 1.8, 0.05, 0x5a3d24);
        pb.box(0, 1.15, 0, 0.08, 0.32, 0.12, 0xc8963e, { tex: 'metal' });
        break;

      default:
        pb.box(0, 0, 0, 0.1, 0.1, 0.1, 0xcccccc);
        break;
    }

    const mesh = pb.build();
    this.propContainer.add(mesh);
  }

  detachProp(): void {
    while (this.propContainer.children.length > 0) {
      const child = this.propContainer.children[0];
      this.propContainer.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
      }
    }
    this.currentProp = null;
  }

  showBubble(type: EmoteType, duration = 2.0): void {
    this.clearBubble();
    this.emote = { type, life: duration };

    const bb = new VoxelBuilder(9, false);
    // 흰색 바탕 타일
    bb.box(0, 0, 0, 0.4, 0.4, 0.06, 0xffffff);

    // 기호 픽셀
    switch (type) {
      case '!':
        bb.box(0, 0.05, 0.04, 0.08, 0.18, 0.04, 0xd32f2f);
        bb.box(0, -0.1, 0.04, 0.08, 0.06, 0.04, 0xd32f2f);
        break;
      case '?':
        bb.box(0, 0.06, 0.04, 0.18, 0.16, 0.04, 0x1976d2);
        bb.box(0, -0.1, 0.04, 0.08, 0.06, 0.04, 0x1976d2);
        break;
      case 'heart':
        bb.box(0, 0, 0.04, 0.22, 0.22, 0.04, 0xe91e63);
        break;
      case 'anger':
        bb.box(0, 0, 0.04, 0.2, 0.2, 0.04, 0xb71c1c);
        break;
      case 'sweat':
        bb.box(0, 0, 0.04, 0.14, 0.22, 0.04, 0x00bcd4);
        break;
      case '...':
      default:
        bb.box(-0.1, 0, 0.04, 0.06, 0.06, 0.04, 0x424242);
        bb.box(0, 0, 0.04, 0.06, 0.06, 0.04, 0x424242);
        bb.box(0.1, 0, 0.04, 0.06, 0.06, 0.04, 0x424242);
        break;
    }

    const bMesh = bb.build();
    this.bubbleContainer.add(bMesh);
  }

  clearBubble(): void {
    while (this.bubbleContainer.children.length > 0) {
      const child = this.bubbleContainer.children[0];
      this.bubbleContainer.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
      }
    }
    this.emote = null;
  }

  dispose(): void {
    this.detachProp();
    this.clearBubble();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
      }
    });
  }
}
