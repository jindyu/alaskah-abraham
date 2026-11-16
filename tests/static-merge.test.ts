import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VoxelBuilder, voxelConfig } from '../src/world/voxel';
import { MAX_BONES, StaticMerger, mergeConfig } from '../src/world/staticMerge';
import { snapRect, snapSpan } from '../src/ui/uiScale';

function box(x: number, y: number, z: number, tex: 'plain' | 'wood' = 'plain'): THREE.Group {
  const b = new VoxelBuilder(3);
  b.box(0, 0, 0, 1, 1, 1, 0xc0a080, { tex, ao: false, jitter: 0 });
  const g = b.build(true, true);
  g.position.set(x, y, z);
  return g;
}
const merged = (root: THREE.Object3D): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => { if (o.name === 'merged-static') out.push(o as THREE.Mesh); });
  return out;
};
const triCount = (root: THREE.Object3D): number => {
  let n = 0;
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.layers.mask === 1 && m.visible) n += m.geometry.index!.count / 3; });
  return n;
};
function observe(sm: StaticMerger, rootFrames = mergeConfig.observe + 1, each?: () => void): void {
  for (let i = 0; i < rootFrames; i++) { each?.(); sm.update(); }
}

describe('정적 병합 (staticMerge)', () => {
  it('정지한 같은 재질 메시들을 한 메시로 합치고 원본을 layer 1 로 옮기며, 삼각형 수는 그대로다', () => {
    const root = new THREE.Group();
    for (let i = 0; i < 6; i++) root.add(box(i * 3, 0, 0));
    const before = triCount(root);
    const sm = new StaticMerger(root);
    observe(sm);
    expect(sm.ready).toBe(true);
    expect(merged(root).length).toBe(1);
    expect(sm.mergedSources).toBe(6);
    expect(triCount(root)).toBe(before);
    // 끄면 원본이 돌아오고 병합 메시는 숨는다
    sm.setActive(false);
    expect(merged(root)[0].visible).toBe(false);
    expect(triCount(root)).toBe(before);
    sm.setActive(true);
    expect(merged(root)[0].visible).toBe(true);
  });

  it('합친 뒤 원본 하나가 움직이면 그것만 빼고 나머지로 다시 굽는다 (통째로 풀지 않는다)', () => {
    const root = new THREE.Group();
    const groups: THREE.Group[] = [];
    for (let i = 0; i < 5; i++) { const g = box(i * 3, 0, 0); groups.push(g); root.add(g); }
    const sm = new StaticMerger(root);
    observe(sm);
    expect(merged(root).length).toBe(1);
    groups[2].position.y += 1; // 한 소품이 움직임
    sm.update();
    expect(sm.repaired).toBe(1);
    const mm = merged(root);
    expect(mm.length).toBe(1); // 나머지 4 개로 다시 구운 하나
    groups[2].traverse((o) => { if ((o as THREE.Mesh).isMesh) expect(o.layers.mask).toBe(1); }); // 움직인 쪽은 다시 보인다
    groups[0].traverse((o) => { if ((o as THREE.Mesh).isMesh) expect(o.layers.mask).toBe(2); });
  });

  it('움직이는 부품(조상)들 안의 정지 메시는 뼈 배치로 한 메시에 합쳐지고 뼈 번호가 붙는다', () => {
    const root = new THREE.Group();
    const parts: THREE.Group[] = [];
    for (let i = 0; i < 4; i++) {
      const part = new THREE.Group();
      part.position.set(i * 3, 0, 0);
      part.add(box(0, 0, 0), box(0, 1, 0)); // 부품 안에는 같은 재질 메시 둘
      parts.push(part);
      root.add(part);
    }
    const sm = new StaticMerger(root);
    let t = 0;
    observe(sm, mergeConfig.observe + 1, () => { t += 0.1; for (const p of parts) p.rotation.y = Math.sin(t); });
    const mm = merged(root);
    expect(mm.length).toBeGreaterThanOrEqual(1);
    expect(sm.boneMeshes).toBeGreaterThanOrEqual(1);
    const bone = mm.find((m) => m.geometry.getAttribute('aBone'))!;
    expect(bone).toBeTruthy();
    const ab = bone.geometry.getAttribute('aBone');
    let max = 0;
    for (let i = 0; i < ab.count; i++) max = Math.max(max, ab.getX(i));
    expect(max).toBe(3); // 부품 4 개 → 뼈 0..3
    expect(bone.frustumCulled).toBe(false);
    expect(bone.customDepthMaterial).toBeTruthy(); // 그림자 패스도 같은 변환
    expect(max).toBeLessThan(MAX_BONES);
    // 부품이 아직 움직이는 한(계속 회전) 병합이 안 풀린다 — 움직임은 뼈 행렬이 맡는다
    for (let i = 0; i < 20; i++) { t += 0.1; for (const p of parts) p.rotation.y = Math.sin(t); sm.update(); sm.updateBones(); }
    expect(merged(root).length).toBe(mm.length);
    expect(sm.unmerged).toBe(0);
  });

  it('병합 분류: 투명·공유 아님 재질은 합치지 않는다', () => {
    const root = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
      root.add(m);
    }
    const sm = new StaticMerger(root);
    observe(sm);
    expect(sm.mergedMeshes).toBe(0);
    expect(sm.rejects.notMergeable).toBe(3);
  });
});

