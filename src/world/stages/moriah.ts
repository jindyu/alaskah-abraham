import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL } from '../palette';
import { Collision } from '../collision';
import { buildStoneAltar } from '../props/biblicalProps';
import * as P from '../props';
import { Donkey, RamInThicket } from '../../entities/animals';
import { buildFarField, buildHorizonPlane, scatterGroundCover, tintColor } from './common';
import {
  createStageGroundMesh,
  buildPerimeterRidges,
  buildSplitWoodBundle,
  buildSmokeColumn,
} from './scenery36';
import { fbm, hash2, valueNoise } from '../../core/rng';

export interface MoriahStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  altar: THREE.Group;
  ram: RamInThicket;
  donkey: Donkey;
  divineLight: THREE.PointLight;
  update: (dt: number, time: number) => void;
}

const MORIAH_HALF = 18;

/** 모리아 산 고해상도 지면: 거친 화강암 쇄석, 험준한 산악 암반, 갈색 고원 흙 */
function buildMoriahGroundMesh(): THREE.Mesh {
  const resolution = 480;

  return createStageGroundMesh(MORIAH_HALF, resolution, (x, z, _u, _v, i, j) => {
    // 1. 산악 암반 및 거친 돌조각 기본 지면
    const nRock = fbm(x / 6, z / 6, 701, 2) * 0.5 + valueNoise(i / 12, j / 12, 702) * 0.3 + hash2(i, j, 703) * 0.2;
    let c = nRock > 0.65 ? 0x9e988e : nRock > 0.4 ? PAL.stone[1] : 0x6e6860;

    // 뾰족한 화산암/석회암 쇄석 스펙클
    const hGrit = hash2(i, j, 705);
    if (hGrit < 0.02) c = 0x48423c;
    else if (hGrit > 0.98) c = 0xc8c2b4;

    // 2. 남쪽 기슭 베이스캠프 (z: 5 ~ 12, x: -7 ~ 7) 다져진 흙
    if (z >= 5.0 && z <= 12.0 && Math.abs(x) < 7.5) {
      const nCamp = fbm(x * 1.5, z * 1.5, 711, 2);
      if (nCamp > 0.4) {
        c = 0x7e5e40; // 마른 황토
        if (hash2(i, j, 713) < 0.05) c = 0x9a7652;
      }
    }

    // 3. 지그재그 등산로 길 (스위치백 트레일)
    // z=8(남) -> z=3(우) -> z=-1(좌) -> z=-6(정상)
    let dPath = 999;
    if (z >= 4.0 && z <= 8.5) dPath = Math.abs(x - 0);
    else if (z >= 1.0 && z < 4.0) dPath = Math.abs(x - (1.5 - (z - 1.0) * 0.8));
    else if (z >= -2.5 && z < 1.0) dPath = Math.abs(x - (-1.8 + (z + 2.5) * 0.9));
    else if (z >= -6.5 && z < -2.5) dPath = Math.abs(x - (0 - (z + 6.5) * 0.4));

    if (dPath < 1.4) {
      const nPath = valueNoise(i / 8, j / 8, 721);
      c = nPath > 0.5 ? 0x8a7258 : 0x78624a;
      if (hash2(i, j, 723) < 0.04) c = 0xb29e84; // 밟혀서 드러난 밝은 자갈
    }

    // 4. 정상 번제단 바위 대지 (z: -10 ~ -5, |x| < 6)
    if (z <= -5.0 && Math.abs(x) < 5.8) {
      const nSummit = fbm(x * 2, z * 2, 731, 2);
      c = nSummit > 0.5 ? PAL.stone[2] : 0x827c74;
    }

    return c;
  });
}

/**
 * 제5권 모리아 산 3D 복셀 무대
 */
