import * as THREE from 'three';
import { VoxelBuilder } from '../world/voxel';
import { PAL } from '../world/palette';

export class Sheep {
  readonly root = new THREE.Group();
  private head = new THREE.Group();
  private legBL = new THREE.Group();
  private legBR = new THREE.Group();
  private legFL = new THREE.Group();
  private legFR = new THREE.Group();

  constructor(x = 0, z = 0) {
    this.root.position.set(x, 0, z);
    this.buildMesh();
  }

  private buildMesh(): void {
    // 몸통 (양털)
    const bb = new VoxelBuilder(9, false);
    bb.box(0, 0.45, 0, 0.7, 0.55, 0.9, PAL.wool[2], { tex: 'wool' });
    this.root.add(bb.build());

    // 머리 (검은 얼굴 + 흰 털)
    const hb = new VoxelBuilder(9, false);
    hb.box(0, 0, 0, 0.32, 0.35, 0.35, PAL.wool[2], { tex: 'wool' });
    hb.box(0, -0.05, 0.18, 0.24, 0.25, 0.25, PAL.sheepFace[1]);
    this.head.add(hb.build());
    this.head.position.set(0, 0.65, 0.45);
    this.root.add(this.head);

    // 4 다리
    const lb = new VoxelBuilder(9, false);
    lb.box(0, -0.15, 0, 0.12, 0.32, 0.12, PAL.sheepFace[0]);
    const legMesh = lb.build();

    this.legFL.add(legMesh.clone()); this.legFL.position.set(-0.24, 0.3, 0.3);
    this.legFR.add(legMesh.clone()); this.legFR.position.set(0.24, 0.3, 0.3);
    this.legBL.add(legMesh.clone()); this.legBL.position.set(-0.24, 0.3, -0.3);
    this.legBR.add(legMesh.clone()); this.legBR.position.set(0.24, 0.3, -0.3);

    this.root.add(this.legFL, this.legFR, this.legBL, this.legBR);
  }

  update(dt: number, time: number): void {
    // 한가로운 고개 끄덕임 / 풀 뜯기
    this.head.rotation.x = Math.sin(time * 1.5 + this.root.position.x) * 0.15 + 0.1;
  }
}

export class Camel {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private neck = new THREE.Group();
  private kneeling = false;

  constructor(x = 0, z = 0, kneeling = false) {
    this.root.position.set(x, 0, z);
    this.kneeling = kneeling;
    this.buildMesh();
  }

  private buildMesh(): void {
    const cb = new VoxelBuilder(9, false);
    const col = 0xb58c54;

    // 몸통 및 혹
    cb.box(0, 1.2, 0, 1.1, 1.1, 1.8, col, { tex: 'soil' });
    cb.box(0, 2.0, -0.1, 0.8, 0.7, 0.8, col, { tex: 'soil' }); // 등 혹

    if (this.kneeling) {
      // 꿇어앉은 다리
      cb.box(-0.45, 0.3, 0.5, 0.3, 0.5, 0.8, col);
      cb.box(0.45, 0.3, 0.5, 0.3, 0.5, 0.8, col);
      cb.box(-0.45, 0.3, -0.5, 0.3, 0.5, 0.8, col);
      cb.box(0.45, 0.3, -0.5, 0.3, 0.5, 0.8, col);
      this.root.position.y = -0.5;
    } else {
      // 서 있는 긴 4다리
      cb.box(-0.45, 0.5, 0.6, 0.22, 1.0, 0.22, col);
      cb.box(0.45, 0.5, 0.6, 0.22, 1.0, 0.22, col);
      cb.box(-0.45, 0.5, -0.6, 0.22, 1.0, 0.22, col);
      cb.box(0.45, 0.5, -0.6, 0.22, 1.0, 0.22, col);
    }

    // 여행 봇짐
    cb.box(-0.6, 1.4, 0, 0.25, 0.6, 0.8, 0x8e4228, { tex: 'stripeRed' });
    cb.box(0.6, 1.4, 0, 0.25, 0.6, 0.8, 0x8e4228, { tex: 'stripeRed' });

    this.body.add(cb.build());
    this.root.add(this.body);

    // 목과 머리 (애니메이션 그룹 분리)
    const nb = new VoxelBuilder(9, false);
    nb.box(0, 0.6, 0.45, 0.45, 1.2, 0.6, col, { tex: 'soil' });
    nb.box(0, 1.1, 0.85, 0.4, 0.45, 0.7, col, { tex: 'soil' }); // 주둥이
    nb.box(0, 0.85, 0.5, 0.48, 0.1, 0.48, 0x8a3220); // 목걸이 띠
    this.neck.add(nb.build());
    this.neck.position.set(0, 1.2, 0.45);
    this.root.add(this.neck);
  }

