import type { Interactions } from '../systems/interaction';

/** 안내 대상의 위치·높이·문구 (호출하는 쪽이 객체 하나를 재사용한다) */
export interface GuidanceTarget {
  x: number;
  z: number;
  height: number;
  label: string;
}

/** 안전망 상호작용의 id (createGame.addContinueInteraction 과 같은 값) */
export const SAFETY_NET_ID = 'story_continue';

/**
 * 플레이어 (px, pz) 에서 가장 가까운, 지금 할 수 있는(label 이 null 이 아닌) 상호작용을 out 에 채운다 (순수).
 * 실제 상호작용이 하나라도 있으면 '다음 이야기로'(안전망)는 후보에서 뺀다 — 핀이 퀘스트 대신 안전망을 가리키지 않게.
 * 후보가 없으면 false (out 은 그대로).
 */
export function findGuidanceTarget(interactions: Interactions, px: number, pz: number, out: GuidanceTarget): boolean {
  let bestD = Infinity;
  let found = false;
  let sawReal = false;
  for (const it of interactions.values()) {
    const label = it.label();
    if (label === null) continue;
    const isNet = it.id === SAFETY_NET_ID;
    if (isNet && sawReal) continue;
    if (!isNet && !sawReal) { sawReal = true; bestD = Infinity; found = false; } // 첫 실제 상호작용이 나오면 안전망 후보를 버림
    const pos = it.pos();
    const dx = pos.x - px;
    const dz = pos.z - pz;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      out.x = pos.x;
      out.z = pos.z;
      out.height = it.height;
      out.label = label;
      found = true;
    }
  }
  return found;
}
