import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import * as P from '../props';
import { buildFarField, buildHorizonPlane, scatterGroundCover } from './common';
import {
  createStageGroundMesh,
  buildPerimeterRidges,
  buildMudbrickBuilding,
  buildSmokeColumn,
  buildTorchStand,
  buildStoragePropCluster,
} from './scenery36';
import { fbm, hash2, valueNoise } from '../../core/rng';
import { tintColor } from './common';
import { Dressing } from './dressing';

export interface SodomStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  lotHouse: THREE.Group;
  saltPillar: THREE.Group;
  sulfurLights: THREE.PointLight[];
  update: (dt: number, time: number) => void;
}

const SODOM_HALF = 18;

/** 소돔 고해상도 지면: 붉은 사암 대지, 유황 노란 결정, 소금 백색 피루, 성문 앞 포석 */
function buildSodomGroundMesh(): THREE.Mesh {
  const reg = PAL_REGION.SODOM_NEGEV;
  const resolution = 480;

  return createStageGroundMesh(SODOM_HALF, resolution, (x, z, _u, _v, i, j) => {
    // 1. 기본 붉은 협곡 대지
    const nBase = fbm(x / 7, z / 7, 201, 2) * 0.5 + valueNoise(i / 14, j / 14, 202) * 0.3 + hash2(i, j, 203) * 0.2;
    let c = nBase > 0.65 ? 0xc29058 : nBase > 0.4 ? 0xa8704a : 0x8a5a44;

    // 미세 모래알/자갈
    const hGrit = hash2(i, j, 205);
    if (hGrit < 0.015) c = 0x76381e;
    else if (hGrit > 0.985) c = 0xcc885a;

    // 2. 유황 침전물 및 노란 결정 지대 (북동쪽, 남서쪽)
    const nSulfur1 = Math.hypot(x - (-6), z - 5);
    const nSulfur2 = Math.hypot(x - 7, z - (-4));
    if (nSulfur1 < 5.2 || nSulfur2 < 4.8) {
      const dMin = Math.min(nSulfur1 / 5.2, nSulfur2 / 4.8);
      const sNoise = valueNoise(i / 8, j / 8, 221);
      if (sNoise > dMin * 0.85) {
        c = sNoise > 0.6 ? reg.sulfurYellow : 0xcab032;
        if (hash2(i, j, 223) < 0.05) c = 0xffe860;
      }
    }

    // 3. 소금 피루 / 하얀 알칼리 소금 결정 (남동쪽 소금기둥 주변)
    const dSalt = Math.hypot(x - 8.5, z - 7.5);
    if (dSalt < 6.5) {
      const saltNoise = fbm(x * 1.5, z * 1.5, 231, 2);
      if (saltNoise > 0.35 + (dSalt / 6.5) * 0.4) {
        c = saltNoise > 0.65 ? reg.saltPillar : 0xd8d4cb;
        if (hash2(i, j, 233) < 0.08) c = 0xf5f3ee;
      }
    }

    // 4. 성문 앞 석조 광장 (z: -10 ~ -4, |x| < 7)
    if (z >= -9.8 && z <= -3.8 && Math.abs(x) < 6.8) {
      const cell = 12;
      const li = i % cell;
      const lj = j % cell;
      if (li === 0 || lj === 0) {
        c = 0x5a4234; // 틈새 줄눈
      } else {
        const stoneTones = [0x8c7460, 0x9b826e, 0x7e6856, 0xaa927c];
        const tone = stoneTones[Math.floor(hash2(Math.floor(i / cell), Math.floor(j / cell), 241) * 4)];
        c = li === 1 || lj === 1 ? 0xbda58e : tone;
        if (hash2(i, j, 243) < 0.03) c = 0x483224; // 풍화 균열
      }
    }

    // 5. 그을린 재와 검은 유황 흔적 (불길에 휩싸인 거리)
    const nAsh = fbm(x * 2, z * 2, 251, 2);
    if (nAsh > 0.72) {
      c = 0x2e2420; // 숯 검댕이
    }

    return c;
  });
}

/**
 * 제4권 소돔 성문 및 멸망의 거리 3D 복셀 무대
 */
