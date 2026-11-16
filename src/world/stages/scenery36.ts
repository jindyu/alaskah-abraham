import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { Collision } from '../collision';
import { PAL } from '../palette';
import { Px, TD } from '../textures';
import { Canopy } from '../foliage';
import { fbm, hash2, valueNoise } from '../../core/rng';
import * as P from '../props';
import { groundVariation, tintColor } from './common';

/**
 * 무대 지면 고해상도 DataTexture 평면 생성
 */
export function createStageGroundMesh(
  half: number,
  resolution: number,
  paint: (x: number, z: number, u: number, v: number, i: number, j: number) => number,
): THREE.Mesh {
  const px = new Px(resolution, resolution);
  const toWorld = (idx: number) => -half + ((idx + 0.5) / resolution) * (half * 2);

  for (let j = 0; j < resolution; j++) {
    const z = toWorld(j);
    const v = j / resolution;
    for (let i = 0; i < resolution; i++) {
      const x = toWorld(i);
      const u = i / resolution;
      const c = groundVariation(paint(x, z, u, v, i, j), x, z, half % 7);
      px.set(i, j, c);
    }
  }

  const tex = px.toTexture();
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2, half * 2),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.01;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * 외곽 능선 한 칸: 캐릭터·소품 복셀과 밀도가 맞게 ~0.7유닛 기둥 격자로 쌓은 둔덕.
 * 가운데가 솟고 가장자리로 낮아지는 윤곽에 노이즈를 얹고 0.2 단위로 양자화 → 계단식 지층 실루엣.
 * 높이 띠마다 두 지층색이 번갈고, 꼭대기는 햇빛 받은 밝은 얇은 캡을 얹는다. (무대 빌드 때만 호출 — 프레임당 할당 아님)
 */
export function ridgeMound(
  vb: VoxelBuilder, x: number, z: number, wx: number, wz: number, h: number,
  c1: number, c2: number, tex: 'cliff' | 'dune' | 'soil' | 'stone' | 'brick',
): void {
  // 위치에서 결정되는 난수 → 같은 무대는 항상 같은 모양, 이웃 칸끼리는 전혀 다른 모양
  const r = (k: number) => hash2(Math.round(x * 13) + k * 101, Math.round(z * 13) - k * 57, 977);
  const hh = h * (0.8 + r(2) * 0.5);
  const CELL = 0.9;
  const nx = Math.max(2, Math.round(wx / CELL)), nz = Math.max(2, Math.round(wz / CELL));
  const cw = wx / nx, cd = wz / nz;
  const band = 0.95 + r(7) * 0.5;                             // 지층 띠 두께
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const u = ((i + 0.5) / nx) * 2 - 1, v = ((j + 0.5) / nz) * 2 - 1;
      const px = x + u * wx / 2, pz = z + v * wz / 2;
      const edge = Math.max(Math.abs(u), Math.abs(v));
      const prof = 1 - Math.pow(edge, 1.7) * 0.85;
      const nse = 0.65 + valueNoise(px * 1.3, pz * 1.3, 987) * 0.6;
      const ch = Math.max(0.2, Math.round((hh * prof * nse) / 0.2) * 0.2);
      // 층 단위로 아래서부터 쌓는다 (높이 띠마다 색이 바뀜)
      let y = 0, k = 0;
      while (y < ch - 0.01) {
        const lh = Math.min(band * (0.8 + hash2(i + k * 7, j, 991) * 0.5), ch - y);
        const t = (y + lh) / Math.max(hh, 0.5);
        const base = k % 2 === 0 ? c1 : c2;
        const top = y + lh >= ch - 0.01; // 맨 위 층은 햇빛 받아 밝게 (별도 캡 박스 없이 삼각형 절약)
        const cc = tintColor(base, 0.72 + t * 0.3 + (top ? 0.2 : 0) + (hash2(i, j + k * 5, 993) - 0.5) * 0.14, (r(20 + (k % 5)) - 0.5) * 0.14);
        vb.box(px, y, pz, cw + 0.04, lh + 0.02, cd + 0.04, cc, { tex, jitter: 0.05 });
        y += lh; k++;
      }
    }
  }
  // 산기슭 굴러내린 바위
  const rocks = Math.floor(r(90) * 3.2);
  for (let k = 0; k < rocks; k++) {
    const rs = 0.25 + r(91 + k) * 0.35;
    vb.box(x + (r(95 + k) - 0.5) * wx * 1.1, 0, z + (r(99 + k) - 0.5) * wz * 1.1, rs, rs * 0.7, rs * 0.9, tintColor(c1, 0.75 + r(103 + k) * 0.3), { tex, jitter: 0.05 });
  }
}