  setKneeling(kneel: boolean): void {
    if (this.kneeling === kneel) return;
    this.kneeling = kneel;
    while (this.root.children.length > 0) {
      const c = this.root.children[0];
      this.root.remove(c);
      if (c instanceof THREE.Mesh) c.geometry?.dispose();
    }
    this.buildMesh();
  }

  update(dt: number, time: number): void {
    this.neck.rotation.x = Math.sin(time * 1.2) * 0.08;
    this.neck.rotation.y = Math.sin(time * 0.6) * 0.06;
  }
}

export class Pigeon {
  readonly root = new THREE.Group();
  private bodyMesh = new THREE.Group();
  private headMesh = new THREE.Group();
  private wingL = new THREE.Group();
  private wingR = new THREE.Group();

  readonly homeX: number;
  readonly homeZ: number;
  private flying = false;
  private flyTimer = 0;
  private currentY = 0;
  private flightAngle = 0;
  private seed: number;

  constructor(x: number, z: number, seed = 0) {
    this.homeX = x;
    this.homeZ = z;
    this.seed = seed;
    this.flightAngle = seed * 1.7;
    this.root.position.set(x, 0, z);
    this.buildMesh();
  }

  private buildMesh(): void {
    // 1. 몸통 (푸른빛 도는 비둘기 회색)
    const bb = new VoxelBuilder(7, false);
    bb.box(0, 0.12, 0, 0.22, 0.16, 0.32, 0x757f8c, { tex: 'plain' });
    // 꼬리깃 (어두운 회청색)
    bb.box(0, 0.14, -0.22, 0.16, 0.04, 0.18, 0x485260, { tex: 'plain' });
    // 붉은 발
    bb.box(-0.06, 0.03, 0.02, 0.03, 0.06, 0.06, 0xba4436);
    bb.box(0.06, 0.03, 0.02, 0.03, 0.06, 0.06, 0xba4436);
    this.bodyMesh.add(bb.build());
    this.root.add(this.bodyMesh);

    // 2. 머리와 목 (청동빛 깃털 + 노란 부리)
    const hb = new VoxelBuilder(7, false);
    hb.box(0, 0.08, 0.08, 0.14, 0.16, 0.14, 0x566870, { tex: 'plain' });
    hb.box(0, 0.12, 0.18, 0.04, 0.04, 0.08, 0xe2a838); // 부리
    this.headMesh.add(hb.build());
    this.headMesh.position.set(0, 0.16, 0.08);
    this.root.add(this.headMesh);

    // 3. 좌우 날개
    const wbL = new VoxelBuilder(7, false);
    wbL.box(-0.14, 0, 0, 0.26, 0.04, 0.28, 0x606a78, { tex: 'plain' });
    wbL.box(-0.20, 0, -0.04, 0.18, 0.03, 0.22, 0x424a54, { tex: 'plain' });
    this.wingL.add(wbL.build());
    this.wingL.position.set(-0.10, 0.20, 0);

    const wbR = new VoxelBuilder(7, false);
    wbR.box(0.14, 0, 0, 0.26, 0.04, 0.28, 0x606a78, { tex: 'plain' });
    wbR.box(0.20, 0, -0.04, 0.18, 0.03, 0.22, 0x424a54, { tex: 'plain' });
    this.wingR.add(wbR.build());
    this.wingR.position.set(0.10, 0.20, 0);

    this.root.add(this.wingL, this.wingR);
  }