describe('안쪽 면 제거 (voxel dropCoincidentQuads)', () => {
  const stack = (cull: boolean): number => {
    const prev = voxelConfig.cullInterior;
    voxelConfig.cullInterior = cull;
    try {
      const b = new VoxelBuilder(1);
      b.box(0, 0, 0, 1, 1, 1, 0xaaaaaa, { ao: true, jitter: 0 }); // 땅에 붙음: 5면
      b.box(0, 1, 0, 1, 1, 1, 0xaaaaaa, { ao: true, jitter: 0 }); // 위에 쌓음: 6면
      const g = b.build(true, true);
      let v = 0;
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) v += m.geometry.getAttribute('position').count; });
      return v;
    } finally { voxelConfig.cullInterior = prev; }
  };
  it('쌓은 박스 사이의 마주 붙은 두 면만 빠진다 (11면 → 9면)', () => {
    expect(stack(false)).toBe(11 * 4);
    expect(stack(true)).toBe(9 * 4);
  });
  it('떨어져 있는 박스는 하나도 안 빠진다', () => {
    voxelConfig.cullInterior = true;
    const b = new VoxelBuilder(1);
    b.box(0, 0, 0, 1, 1, 1, 0xaaaaaa, { ao: true, jitter: 0 });
    b.box(2, 0, 0, 1, 1, 1, 0xaaaaaa, { ao: true, jitter: 0 });
    let v = 0;
    b.build(true, true).traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) v += m.geometry.getAttribute('position').count; });
    expect(v).toBe(10 * 4);
  });
});

describe('snapRect 풀링 (프레임당 할당 0)', () => {
  it('snapSpan 과 같은 결과를 내고, 최근 64 번까지는 서로 다른 객체다', () => {
    for (const [x, w, d] of [[1.4, 10.3, 2], [5, -3, 3], [0, 0.1, 0.5], [7.5, 2, 1.25]] as const) {
      const r = snapRect(x, 2.2, w, 4.4, d);
      const [x0, x1] = snapSpan(x, w, d), [y0, y1] = snapSpan(2.2, 4.4, d);
      expect([r.x0, r.x1, r.y0, r.y1]).toEqual([x0, x1, y0, y1]);
    }
    const seen = new Set<object>();
    for (let i = 0; i < 64; i++) seen.add(snapRect(i, i, 1, 1, 1));
    expect(seen.size).toBe(64);
  });
});
