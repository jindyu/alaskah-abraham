import * as THREE from 'three';
import type { VoxelBuilder } from '../voxel';
import type { Collision } from '../collision';
import { fbm, hash2, valueNoise } from '../../core/rng';
import { getTexture, TD } from '../textures';
import type { TexKey } from '../textures';

/**
 * 3D 무대 외곽 지평선까지 이어지는 원경 지면 플레인 헬퍼
 * @param color 지면 색상
 * @param size 평면 한 변의 길이 (기본값 360)
 * @param y Y축 높이 (기본값 -0.05, 지면 y=0 아래에 자연스럽게 깔림)
 */
export function buildHorizonPlane(color: number, size = 360, y = -0.05, strength = 1.5): THREE.Mesh {
  // 한 가지 색의 평면은 화면 아래쪽이 '빈 공간'처럼 보인다 → 월드 좌표 노이즈로 꼭짓점마다 색을 흔들어 둔다
  const seg = Math.max(8, Math.round(size / 4));
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // 회전(-90° X) 뒤의 월드 좌표: x → x, 평면 y → -z
    const wx = pos.getX(i), wz = -pos.getY(i);
    c.setHex(groundVariation(color, wx, wz, 7, strength));
    const shade = 1;
    colors[i * 3] = c.r * shade; colors[i * 3 + 1] = c.g * shade; colors[i * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}


export interface GroundCoverOpts {
  seed: number;
  /** 무대 한 변 절반 크기 (가장자리 3칸은 비움) */
  half: number;
  count: number;
  /** 꽃 색 후보 (비우면 꽃 없음) */
  flowers?: ReadonlyArray<number>;
  /** 풀/관목 색 후보 */
  tufts: ReadonlyArray<number>;
  /** 잔돌 색 후보 */
  pebbles: ReadonlyArray<number>;
}

/** 결정적 의사난수 (무대를 다시 지어도 같은 배치) */
function lcg(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
}

/**
 * 무대마다 식생·소품 분위기가 같아 보이지 않게, 풀 포기·들꽃·잔돌을 흩뿌린다.
 * 막힌 자리(건물·벽·나무)에는 놓지 않는다. 한 무대당 박스 수백 개 — 무대 메쉬에 합쳐진다.
 */
export function scatterGroundCover(vb: VoxelBuilder, col: Collision, o: GroundCoverOpts): void {
  const rnd = lcg(o.seed);
  const span = o.half - 3;
  const count = Math.round(o.count * 1.7);
  for (let i = 0; i < count; i++) {
    const x = (rnd() * 2 - 1) * span;
    const z = (rnd() * 2 - 1) * span;
    // 군락: 저주파 노이즈가 낮은 곳은 성기게 → 풀밭/맨땅이 덩어리로 나뉜다
    const patch = valueNoise(x / 5 + o.seed, z / 5, 851);
    const rr = rnd();
    if (patch < 0.3 && rr < 0.6) continue;
    if (col.blocked(x, z, 0.7)) continue;
    const kind = rnd();
    const pick = (a: ReadonlyArray<number>) => a[Math.floor(rnd() * a.length)];
    if (kind < 0.4) {
      // 풀 포기: 잎마다 높이·기울기·명암이 다른 3~6장 (포기 중앙이 더 높음)
      const base = pick(o.tufts);
      const n = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const dx = (rnd() - 0.5) * 0.34, dz = (rnd() - 0.5) * 0.34;
        const c = tintColor(base, 0.82 + rnd() * 0.4, (rnd() - 0.5) * 0.1);
        const h = (0.16 + rnd() * 0.3) * (1.2 - Math.hypot(dx, dz) * 1.6);
        vb.box(x + dx, 0, z + dz, 0.06, h, 0.06, c);
      }
    } else if (kind < 0.52) {
      // 관목: 서로 다른 크기 덩어리 2~3개를 쌓은 낮은 덤불
      const base = pick(o.tufts);
      const s = 0.35 + rnd() * 0.35;
      vb.box(x, 0, z, s, s * 0.6, s * 0.9, tintColor(base, 0.72), { jitter: 0.05 });
      vb.box(x + (rnd() - 0.5) * s * 0.4, s * 0.45, z + (rnd() - 0.5) * s * 0.3, s * 0.7, s * 0.4, s * 0.65, tintColor(base, 0.95), { jitter: 0.05 });
      if (rnd() < 0.5) vb.box(x + s * 0.2, s * 0.8, z, s * 0.4, s * 0.25, s * 0.4, tintColor(base, 1.15, 0.04), { jitter: 0.05 });
    } else if (kind < 0.72 && o.flowers && o.flowers.length > 0) {
      // 들꽃: 같은 색 꽃 2~4송이 무리 (한 점이 아니라 군락)
      const fc = pick(o.flowers);
      const n = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const fx = x + (rnd() - 0.5) * 0.6, fz = z + (rnd() - 0.5) * 0.6;
        const stemH = 0.2 + rnd() * 0.22;
        vb.box(fx, 0, fz, 0.04, stemH, 0.04, o.tufts[0]);
        vb.box(fx - 0.05, stemH, fz - 0.05, 0.12 + rnd() * 0.05, 0.09, 0.12 + rnd() * 0.05, tintColor(fc, 0.9 + rnd() * 0.2));
      }
    } else if (kind < 0.8) {
      // 마른 가지/나뭇조각
      const c = tintColor(0x6a4a30, 0.8 + rnd() * 0.4);
      const long = 0.35 + rnd() * 0.4;
      if (rnd() < 0.5) vb.box(x, 0, z, long, 0.05, 0.06, c); else vb.box(x, 0, z, 0.06, 0.05, long, c);
    } else {
      // 바위 무리: 큰 돌 하나 + 작은 돌들, 윗면은 밝고 아랫면은 어두움
      const base = pick(o.pebbles);
      const big = rnd() < 0.3;
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const sx = (big && k === 0 ? 0.4 : 0.12) + rnd() * 0.2;
        const sz = (big && k === 0 ? 0.35 : 0.12) + rnd() * 0.2;
        const sh = (big && k === 0 ? 0.28 : 0.08) + rnd() * 0.12;
        const bx = x + (rnd() - 0.5) * 0.5, bz = z + (rnd() - 0.5) * 0.5;
        vb.box(bx, 0, bz, sx, sh * 0.65, sz, tintColor(base, 0.8 + rnd() * 0.15), { jitter: 0.04 });
        vb.box(bx, sh * 0.65, bz, sx * 0.8, sh * 0.35, sz * 0.8, tintColor(base, 1.08 + rnd() * 0.12), { jitter: 0.04 });
      }
    }
  }
}