export function buildSodomStage(): SodomStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.SODOM_NEGEV;

  // 1. 소돔 원경 지평선 및 고해상도 지면 메쉬
  root.add(buildHorizonPlane(0x7a4e5e, 360, -0.05, 0.2));
  root.add(buildSodomGroundMesh());


  buildFarField(root, SODOM_HALF, { seed: 4, pal: [0x2e3040, 0x40465a, 0x5c6076, 0x7a7e92], tex: 'cliff', accents: [0x4a3c4c], haze: 0x7a4e5e, depth: 44, ground: 0x6a4a40, rim: { min: 3.0, max: 5.5, south: 0.45, openNorth: true } });
  // 2. 외곽 공허 차단: 붉은 협곡 절벽 및 도시 경계벽 (남/동/서 절벽)
  buildPerimeterRidges(vb, col, SODOM_HALF, [0x4e3c50, 0x645064, 0x7a5a5c, 0x3c3042], {
    seed: 401,
    minH: 3.8,
    maxH: 7.2,
    tex: 'cliff',
    openNorth: true, // 북쪽은 거대 성벽과 망루로 차단
  });

  // 3. 북쪽 거대 방어 성벽 및 쌍둥이 망루 (x: -18 ~ 18, z: -11 ~ -14)
  const wallZ = -11.5;
  const wallH = 6.8;
  // 좌측 성벽
  vb.box(-11, 0, wallZ, 14, wallH, 3.2, 0x9a9088, { tex: 'stone' });
  col.addBox(-11, wallZ, 14, 3.5);
  // 성벽 상부 톱니형 여장(Crenellations)
  for (let bx = -17; bx <= -5; bx += 2.0) {
    vb.box(bx, wallH, wallZ, 1.2, 0.9, 0.6, 0xb0a496, { tex: 'stone' });
  }

  // 우측 성벽
  vb.box(11, 0, wallZ, 14, wallH, 3.2, 0x9a9088, { tex: 'stone' });
  col.addBox(11, wallZ, 14, 3.5);
  for (let bx = 5; bx <= 17; bx += 2.0) {
    vb.box(bx, wallH, wallZ, 1.2, 0.9, 0.6, 0xb0a496, { tex: 'stone' });
  }

  // 중앙 쌍둥이 망루 (좌: x=-3.5, 우: x=3.5, 폭 3.0m, 높이 9.2m)
  const towerH = 9.2;
  vb.box(-3.5, 0, wallZ, 3.2, towerH, 4.2, 0xb0a496, { tex: 'stone' });
  col.addBox(-3.5, wallZ, 3.4, 4.4);
  // 좌 망루 옥상 여장
  vb.box(-3.5, towerH, wallZ - 1.8, 3.2, 0.8, 0.5, PAL.stone[3], { tex: 'stone' });
  vb.box(-3.5, towerH, wallZ + 1.8, 3.2, 0.8, 0.5, PAL.stone[3], { tex: 'stone' });
  vb.box(-4.8, towerH, wallZ, 0.5, 0.8, 3.6, PAL.stone[3], { tex: 'stone' });
  // 망루 감시창
  vb.box(-3.5, 6.2, wallZ + 2.12, 0.6, 1.0, 0.08, 0xffa030, { tex: 'glow' });

  vb.box(3.5, 0, wallZ, 3.2, towerH, 4.2, 0xb0a496, { tex: 'stone' });
  col.addBox(3.5, wallZ, 3.4, 4.4);
  // 우 망루 옥상 여장
  vb.box(3.5, towerH, wallZ - 1.8, 3.2, 0.8, 0.5, PAL.stone[3], { tex: 'stone' });
  vb.box(3.5, towerH, wallZ + 1.8, 3.2, 0.8, 0.5, PAL.stone[3], { tex: 'stone' });
  vb.box(4.8, towerH, wallZ, 0.5, 0.8, 3.6, PAL.stone[3], { tex: 'stone' });
  vb.box(3.5, 6.2, wallZ + 2.12, 0.6, 1.0, 0.08, 0xffa030, { tex: 'glow' });

  // 성문 아치 및 상인방
  vb.box(0, 4.8, wallZ, 4.2, 2.6, 3.6, PAL.stone[3], { tex: 'stone' });
  // 청동 장식 육중한 목재 이중 성문
  vb.box(-1.1, 0, wallZ, 2.0, 4.8, 0.45, PAL.wood[0], { tex: 'wood' });
  vb.box(1.1, 0, wallZ, 2.0, 4.8, 0.45, PAL.wood[0], { tex: 'wood' });
  // 청동 빗장 및 보강 띠
  vb.box(0, 2.4, wallZ + 0.25, 3.8, 0.3, 0.12, 0x9a7a40, { tex: 'metal' });
  vb.box(0, 1.2, wallZ + 0.25, 3.8, 0.15, 0.12, 0x9a7a40, { tex: 'metal' });
  col.addBox(-1.3, wallZ, 1.8, 1.0);
  col.addBox(1.3, wallZ, 1.8, 1.0);

  // 3-1. 성벽·망루 앞면 디테일: 돌켜 줄무늬(어두운 현무암 ↔ 밝은 사암), 창, 문, 발코니, 균열, 그을음, 따뜻한 불빛
  const faceZ = wallZ + 1.6 + 0.03; // 성벽 앞면
  const towerFaceZ = wallZ + 2.1 + 0.03; // 망루 앞면
  const darkB = 0x3c3a46, lightB = 0xd8c4a0;
  // 어두운 현무암 기단 + 밝은 사암 줄 (가로로 읽히는 층)
  for (const sx of [-1, 1]) {
    vb.box(sx * 11, 0, faceZ, 14, 1.0, 0.1, darkB, { tex: 'stone' });
    for (let r = 0; r < 4; r++) vb.box(sx * 11, 1.0 + r * 1.35, faceZ, 14, 0.28, 0.1, r % 2 ? lightB : 0xc0a888, { tex: 'stone' });
    vb.box(sx * 11, wallH - 0.4, faceZ + 0.1, 14, 0.4, 0.3, 0xe0cca8, { tex: 'stone' }); // 처마 돌림띠
  }
  for (const tx of [-3.5, 3.5]) {
    vb.box(tx, 0, towerFaceZ, 3.2, 1.2, 0.1, darkB, { tex: 'stone' });
    for (let r = 0; r < 6; r++) vb.box(tx, 1.2 + r * 1.3, towerFaceZ, 3.2, 0.26, 0.1, r % 2 ? lightB : 0xc0a888, { tex: 'stone' });
    vb.box(tx, towerH - 0.5, towerFaceZ + 0.1, 3.6, 0.5, 0.35, 0xe0cca8, { tex: 'stone' });
  }
  // 창: 어두운 틀 + 상인방 + 창턱, 일부는 불이 켜져 있다 (붉은 거리와 대비되는 따뜻한 노랑)
  const windowAt = (wx: number, wy: number, fz: number, lit: boolean): void => {
    vb.box(wx, wy, fz, 0.9, 1.3, 0.12, 0x24202a);
    vb.box(wx, wy + 1.3, fz + 0.04, 1.2, 0.22, 0.2, 0xe4d2ae, { tex: 'stone' });
    vb.box(wx, wy - 0.18, fz + 0.08, 1.2, 0.18, 0.3, 0xd8c4a0, { tex: 'stone' });
    if (lit) {
      vb.box(wx, wy + 0.1, fz + 0.07, 0.66, 1.0, 0.05, 0xffb040, { tex: 'glow' });
      vb.box(wx, wy + 1.55, fz + 0.04, 0.5, 1.4, 0.06, 0x1c1814); // 그을음 줄기
    } else {
      vb.box(wx, wy + 0.2, fz + 0.06, 0.6, 0.9, 0.04, 0x15121a);
    }
  };
  for (let k = 0; k < 6; k++) {
    const wxL = -16.6 + k * 2.3, wxR = 5.6 + k * 2.3;
    if (wxL < -5.6) { windowAt(wxL, 2.5, faceZ, hash2(k, 1, 915) < 0.4); windowAt(wxL + 1.1, 4.4, faceZ, hash2(k, 2, 915) < 0.5); }
    if (wxR > 5.4 && wxR < 17) { windowAt(wxR, 2.5, faceZ, hash2(k, 3, 915) < 0.4); windowAt(wxR + 1.1, 4.4, faceZ, hash2(k, 4, 915) < 0.5); }
  }
  for (const tx of [-3.5, 3.5]) { windowAt(tx - 0.8, 7.2, towerFaceZ, true); windowAt(tx + 0.8, 7.2, towerFaceZ, false); }
  // 성벽의 작은 출입문 (좌우 하나씩): 어두운 문 + 아치 + 계단 + 횃불
  for (const dx of [-9.2, 9.2]) {
    vb.box(dx, 0, faceZ, 1.5, 2.5, 0.14, 0x1e1a1c);
    vb.box(dx, 2.5, faceZ, 1.9, 0.3, 0.24, 0xe4d2ae, { tex: 'stone' });
    vb.box(dx, 0, faceZ + 0.2, 2.2, 0.14, 0.7, 0xb8a484, { tex: 'stone' });
    vb.box(dx - 1.2, 0, faceZ + 0.1, 0.18, 2.5, 0.2, 0xd8c4a0, { tex: 'stone' });
    vb.box(dx + 1.2, 0, faceZ + 0.1, 0.18, 2.5, 0.2, 0xd8c4a0, { tex: 'stone' });
    vb.box(dx + 1.45, 1.5, faceZ + 0.15, 0.1, 0.5, 0.1, PAL.wood[1], { tex: 'wood' }); // 횃불 자루
    vb.box(dx + 1.45, 2.0, faceZ + 0.15, 0.24, 0.3, 0.24, 0xffa020, { tex: 'flame' });
  }
  // 망루 발코니: 돌 난간 + 화로 불 (망루 중단)
  for (const tx of [-3.5, 3.5]) {
    vb.box(tx, 4.7, towerFaceZ + 0.45, 3.4, 0.22, 0.9, 0xcdb894, { tex: 'stone' });
    for (let k = 0; k < 5; k++) vb.box(tx - 1.5 + k * 0.75, 4.92, towerFaceZ + 0.82, 0.18, 0.7, 0.18, 0xe0cca8, { tex: 'stone' });
    vb.box(tx, 5.6, towerFaceZ + 0.82, 3.4, 0.14, 0.24, 0xe0cca8, { tex: 'stone' });
    vb.box(tx - 1.0, 4.92, towerFaceZ + 0.4, 0.55, 0.35, 0.55, 0x2a2428, { tex: 'stone' });
    vb.box(tx - 1.0, 5.27, towerFaceZ + 0.4, 0.4, 0.25, 0.4, 0xff7a1c, { tex: 'flame' });
    // 걸린 천 (적갈색 + 황토)
    vb.box(tx + 1.0, 2.6, towerFaceZ + 0.08, 0.5, 1.8, 0.05, tx < 0 ? 0xa83a2c : 0xd09a30, { tex: 'wool' });
  }
  // 균열과 그을음 줄기: 밋밋한 면을 깨뜨린다
  for (let k = 0; k < 14; k++) {
    const cx = -17 + hash2(k, 5, 917) * 34;
    if (Math.abs(cx) < 5.6) continue;
    const ch = 0.9 + hash2(k, 6, 917) * 1.8, cy = 0.6 + hash2(k, 7, 917) * 3.6;
    vb.box(cx, cy, faceZ + 0.02, 0.07, ch, 0.06, 0x1a1618);
    vb.box(cx + 0.14, cy + ch * 0.5, faceZ + 0.02, 0.07, ch * 0.5, 0.06, 0x1a1618);
    if (k % 3 === 0) vb.box(cx, cy + ch, faceZ + 0.015, 0.7, 2.2, 0.05, 0x2a2224); // 그을음
  }
  // 성벽 앞 화로 네 개 (바닥에서 올라오는 따뜻한 빛)
  for (const bx of [-12.5, -6.5, 6.5, 12.5]) {
    vb.box(bx, 0, faceZ + 0.9, 0.6, 0.7, 0.6, 0x3a343c, { tex: 'stone' });
    vb.box(bx, 0.7, faceZ + 0.9, 0.8, 0.18, 0.8, 0x1c181c, { tex: 'metal' });
    vb.box(bx, 0.88, faceZ + 0.9, 0.5, 0.3, 0.5, 0xff6a14, { tex: 'flame' });
    vb.box(bx, 1.15, faceZ + 0.9, 0.26, 0.28, 0.26, 0xffcf50, { tex: 'flame' });
  }

  // 4. 롯의 2층 흙벽돌 가옥 (남서쪽 x: -7, z: 2)
  // 폭 6.8m, 높이 5.2m, 깊이 5.8m. 문은 x: -3.4, z: 2 에 위치
  const lotHouse = new THREE.Group();
  lotHouse.position.set(-7, 0, 2);
  root.add(lotHouse);

  buildMudbrickBuilding(vb, col, -7, 2, 6.6, 5.0, 5.6, {
    brickColor: 0xd8b890,
    roofColor: 0x8a6048,
    doorPos: { side: 'east', offset: 0, dw: 1.2, dh: 2.4 }, // x=-3.7 지점 문
    litWindows: [
      { side: 'east', y: 3.4, offset: -1.2 },
      { side: 'north', y: 3.2, offset: -1.5 },
      { side: 'south', y: 2.2, offset: 1.0 },
    ],
    awning: true,
    wallTex: 'plaster',
  });

  // 롯의 가옥 문 인터랙션 지점 (-3.4, 0, 2) 앞 발판석
  vb.box(-3.4, 0.02, 2, 1.4, 0.08, 1.6, PAL.stone[3], { tex: 'stone' });
  // 가옥 옥상 오르는 외벽 목재 계단
  for (let s = 0; s < 7; s++) {
    const sy = s * 0.45;
    const sz = 2 - 2.2 + s * 0.65;
    vb.box(-3.5, sy, sz, 0.8, 0.4, 0.6, PAL.wood[1], { tex: 'wood' });
  }

  // 5. 소돔 시가지 밀집 흙벽돌 주택들 (불타는 가옥들)
  // 서북쪽 주택 (x: -12.5, z: -4.5)
  buildMudbrickBuilding(vb, col, -12.5, -4.5, 5.2, 4.4, 5.0, {
    brickColor: 0xb8a088,
    roofColor: 0x6e4a3c,
    doorPos: { side: 'east', offset: 0, dw: 1.0, dh: 2.0 },
    litWindows: [{ side: 'east', y: 2.8, offset: 0.8 }],
    wallTex: 'plaster',
  });
  // 남서쪽 주택 (x: -12.5, z: 7.5)
  buildMudbrickBuilding(vb, col, -12.5, 7.5, 5.0, 4.0, 5.2, {
    brickColor: 0xe0c49c,
    roofColor: 0x7a5440,
    doorPos: { side: 'north', offset: 0, dw: 1.0, dh: 2.0 },
    litWindows: [{ side: 'north', y: 2.5, offset: -0.8 }],
    wallTex: 'plaster',
  });
  // 동북쪽 주택 (x: 12.0, z: -4.5)
  buildMudbrickBuilding(vb, col, 12.0, -4.5, 5.4, 4.6, 5.2, {
    brickColor: 0xc8a888,
    doorPos: { side: 'west', offset: 0, dw: 1.0, dh: 2.0 },
    litWindows: [{ side: 'west', y: 2.8, offset: -0.8 }],
    wallTex: 'plaster',
  });
  // 동남쪽 주택 (x: 12.5, z: 3.5)
  buildMudbrickBuilding(vb, col, 12.5, 3.5, 5.2, 4.2, 4.8, {
    brickColor: 0xa89484,
    doorPos: { side: 'west', offset: 0, dw: 1.0, dh: 2.0 },
    litWindows: [{ side: 'west', y: 2.6, offset: 0.8 }],
    wallTex: 'plaster',
  });

  // 6. 소알을 향한 탈출로 언덕 및 소금 기둥 (남동쪽 x: 8, z: 7)
  // 계단식 바위 언덕길
  vb.box(8, 0, 7, 7.5, 1.4, 7.5, PAL.stone[2], { tex: 'cliff' });
  vb.box(9.2, 1.4, 7.8, 5.0, 1.2, 5.5, PAL.stone[3], { tex: 'cliff' });
  col.addBox(8.8, 7.6, 6.5, 6.5);

  // 탈출로 디딤 바위들 (접근성 보장)
  vb.box(5.8, 0, 5.8, 1.8, 0.4, 1.8, PAL.stone[2], { tex: 'stone' });
  vb.box(6.8, 0.4, 6.4, 1.6, 0.5, 1.6, PAL.stone[3], { tex: 'stone' });

  // 소금 기둥 (뒤를 돌아보는 롯의 아내 실루엣)
  const saltPillar = new THREE.Group();
  saltPillar.position.set(8, 1.4, 7);
  const saltVb = new VoxelBuilder(16, false);
  // 흰 소금 결정 받침대
  saltVb.box(0, 0, 0, 1.8, 0.6, 1.8, reg.saltPillar, { tex: 'cliff' });
  // 휘몰아치는 소금옷 드레이프 몸체
  saltVb.box(0, 0.6, 0, 0.85, 1.6, 0.85, reg.saltPillar, { tex: 'plain' });
  saltVb.box(0, 2.2, 0, 0.65, 0.65, 0.65, reg.saltPillar, { tex: 'plain' }); // 머리
  // 뒤(소돔 성문 북쪽)를 애처롭게 돌아보는 머리 각도 및 옷자락
  saltVb.box(-0.25, 2.25, -0.2, 0.35, 0.4, 0.35, reg.saltPillar, { tex: 'plain' });
  saltVb.box(0.3, 0.8, -0.25, 0.3, 1.0, 0.4, reg.saltPillar, { tex: 'plain' });
  saltPillar.add(saltVb.build());
  root.add(saltPillar);

  // 7. 타오르는 지붕과 무너진 잔해의 피어오르는 연기 기둥들
  buildSmokeColumn(vb, -12.5, 4.4, -4.5, 8.5, 601, 0x342f2b);
  buildSmokeColumn(vb, 12.0, 4.6, -4.5, 9.0, 602, 0x3d3632);
  buildSmokeColumn(vb, -3.5, 9.2, -11.5, 7.5, 603, 0x443d38);
  buildSmokeColumn(vb, 3, 0, 2, 6.0, 604, 0x554c46); // 거리의 불타는 잔해

  // 8. 거리의 무너진 석재 잔해, 숯 덩어리 및 부서진 목재
  P.rock(vb, col, 2.8, -1.5, 1.6);
  P.rock(vb, col, -1.8, -4.2, 1.4);
  P.rock(vb, col, 4.5, -5.5, 1.5);
  P.rock(vb, col, -4.5, 6.2, 1.3);

  // 무너진 사암 기둥 잔해 (거리 한가운데 쓰러짐)
  vb.box(2.2, 0, 0.8, 1.2, 0.7, 2.8, PAL.stone[2], { tex: 'stone', jitter: 0.05 });
  col.addBox(2.2, 0.8, 1.4, 3.0);

  // 9. 거리 조명 및 소품 (횃불대, 물항아리 클러스터, 바구니, 마른 관목)
  buildTorchStand(vb, col, -2.5, -2.0, 2.2);
  buildTorchStand(vb, col, 2.5, -2.0, 2.2);
  buildTorchStand(vb, col, 5.0, 3.0, 2.0);

  buildStoragePropCluster(vb, -4.2, 0.2, 5, 711);
  buildStoragePropCluster(vb, 4.5, -3.2, 4, 712);

  P.bush(vb, col, -8.0, -8.0, 0.9, PAL.shrub);
  P.bush(vb, col, 7.5, -8.5, 0.9, PAL.shrub);
  P.bush(vb, col, -9.5, 3.5, 0.8, PAL.shrub);

  // 거리 드레싱: 피난 짐·부서진 수레·돌무더기 군락 (붉은 거리가 한 색 면으로 보이지 않게)
  const dr = new Dressing(vb, col, 1700);
  dr.supplyPile(-9.0, -7.5, 4); dr.supplyPile(8.5, 11.0, 4); dr.supplyPile(-2.0, 10.0, 4);
  dr.rocks(0.5, 5.5, 3, 0xb09a88); dr.rocks(-14.0, 0.5, 3, 0xb09a88); dr.rocks(14.0, 8.0, 3, 0xb09a88);
  dr.rocks(4.0, 12.5, 4, 0xb09a88); dr.rocks(-8.0, 12.0, 3, 0xb09a88);
  dr.shrubs(-5.5, -6.5, 2, [0x6a5a3c, 0x7a6a44]); dr.shrubs(7.0, 10.0, 2, [0x6a5a3c, 0x7a6a44]);

  scatterGroundCover(vb, col, { seed: 601, half: 18, count: 110, tufts: [0x7a5a38, 0x8a6a40, 0x5a4028], pebbles: [0x5e4a40, 0x7a5a48, 0x3a2a24] });
  const stageMesh = vb.build();
  root.add(stageMesh);

  // 10. 유황불 낙하 조명들 (포인트 라이트)
  const sulfurLights: THREE.PointLight[] = [];
  const lightPositions = [
    { x: -5, y: 3.5, z: 2 },
    { x: 4, y: 2.8, z: -4 },
    { x: 0, y: 4.5, z: -8 },
    { x: 8, y: 3.0, z: 5 },
  ];

  lightPositions.forEach((pos) => {
    const light = new THREE.PointLight(0xff3a14, 2.4, 12, 1.8);
    light.position.set(pos.x, pos.y, pos.z);
    root.add(light);
    sulfurLights.push(light);
  });

  col.bounds = { minX: -14.5, maxX: 14.5, minZ: -14.5, maxZ: 14.5 };

  // per-frame zero allocation update
  const update = (_dt: number, time: number) => {
    for (let i = 0; i < sulfurLights.length; i++) {
      sulfurLights[i].intensity = 2.4 + Math.sin(time * 9.0 + i * 2.0) * 0.55;
    }
  };

  return {
    root,
    col,
    bounds: col.bounds,
    lotHouse,
    saltPillar,
    sulfurLights,
    update,
  };
}