  update(dt: number, time: number, playerX: number, playerZ: number): void {
    const distToPlayer = Math.hypot(playerX - this.root.position.x, playerZ - this.root.position.z);

    // 플레이어가 2.6m 이내로 다가오면 깜짝 놀라 날아오름
    if (distToPlayer < 2.6 && !this.flying) {
      this.flying = true;
      this.flyTimer = 4.2 + (this.seed % 3) * 0.5;
    }

    if (this.flying) {
      this.flyTimer -= dt;
      // 고속 날갯짓
      const flap = Math.sin(time * 26 + this.seed) * 0.85;
      this.wingL.rotation.z = -flap;
      this.wingR.rotation.z = flap;

      // 비행 궤적: 원형으로 솟구쳐 선회
      this.flightAngle += dt * 2.2;
      const targetY = 2.4 + Math.sin(time * 3 + this.seed) * 0.4;
      this.currentY += (targetY - this.currentY) * Math.min(1, dt * 3.5);

      const rad = 2.4 + Math.sin(time * 1.5) * 0.6;
      this.root.position.x = this.homeX + Math.cos(this.flightAngle) * rad;
      this.root.position.z = this.homeZ + Math.sin(this.flightAngle) * rad;
      this.root.position.y = this.currentY;
      this.root.rotation.y = -this.flightAngle + Math.PI / 2;

      // 착륙
      if (this.flyTimer <= 0) {
        this.currentY -= dt * 2.5;
        if (this.currentY <= 0) {
          this.currentY = 0;
          this.flying = false;
          this.root.position.set(this.homeX + (Math.random() - 0.5) * 0.6, 0, this.homeZ + (Math.random() - 0.5) * 0.6);
        }
      }
    } else {
      // 지상 모이 쪼기 및 고개 끄덕임
      this.root.position.y = 0;
      this.wingL.rotation.z = 0.08;
      this.wingR.rotation.z = -0.08;
      this.headMesh.rotation.x = Math.max(0, Math.sin(time * 7 + this.seed * 2) * 0.35);
      this.headMesh.rotation.y = Math.sin(time * 1.8 + this.seed) * 0.2;
    }
  }
}

export class KidGoat {
  readonly root = new THREE.Group();
  private head = new THREE.Group();
  private tail = new THREE.Group();

  constructor(x = 0, z = 0) {
    this.root.position.set(x, 0, z);
    this.buildMesh();
  }

  private buildMesh(): void {
    const col = 0xd6c29e; // 사막 염소 모래빛 털
    const gb = new VoxelBuilder(9, false);

    // 몸통
    gb.box(0, 0.48, 0, 0.55, 0.46, 0.8, col, { tex: 'soil' });

    // 4 다리
    gb.box(-0.2, 0.2, 0.28, 0.1, 0.4, 0.1, 0x4a3222);
    gb.box(0.2, 0.2, 0.28, 0.1, 0.4, 0.1, 0x4a3222);
    gb.box(-0.2, 0.2, -0.28, 0.1, 0.4, 0.1, 0x4a3222);
    gb.box(0.2, 0.2, -0.28, 0.1, 0.4, 0.1, 0x4a3222);
    this.root.add(gb.build());

    // 머리와 귀, 작은 뿔
    const hb = new VoxelBuilder(9, false);
    hb.box(0, 0.2, 0.2, 0.26, 0.3, 0.32, col, { tex: 'soil' });
    hb.box(0, 0.12, 0.38, 0.2, 0.18, 0.2, 0x3e281c); // 주둥이
    // 뿔 2개
    hb.box(-0.1, 0.4, 0.14, 0.06, 0.14, 0.06, 0x2e1e16);
    hb.box(0.1, 0.4, 0.14, 0.06, 0.14, 0.06, 0x2e1e16);
    // 늘어진 귀 2개
    hb.box(-0.18, 0.26, 0.14, 0.06, 0.18, 0.1, 0x8a6e52);
    hb.box(0.18, 0.26, 0.14, 0.06, 0.18, 0.1, 0x8a6e52);
    this.head.add(hb.build());
    this.head.position.set(0, 0.45, 0.35);
    this.root.add(this.head);

    // 꼬리
    const tb = new VoxelBuilder(9, false);
    tb.box(0, 0.06, -0.1, 0.08, 0.14, 0.08, col);
    this.tail.add(tb.build());
    this.tail.position.set(0, 0.65, -0.4);
    this.root.add(this.tail);
  }

  update(dt: number, time: number, playerX: number, playerZ: number): void {
    // 꼬리 흔들기
    this.tail.rotation.x = 0.3 + Math.sin(time * 8) * 0.25;
    this.tail.rotation.z = Math.cos(time * 10) * 0.2;

    const dx = playerX - this.root.position.x;
    const dz = playerZ - this.root.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 3.2) {
      // 플레이어를 호기심 어린 눈으로 올려다봄
      const angle = Math.atan2(dx, dz);
      this.root.rotation.y += (angle - this.root.rotation.y) * Math.min(1, dt * 4);
      this.head.rotation.x = -0.15;
      this.head.rotation.z = Math.sin(time * 3) * 0.12; // 갸우뚱
    } else {
      // 풀 뜯기
      this.head.rotation.x = 0.25 + Math.sin(time * 2) * 0.15;
      this.head.rotation.z = 0;
    }
  }
}

export class Donkey {
  readonly root = new THREE.Group();