/**
 * 맵 외곽 언덕/절벽 경계 (공허 차단)
 */
export function buildPerimeterRidges(
  vb: VoxelBuilder,
  col: Collision,
  half: number,
  pal: readonly number[],
  opts: {
    seed?: number;
    minH?: number;
    maxH?: number;
    tex?: 'cliff' | 'dune' | 'soil' | 'stone' | 'brick';
    openEast?: boolean;
    openSouth?: boolean;
    openNorth?: boolean;
    openWest?: boolean;
  } = {},
): void {
  const seed = opts.seed ?? 101;
  const minH = opts.minH ?? 2.8;
  const maxH = opts.maxH ?? 5.5;
  const tex = opts.tex ?? 'cliff';
  const step = 2.4;

  // 시각 외곽(능선·절벽)은 buildFarField 의 rim 이 그린다 — 여기서는 충돌체만 등록 (무대당 하나의 가장자리 언어)
  void vb; void pal; void seed; void minH; void maxH; void tex; void step;

  // 외곽 충돌체 등록 (플레이어가 맵 밖으로 나가지 못하게 고정)
  const d = half - 0.5;
  if (!opts.openNorth) col.addBox(0, -d, half * 2 + 4, 3.0);
  if (!opts.openSouth) col.addBox(0, d, half * 2 + 4, 3.0);
  if (!opts.openWest) col.addBox(-d, 0, 3.0, half * 2 + 4);
  if (!opts.openEast) col.addBox(d, 0, 3.0, half * 2 + 4);
}

/**
 * 흙벽돌 가옥 (창문 발광, 옥상 테라스 난간, 돌출 서까래)
 */
