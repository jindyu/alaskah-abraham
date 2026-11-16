import * as THREE from 'three';
import { isSharedMaterial } from './voxel';

/**
 * 정적 메시 병합 (드로우콜 절감).
 *
 * 무대를 짓고 나면 VoxelBuilder 가 텍스처별로 한 메시로 합쳐 주지만, 소품·건물마다 따로 build() 한 Group 들은
 * 같은 재질인데도 메시가 따로라 드로우콜(과 유니폼 업로드 할당)이 늘어난다.
 * 무대를 짓고 OBSERVE_FRAMES 프레임 동안 노드(메시+조상)의 변환·가시성을 관찰해 움직이거나 깜빡이는 노드는 '동적'으로 표시하고,
 * 나머지(공유 재질·불투명·작은 메시)를 (재질 × 그림자 플래그 × XZ 타일) 별로 월드 좌표로 구워 한 메시로 합친다.
 * 원본 메시는 지우지 않고 layer 1 로 옮겨 본 패스·그림자 패스 모두에서 안 그린다 (카메라 layer 0 만 본다).
 * 병합 뒤에도 매 프레임 원본 노드의 변환·가시성·부모가 그대로인지 확인하고, 하나라도 바뀌면 그 병합 메시만 풀어서
 * 원본을 layer 0 으로 되돌린다 → 액션이 소품을 숨기거나 옮겨도 화면이 틀어지지 않는다 (최대 1프레임 지연).
 * 프레임당 할당은 없다 (고정 Float32Array·for 루프).
 *
 * 움직이는 노드 아래의 정지 메시도 합친다: 움직이는 조상(anchor) 이 있으면 그 조상 좌표로 구워 붙이거나,
 * 여러 조상(부품)에 걸친 같은 재질은 '뼈 배치'(buildBoneMesh) 로 한 메시에 모아 정점 셰이더가 부품 월드 행렬로 옮긴다.
 * 합친 뒤 원본 노드가 바뀌면 바뀐 원본만 빼고 다시 굽는다 (repair). 그림자 패스 절감은 cullSmallShadows.
 */
export const OBSERVE_FRAMES = 45;
/** 병합 타일 한 변 (월드 유닛). VoxelBuilder 의 CHUNK_TILE(20) 타일은 이미 재질별로 나뉘어 있어 같은 20 타일로는 합칠 게 거의 없다.
 * 화면(정사영 세로 약 30유닛)에 한 번에 들어오는 범위와 비슷하게 잡아, 컬링 이득은 거의 안 잃고 타일 간 병합으로 드로우콜을 줄인다. */
export const MERGE_TILE = 48;
/** QA·튜닝용 런타임 설정 (devHooks 의 mergeConfig, 다음 무대부터 적용).
 * tile: 병합 타일 한 변 / smallR·smallTile: 이 반지름보다 작은 소품은 이 큰 타일로 합침 / shadowMinR: 이보다 작은 (병합 못 한) 메시는 그림자 패스에서 뺌 (0 이면 끔) /
 * shadowKeep: 한 부품 묶음에서 그림자를 드리울 큰 메시 수 (0 이면 끔) / shadowBigR: 이 이상은 항상 드리움 / anchors·bones: 움직이는 조상 안 병합·뼈 배치 (끄면 예전 동작) / observe: 관찰 프레임 */
export const mergeConfig = { tile: MERGE_TILE, shadowMinR: 0.22, shadowKeep: 3, shadowBigR: 1, smallR: 2, smallTile: 1e9, anchors: true, bones: true, observe: OBSERVE_FRAMES };
/** 이보다 큰 메시는 이미 VoxelBuilder 가 타일로 나눠 놓았거나 한 덩어리라 합치지 않는다 */
export const MERGE_MAX_VERTS = 6000;
const HIDDEN_LAYER = 1;

interface Merged {
  mesh: THREE.Mesh;
  /** 병합 메시가 붙는 곳: root (월드 고정) 또는 움직이는 조상 (그 노드 안에서는 정지한 메시들을 그 노드 좌표로 구워 붙임) */
  anchor: THREE.Object3D;
  sources: THREE.Mesh[];
  nodes: THREE.Object3D[];
  parents: (THREE.Object3D | null)[];
  snap: Float32Array;
  alive: boolean;
  /** 원본마다 그 원본이 속한 움직이는 조상(뼈). 일반 병합이면 모두 anchor */
  srcAnchors: THREE.Object3D[];
  /** 뼈 배치 병합이면: 뼈 행렬 배열(uBones)과 뼈 목록. 매 프레임 scene.onBeforeRender 에서 갱신 */
  bone: BoneData | null;
}

