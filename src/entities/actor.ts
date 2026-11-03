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
  | 'offer';

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

  private pose: ActorPose = 'stand';
  private walkTime = 0;
  private currentProp: string | null = null;
  private emote: { type: EmoteType; life: number } | null = null;

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

      case 'stand':
      case 'walk':
      default:
        break;
    }
  }

  private resetJoints(): void {
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