/** 0xRRGGBB 색에 밝기 k 와 따뜻함 w(+따뜻/-차갑) 를 곱한다 */
export function tintColor(c: number, k: number, w = 0): number {
  const r = Math.max(0, Math.min(255, (((c >> 16) & 255) * k * (1 + w)) | 0));
  const g = Math.max(0, Math.min(255, (((c >> 8) & 255) * k) | 0));
  const b = Math.max(0, Math.min(255, ((c & 255) * k * (1 - w)) | 0));
  return (r << 16) | (g << 8) | b;
}

/**
 * 지면 색에 다중 스케일 변화를 얹는다 (반복 무늬 제거).
 * 큰 얼룩(~22유닛) + 중간 덩어리(~6) + 잔 잡음, 밝기와 따뜻함을 함께 흔들고 4단계로 양자화해 픽셀 아트 느낌을 유지.
 * 격자 위치(i,j)가 아니라 월드 좌표(x,z)로 계산 → 무대 해상도와 무관.
 */
export function groundVariation(c: number, x: number, z: number, seed = 0, strength = 1): number {
  const macro = fbm(x / 22 + seed, z / 22 - seed, 811 + seed, 3) - 0.5;
  const mid = valueNoise(x / 6 + seed * 0.7, z / 6, 823 + seed) - 0.5;
  const fine = hash2(Math.floor(x * 14), Math.floor(z * 14), 829 + seed) - 0.5;
  let k = 1 + (macro * 0.34 + mid * 0.16 + fine * 0.05) * strength;
  k = Math.round(k * 28) / 28;
  const w = (valueNoise(x / 31 - seed, z / 31, 839 + seed) - 0.5) * 0.12 * strength;
  return tintColor(c, k, w);
}