  constructor(x = 0, z = 0, withWood = false) {
    this.root.position.set(x, 0, z);
    this.buildMesh(withWood);
  }

  private buildMesh(withWood: boolean): void {
    const db = new VoxelBuilder(9, false);
    const col = 0x8a7a70;

    // 몸통
    db.box(0, 0.75, 0, 0.7, 0.65, 1.2, col, { tex: 'soil' });
    // 머리와 긴 귀
    db.box(0, 1.2, 0.6, 0.32, 0.7, 0.4, col);
    db.box(0, 1.3, 0.85, 0.26, 0.32, 0.45, 0x5a4a40);
    db.box(-0.12, 1.7, 0.55, 0.08, 0.4, 0.08, col); // 귀 1
    db.box(0.12, 1.7, 0.55, 0.08, 0.4, 0.08, col);  // 귀 2

    // 다리
    db.box(-0.25, 0.32, 0.4, 0.14, 0.65, 0.14, col);
    db.box(0.25, 0.32, 0.4, 0.14, 0.65, 0.14, col);
    db.box(-0.25, 0.32, -0.4, 0.14, 0.65, 0.14, col);
    db.box(0.25, 0.32, -0.4, 0.14, 0.65, 0.14, col);

    if (withWood) {
      // 등에 실린 번제 나무 장작 단
      db.box(-0.4, 1.05, 0, 0.25, 0.4, 0.9, 0x6e4628, { tex: 'wood' });
      db.box(0.4, 1.05, 0, 0.25, 0.4, 0.9, 0x6e4628, { tex: 'wood' });
      db.box(0, 1.15, 0, 0.65, 0.2, 0.9, 0x5a361c, { tex: 'wood' });
    }

    this.root.add(db.build());
  }
}

export class RamInThicket {
  readonly root = new THREE.Group();

  constructor(x = 0, z = 0) {
    this.root.position.set(x, 0, z);
    this.buildMesh();
  }

  private buildMesh(): void {
    const rb = new VoxelBuilder(9, false);

    // 숫양 몸통
    rb.box(0, 0.6, 0, 0.75, 0.65, 0.95, PAL.wool[1], { tex: 'wool' });
    // 숫양 머리
    rb.box(0, 0.85, 0.48, 0.35, 0.38, 0.38, PAL.sheepFace[1]);
    // 뿔 (좌우로 크게 굽은 양 뿔)
    rb.box(-0.25, 1.05, 0.45, 0.18, 0.22, 0.18, 0x4a3222);
    rb.box(0.25, 1.05, 0.45, 0.18, 0.22, 0.18, 0x4a3222);
    rb.box(-0.35, 0.95, 0.35, 0.14, 0.18, 0.18, 0x4a3222);
    rb.box(0.35, 0.95, 0.35, 0.14, 0.18, 0.18, 0x4a3222);

    // 뿔이 걸린 가시덤불 수풀
    rb.box(0, 0.7, 0.3, 1.4, 1.2, 1.3, PAL.shrub[1], { tex: 'leafVine' });
    rb.box(-0.4, 0.5, 0.5, 0.8, 0.9, 0.8, PAL.shrub[0], { tex: 'leafVine' });
    rb.box(0.4, 0.6, 0.4, 0.8, 1.0, 0.8, PAL.shrub[2], { tex: 'leafVine' });

    this.root.add(rb.build());
  }
}

export class KiteBird {
  readonly root = new THREE.Group();
  private angle = 0;
  private radius = 8;
  private height = 7;
  private speed = 1.2;

  constructor(cx = 0, cz = 0) {
    this.root.position.set(cx, this.height, cz);
    this.buildMesh();
  }

  private buildMesh(): void {
    const bb = new VoxelBuilder(9, false);
    // 솔개 몸통
    bb.box(0, 0, 0, 0.2, 0.12, 0.5, 0x3d2817);
    // 양 날개 (펼침)
    bb.box(-0.55, 0.02, 0, 0.9, 0.04, 0.32, 0x2e1d13);
    bb.box(0.55, 0.02, 0, 0.9, 0.04, 0.32, 0x2e1d13);
    // 꼬리
    bb.box(0, 0.01, -0.35, 0.28, 0.04, 0.3, 0x3d2817);
    this.root.add(bb.build());
  }

  update(dt: number, cx = 0, cz = 0): void {
    this.angle += dt * this.speed;
    this.root.position.x = cx + Math.cos(this.angle) * this.radius;
    this.root.position.z = cz + Math.sin(this.angle) * this.radius;
    this.root.rotation.y = -this.angle + Math.PI / 2;
  }
}