export function buildMudbrickBuilding(
  vb: VoxelBuilder,
  col: Collision,
  x: number,
  z: number,
  w: number,
  h: number,
  d: number,
  opts: {
    brickColor?: number;
    roofColor?: number;
    doorPos?: { side: 'north' | 'south' | 'east' | 'west'; offset?: number; dw?: number; dh?: number };
    litWindows?: { side: 'north' | 'south' | 'east' | 'west'; y: number; offset: number }[];
    awning?: boolean;
    seed?: number;
    /** 벽 질감 (기본 벽돌, 'plaster' 는 회벽 — 색이 벽돌색에 눌리지 않는다) */
    wallTex?: 'brick' | 'plaster';
  } = {},
): void {
  const seed = opts.seed ?? 331;
  const wallTex = opts.wallTex ?? 'brick';
  const bColor = opts.brickColor ?? PAL.brick[1];
  const rColor = opts.roofColor ?? PAL.brick[2];

  // 메인 건물 몸통
  vb.box(x, 0, z, w, h, d, bColor, { tex: wallTex, jitter: 0.02 });
  col.addBox(x, z, w + 0.3, d + 0.3);

  // 옥상 테라스 난간 (사방 0.4m 돌출 난간)
  const parapetH = 0.6;
  vb.box(x, h, z - d / 2 + 0.15, w, parapetH, 0.3, rColor, { tex: 'brick' });
  vb.box(x, h, z + d / 2 - 0.15, w, parapetH, 0.3, rColor, { tex: 'brick' });
  vb.box(x - w / 2 + 0.15, h, z, 0.3, parapetH, d - 0.6, rColor, { tex: 'brick' });
  vb.box(x + w / 2 - 0.15, h, z, 0.3, parapetH, d - 0.6, rColor, { tex: 'brick' });

  // 옥상 바닥 차양/바닥판
  vb.box(x, h - 0.1, z, w - 0.4, 0.15, d - 0.4, PAL.dirt[2], { tex: 'mudRoof' });

  // 건물 상단 돌출 서까래 목재들 (고대 근동 특유의 돌출 들보)
  const beamCount = Math.max(2, Math.floor(w / 1.4));
  for (let i = 0; i < beamCount; i++) {
    const bx = x - w / 2 + 0.5 + (i / Math.max(1, beamCount - 1)) * (w - 1.0);
    vb.box(bx, h - 0.35, z, 0.18, 0.18, d + 0.4, PAL.wood[1], { tex: 'wood' });
  }

  // 문 배치
  if (opts.doorPos) {
    const { side, offset = 0, dw = 1.0, dh = 2.0 } = opts.doorPos;
    let dx = x, dz = z;
    if (side === 'south') { dz = z + d / 2 + 0.02; dx = x + offset; }
    else if (side === 'north') { dz = z - d / 2 - 0.02; dx = x + offset; }
    else if (side === 'east') { dx = x + w / 2 + 0.02; dz = z + offset; }
    else if (side === 'west') { dx = x - w / 2 - 0.02; dz = z + offset; }

    const isEW = side === 'east' || side === 'west';
    vb.box(dx, 0, dz, isEW ? 0.06 : dw, dh, isEW ? dw : 0.06, PAL.wood[0], { tex: 'wood' });
    // 문 상단 목재 상인방
    vb.box(dx, dh, dz, isEW ? 0.2 : dw + 0.3, 0.25, isEW ? dw + 0.3 : 0.2, PAL.wood[2], { tex: 'wood' });
  }

  // 빛나는 창문 배치 (tex: 'glow')
  if (opts.litWindows) {
    for (const win of opts.litWindows) {
      let wx = x, wz = z;
      const isEW = win.side === 'east' || win.side === 'west';
      if (win.side === 'south') { wz = z + d / 2 + 0.03; wx = x + win.offset; }
      else if (win.side === 'north') { wz = z - d / 2 - 0.03; wx = x + win.offset; }
      else if (win.side === 'east') { wx = x + w / 2 + 0.03; wz = z + win.offset; }
      else if (win.side === 'west') { wx = x - w / 2 - 0.03; wz = z + win.offset; }

      // 창살 프레임 + 발광 창
      const winColor = 0xffba42; // 온화한 등불빛
      vb.box(wx, win.y, wz, isEW ? 0.04 : 0.6, 0.6, isEW ? 0.6 : 0.04, winColor, { tex: 'glow' });
      // 창틀 십자살
      vb.box(wx, win.y, wz, isEW ? 0.06 : 0.65, 0.08, isEW ? 0.65 : 0.06, PAL.wood[1], { tex: 'wood' });
      vb.box(wx, win.y, wz, isEW ? 0.06 : 0.08, 0.65, isEW ? 0.08 : 0.06, PAL.wood[1], { tex: 'wood' });
    }
  }

  // 옥상 차양막 (대나무/갈대 차양)
  if (opts.awning) {
    const ax = x + 0.2;
    const az = z + 0.2;
    vb.box(ax, h + parapetH, az, w * 0.6, 0.08, d * 0.5, PAL.straw[1], { tex: 'reed' });
    // 기둥 2개
    vb.box(ax - w * 0.26, h, az - d * 0.2, 0.1, parapetH + 0.05, 0.1, PAL.wood[1], { tex: 'wood' });
    vb.box(ax + w * 0.26, h, az - d * 0.2, 0.1, parapetH + 0.05, 0.1, PAL.wood[1], { tex: 'wood' });
  }
}

/**
 * 피어오르는 연기 기둥 (소돔 화염, 모리아 제단, 야외 화덕)
 */