export function buildMoriahStage(): MoriahStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16

  // 1. 모리아 원경 지평선 및 고해상도 지면 메쉬
  root.add(buildHorizonPlane(0xa8a29e, 360, -0.05, 0.2));
  root.add(buildMoriahGroundMesh());


  buildFarField(root, MORIAH_HALF, { seed: 5, pal: [0x4c4a50, 0x5e5a5c, 0x74706c, 0x8a847a], tex: 'cliff', accents: [0x7e7870], haze: 0xa8a29e, depth: 44, ground: 0x6a6460, rim: { min: 2.6, max: 5.2, south: 0.4 } });
  // 2. 외곽 공허 차단: 깎아지른 모리아 산맥의 거대한 연봉과 바위 협곡 (높이 4.5m ~ 9.0m)
  buildPerimeterRidges(vb, col, MORIAH_HALF, [0x5a5a62, 0x6a645e, 0x7c746a, 0x4c4a52], {
    seed: 701,
    minH: 3.6,
    maxH: 7.0,
    tex: 'cliff',
  });

  // 3. 지그재그(스위치백) 등산로와 계단식 산악 지형 구축
  // 단 하나의 색 덩어리로 뭉개지지 않게: 단마다 아래는 어두운 지층띠, 위는 햇빛 받는 밝은 암반, 가장자리에 풀·잔돌 턱
  const tier = (cx: number, cz: number, w: number, d: number, h: number, top: number, low: number): void => {
    const bands = Math.max(2, Math.round(h / 0.6));
    for (let k = 0; k < bands; k++) {
      const t = (k + 1) / bands;
      const c = k % 2 === 0 ? tintColor(low, 0.85 + t * 0.4) : tintColor(top, 0.78 + t * 0.4);
      const inset = (1 - t) * 0.0;
      vb.box(cx, (h / bands) * k, cz, w - inset, h / bands + 0.01, d - inset, c, { tex: 'cliff', jitter: 0.06 });
    }
    // 윗면 밝은 캡 (바위 선반)
    vb.box(cx, h, cz, w - 0.2, 0.12, d - 0.2, tintColor(top, 1.18), { tex: 'stone', jitter: 0.05 });
    // 가장자리 풀턱 (앞쪽과 좌우)
    for (let k = 0; k < Math.round(w * 1.4); k++) {
      const gx = cx - w / 2 + 0.3 + (k / Math.round(w * 1.4)) * (w - 0.6);
      const gh = 0.15 + hash2(k, Math.round(cz * 3), 761) * 0.22;
      vb.box(gx, h + 0.1, cz + d / 2 - 0.16, 0.4, gh, 0.3, tintColor(0x6a8a48, 0.8 + hash2(k, Math.round(h * 5), 763) * 0.4), { tex: 'leafVine', jitter: 0.06 });
    }
  };

  // 3-1. 기슭 베이스캠프 평지 (y: 0, z: 6 ~ 12)
  vb.box(0, 0, 9, 14, 0.35, 8, 0xa88458, { tex: 'soil' });

  // 3-2. 등산로 1단계 테라스 (y: 0.9, z: 4.2)
  tier(0.5, 4.2, 8.5, 4.2, 0.9, 0xb09a78, 0x86745a);
  col.addBox(0.5, 4.2, 8.5, 4.2);
  // 계단 1: 남쪽에서 오르는 돌계단 (밝은 석재)
  for (let s = 0; s < 3; s++) {
    vb.box(0, s * 0.3, 6.4 - s * 0.5, 3.2, 0.3, 0.6, 0xd2c4a4, { tex: 'stone' });
  }

  // 3-3. 등산로 2단계 테라스 및 우측 지그재그 굽이 (y: 1.8, z: 1.0)
  tier(1.5, 1.0, 8.0, 4.2, 1.8, 0xbca88a, 0x8a7860);
  col.addBox(1.5, 1.0, 8.0, 4.2);
  for (let s = 0; s < 3; s++) {
    vb.box(1.8 - s * 0.3, 0.9 + s * 0.3, 2.8, 0.7, 0.3, 2.4, 0xd8cab0, { tex: 'stone' });
  }

  // 3-4. 등산로 3단계 테라스 및 좌측 지그재그 굽이 (y: 2.7, z: -2.8)
  tier(-1.2, -2.8, 8.5, 4.4, 2.7, 0xc8b898, 0x90806a);
  col.addBox(-1.2, -2.8, 8.5, 4.4);
  for (let s = 0; s < 3; s++) {
    vb.box(-0.2 - s * 0.4, 1.8 + s * 0.3, -1.0, 0.8, 0.3, 2.2, 0xdccfb4, { tex: 'stone' });
  }

  // 3-5. 모리아 산 정상 번제단 바위 단상 (y: 4.0, z: -7.0)
  tier(0, -7.0, 11.5, 8.5, 4.0, 0xd2c2a2, 0x988670);
  col.addBox(0, -7.0, 11.5, 8.5);
  for (let s = 0; s < 4; s++) {
    vb.box(0, 2.8 + s * 0.3, -4.6 - s * 0.45, 3.4, 0.3, 0.55, 0xe0d4b8, { tex: 'stone' });
  }
  // 정상 번제단 터: 밝은 포석 마당 + 테두리 돌, 한눈에 '제단 구역'이 읽히게
  vb.box(0, 4.12, -7.0, 7.4, 0.06, 5.6, 0xe6dabe, { tex: 'stone', jitter: 0.03 });
  vb.box(0, 4.18, -7.0, 5.2, 0.05, 3.6, 0xf0e6cc, { tex: 'stone', jitter: 0.03 });
  for (let k = 0; k < 12; k++) {
    const sx = -3.4 + k * 0.62;
    vb.box(sx, 4.12, -9.9, 0.5, 0.28 + hash2(k, 1, 771) * 0.18, 0.4, tintColor(0xc8b898, 0.9 + hash2(k, 2, 773) * 0.3), { tex: 'stone' });
  }
  // 정상 뒤편 큰 바위와 마른 소나무 같은 관목으로 정상의 윤곽을 만든다
  vb.box(-4.4, 4.0, -9.4, 2.0, 1.6, 1.6, 0xb8a888, { tex: 'cliff' });
  vb.box(-4.1, 5.6, -9.3, 1.3, 0.9, 1.1, 0xcabc9c, { tex: 'cliff' });
  vb.box(4.6, 4.0, -9.4, 1.8, 1.3, 1.5, 0xb8a888, { tex: 'cliff' });
  vb.box(4.5, 5.3, -9.3, 1.1, 0.8, 1.0, 0xcabc9c, { tex: 'cliff' });

  // 등산로 벼랑길 안전 난간석/디딤돌 (Cairns & Kerbs)
  vb.box(4.2, 0.9, 4.0, 0.5, 0.6, 3.5, PAL.stone[3], { tex: 'stone' });
  vb.box(-4.5, 2.7, -2.5, 0.5, 0.6, 3.6, PAL.stone[3], { tex: 'stone' });
  vb.box(-5.2, 4.0, -7.0, 0.6, 0.7, 7.5, PAL.stone[3], { tex: 'cliff' }); // 정상 서쪽 난간벽
  vb.box(5.2, 4.0, -7.0, 0.6, 0.7, 7.5, PAL.stone[3], { tex: 'cliff' }); // 정상 동쪽 난간벽

  // 4. 산 정상 돌 번제단 (아케다 제단: x: 0, y: 4.0, z: -7)
  const altar = buildStoneAltar(true);
  altar.position.set(0, 4.0, -7);
  root.add(altar);

  // 제단 위 정갈하게 벌여놓은 쪼갠 장작더미 (아브라함이 벌여놓은 나무)
  vb.box(0, 5.2, -7, 1.8, 0.35, 1.4, PAL.wood[2], { tex: 'wood' });
  vb.box(0, 5.55, -7, 1.5, 0.25, 1.2, PAL.wood[1], { tex: 'wood' });

  // 제단 옆 예비 장작더미
  buildSplitWoodBundle(vb, col, -2.8, 4.0, -7.0, 1.5, 0.8, 1.0);

  // 제단 취사용 불씨 화로 및 칼 놓는 바위
  vb.box(2.0, 4.0, -6.0, 0.8, 0.45, 0.8, PAL.stone[3], { tex: 'stone' });
  vb.box(2.0, 4.45, -6.0, 0.5, 0.25, 0.5, 0x8a5a2a, { tex: 'metal' });
  vb.box(2.0, 4.7, -6.0, 0.25, 0.2, 0.25, 0xff5a10, { tex: 'flame' }); // 타오르는 숯불

  // 5. 수풀에 뿔이 걸린 숫양 (여호와 이레: x: 3.2, z: -7.5)
  // 정상 동북쪽 바위 틈새 빽빽한 가시덤불
  const ram = new RamInThicket(3.2, -7.5);
  ram.root.position.y = 4.0; // 정상 높이 맞춤
  root.add(ram.root);
  col.addBox(3.2, -7.5, 2.2, 2.2);

  // 가시덤불 수풀 복셀 (숫양을 감싸는 덤불)
  vb.box(3.2, 4.0, -8.2, 1.8, 1.2, 1.2, 0x3e522c, { tex: 'leafVine' });
  vb.box(4.0, 4.0, -7.5, 1.2, 1.3, 1.6, 0x4a6234, { tex: 'leafVine' });
  vb.box(2.5, 4.0, -8.0, 1.0, 1.0, 1.0, 0x354626, { tex: 'leafVine' });
  vb.box(3.2, 5.0, -7.8, 1.4, 0.6, 1.4, 0x58763e, { tex: 'leafVine' });

  // 6. 산기슭 베이스캠프 (종들과 나귀가 머무는 곳: x: -3, z: 8)
  const donkey = new Donkey(-3, 8);
  root.add(donkey.root);
  col.addBox(-3, 8, 2.4, 2.0);

  // 나귀 옆 짐꾸러미, 가죽 부대, 안장
  vb.box(-4.5, 0.35, 7.8, 0.8, 0.5, 0.8, PAL.wood[1], { tex: 'wood' });
  vb.box(-4.5, 0.35, 8.8, 0.7, 0.6, 0.6, PAL.fur.dark, { tex: 'wool' }); // 안장낭
  vb.box(-2.0, 0.35, 9.2, 0.5, 0.4, 0.7, 0x6e4828, { tex: 'plain' }); // 물가죽

  // 종들의 야외 모닥불 및 나귀 풀단
  P.campfire(vb, col, 2.0, 8.5);
  vb.box(-1.8, 0.35, 7.8, 1.2, 0.4, 0.8, PAL.straw[1], { tex: 'reed' }); // 건초 더미

  // 7. 제단 연기 기둥 (하늘을 향해 곧게 솟구침)
  buildSmokeColumn(vb, 0, 5.4, -7.0, 9.5, 801, 0x5e5650);

  // 8. 험준한 산악 바위들과 고산 지대 마른 관목들 (30-60 소품)
  P.rock(vb, col, -7.0, 3.0, 2.2);
  P.rock(vb, col, 7.5, 2.5, 2.0);
  P.rock(vb, col, -8.5, -6.0, 2.6);
  P.rock(vb, col, 8.5, -5.5, 2.4);
  P.rock(vb, col, -5.5, 9.5, 1.8);
  P.rock(vb, col, 6.0, 9.0, 1.9);

  P.bush(vb, col, -4.5, -2.5, 1.0, PAL.shrub);
  P.bush(vb, col, 4.5, -3.0, 1.1, PAL.shrub);
  P.bush(vb, col, -6.5, 5.5, 0.9, PAL.shrub);
  P.bush(vb, col, 5.5, 6.0, 0.9, PAL.shrub);
  P.bush(vb, col, -2.5, 4.0, 0.8, PAL.shrub);

  scatterGroundCover(vb, col, { seed: 701, half: 18, count: 224, flowers: [0xf0e8c0,0xe0b0c8], tufts: [0x7a8a58,0x6a7a4c,0x8a9a64], pebbles: [0x7e7870,0x9d968a,0x5e5a58] });
  const stageMesh = vb.build();
  root.add(stageMesh);

  // 9. 하나님의 영광과 여호와의 사자의 음성 (신령한 천상의 빛 조명)
  const divineLight = new THREE.PointLight(0xffea90, 2.5, 18, 1.4);
  divineLight.position.set(0, 7.5, -7.0);
  root.add(divineLight);

  col.bounds = { minX: -14.5, maxX: 14.5, minZ: -14.5, maxZ: 14.5 };

  // per-frame zero allocation update
  const update = (_dt: number, time: number) => {
    divineLight.intensity = 2.5 + Math.sin(time * 6.0) * 0.4;
  };

  return {
    root,
    col,
    bounds: col.bounds,
    altar,
    ram,
    donkey,
    divineLight,
    update,
  };
}