interface BoneData {
  anchors: THREE.Object3D[];
  arr: Float32Array;
  rootInv: THREE.Matrix4;
}

/** 뼈 배치 병합 한 메시의 최대 뼈(움직이는 부품) 수. 유니폼 mat4[24] = 96 벡터 */
export const MAX_BONES = 24;

const NODE_STRIDE = 11;
function writeSnap(n: THREE.Object3D, out: Float32Array, o: number): void {
  out[o] = n.visible ? 1 : 0;
  out[o + 1] = n.position.x; out[o + 2] = n.position.y; out[o + 3] = n.position.z;
  out[o + 4] = n.quaternion.x; out[o + 5] = n.quaternion.y; out[o + 6] = n.quaternion.z; out[o + 7] = n.quaternion.w;
  out[o + 8] = n.scale.x; out[o + 9] = n.scale.y; out[o + 10] = n.scale.z;
}
function sameSnap(n: THREE.Object3D, s: Float32Array, o: number): boolean {
  return s[o] === (n.visible ? 1 : 0)
    && s[o + 1] === n.position.x && s[o + 2] === n.position.y && s[o + 3] === n.position.z
    && s[o + 4] === n.quaternion.x && s[o + 5] === n.quaternion.y && s[o + 6] === n.quaternion.z && s[o + 7] === n.quaternion.w
    && s[o + 8] === n.scale.x && s[o + 9] === n.scale.y && s[o + 10] === n.scale.z;
}

function effectivelyVisible(n: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = n; o; o = o.parent) {
    if (!o.visible) return false;
    if (o === root) break;
  }
  return true;
}