export function buildSmokeColumn(
  vb: VoxelBuilder,
  x: number,
  y0: number,
  z: number,
  totalH: number,
  seed = 441,
  color = 0x48423e,
): void {
  const steps = Math.floor(totalH / 0.7);
  let curX = x;
  let curZ = z;

  for (let s = 0; s < steps; s++) {
    const progress = s / steps;
    const y = y0 + s * 0.65;
    const size = 0.45 + progress * 0.85;
    curX += (hash2(s, 1, seed) - 0.45) * 0.35;
    curZ += (hash2(s, 2, seed) - 0.45) * 0.35;

    // 단계별 연기 복셀 덩어리
    const colFade = progress > 0.6 ? 0x6e6862 : color;
    vb.box(curX, y, curZ, size, 0.5, size, colFade, { tex: 'plain', jitter: 0.08 });
    if (s % 2 === 0 && s > 0) {
      vb.box(curX + 0.2, y + 0.2, curZ - 0.1, size * 0.7, 0.4, size * 0.7, colFade, { tex: 'plain', jitter: 0.08 });
    }
  }
}

/**
 * 스탠드 횃불 (목재 기둥 + 청동 받침 + 발광 불꽃)
 */
export function buildTorchStand(
  vb: VoxelBuilder,
  col: Collision | null,
  x: number,
  z: number,
  h = 2.0,
): void {
  // 바닥 3각 발받침
  vb.box(x, 0, z, 0.6, 0.15, 0.6, PAL.stone[1], { tex: 'stone' });
  // 나무 기둥
  vb.box(x, 0.15, z, 0.16, h, 0.16, PAL.wood[1], { tex: 'wood' });
  // 상단 청동 보울
  vb.box(x, 0.15 + h, z, 0.45, 0.25, 0.45, 0x8a6a3a, { tex: 'metal' });
  // 타오르는 화염 복셀
  vb.box(x, 0.4 + h, z, 0.3, 0.4, 0.3, 0xff5a10, { tex: 'flame' });
  vb.box(x, 0.55 + h, z, 0.18, 0.3, 0.18, 0xffca30, { tex: 'flame' });

  if (col) {
    col.addBox(x, z, 0.6, 0.6);
  }
}

/**
 * 가축용 긴 돌 물구유 (낙타, 양, 나귀)
 */
export function buildTroughLong(
  vb: VoxelBuilder,
  col: Collision | null,
  x: number,
  z: number,
  length: number,
  dir: 'x' | 'z' = 'x',
): void {
  const isX = dir === 'x';
  const w = isX ? length : 1.1;
  const d = isX ? 1.1 : length;

  // 석조 외벽
  vb.box(x, 0, z, w, 0.5, d, PAL.stone[2], { tex: 'stone' });
  // 내부 맑은 물
  const waterW = isX ? length - 0.3 : 0.7;
  const waterD = isX ? 0.7 : length - 0.3;
  vb.box(x, 0.22, z, waterW, 0.18, waterD, PAL.water[1], { tex: 'water' });

  if (col) {
    col.addBox(x, z, w + 0.2, d + 0.2);
  }
}

/**
 * 짙은 갈색 염소털 유목 장막(너무 어두우면 한 덩어리 검은 면으로 보여 밝은 갈색 + 밝은 능선 띠) (중앙 기둥, 밧줄, 가죽 멍석)
 */