/** 원경 디테일 텍스처 한 장의 가로 텍셀 수 (유닛 = FAR_TILE_TEXELS / TD) */
const FAR_TILE_TEXELS = 128;

export interface FarFieldOpts {
  seed: number;
  /** 지형 색 후보. 밝기순으로 정렬해 어두운(낮은 곳) → 밝은(높은 곳) 한 가지 색조 램프로 쓴다 */
  pal: ReadonlyArray<number>;
  /** dune: 부드러운 모래 능선 / soil: 계단식 구릉(등고선 단) / cliff·stone·brick: 가파른 암벽 띠 */
  tex?: 'cliff' | 'dune' | 'soil' | 'stone' | 'brick';
  /** 능선 바깥으로 이어 붙일 깊이 (기본 30) */
  depth?: number;
  /** 가장 먼 곳 최대 높이 (기본 4) */
  maxH?: number;
  /** 가까운 곳 높이 상한 (카메라 앞 능선이 플레이 영역을 가리지 않게, 기본 1.2) */
  nearH?: number;
  /** 군데군데 흩뿌릴 바위·덤불 색 (비우면 생략) */
  accents?: ReadonlyArray<number>;
  /** 먼 능선이 옅어질 안개색 (기본 회갈색). 같은 색의 buildHorizonPlane 과 이어진다 */
  haze?: number;
  /** 무대 지면 색: 가장자리에서 이 색에서 능선 색으로 부드럽게 넘어간다 */
  ground?: number;
  /** 무대 둘레 능선(테두리): 무대 가장자리 안쪽부터 솟아오른다. 남쪽(카메라 쪽)은 south 배율로 낮춘다 */
  rim?: { min: number; max: number; south?: number; openNorth?: boolean };
}

/** 무대 빌드 때만 쓰는 정적 생성 코드 (step() 과 무관) */
function smooth01(t: number): number { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); }
function lum(c: number): number { return ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11; }

/**
 * 맵 가장자리 바깥(원경)을 복셀풍 높이장으로 채운다 — 무대마다 "하나의 가장자리 언어".
 * - 색: 팔레트를 밝기순 램프로 놓고 (높이+저주파 노이즈)로 4단 양자화 → 같은 계열 2~3톤, 칸마다 색이 튀지 않음
 * - 멀수록 haze 색으로 수렴(맨 끝은 haze = 지평선 평면 색), 지면 쪽은 ground 색에서 서서히 이어짐
 * - 높이: 저주파 노이즈, dune 은 0.125 단위(부드러운 사구) / soil 은 0.5 단위 등고선 계단 / cliff 는 가파른 단
 * - 가까운 곳 0.5유닛, 먼 곳 1유닛 격자. 위 면 + 낮은 이웃 쪽 옆면만 그려 삼각형을 아낀다. 메쉬 하나(1 드로우콜).
 */
