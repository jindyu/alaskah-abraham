import { addFoliageWind } from '../renderer/environmentWind';
import * as THREE from 'three';
import { Rng, hash2 } from '../core/rng';
import { GRAINED, TD, TexKey, getTexture, getRelief } from './textures';

export type TexSpec = TexKey | { top?: TexKey; side?: TexKey; bottom?: TexKey };

export interface BoxOpts {
  /** 추가 장식은 별도 해시로 색을 골라 기존 월드 난수 흐름을 유지한다. */
  variationSeed?: number;
  tex?: TexSpec;
  /** 박스마다 밝기 흔들기 폭 (0이면 팔레트 색 그대로) */
  jitter?: number;
  /** 지면 접촉 어둡게(가짜 AO). 정적 월드 기본값 true */
  ao?: boolean;
}

/** 런타임 설정 (QA 가 devHooks 로 끄고 켜 비교한다. 다음에 짓는 모델부터 적용) */
export const voxelConfig = { cullInterior: true };

interface Batch { pos: number[]; nrm: number[]; uv: number[]; col: number[]; idx: number[] }

const E = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

const materials = new Map<TexKey, THREE.Material>();
/** 공유 캐시에 든 재질 (장 전환 시 dispose 하면 안 됨) — 조회가 O(1) 이도록 별도 Set */
const sharedMaterials = new Set<THREE.Material>();
/** 특정 텍스처 키의 재질을 교체 (물 셰이더, 발광 재질 등). 빌드 전에 등록해야 함 */
export function overrideMaterial(key: TexKey, mat: THREE.Material) {
  materials.set(key, mat);
  sharedMaterials.add(mat);
}
export function isSharedMaterial(mat: THREE.Material): boolean {
  return sharedMaterials.has(mat);
}
export function materialFor(key: TexKey): THREE.Material {
  let m = materials.get(key);
  if (!m) {
    const cloth = key.startsWith('stripe') || key.startsWith('fabric') || key === 'reed';
    const relief = cloth || ['wood', 'stone', 'wetStone', 'plaster', 'brick', 'mudRoof', 'bark', 'metal'].includes(key);
    m = relief ? new THREE.MeshStandardMaterial({
      map: getTexture(key), vertexColors: true, metalness: key === 'metal' ? 0.45 : 0,
      roughness: key === 'metal' ? 0.48 : key === 'wetStone' ? 0.5 : cloth ? 1 : key === 'wood' ? 0.9 : 0.97,
      bumpMap: getRelief(key), bumpScale: cloth ? 0.008 : key === 'metal' ? 0.006 : key === 'wood' ? 0.018 : 0.024,
    }) : new THREE.MeshLambertMaterial({ map: getTexture(key), vertexColors: true });
    if (key === 'canopy' || key.startsWith('stripe') || key === 'leafVine') addFoliageWind(m);
    materials.set(key, m);
    sharedMaterials.add(m);
  }
  return m;
}

/**
 * 복셀 모델 빌더. 박스를 쌓아 텍스처별로 하나의 지오메트리로 병합한다.
 * box(cx, y, cz, w, h, d): x/z는 중심, y는 바닥 기준.
 * UV는 로컬 좌표 × TD 라서 모든 표면의 텍셀 크기가 같다.
 */
