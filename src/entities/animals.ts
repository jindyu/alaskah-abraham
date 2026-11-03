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

    // 목과 머리
    cb.box(0, 1.8, 0.9, 0.45, 1.2, 0.6, col, { tex: 'soil' });
    cb.box(0, 2.3, 1.3, 0.4, 0.45, 0.7, col, { tex: 'soil' }); // 주둥이

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

    this.root.add(cb.build());
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
