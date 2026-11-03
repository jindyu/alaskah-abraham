import * as THREE from 'three';
import type { Interactable } from '../systems/interaction';

/** 클릭한 곳 근처를 대상으로 칠 여유 (대상 반지름 밖으로 이만큼까지) */
export const PICK_MARGIN = 0.6;

/** 화면 좌표(clientX/Y) → 그 요소 안의 NDC(-1..1, 위가 +). rect 는 렌더 캔버스의 getBoundingClientRect */
export function ndcOf(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): { x: number; y: number } {
  return { x: ((clientX - rect.left) / rect.width) * 2 - 1, y: -(((clientY - rect.top) / rect.height) * 2 - 1) };
}

const ray = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const ndc = new THREE.Vector2();

/** NDC 위치의 시선이 월드 y=0 평면과 만나는 지점 (x, z). 평면과 만나지 않으면 null */
export function groundPoint(camera: THREE.Camera, nx: number, ny: number): { x: number; z: number } | null {
  camera.updateMatrixWorld();
  ray.setFromCamera(ndc.set(nx, ny), camera);
  const p = ray.ray.intersectPlane(ground, hit);
  return p && Number.isFinite(p.x) && Number.isFinite(p.z) ? { x: p.x, z: p.z } : null;
}

/**
 * (x, z) 에서 가장 가까운 상호작용 대상(가장자리 거리 − 가중치가 작은 것). pos±r+margin 안만 후보.
 * label() 은 부수효과가 있을 수 있어 최종 후보에만 물음: 지금 할 수 없는(null) 대상은 건너뛰고 다음 후보
 */
export function pickInteractable(items: Iterable<Interactable>, x: number, z: number, margin = PICK_MARGIN): Interactable | null {
  const cands: { it: Interactable; score: number }[] = [];
  for (const it of items) {
    const p = it.pos();
    const gap = Math.hypot(p.x - x, p.z - z) - it.r;
    if (gap > margin) continue;
    cands.push({ it, score: gap - (typeof it.bias === 'function' ? it.bias() : it.bias ?? 0) });
  }
  cands.sort((a, b) => a.score - b.score);
  for (const c of cands) if (c.it.label() !== null) return c.it;
  return null;
}