export class VoxelBuilder {
  private batches = new Map<TexKey, Batch>();
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];
  private readonly tmpColor = new THREE.Color();
  readonly rng: Rng;
  defaultAo: boolean;
  defaultJitter = 0.05;
  /** AO 기준 지면 높이 (언덕 위 소품용) */
  groundY = 0;
  /** build() 때 마주 붙은 안쪽 면을 뺄지 (dropCoincidentQuads). 모양은 안 바뀌고 삼각형만 준다. 기본값은 voxelConfig.cullInterior */
  cullInterior = voxelConfig.cullInterior;

  constructor(seed = 1, isStatic = true) {
    this.rng = new Rng(seed);
    this.defaultAo = isStatic;
  }

  /** 위치/회전 변환 아래에서 fn 실행 */
  at(x: number, y: number, z: number, ry: number, fn: () => void, rx = 0, rz = 0, s = 1) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
      new THREE.Vector3(s, s, s),
    );
    this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m));
    fn();
    this.stack.pop();
  }

  box(cx: number, y: number, cz: number, w: number, h: number, d: number, color: number, opts: BoxOpts = {}) {
    const mat = this.stack[this.stack.length - 1];
    const nmat = new THREE.Matrix3().getNormalMatrix(mat);
    const jitter = opts.jitter ?? this.defaultJitter;
    const ao = opts.ao ?? this.defaultAo;
    const base = this.tmpColor.setHex(color);
    const k = 1 + ((opts.variationSeed === undefined ? this.rng.next() : hash2(cx * 16, y * 16, opts.variationSeed)) - 0.5) * 2 * jitter;
    const warm = ((opts.variationSeed === undefined ? this.rng.next() : hash2(cz * 16, y * 16, opts.variationSeed + 1)) - 0.5) * jitter * 0.5;
    const cr = base.r * k * (1 + warm), cg = base.g * k, cb = base.b * k * (1 - warm);

    const min = [cx - w / 2, y, cz - d / 2];
    const max = [cx + w / 2, y + h, cz + d / 2];
    const size = [w, h, d];
    const spec = opts.tex ?? 'plain';
    const v = new THREE.Vector3(), n = new THREE.Vector3();

    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [1, -1]) {
        // 땅에 붙은 정적 박스의 바닥면은 안 보이므로 생략
        if (axis === 1 && sign === -1 && ao && y <= 0.001) continue;
        const tex: TexKey = typeof spec === 'string' ? spec
          : axis === 1 ? (sign > 0 ? spec.top : spec.bottom) ?? spec.side ?? 'plain'
          : spec.side ?? 'plain';
        const b = this.batch(tex);
        const texSize = getTexture(tex).image.width;
        let ai = (axis + 1) % 3, bi = (axis + 2) % 3;
        if (sign < 0) [ai, bi] = [bi, ai];
        // UV 축: 옆면은 (수평, y), 윗/아랫면은 (x, z)
        let uAxis = axis === 1 ? 0 : axis === 0 ? 2 : 0;
        let vAxis = axis === 1 ? 2 : 1;
        if (GRAINED.has(tex) && size[uAxis] > size[vAxis]) [uAxis, vAxis] = [vAxis, uAxis];

        const start = b.pos.length / 3;
        n.copy(E[axis]).multiplyScalar(sign).applyMatrix3(nmat).normalize();
        const corners: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
        for (const [ca, cb2] of corners) {
          const p = [0, 0, 0];
          p[axis] = sign > 0 ? max[axis] : min[axis];
          p[ai] = ca ? max[ai] : min[ai];
          p[bi] = cb2 ? max[bi] : min[bi];
          b.uv.push((p[uAxis] * TD) / texSize, (p[vAxis] * TD) / texSize);
          v.set(p[0], p[1], p[2]).applyMatrix4(mat);
          b.pos.push(v.x, v.y, v.z);
          b.nrm.push(n.x, n.y, n.z);
          let s = 1;
          if (ao) {
            // 수직면의 발치만 더 단단하게 접지. 지붕·바닥의 팔레트는 유지한다.
            const contact = axis === 1 ? 0.72 : 0.62;
            s = contact + (1 - contact) * THREE.MathUtils.smoothstep(v.y - this.groundY, 0, 0.55);
            // 떠 있는 소품·들보의 아랫면은 그늘져 보이게 (땅 가까운 아랫면은 위에서 이미 걸러짐)
            if (axis === 1 && sign < 0 && y > this.groundY + 0.05) s *= 0.62;
          }
          b.col.push(cr * s, cg * s, cb * s);
        }
        b.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    }
  }

  private batch(key: TexKey): Batch {
    let b = this.batches.get(key);
    if (!b) {
      b = { pos: [], nrm: [], uv: [], col: [], idx: [] };
      this.batches.set(key, b);
    }
    return b;
  }

  /**
   * 텍스처별 메시를 Group 으로 돌려줌. 큰 배치(정점 CHUNK_MIN_VERTS 이상이고 면 중심의 XZ 범위가 CHUNK_TILE 이상)는
   * XZ 평면 CHUNK_TILE 격자 타일로 나눠 (타일 × 텍스처) 메시로 만듦 → three 의 frustum culling(본 패스·그림자 패스)이 먼 타일을 건너뜀.
   * 작은 소품은 예전처럼 텍스처당 메시 하나. 정점·인덱스·winding 은 그대로 옮기고 타일 안에서 인덱스를 다시 매김.
   */
  build(castShadow = true, receiveShadow = true): THREE.Group {
    const g = new THREE.Group();
    for (const [key, b] of this.batches) {
      if (this.cullInterior) dropCoincidentQuads(b);
      for (const part of splitByTile(b)) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(part.nrm, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(part.col, 3));
        geo.setIndex(part.idx);
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, materialFor(key));
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        g.add(mesh);
      }
    }
    this.batches.clear();
    return g;
  }
}

/**
 * 같은 배치 안에서 서로 마주 붙은 면(위치·크기가 똑같고 법선이 반대인 두 사각형)을 둘 다 뺀다 — 쌓은 박스 사이의 안쪽 면이라 어디서도 안 보인다.
 * 사각형은 연속 4정점·6인덱스(box 가 이렇게 쌓음). 모서리 좌표를 1/4096 로 맞춰 비교하므로 정확히 맞닿은 면만 걸린다 (살짝 어긋난 면은 그대로 둠 → 보이는 모양은 안 바뀐다).
 * 빌드 때 한 번만 도는 코드 (step 과 무관).
 */