export function buildRichNomadTent(
  vb: VoxelBuilder,
  col: Collision,
  x: number,
  z: number,
  w: number,
  d: number,
  tentColor: number = 0x5c4838,
): void {
  const ridgeH = 2.4;
  const wallH = 1.0;

  // 지붕 능선
  vb.box(x, ridgeH - 0.1, z, w * 0.9, 0.15, 0.4, tentColor, { tex: 'wool' });
  // 능선 위 밝은 띠 (면이 한 덩어리 어둠으로 뭉치지 않게)
  vb.box(x, ridgeH - 0.05, z, w * 0.92, 0.06, 0.55, 0x8a7258, { tex: 'wool' });
  // 기울어진 천막 지붕 경사 (남/북)
  vb.box(x, ridgeH * 0.7, z - d * 0.28, w * 0.95, 0.1, d * 0.55, tentColor, { tex: 'wool' });
  vb.box(x, ridgeH * 0.7, z + d * 0.28, w * 0.95, 0.1, d * 0.55, tentColor, { tex: 'wool' });

  // 천막 옆벽 (천이 드리워진 형태)
  vb.box(x - w * 0.48, 0, z, 0.12, wallH, d * 0.9, tentColor, { tex: 'wool' });
  vb.box(x + w * 0.48, 0, z, 0.12, wallH, d * 0.9, tentColor, { tex: 'wool' });
  vb.box(x, 0, z - d * 0.48, w * 0.9, wallH, 0.12, tentColor, { tex: 'wool' });

  // 나무 지주목 2개
  vb.box(x - w * 0.35, 0, z, 0.12, ridgeH, 0.12, PAL.wood[2], { tex: 'wood' });
  vb.box(x + w * 0.35, 0, z, 0.12, ridgeH, 0.12, PAL.wood[2], { tex: 'wood' });

  // 장막 내부 바닥 카펫과 방석
  vb.box(x, 0.02, z, w * 0.7, 0.05, d * 0.6, PAL.fabric.redDark, { tex: 'stripeRed' });
  vb.box(x + 0.4, 0.07, z - 0.2, 0.5, 0.15, 0.5, PAL.fabric.ochre, { tex: 'plain' });

  col.addBox(x, z, w + 0.2, d + 0.2);
}

/**
 * 가축 울타리 (목재 가로대, 기둥, 짚 침상)
 */
export function buildFencePen(
  vb: VoxelBuilder,
  col: Collision,
  x: number,
  z: number,
  w: number,
  d: number,
  gateSide: 'north' | 'south' | 'east' | 'west' = 'west',
): void {
  const h = 0.95;
  const postSpacing = 2.0;

  // 사방 기둥 및 가로대
  const drawFenceLine = (x1: number, z1: number, x2: number, z2: number, isGate: boolean) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const count = Math.max(1, Math.round(len / postSpacing));
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    const isX = Math.abs(x2 - x1) > Math.abs(z2 - z1);

    if (!isGate) {
      // 2줄 가로대
      vb.box(mx, 0.35, mz, isX ? len : 0.12, 0.1, isX ? 0.12 : len, PAL.wood[1], { tex: 'wood' });
      vb.box(mx, 0.75, mz, isX ? len : 0.12, 0.1, isX ? 0.12 : len, PAL.wood[1], { tex: 'wood' });
    } else {
      // 문 좌우 1/3만 가로대, 중앙 열림
      const halfL = (len - 1.6) / 2;
      if (halfL > 0.2) {
        const off = len / 2 - halfL / 2;
        if (isX) {
          vb.box(mx - off, 0.5, mz, halfL, 0.1, 0.12, PAL.wood[1], { tex: 'wood' });
          vb.box(mx + off, 0.5, mz, halfL, 0.1, 0.12, PAL.wood[1], { tex: 'wood' });
        } else {
          vb.box(mx, 0.5, mz - off, 0.12, 0.1, halfL, PAL.wood[1], { tex: 'wood' });
          vb.box(mx, 0.5, mz + off, 0.12, 0.1, halfL, PAL.wood[1], { tex: 'wood' });
        }
      }
    }

    // 기둥들
    for (let i = 0; i <= count; i++) {
      const px = x1 + (x2 - x1) * (i / count);
      const pz = z1 + (z2 - z1) * (i / count);
      vb.box(px, 0, pz, 0.16, h, 0.16, PAL.wood[0], { tex: 'wood' });
    }
  };

  const xL = x - w / 2, xR = x + w / 2;
  const zT = z - d / 2, zB = z + d / 2;

  drawFenceLine(xL, zT, xR, zT, gateSide === 'north');
  drawFenceLine(xR, zT, xR, zB, gateSide === 'east');
  drawFenceLine(xL, zB, xR, zB, gateSide === 'south');
  drawFenceLine(xL, zT, xL, zB, gateSide === 'west');

  // 바닥 짚더미
  vb.box(x, 0.02, z, w * 0.85, 0.08, d * 0.85, PAL.straw[0], { tex: 'reed' });
  vb.box(x + w * 0.2, 0.1, z - d * 0.2, 1.2, 0.4, 0.9, PAL.straw[1], { tex: 'reed' });

  col.addBox(x, z, w + 0.3, d + 0.3);
}