export function buildFarField(root: THREE.Object3D, half: number, o: FarFieldOpts): THREE.Mesh {
  const depth = o.depth ?? 30, maxH = o.maxH ?? 4, nearH = o.nearH ?? 1.2;
  const tex = o.tex ?? 'dune';
  const kind = tex === 'dune' ? 0 : tex === 'soil' ? 1 : 2;
  // 사구·구릉은 계단 없는 매끈한 능선(모서리 높이로 비탈면), 암벽만 0.5 단 계단
  const smoothTerrain = true;
  // 암벽은 0.5 단 계단을 모서리 높이로 이어 가파른 경사 단구로 (수직 옆면의 어두운 줄 제거)
  const quant = kind === 2 ? 0.25 : 0;
  // 사구·구릉의 옆면은 윗면과 거의 같은 밝기로 — 얇은 단이 어두운 줄무늬(띠)로 읽히지 않고 완만한 능선처럼 보이게 (암벽만 또렷한 단)
  const sideSoft = kind === 2 ? 0.4 : 0.7;
  const rim = o.rim;
  const rimStart = rim ? 2 : -1; // 무대 가장자리 몇 유닛 안쪽부터 솟을지
  const inner = half - rimStart, outer = half + depth;
  const NEAR_CELL = 0.5, FAR_CELL = 1, SPLIT = 14;
  const accents = o.accents ?? [];
  const haze = new THREE.Color(o.haze ?? 0xb8b4a8);
  const gnd = o.ground !== undefined ? new THREE.Color(o.ground) : null;
  const ramp = o.pal.slice().sort((a, b) => lum(a) - lum(b)).map((v) => new THREE.Color(v));
  const strongH = rim ? rim.max : nearH;
  const hMax = Math.max(0.5, strongH * 0.45 + maxH * 0.45);
  const southK = rim?.south ?? 0.45;

  const hAt = (x: number, z: number): number => {
    const ax = Math.abs(x), az = Math.abs(z);
    const d = Math.max(ax, az) - half; // 무대 바깥으로 얼마나 나갔는지 (안쪽이면 음수)
    const t = Math.min(1, Math.max(0, d / depth));
    let h = 0;
    if (rim && !(rim.openNorth && z < 0 && az >= ax)) {
      const south = z > 0 && az >= ax;
      const along = az >= ax ? x : z;
      const k = (south ? southK : 1) * (0.55 + 0.45 * fbm(along / 13 + o.seed, (az >= ax ? 1 : 2) * 3.7 + o.seed, 905 + o.seed, 2));
      const slope = kind === 2 ? 2.8 : 5;
      h += smooth01((d + rimStart) / slope) * (rim.min + (rim.max - rim.min) * k);
    } else {
      h += smooth01(d / 3) * nearH * (0.35 + fbm(x / 16 + o.seed, z / 16, 911 + o.seed, 2) * 0.8);
    }
    // 먼 능선 (저주파)
    const ridge = fbm(x / 17 + o.seed * 3, z / 17, 931 + o.seed, 3);
    h += smooth01(d / 9) * maxH * (0.1 + ridge * 1.0) * (kind === 2 ? 1.2 : 1);
    h += (fbm(x / 6 + o.seed, z / 6, 917 + o.seed, 2) - 0.4) * (kind === 0 ? 0.9 : 1.3) * smooth01((d + 1) / 4);
    void t;
    return Math.max(0.05, quant > 0 ? Math.round(h / quant) * quant : h);
  };

  // 윗면(0)과 옆면(1)을 따로 모은다 → 윗면은 잔 알갱이, 옆면은 지층 무늬 (월드 좌표 UV, 텍셀 = 소품과 같은 1/TD 유닛)
  const sets = [0, 1].map(() => ({ pos: [] as number[], col: [] as number[], nrm: [] as number[], uv: [] as number[] }));
  const UV_SCALE = 1 / (FAR_TILE_TEXELS / TD);
  const pushV = (set: number, x: number, y: number, z: number, nx: number, ny: number, nz: number): void => {
    const S = sets[set];
    S.pos.push(x, y, z); S.nrm.push(nx, ny, nz);
    if (ny !== 0) S.uv.push(x * UV_SCALE, z * UV_SCALE);
    else if (nx !== 0) S.uv.push(z * UV_SCALE, y * UV_SCALE);
    else S.uv.push(x * UV_SCALE, y * UV_SCALE);
  };
  let cur = sets[0].col;
  const c = new THREE.Color();
  const colorAt = (x: number, z: number, h: number, shade: number): void => {
    const d = Math.max(Math.abs(x), Math.abs(z)) - half;
    const t = Math.min(1, Math.max(0, d / depth));
    // 높이 + 저주파 노이즈 → 4단 양자화된 램프 위치 (큰 덩어리로만 색이 바뀐다)
    let u = Math.min(1, h / hMax) * 0.75 + valueNoise(x / 26, z / 26, 921 + o.seed) * 0.25;
    // 띠(등고선 색 줄무늬) 방지: 단 경계를 칸마다 흩어(디더) 계단이 아니라 알갱이로 섞이게 한다
    u = Math.round(Math.min(1, Math.max(0, u)) * 9 + (hash2(Math.floor(x * 4), Math.floor(z * 4), 951 + o.seed) - 0.5) * 1.1) / 9;
    u = Math.min(1, Math.max(0, u));
    const fi = u * (ramp.length - 1), i0 = Math.min(ramp.length - 2, Math.floor(fi));
    if (ramp.length === 1) c.copy(ramp[0]); else c.copy(ramp[i0]).lerp(ramp[i0 + 1], fi - i0);
    c.multiplyScalar(shade * (0.97 + hash2(Math.floor(x * 2), Math.floor(z * 2), 941 + o.seed) * 0.06));
    // 지면 → 능선 색 (가장자리 이음새 제거)
    if (gnd) c.lerp(gnd, 1 - smooth01((d + rimStart) / 6));
    // 대기 원근: 멀수록 haze 색, 맨 끝은 haze 그대로
    c.lerp(haze, Math.pow(t, 2.3) * 0.97 + (t > 0.97 ? 0.03 : 0));
    cur.push(c.r, c.g, c.b);
  };
  const rnd = lcg(o.seed * 7 + 13);
  const quad = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, x3: number, y3: number, z3: number, nx: number, ny: number, nz: number, cx: number, cz: number, h: number, shade: number): void => {
    const v = [x0, y0, z0, x1, y1, z1, x2, y2, z2, x0, y0, z0, x2, y2, z2, x3, y3, z3];
    const set = ny !== 0 ? 0 : 1;
    cur = sets[set].col;
    if (set === 1) shade += (1 - shade) * sideSoft;
    for (let i = 0; i < 6; i++) { pushV(set, v[i * 3], v[i * 3 + 1], v[i * 3 + 2], nx, ny, nz); colorAt(cx, cz, h, shade); }
  };

  const smoothAccent = (cx: number, cz: number, h: number, cell: number): void => {
    // 드문 바위·덤불 (밀도 맞춤 소형, 멀리는 생략)
    if (accents.length > 0 && cell === NEAR_CELL && h > 0.3 && rnd() < 0.03) {
      const sz = 0.2 + rnd() * 0.3, ab = accents[Math.floor(rnd() * accents.length)];
      const ah = sz * 0.7;
      c.setHex(ab).multiplyScalar(0.8 + rnd() * 0.3).lerp(haze, Math.min(0.5, Math.max(0, (Math.max(Math.abs(cx), Math.abs(cz)) - half) / depth)));
      const ax0 = cx - sz / 2, ax1 = cx + sz / 2, az0 = cz - sz / 2, az1 = cz + sz / 2, ay = h + ah;
      const face = (v: number[], nx: number, ny: number, nz: number, sh: number): void => {
        const set = ny !== 0 ? 0 : 1;
        for (let i = 0; i < 6; i++) { pushV(set, v[i * 3], v[i * 3 + 1], v[i * 3 + 2], nx, ny, nz); sets[set].col.push(c.r * sh, c.g * sh, c.b * sh); }
      };
      face([ax0, ay, az1, ax1, ay, az1, ax1, ay, az0, ax0, ay, az1, ax1, ay, az0, ax0, ay, az0], 0, 1, 0, 1.1);
      face([ax0, ay, az1, ax0, h, az1, ax1, h, az1, ax0, ay, az1, ax1, h, az1, ax1, ay, az1], 0, 0, 1, 0.85);
      face([ax1, ay, az1, ax1, h, az1, ax1, h, az0, ax1, ay, az1, ax1, h, az0, ax1, ay, az0], 1, 0, 0, 0.75);
    }
  };
  const addCell = (cx: number, cz: number, cell: number): void => {
    const h = hAt(cx, cz);
    const x0 = cx - cell / 2, x1 = cx + cell / 2, z0 = cz - cell / 2, z1 = cz + cell / 2;
    // 언덕 음영: 서북쪽 햇빛 기준으로 오르막은 밝게, 내리막은 어둡게 → 능선이 입체로 읽힌다
    const gx = (hAt(cx - cell, cz) - hAt(cx + cell, cz)) / (2 * cell), gz = (hAt(cx, cz - cell) - hAt(cx, cz + cell)) / (2 * cell);
    const top = 1 + Math.max(-0.28, Math.min(0.22, gx * 0.32 + gz * 0.2));
    if (smoothTerrain) {
      const ha = hAt(x0, z1), hb = hAt(x1, z1), hc = hAt(x1, z0), hd = hAt(x0, z0);
      // 평균 기울기 법선 (남북 기울기는 z 부호 주의: 위쪽 = -z)
      const sx = ((hb + hc) - (ha + hd)) / (2 * cell), sz = ((ha + hb) - (hc + hd)) / (2 * cell);
      const nl = Math.hypot(sx, 1, sz);
      quad(x0, ha, z1, x1, hb, z1, x1, hc, z0, x0, hd, z0, -sx / nl, 1 / nl, sz / nl, cx, cz, h, top);
      return smoothAccent(cx, cz, h, cell);
    }
    quad(x0, h, z1, x1, h, z1, x1, h, z0, x0, h, z0, 0, 1, 0, cx, cz, h, top);
    for (let s = 0; s < 4; s++) {
      const dx = s === 0 ? 1 : s === 1 ? -1 : 0, dz = s === 2 ? 1 : s === 3 ? -1 : 0;
      const nh = hAt(cx + dx * cell, cz + dz * cell);
      if (nh >= h - 0.01) continue;
      if (dx === 1) quad(x1, h, z1, x1, h, z0, x1, nh, z0, x1, nh, z1, 1, 0, 0, cx, cz, h, 0.84);
      else if (dx === -1) quad(x0, h, z0, x0, h, z1, x0, nh, z1, x0, nh, z0, -1, 0, 0, cx, cz, h, 0.8);
      else if (dz === 1) quad(x0, h, z1, x0, nh, z1, x1, nh, z1, x1, h, z1, 0, 0, 1, cx, cz, h, 0.9);
      else quad(x1, h, z0, x1, nh, z0, x0, nh, z0, x0, h, z0, 0, 0, -1, cx, cz, h, 0.82);
    }
    smoothAccent(cx, cz, h, cell);
  };

  const nearEnd = half + SPLIT;
  const skipOpen = (cx: number, cz: number): boolean => !!(rim && rim.openNorth && cz < 0 && Math.abs(cz) >= Math.abs(cx) && Math.max(Math.abs(cx), Math.abs(cz)) < half + 1);
  for (let x = -outer; x < outer; x += NEAR_CELL) {
    for (let z = -outer; z < outer; z += NEAR_CELL) {
      const cx = x + NEAR_CELL / 2, cz = z + NEAR_CELL / 2;
      const m = Math.max(Math.abs(cx), Math.abs(cz));
      if (m < inner || m > nearEnd || skipOpen(cx, cz)) continue;
      addCell(cx, cz, NEAR_CELL);
    }
  }
  for (let x = -outer; x < outer; x += FAR_CELL) {
    for (let z = -outer; z < outer; z += FAR_CELL) {
      const cx = x + FAR_CELL / 2, cz = z + FAR_CELL / 2;
      const m = Math.max(Math.abs(cx), Math.abs(cz));
      if (m <= nearEnd || m > outer) continue;
      addCell(cx, cz, FAR_CELL);
    }
  }

  const geo = new THREE.BufferGeometry();
  const P: number[] = [], N: number[] = [], C: number[] = [], U: number[] = [];
  const nTop = sets[0].pos.length / 3;
  for (const S of sets) { for (const v of S.pos) P.push(v); for (const v of S.nrm) N.push(v); for (const v of S.col) C.push(v); for (const v of S.uv) U.push(v); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.addGroup(0, nTop, 0);
  geo.addGroup(nTop, P.length / 3 - nTop, 1);
  geo.computeBoundingSphere();
  const sideKey: TexKey = kind === 2 ? 'farStrata' : kind === 1 ? 'farSoilSide' : 'farDuneSide';
  const mesh = new THREE.Mesh(geo, [
    new THREE.MeshLambertMaterial({ vertexColors: true, map: getTexture('farGrain') }),
    new THREE.MeshLambertMaterial({ vertexColors: true, map: getTexture(sideKey) }),
  ]);
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}