export function dropCoincidentQuads(b: Batch): number {
  const nv = b.pos.length / 3;
  if (nv < 8 || nv % 4 !== 0 || b.idx.length !== (nv / 4) * 6) return 0;
  const quads = nv / 4;
  const seen = new Map<string, number>();
  const dead = new Uint8Array(quads);
  let drop = 0;
  const Q = 4096;
  for (let q = 0; q < quads; q++) {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < 4; k++) {
      const o = (q * 4 + k) * 3, x = b.pos[o], y = b.pos[o + 1], z = b.pos[o + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    const key = `${Math.round(x0 * Q)},${Math.round(y0 * Q)},${Math.round(z0 * Q)},${Math.round(x1 * Q)},${Math.round(y1 * Q)},${Math.round(z1 * Q)}`;
    const other = seen.get(key);
    if (other !== undefined) {
      const a = other * 12, c = q * 12; // 첫 정점의 법선 (4정점 × 3)
      if (b.nrm[a] * b.nrm[c] + b.nrm[a + 1] * b.nrm[c + 1] + b.nrm[a + 2] * b.nrm[c + 2] < -0.99) {
        dead[q] = 1; dead[other] = 1; drop += 2;
        seen.delete(key);
        continue;
      }
    }
    seen.set(key, q);
  }
  if (!drop) return 0;
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  let w = 0;
  for (let q = 0; q < quads; q++) {
    if (dead[q]) continue;
    for (let k = 0; k < 4; k++) {
      const v = q * 4 + k;
      pos.push(b.pos[v * 3], b.pos[v * 3 + 1], b.pos[v * 3 + 2]);
      nrm.push(b.nrm[v * 3], b.nrm[v * 3 + 1], b.nrm[v * 3 + 2]);
      uv.push(b.uv[v * 2], b.uv[v * 2 + 1]);
      col.push(b.col[v * 3], b.col[v * 3 + 1], b.col[v * 3 + 2]);
    }
    const base = q * 4, start = w * 4;
    for (let k = 0; k < 6; k++) idx.push(b.idx[q * 6 + k] - base + start);
    w++;
  }
  b.pos = pos; b.nrm = nrm; b.uv = uv; b.col = col; b.idx = idx;
  return drop;
}

/** 타일 분할 규칙 (docs/ARCHITECTURE.md 성능 예산 '타일 청크'): 타일 한 변(월드 유닛)과 분할을 시작하는 최소 정점 수 */
export const CHUNK_TILE = 20;
export const CHUNK_MIN_VERTS = 3000;

/** 배치를 면(quad: 연속 4정점·6인덱스) 중심의 XZ 타일로 나눔. 분할할 만큼 크지 않으면 [batch] 그대로 */
function splitByTile(b: Batch): Batch[] {
  const nv = b.pos.length / 3;
  if (nv < CHUNK_MIN_VERTS || nv % 4 !== 0 || b.idx.length !== (nv / 4) * 6) return [b];
  const quads = nv / 4;
  const cx = new Float64Array(quads), cz = new Float64Array(quads);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let q = 0; q < quads; q++) {
    let sx = 0, sz = 0;
    for (let k = 0; k < 4; k++) { sx += b.pos[(q * 4 + k) * 3]; sz += b.pos[(q * 4 + k) * 3 + 2]; }
    cx[q] = sx / 4; cz[q] = sz / 4;
    if (cx[q] < x0) x0 = cx[q];
    if (cx[q] > x1) x1 = cx[q];
    if (cz[q] < z0) z0 = cz[q];
    if (cz[q] > z1) z1 = cz[q];
  }
  if (x1 - x0 < CHUNK_TILE && z1 - z0 < CHUNK_TILE) return [b];
  const tiles = new Map<string, Batch>();
  for (let q = 0; q < quads; q++) {
    const key = `${Math.floor(cx[q] / CHUNK_TILE)},${Math.floor(cz[q] / CHUNK_TILE)}`;
    let t = tiles.get(key);
    if (!t) { t = { pos: [], nrm: [], uv: [], col: [], idx: [] }; tiles.set(key, t); }
    const base = q * 4, start = t.pos.length / 3;
    for (let k = 0; k < 4; k++) {
      const v = base + k;
      t.pos.push(b.pos[v * 3], b.pos[v * 3 + 1], b.pos[v * 3 + 2]);
      t.nrm.push(b.nrm[v * 3], b.nrm[v * 3 + 1], b.nrm[v * 3 + 2]);
      t.uv.push(b.uv[v * 2], b.uv[v * 2 + 1]);
      t.col.push(b.col[v * 3], b.col[v * 3 + 1], b.col[v * 3 + 2]);
    }
    for (let k = 0; k < 6; k++) t.idx.push(b.idx[q * 6 + k] - base + start);
  }
  return tiles.size > 1 ? [...tiles.values()] : [b];
}
