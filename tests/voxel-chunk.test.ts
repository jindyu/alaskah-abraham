import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CHUNK_MIN_VERTS, CHUNK_TILE, VoxelBuilder } from '../src/world/voxel';

/** 땅에 붙은 정적 박스(ao 기본값)는 바닥면을 빼서 박스당 5면 = 20정점·30인덱스 */
const V_PER_BOX = 20, I_PER_BOX = 30;

function meshesOf(g: THREE.Group): THREE.Mesh[] {
  return g.children as THREE.Mesh[];
}
function vertCount(m: THREE.Mesh) { return m.geometry.getAttribute('position').count; }

/** 가로 nx × 세로 nz 칸, 칸 간격 step 으로 박스를 깔아 build 한다 */
function grid(nx: number, nz: number, step: number, tex: 'plain' | 'wood' | 'mixed' = 'plain') {
  const b = new VoxelBuilder(7);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++)
      b.box(i * step, 0, j * step, 1, 1, 1, 0xc0a080, { tex: tex === 'mixed' ? ((i + j) % 2 ? 'wood' : 'plain') : tex });
  return b.build(true, true);
}

describe('VoxelBuilder.build 타일 청크', () => {
  it('넓게 깔린 큰 배치는 XZ 타일 여러 개로 갈라지고 정점·인덱스 총량이 같다', () => {
    const n = 20 * 10;
    expect(n * V_PER_BOX).toBeGreaterThanOrEqual(CHUNK_MIN_VERTS);
    const ms = meshesOf(grid(20, 10, 5));
    expect(ms.length).toBeGreaterThanOrEqual(2);
    expect(ms.reduce((s, m) => s + vertCount(m), 0)).toBe(n * V_PER_BOX);
    expect(ms.reduce((s, m) => s + (m.geometry.index?.count ?? 0), 0)).toBe(n * I_PER_BOX);
  });

  it('각 타일의 인덱스는 그 타일의 정점 범위 안이고, 면 중심은 모두 같은 타일에 있고, 경계 구가 있다', () => {
    for (const m of meshesOf(grid(20, 10, 5))) {
      const pos = m.geometry.getAttribute('position');
      const idx = m.geometry.index!;
      let max = -1, min = Infinity;
      for (let i = 0; i < idx.count; i++) { max = Math.max(max, idx.getX(i)); min = Math.min(min, idx.getX(i)); }
      expect(min).toBe(0);
      expect(max).toBe(pos.count - 1);
      expect(idx.count % 6).toBe(0);
      expect(pos.count % 4).toBe(0);
      const keys = new Set<string>();
      for (let q = 0; q < pos.count / 4; q++) {
        let cx = 0, cz = 0;
        for (let k = 0; k < 4; k++) { cx += pos.getX(q * 4 + k) / 4; cz += pos.getZ(q * 4 + k) / 4; }
        keys.add(`${Math.floor(cx / CHUNK_TILE)},${Math.floor(cz / CHUNK_TILE)}`);
      }
      expect(keys.size).toBe(1);
      expect(m.geometry.boundingSphere).not.toBeNull();
      // 타일 한 변 + 박스 크기 안에 들어가는 작은 구 (타일 대각선 / 2 + 여유)
      expect(m.geometry.boundingSphere!.radius).toBeLessThan((CHUNK_TILE * Math.SQRT2) / 2 + 2);
      expect(m.frustumCulled).toBe(true);
    }
  });

  it('삼각형 winding 이 저장된 법선과 같은 방향을 유지한다', () => {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (const m of meshesOf(grid(20, 10, 5))) {
      const pos = m.geometry.getAttribute('position'), nrm = m.geometry.getAttribute('normal'), idx = m.geometry.index!;
      for (let t = 0; t < idx.count; t += 3) {
        const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
        a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
        n.copy(b).sub(a).cross(c.clone().sub(a));
        expect(n.dot(new THREE.Vector3().fromBufferAttribute(nrm, i0))).toBeGreaterThan(0);
      }
    }
  });

  it('텍스처가 다르면 메시도 따로 (타일 × 텍스처), 총량은 그대로', () => {
    const ms = meshesOf(grid(40, 10, 5, 'mixed'));
    const mats = new Set(ms.map((m) => m.material));
    expect(mats.size).toBe(2);
    expect(ms.reduce((s, m) => s + vertCount(m), 0)).toBe(400 * V_PER_BOX);
    expect(ms.length).toBeGreaterThanOrEqual(4);
  });

  it('작은 모델(정점 임계 미만)은 메시 하나', () => {
    const ms = meshesOf(grid(3, 3, 5));
    expect(ms.length).toBe(1);
    expect(vertCount(ms[0])).toBe(9 * V_PER_BOX);
  });

  it('정점이 많아도 XZ 범위가 타일보다 좁으면 쪼개지 않는다', () => {
    const ms = meshesOf(grid(20, 10, 0.5));
    expect(20 * 10 * V_PER_BOX).toBeGreaterThanOrEqual(CHUNK_MIN_VERTS);
    expect(ms.length).toBe(1);
    expect(vertCount(ms[0])).toBe(200 * V_PER_BOX);
  });
});