function mergeable(m: THREE.Mesh): boolean {
  if (!(m as { isMesh?: boolean }).isMesh) return false;
  if ((m as unknown as { isInstancedMesh?: boolean }).isInstancedMesh || (m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) return false;
  const mat = m.material;
  if (Array.isArray(mat) || !mat || !isSharedMaterial(mat) || mat.transparent) return false;
  if (m.renderOrder !== 0 || !m.frustumCulled || m.layers.mask !== 1) return false;
  if (m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || m.onAfterRender !== THREE.Object3D.prototype.onAfterRender) return false;
  const g = m.geometry;
  const a = g.attributes;
  if (!a.position || !a.normal || !a.uv || !a.color || !g.index || g.groups.length > 0) return false;
  if (a.position.count > MERGE_MAX_VERTS) return false;
  if (a.position.itemSize !== 3 || a.normal.itemSize !== 3 || a.uv.itemSize !== 2 || a.color.itemSize !== 3) return false;
  if ((a.position as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) return false;
  return Object.keys(a).length === 4;
}

/** 정점 셰이더에 뼈 변환을 넣는다 (begin_vertex 뒤에 위치, beginnormal_vertex 뒤에 법선) */
function boneShader(vs: string, withNormal: boolean): string {
  let out = 'attribute float aBone;\nuniform mat4 uBones[' + MAX_BONES + '];\n' + vs;
  out = out.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = (uBones[int(aBone + 0.5)] * vec4(transformed, 1.0)).xyz;');
  if (withNormal) out = out.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal = mat3(uBones[int(aBone + 0.5)]) * objectNormal;');
  return out;
}

const tmpV = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpN = new THREE.Matrix3();
const tmpInv = new THREE.Matrix4();
const tmpS = new THREE.Vector3();

function bake(sources: THREE.Mesh[], rootInv: THREE.Matrix4): THREE.BufferGeometry {
  let nv = 0, ni = 0;
  for (const s of sources) { nv += s.geometry.attributes.position.count; ni += s.geometry.index!.count; }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const s of sources) {
    const g = s.geometry, a = g.attributes;
    tmpM.multiplyMatrices(rootInv, s.matrixWorld);
    tmpN.getNormalMatrix(tmpM);
    const n = a.position.count;
    for (let i = 0; i < n; i++) {
      tmpV.fromBufferAttribute(a.position, i).applyMatrix4(tmpM);
      pos[(vo + i) * 3] = tmpV.x; pos[(vo + i) * 3 + 1] = tmpV.y; pos[(vo + i) * 3 + 2] = tmpV.z;
      tmpV.fromBufferAttribute(a.normal, i).applyMatrix3(tmpN).normalize();
      nrm[(vo + i) * 3] = tmpV.x; nrm[(vo + i) * 3 + 1] = tmpV.y; nrm[(vo + i) * 3 + 2] = tmpV.z;
      uv[(vo + i) * 2] = a.uv.getX(i); uv[(vo + i) * 2 + 1] = a.uv.getY(i);
      col[(vo + i) * 3] = a.color.getX(i); col[(vo + i) * 3 + 1] = a.color.getY(i); col[(vo + i) * 3 + 2] = a.color.getZ(i);
    }
    const ix = g.index!;
    // 행렬식이 음수(거울 스케일)면 면 방향이 뒤집히므로 인덱스 순서를 바꿔 감는 방향을 유지
    const flip = tmpM.determinant() < 0;
    for (let i = 0; i < ix.count; i += 3) {
      const a0 = ix.getX(i) + vo, a1 = ix.getX(i + 1) + vo, a2 = ix.getX(i + 2) + vo;
      idx[io++] = a0; idx[io++] = flip ? a2 : a1; idx[io++] = flip ? a1 : a2;
    }
    vo += n;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** 뼈 배치 메시가 쓰는 복제 재질(·깊이 재질)을 치운다. 텍스처는 공유라 건드리지 않는다 */
export function disposeBoneMaterials(mesh: THREE.Mesh): void {
  const mat = mesh.material;
  if (!Array.isArray(mat) && mat.userData.boneBatch) mat.dispose();
  const d = mesh.customDepthMaterial;
  if (d && d.userData.boneBatch) d.dispose();
}

export class StaticMerger {
  private readonly root: THREE.Object3D;
  private frames = 0;
  private done = false;
  private dynamic = new Set<THREE.Object3D>();
  private observed: THREE.Object3D[] = [];
  private observedSnap: Float32Array = new Float32Array(0);
  private merged: Merged[] = [];
  /** 통계 (QA·테스트) */
  mergedMeshes = 0;
  mergedSources = 0;
  unmerged = 0;
  shadowCulled = 0;
  private readonly culledMeshes: THREE.Mesh[] = [];
  /** 뼈 배치 병합 메시 수 */
  boneMeshes = 0;
  /** 합친 뒤 원본이 바뀌어 바뀐 것만 빼고 다시 구운 횟수 */
  repaired = 0;
  /** 합치지 못한 메시 사유별 수 (QA 진단) */
  readonly rejects = { hidden: 0, notMergeable: 0, dynamic: 0, singleton: 0 };

  constructor(root: THREE.Object3D) {
    this.root = root;
    this.beginObserve();
  }

  private beginObserve(): void {
    const nodes: THREE.Object3D[] = [];
    this.root.traverse((o) => { if (o !== this.root) nodes.push(o); });
    this.observed = nodes;
    this.observedSnap = new Float32Array(nodes.length * NODE_STRIDE);
    for (let i = 0; i < nodes.length; i++) writeSnap(nodes[i], this.observedSnap, i * NODE_STRIDE);
  }

  /** 매 프레임 (stageManager.update) 호출 */
  update(): void {
    if (!this.done) {
      const s = this.observedSnap, nodes = this.observed;
      for (let i = 0; i < nodes.length; i++) {
        const o = i * NODE_STRIDE;
        if (!sameSnap(nodes[i], s, o)) { this.dynamic.add(nodes[i]); writeSnap(nodes[i], s, o); }
      }
      if (++this.frames >= mergeConfig.observe) { this.done = true; this.merge(); this.observed = []; this.observedSnap = new Float32Array(0); }
      return;
    }
    const list = this.merged;
    // 합쳐진 뒤에 원본 노드가 바뀐 병합은 통째로 풀지 않고, 바뀐 원본만 빼고 나머지로 다시 굽는다 (한 소품의 변화가 무대 전체 병합을 깨지 않게)
    for (let i = 0, n0 = list.length; i < n0; i++) {
      const m = list[i];
      if (!m.alive) continue;
      let ok = true;
      const n = m.nodes, s = m.snap;
      for (let k = 0; k < n.length; k++) {
        if (!sameSnap(n[k], s, k * NODE_STRIDE) || n[k].parent !== m.parents[k]) { ok = false; break; }
      }
      if (!ok) this.repair(m);
    }
  }

  /** 병합 m 의 원본 중 바뀐 노드 아래에 있는 것을 동적으로 표시하고, 나머지로 병합을 다시 만든다 */
  private repair(m: Merged): void {
    const bad = new Set<THREE.Object3D>();
    const n = m.nodes, s = m.snap;
    for (let k = 0; k < n.length; k++) if (!sameSnap(n[k], s, k * NODE_STRIDE) || n[k].parent !== m.parents[k]) { bad.add(n[k]); this.dynamic.add(n[k]); }
    const keep: THREE.Mesh[] = [], keepA: THREE.Object3D[] = [];
    for (let i = 0; i < m.sources.length; i++) {
      let hit = false;
      for (let a: THREE.Object3D | null = m.sources[i]; a && a !== m.srcAnchors[i]; a = a.parent) if (bad.has(a)) { hit = true; break; }
      if (!hit) { keep.push(m.sources[i]); keepA.push(m.srcAnchors[i]); }
    }
    const anchor = m.anchor, wasBone = !!m.bone;
    this.unmerge(m);
    if (keep.length >= 2) {
      this.root.updateMatrixWorld(true);
      if (wasBone) this.buildBoneMesh(keep, keepA); else this.buildMerged(anchor, keep);
      this.repaired++;
    }
  }

  private merge(): void {
    this.root.updateMatrixWorld(true);
    const root = this.root;
    const groups = new Map<string, { anchor: THREE.Object3D; sources: THREE.Mesh[] }>();
    const rj = this.rejects;
    const tile = mergeConfig.tile;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!(m as { isMesh?: boolean }).isMesh) return;
      if (!effectivelyVisible(m, root)) { rj.hidden++; return; }
      if (!mergeable(m)) { rj.notMergeable++; return; }
      // 자신이 움직이면 제외. 움직이는 조상이 있으면 그 조상 안에서만(조상 좌표로) 합친다 — 같이 움직이는 정지 부품끼리
      if (this.dynamic.has(m)) { rj.dynamic++; return; }
      let anchor: THREE.Object3D = root;
      for (let a: THREE.Object3D | null = m.parent; a && a !== root; a = a.parent) if (this.dynamic.has(a)) { anchor = a; break; }
      if (anchor !== root && !mergeConfig.anchors) { rj.dynamic++; return; }
      m.geometry.computeBoundingSphere();
      const bs = m.geometry.boundingSphere!;
      const mat = m.material as THREE.Material;
      let where: string;
      if (anchor === root) {
        tmpV.copy(bs.center).applyMatrix4(m.matrixWorld);
        // 작은 소품(반지름 < smallR)은 컬링 이득이 거의 없으므로 훨씬 큰 타일로 합쳐 같은 재질끼리 한 덩어리로 (드로우콜 절감)
        const t = bs.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) < mergeConfig.smallR ? mergeConfig.smallTile : tile;
        where = `${Math.floor(tmpV.x / t)},${Math.floor(tmpV.z / t)}`;
      } else where = anchor.uuid;
      const key = `${mat.uuid}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${where}`;
      let g = groups.get(key);
      if (!g) groups.set(key, g = { anchor, sources: [] });
      g.sources.push(m);
    });
    const boneSources: THREE.Mesh[] = [];
    const boneSrcAnchors: THREE.Object3D[] = [];
    for (const { anchor, sources } of groups.values()) {
      if (anchor !== root && !mergeConfig.bones) {
        if (sources.length < 2) { rj.singleton++; continue; }
        this.buildMerged(anchor, sources);
        continue;
      }
      if (anchor !== root) { for (const src of sources) { boneSources.push(src); boneSrcAnchors.push(anchor); } continue; }
      if (sources.length < 2) { rj.singleton++; continue; }
      this.buildMerged(anchor, sources);
    }
    if (boneSources.length) this.buildBoneBatches(boneSources, boneSrcAnchors);
    this.cullSmallShadows();
  }

  /** 같은 (재질·그림자 플래그) 정지 메시들을 anchor 좌표로 구워 한 메시로 합치고 원본을 layer 1 로 옮긴다 */
  private buildMerged(anchor: THREE.Object3D, sources: THREE.Mesh[]): void {
    tmpInv.copy(anchor.matrixWorld).invert();
    const geo = bake(sources, tmpInv);
    const first = sources[0];
    const mesh = new THREE.Mesh(geo, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.name = 'merged-static';
    const nodeSet = new Set<THREE.Object3D>();
    for (const s of sources) for (let a: THREE.Object3D | null = s; a && a !== anchor; a = a.parent) nodeSet.add(a);
    const nodes = Array.from(nodeSet);
    const snap = new Float32Array(nodes.length * NODE_STRIDE);
    const parents: (THREE.Object3D | null)[] = new Array(nodes.length);
    for (let k = 0; k < nodes.length; k++) { writeSnap(nodes[k], snap, k * NODE_STRIDE); parents[k] = nodes[k].parent; }
    for (const s of sources) s.layers.set(HIDDEN_LAYER);
    anchor.add(mesh);
    this.merged.push({ mesh, anchor, sources, nodes, parents, snap, alive: true, srcAnchors: sources.map(() => anchor), bone: null });
    this.mergedMeshes++;
    this.mergedSources += sources.length;
  }

  /**
   * 뼈 배치: 움직이는 부품(사람·동물의 팔다리 같은, 안에서는 정지한 메시 묶음)들을 (재질 × 그림자 플래그) 별로 한 메시에 합친다.
   * 정점은 부품(뼈) 로컬 좌표로 구워 두고 정점마다 뼈 번호(aBone)를 달고, 정점 셰이더가 uBones[aBone] (그 부품의 월드 행렬)로 옮긴다 —
   * 스키닝과 같은 원리지만 부품마다 뼈 하나뿐이라 가중치가 없다. 그림자 패스용 깊이 재질도 같은 변환을 한다.
   * 뼈 행렬은 scene.onBeforeRender (월드 행렬 갱신 뒤·그림자 패스 앞) 에서 할당 없이 채운다. 부품이 숨겨지거나 장면에서 빠지면 행렬을 0 으로 만들어 안 그린다.
   * 한 메시당 MAX_BONES 부품씩 끊는다 (유니폼 한도).
   */
  private buildBoneBatches(sources: THREE.Mesh[], srcAnchors: THREE.Object3D[]): void {
    const byKey = new Map<string, number[]>();
    for (let i = 0; i < sources.length; i++) {
      const m = sources[i];
      const key = `${(m.material as THREE.Material).uuid}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}`;
      let l = byKey.get(key);
      if (!l) byKey.set(key, l = []);
      l.push(i);
    }
    for (const idxs of byKey.values()) {
      // 부품(뼈) 수를 MAX_BONES 이하로 끊는다
      let chunk: number[] = [];
      let bones = new Set<THREE.Object3D>();
      const flush = () => {
        if (chunk.length >= 2) this.buildBoneMesh(chunk.map((k) => sources[k]), chunk.map((k) => srcAnchors[k]));
        else this.rejects.singleton += chunk.length;
        chunk = []; bones = new Set();
      };
      for (const k of idxs) {
        const a = srcAnchors[k];
        if (!bones.has(a) && bones.size >= MAX_BONES) flush();
        bones.add(a); chunk.push(k);
      }
      flush();
    }
  }

  private buildBoneMesh(sources: THREE.Mesh[], srcAnchors: THREE.Object3D[]): void {
    const root = this.root;
    root.updateMatrixWorld(true);
    const anchors: THREE.Object3D[] = [];
    const boneOf = new Map<THREE.Object3D, number>();
    for (const a of srcAnchors) if (!boneOf.has(a)) { boneOf.set(a, anchors.length); anchors.push(a); }
    // 정점 수 세기 → 부품 로컬 좌표로 굽기
    let nv = 0, ni = 0;
    for (const s of sources) { nv += s.geometry.attributes.position.count; ni += s.geometry.index!.count; }
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), bone = new Float32Array(nv);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (let si = 0; si < sources.length; si++) {
      const s = sources[si], g = s.geometry, a = g.attributes, A = srcAnchors[si];
      tmpInv.copy(A.matrixWorld).invert();
      tmpM.multiplyMatrices(tmpInv, s.matrixWorld);
      tmpN.getNormalMatrix(tmpM);
      const n = a.position.count, b = boneOf.get(A)!;
      for (let i = 0; i < n; i++) {
        tmpV.fromBufferAttribute(a.position, i).applyMatrix4(tmpM);
        pos[(vo + i) * 3] = tmpV.x; pos[(vo + i) * 3 + 1] = tmpV.y; pos[(vo + i) * 3 + 2] = tmpV.z;
        tmpV.fromBufferAttribute(a.normal, i).applyMatrix3(tmpN).normalize();
        nrm[(vo + i) * 3] = tmpV.x; nrm[(vo + i) * 3 + 1] = tmpV.y; nrm[(vo + i) * 3 + 2] = tmpV.z;
        uv[(vo + i) * 2] = a.uv.getX(i); uv[(vo + i) * 2 + 1] = a.uv.getY(i);
        col[(vo + i) * 3] = a.color.getX(i); col[(vo + i) * 3 + 1] = a.color.getY(i); col[(vo + i) * 3 + 2] = a.color.getZ(i);
        bone[vo + i] = b;
      }
      const ix = g.index!;
      const flip = tmpM.determinant() < 0;
      for (let i = 0; i < ix.count; i += 3) {
        const a0 = ix.getX(i) + vo, a1 = ix.getX(i + 1) + vo, a2 = ix.getX(i + 2) + vo;
        idx[io++] = a0; idx[io++] = flip ? a2 : a1; idx[io++] = flip ? a1 : a2;
      }
      vo += n;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aBone', new THREE.BufferAttribute(bone, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));

    const arr = new Float32Array(MAX_BONES * 16);
    for (let b = 0; b < MAX_BONES; b++) { arr[b * 16] = 1; arr[b * 16 + 5] = 1; arr[b * 16 + 10] = 1; arr[b * 16 + 15] = 1; }
    const uniform = { value: arr };
    const first = sources[0];
    const src = first.material as THREE.Material;
    const mat = src.clone();
    mat.userData.boneBatch = true;
    const srcCompile = src.onBeforeCompile, srcKey = src.customProgramCacheKey;
    mat.onBeforeCompile = (shader, renderer) => {
      srcCompile.call(mat, shader, renderer);
      shader.uniforms.uBones = uniform;
      shader.vertexShader = boneShader(shader.vertexShader, true);
    };
    mat.customProgramCacheKey = () => `bonebatch-${MAX_BONES}|${srcKey.call(src)}`;
    const depth = new THREE.MeshDepthMaterial();
    depth.userData.boneBatch = true;
    depth.onBeforeCompile = (shader) => {
      shader.uniforms.uBones = uniform;
      shader.vertexShader = boneShader(shader.vertexShader, false);
    };
    depth.customProgramCacheKey = () => `bonebatch-depth-${MAX_BONES}`;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.customDepthMaterial = depth;
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.frustumCulled = false; // 뼈가 움직이므로 정적 경계구가 맞지 않는다
    mesh.name = 'merged-static';
    const nodeSet = new Set<THREE.Object3D>();
    for (let si = 0; si < sources.length; si++) for (let a: THREE.Object3D | null = sources[si]; a && a !== srcAnchors[si]; a = a.parent) nodeSet.add(a);
    const nodes = Array.from(nodeSet);
    const snap = new Float32Array(nodes.length * NODE_STRIDE);
    const parents: (THREE.Object3D | null)[] = new Array(nodes.length);
    for (let k = 0; k < nodes.length; k++) { writeSnap(nodes[k], snap, k * NODE_STRIDE); parents[k] = nodes[k].parent; }
    for (const s of sources) s.layers.set(HIDDEN_LAYER);
    root.add(mesh);
    const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    this.merged.push({ mesh, anchor: root, sources, nodes, parents, snap, alive: true, srcAnchors, bone: { anchors, arr, rootInv } });
    this.mergedMeshes++;
    this.mergedSources += sources.length;
    this.boneMeshes++;
    this.writeBones(this.merged[this.merged.length - 1].bone!);
  }

  /** 뼈 행렬 = 무대 루트 기준 부품 월드 행렬. 숨겨지거나 장면에서 빠진 부품은 0 행렬 (안 그려짐) */
  private writeBones(b: BoneData): void {
    const root = this.root, arr = b.arr, anchors = b.anchors;
    for (let i = 0; i < anchors.length; i++) {
      let shown = true;
      for (let a: THREE.Object3D | null = anchors[i]; ; a = a.parent) {
        if (!a) { shown = false; break; }
        if (!a.visible) { shown = false; break; }
        if (a === root) break;
      }
      const o = i * 16;
      if (shown) {
        tmpM.multiplyMatrices(b.rootInv, anchors[i].matrixWorld);
        const e = tmpM.elements;
        for (let k = 0; k < 16; k++) arr[o + k] = e[k];
      } else {
        for (let k = 0; k < 16; k++) arr[o + k] = 0;
      }
    }
  }

  /** scene.onBeforeRender 에서 매 프레임: 살아 있는 뼈 배치 메시의 행렬을 갱신 */
  updateBones(): void {
    const list = this.merged;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.alive && m.bone) this.writeBones(m.bone);
    }
  }

  /**
   * 그림자 패스 절감 (그림자 패스는 본 패스와 같은 수의 드로우콜이 또 든다):
   *  - 병합하지 못한 작은 메시(월드 반지름 < shadowMinR)는 그림자에서 뺀다 — 한두 픽셀짜리 그림자.
   *  - 같이 움직이는 부품 묶음(사람·동물처럼 가장 바깥의 움직이는 조상 아래 메시들)은 큰 것 shadowKeep 개만 그림자를 드리운다 —
   *    팔다리 하나하나의 그림자는 몸통 그림자 위에 겹쳐 사라진다.
   * 병합된 메시·큰 메시(반지름 ≥ shadowBigR)는 그대로. 본 패스에는 영향 없음.
   */
  private cullSmallShadows(): void {
    const minR = mergeConfig.shadowMinR, keepN = mergeConfig.shadowKeep, bigR = mergeConfig.shadowBigR;
    if (!(minR > 0) && !(keepN > 0)) return;
    const clusters = new Map<THREE.Object3D, { m: THREE.Mesh; r: number }[]>();
    const root = this.root;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!(m as { isMesh?: boolean }).isMesh || !m.castShadow || m.layers.mask !== 1 || m.name === 'merged-static') return;
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      const bs = m.geometry.boundingSphere;
      if (!bs) return;
      m.getWorldScale(tmpS);
      const r = bs.radius * Math.max(tmpS.x, tmpS.y, tmpS.z);
      if (r >= bigR) return;
      if (r < minR) { m.castShadow = false; this.culledMeshes.push(m); this.shadowCulled++; return; }
      if (!(keepN > 0)) return;
      let top: THREE.Object3D | null = null;
      for (let a: THREE.Object3D | null = m.parent; a && a !== root; a = a.parent) if (this.dynamic.has(a)) top = a;
      if (!top) return;
      let list = clusters.get(top);
      if (!list) clusters.set(top, list = []);
      list.push({ m, r });
    });
    for (const list of clusters.values()) {
      if (list.length <= keepN) continue;
      list.sort((x, y) => y.r - x.r);
      for (let i = keepN; i < list.length; i++) { list[i].m.castShadow = false; this.culledMeshes.push(list[i].m); this.shadowCulled++; }
    }
  }

  /** QA 전용: 그림자 컷으로 뺀 메시의 그림자를 되살리기(false)/다시 빼기(true) — 컷의 화면 영향을 같은 장면에서 재려고 */
  setShadowCull(on: boolean): void {
    for (const m of this.culledMeshes) m.castShadow = !on;
  }

  /** 병합 관찰이 끝나 병합까지 마쳤나 */
  get ready(): boolean { return this.done; }

  /**
   * QA 전용: 병합 켜기/끄기 (같은 무대·같은 상태에서 병합 전후 화면을 비교하려고).
   * 끄면 병합 메시를 숨기고 살아 있는 병합의 원본을 layer 0 으로 되돌린다. 켜면 반대로. 풀려 버린 병합은 건드리지 않는다.
   */
  setActive(on: boolean): void {
    for (const m of this.merged) {
      if (!m.alive) continue;
      m.mesh.visible = on;
      for (const s of m.sources) s.layers.set(on ? HIDDEN_LAYER : 0);
    }
  }

  private unmerge(m: Merged): void {
    m.alive = false;
    for (const s of m.sources) s.layers.set(0);
    m.mesh.parent?.remove(m.mesh);
    m.mesh.geometry.dispose();
    if (m.bone) disposeBoneMaterials(m.mesh);
    this.unmerged++;
  }

  /** 무대 해제 때 (geometry 는 stageManager 의 traverse 가 정리하지만, 병합 메시 참조를 끊는다) */
  dispose(): void {
    for (const m of this.merged) { if (m.alive && m.bone) disposeBoneMaterials(m.mesh); m.nodes.length = 0; m.sources.length = 0; }
    this.merged = [];
  }
}