/**
 * 풍성한 항아리/곡물자루/바구니 소품 묶음
 */
export function buildStoragePropCluster(
  vb: VoxelBuilder,
  x: number,
  z: number,
  count = 5,
  seed = 521,
): void {
  for (let i = 0; i < count; i++) {
    const ox = (hash2(i, 1, seed) - 0.5) * 1.5;
    const oz = (hash2(i, 2, seed) - 0.5) * 1.5;
    const type = Math.floor(hash2(i, 3, seed) * 3);
    const px = x + ox;
    const pz = z + oz;

    if (type === 0) {
      P.pot(vb, px, pz, 1.0);
    } else if (type === 1) {
      P.sack(vb, px, pz);
    } else {
      P.basket(vb, px, 0, pz, PAL.produce.fig);
    }
  }
}

/**
 * 쪼갠 장작더미 (번제/취사용)
 */
export function buildSplitWoodBundle(
  vb: VoxelBuilder,
  col: Collision | null,
  x: number,
  y: number,
  z: number,
  w = 1.3,
  h = 0.7,
  d = 0.9,
): void {
  // 엇갈려 쌓인 장작들
  const layers = Math.floor(h / 0.18);
  for (let l = 0; l < layers; l++) {
    const curY = y + l * 0.18;
    const isEven = l % 2 === 0;
    const logCount = 3;
    for (let i = 0; i < logCount; i++) {
      const c = PAL.wood[1 + (i % 3)];
      if (isEven) {
        const pz = z - d / 2 + 0.15 + (i / (logCount - 1)) * (d - 0.3);
        vb.box(x, curY, pz, w * 0.9, 0.16, 0.22, c, { tex: 'bark', jitter: 0.03 });
      } else {
        const px = x - w / 2 + 0.15 + (i / (logCount - 1)) * (w - 0.3);
        vb.box(px, curY, z, 0.22, 0.16, d * 0.9, c, { tex: 'bark', jitter: 0.03 });
      }
    }
  }

  if (col) {
    col.addBox(x, z, w, d);
  }
}

/** 잎 팔레트를 밝기·따뜻함으로 옮긴 변형 (수관 덩어리마다 색조를 달리 하는 용도) */
export function shiftPal(pal: readonly number[], k: number, w = 0): number[] {
  return pal.map((c) => tintColor(c, k, w));
}

/**
 * 풍성한 캐노피를 가진 고목 (올리브/상수리/에셀)
 * 시드마다 줄기 굽음·잎 덩어리 개수/배치·색조가 달라 같은 나무가 반복되지 않는다.
 */
