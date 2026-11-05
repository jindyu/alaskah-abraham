import * as THREE from 'three';
import { Collision } from '../collision';
import { PAL_REGION } from '../palette';
import { VoxelBuilder } from '../voxel';
import { Px, TD, ditherPick } from '../textures';
import { fbm, hash2, valueNoise } from '../../core/rng';

export interface UrPalaceStage {
  root: THREE.Group;
  col: Collision;
  spawn: { x: number; z: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  thronePos: THREE.Vector3;
  braziers: THREE.PointLight[];
  updateAnimations(dt: number, time: number): void;
}

const PALACE_HALF = 20; // 40x40m

/** 니므롯 왕궁 바닥: 청유리 타일, 왕실 대리석, 황금 줄눈 고해상도 지면 (TD=16) */
function buildPalaceGround(): THREE.Mesh {
  const N = PALACE_HALF * 2 * TD; // 640x640
  const px = new Px(N, N);
  const toW = (idx: number) => -PALACE_HALF + (idx + 0.5) / TD;
  const reg = PAL_REGION.MESOPOTAMIA;

  for (let j = 0; j < N; j++) {
    const z = toW(j);
    for (let i = 0; i < N; i++) {
      const x = toW(i);

      // 1. 기본 대리석 바닥 (황갈색 및 테라코타 마노석 톤)
      const nMarble = fbm(x / 6, z / 6, 901, 2) * 0.6 + valueNoise(i / 10, j / 10, 902) * 0.4;
      let c = ditherPick([0xd0bc98, 0xc4b08c, 0xd8c8a8, 0xb8a480], nMarble, i, j, 0.25);

      const li = i % (TD * 2);
      const lj = j % (TD * 2);
      if (li === 0 || lj === 0) {
        c = 0x8a7250; // 금장 줄눈
      }

      // 2. 중앙 어도(왕실 카펫 보도: |x| <= 2.2, z: -10 ~ 12)
      if (Math.abs(x) <= 2.2 && z >= -10.0 && z <= 12.0) {
        const carpetBorder = Math.abs(Math.abs(x) - 2.1) < 0.15;
        if (carpetBorder) {
          c = 0xf3c13a; // 카펫 황금 테두리
        } else {
          // 심홍색 벨벳 카펫
          const nCarpet = hash2(i, j, 915);
          c = nCarpet < 0.15 ? 0x9a2028 : nCarpet > 0.85 ? 0x76141c : 0x881a22;
        }
      }

      // 3. 기둥 기단 열주 주변 청유리 타일 (x = ±5.5, z: -8 ~ 8)
      if ((Math.abs(x - 5.5) <= 1.5 || Math.abs(x - (-5.5)) <= 1.5) && z >= -9.0 && z <= 9.0) {
        const tileI = Math.floor(i / (TD / 2));
        const tileJ = Math.floor(j / (TD / 2));
        if ((tileI + tileJ) % 2 === 0) {
          c = reg.ishtarBlue; // 이슈타르 코발트 블루
        } else {
          c = 0x143460;
        }
      }

      // 4. 북쪽 옥좌 단상 바닥 (|x| <= 5.0, z: -12.5 ~ -8.5)
      if (Math.abs(x) <= 5.0 && z >= -12.5 && z <= -8.5) {
        c = 0xe0b840; // 옥좌 단상 황금빛
        if (li % 8 === 0 || lj % 8 === 0) c = 0xa87c20;
      }

      px.set(i, j, c);
    }
  }

  const tex = px.toTexture();
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PALACE_HALF * 2, PALACE_HALF * 2),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.01;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildUrPalaceStage(): UrPalaceStage {
  const root = new THREE.Group();
  const col = new Collision();
  col.bounds = { minX: -PALACE_HALF + 4, maxX: PALACE_HALF - 4, minZ: -PALACE_HALF + 4, maxZ: PALACE_HALF - 4 };

  // 지면 추가
  root.add(buildPalaceGround());

  const b = new VoxelBuilder(999, false);
  const reg = PAL_REGION.MESOPOTAMIA;

  // ─────────────────────────────────────────────────────────────
  // 1. 외벽 및 회랑 벽면 (이슈타르 블루 유약 벽돌과 황금 황소/사자 부조)
  // ─────────────────────────────────────────────────────────────
  // 북쪽 옥좌 뒷벽 (z: -14.0)
  b.box(0, 4.0, -14.0, 24.0, 8.0, 1.6, reg.ishtarBlue, { tex: 'brick' });
  // 상단 황금 처마
  b.box(0, 8.2, -14.0, 25.0, 0.6, 2.0, 0xf3c13a);
  // 황금 날개 달린 사자/황소 상징 부조 (중앙 옥좌 뒤)
  b.box(0, 5.2, -13.1, 3.2, 2.4, 0.3, 0xf3c13a);
  b.box(0, 5.2, -13.0, 2.4, 1.8, 0.4, 0x8a2018); // 사자 방패 문장

  // 동/서 외벽 (x = ±12.0)
  b.box(-12.0, 3.5, 0, 1.6, 7.0, 28.0, reg.ishtarBlue, { tex: 'brick' });
  b.box(12.0, 3.5, 0, 1.6, 7.0, 28.0, reg.ishtarBlue, { tex: 'brick' });
  col.addBox(-12.0, 0, 1.6, 28.0);
  col.addBox(12.0, 0, 1.6, 28.0);
  col.addBox(0, -14.0, 24.0, 1.6);

  // ─────────────────────────────────────────────────────────────
  // 2. 8쌍의 웅장한 이슈타르 청유리 대리석 기둥 (x = ±5.5, z: -8 ~ 8)
  // ─────────────────────────────────────────────────────────────
  const pillarZ = [-8.0, -4.0, 0.0, 4.0, 8.0];
  for (const pz of pillarZ) {
    for (const px of [-5.5, 5.5]) {
      // 기단
      b.box(px, 0.4, pz, 1.4, 0.8, 1.4, 0xf3c13a, { tex: 'stone' });
      // 기둥 몸체 (청유리 타일)
      b.box(px, 3.8, pz, 0.9, 6.0, 0.9, reg.ishtarBlue, { tex: 'stone' });
      // 주두 (황금 조각)
      b.box(px, 7.0, pz, 1.3, 0.6, 1.3, 0xf3c13a);
      // 충돌
      col.addBox(px, pz, 1.2, 1.2);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. 3단 계단식 황금 옥좌 단상 (North Throne Dais)
  // ─────────────────────────────────────────────────────────────
  // 1단
  b.box(0, 0.25, -9.5, 7.0, 0.5, 5.0, 0x3d2817, { tex: 'stone' });
  // 2단
  b.box(0, 0.65, -9.8, 5.4, 0.4, 4.0, reg.ishtarBlue, { tex: 'brick' });
  // 3단
  b.box(0, 1.0, -10.2, 4.0, 0.4, 3.0, 0xf3c13a);
  // 계단 경사로
  b.box(0, 0.15, -6.8, 2.0, 0.3, 1.0, 0x881a22);
  b.box(0, 0.45, -7.5, 2.0, 0.3, 0.8, 0x881a22);

  // 니므롯의 거대 황금 옥좌
  const tz = -10.8;
  // 좌판
  b.box(0, 1.5, tz, 2.0, 0.6, 1.2, 0xf3c13a);
  // 등받이 (날개 달린 황소 형상)
  b.box(0, 2.6, tz - 0.5, 2.0, 1.8, 0.3, 0xf3c13a);
  b.box(0, 2.8, tz - 0.4, 1.4, 1.4, 0.2, 0x8a2018); // 자주색 등받이 쿠션
  // 팔걸이 (황금 사자 머리 조각)
  b.box(-0.95, 1.8, tz, 0.3, 0.6, 1.1, 0xd4a024);
  b.box(0.95, 1.8, tz, 0.3, 0.6, 1.1, 0xd4a024);
  col.addBox(0, tz, 3.2, 2.4);

  // ─────────────────────────────────────────────────────────────
  // 4. 청동 화로 및 실내 광원 시스템
  // ─────────────────────────────────────────────────────────────
  const braziers: THREE.PointLight[] = [];
  const brazierSpots = [
    { x: -3.6, z: -6.5 },
    { x: 3.6, z: -6.5 },
    { x: -3.6, z: 2.0 },
    { x: 3.6, z: 2.0 },
    { x: -3.6, z: 8.5 },
    { x: 3.6, z: 8.5 },
  ];

  for (const s of brazierSpots) {
    // 화로 다리 및 그릇
    b.box(s.x, 0.4, s.z, 0.7, 0.8, 0.7, 0x4a3222, { tex: 'stone' });
    b.box(s.x, 0.85, s.z, 0.9, 0.25, 0.9, 0x22160e);
    // 타오르는 숯불 복셀
    b.box(s.x, 1.0, s.z, 0.6, 0.2, 0.6, 0xff4810);
    b.box(s.x, 1.12, s.z, 0.3, 0.15, 0.3, 0xffaa20);
    col.addBox(s.x, s.z, 0.8, 0.8);

    const light = new THREE.PointLight(0xff7722, 1.8, 10.0);
    light.position.set(s.x, 1.4, s.z);
    root.add(light);
    braziers.push(light);
  }

  // 옥좌 집중 조명 (왕의 위엄을 비추는 천장 황금 앰비언트)
  const throneLight = new THREE.PointLight(0xfff0c0, 2.4, 12.0);
  throneLight.position.set(0, 4.0, tz);
  root.add(throneLight);

  root.add(b.build());

  return {
    root,
    col,
    spawn: { x: 0, z: 7.5 },
    bounds: { minX: -PALACE_HALF + 4, maxX: PALACE_HALF - 4, minZ: -PALACE_HALF + 4, maxZ: PALACE_HALF - 4 },
    thronePos: new THREE.Vector3(0, 1.6, tz),
    braziers,
    updateAnimations(_dt: number, time: number) {
      // 화로 불빛 자연스러운 플리커
      for (let i = 0; i < braziers.length; i++) {
        const bl = braziers[i];
        bl.intensity = 1.6 + Math.sin(time * 8.0 + i * 1.7) * 0.3 + Math.cos(time * 13.0 + i) * 0.15;
      }
    },
  };
}