export function buildFoliageTree(
  vb: VoxelBuilder,
  col: Collision | null,
  x: number,
  z: number,
  opts: {
    trunkH?: number;
    trunkThickness?: number;
    rx?: number;
    ry?: number;
    rz?: number;
    foliagePal?: readonly number[];
    barkColor?: number;
    seed?: number;
  } = {},
): void {
  const seed = opts.seed ?? 711;
  const trunkH = opts.trunkH ?? 2.2;
  const trunkThick = opts.trunkThickness ?? 0.45;
  const barkColor = opts.barkColor ?? PAL.bark[1];
  const foliagePal = opts.foliagePal ?? PAL.olive;
  const jit = 0.78 + ((seed * 2654435761) % 1000) / 1000 * 0.4; // 0.78 ~ 1.18
  const rx = opts.rx ?? 1.6 * jit;
  const ry = opts.ry ?? 1.35 * (1.3 - jit * 0.3);
  const rz = opts.rz ?? 1.6 * (2 - jit) * 0.9;
  const r = (k: number) => hash2(seed, k, 4421);

  // 1. 굽은 줄기: 뿌리 퍼짐 + 기우는 지주 2~3개 + 가지
  const lean = (r(1) - 0.5) * 0.5;
  vb.box(x, 0, z, trunkThick * 1.35, trunkH * 0.18, trunkThick * 1.35, barkColor, { tex: 'bark' });
  vb.box(x + lean * 0.2, 0, z, trunkThick, trunkH * 0.62, trunkThick, barkColor, { tex: 'bark' });
  vb.box(x - 0.2 + lean * 0.5, trunkH * 0.4, z + 0.15, trunkThick * 0.75, trunkH * 0.5, trunkThick * 0.75, barkColor, { tex: 'bark' });
  vb.box(x + 0.25 + lean, trunkH * 0.5, z - 0.2, trunkThick * 0.7, trunkH * 0.6, trunkThick * 0.7, barkColor, { tex: 'bark' });
  if (r(2) < 0.7) vb.box(x + (r(3) - 0.5) * rx * 0.9, trunkH * 0.85, z + (r(4) - 0.5) * rz * 0.9, trunkThick * 0.4, trunkH * 0.3, trunkThick * 0.4, barkColor, { tex: 'bark' });
  for (let k = 0; k < 3; k++) { // 땅 위로 드러난 뿌리
    const a = r(5 + k) * 6.28;
    vb.box(x + Math.cos(a) * trunkThick * 0.9, 0, z + Math.sin(a) * trunkThick * 0.9, trunkThick * 0.5, 0.14, trunkThick * 0.5, barkColor, { tex: 'bark' });
  }

  // 2. 수관: 덩어리마다 별도 Canopy → 팔레트를 달리해 색조 얼룩 (밝은 햇빛 덩어리 / 짙은 그늘 덩어리)
  const lobes = 4 + Math.floor(r(10) * 4); // 4~7
  const cell = 0.2 + r(11) * 0.07;
  for (let k = 0; k < lobes; k++) {
    const a = r(20 + k) * Math.PI * 2 + k * 0.7;
    const d = k === 0 ? 0 : 0.35 + r(30 + k) * 0.55;
    const s = k === 0 ? 1 : 0.4 + r(40 + k) * 0.35;
    const lx = x + Math.cos(a) * rx * d, lz = z + Math.sin(a) * rz * d;
    const ly = trunkH + ry * (0.45 + r(50 + k) * 0.9) * (k === 0 ? 0.7 : 1) - d * ry * 0.3; // 가장자리는 처지게
    const pal = shiftPal(foliagePal, 0.85 + r(60 + k) * 0.35, (r(70 + k) - 0.5) * 0.14);
    const c = new Canopy(vb, cell, seed + k * 13);
    c.ellipsoid(lx, ly, lz, rx * s * (0.9 + r(80 + k) * 0.3), ry * s * (0.85 + r(90 + k) * 0.3), rz * s * (0.9 + r(100 + k) * 0.3), 0.5);
    c.emit(pal, { holes: 0.24 });
  }
  // 늘어진 잔가지 잎
  const hang = new Canopy(vb, cell, seed + 99);
  for (let k = 0; k < 2; k++) {
    const a = r(110 + k) * 6.28;
    hang.ellipsoid(x + Math.cos(a) * rx * 0.8, trunkH + ry * 0.15, z + Math.sin(a) * rz * 0.8, rx * 0.22, ry * 0.3, rz * 0.22, 0.6);
  }
  hang.emit(shiftPal(foliagePal, 0.8, 0.03), { holes: 0.3 });

  if (col) {
    col.addBox(x, z, trunkThick * 2.2, trunkThick * 2.2);
  }
}

/**
 * 성문 장로 석조 벤치 좌석
 */
export function buildStoneBenchCurved(
  vb: VoxelBuilder,
  col: Collision | null,
  x: number,
  z: number,
  w = 2.4,
  d = 0.8,
  h = 0.55,
): void {
  // 석재 상판
  vb.box(x, h - 0.15, z, w, 0.15, d, PAL.stone[3], { tex: 'stone' });
  // 석재 다리 2개
  vb.box(x - w / 2 + 0.25, 0, z, 0.3, h - 0.15, d - 0.15, PAL.stone[2], { tex: 'stone' });
  vb.box(x + w / 2 - 0.25, 0, z, 0.3, h - 0.15, d - 0.15, PAL.stone[2], { tex: 'stone' });

  if (col) {
    col.addBox(x, z, w, d);
  }
}
