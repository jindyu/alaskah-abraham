/** 손에 들 물건 이름 (도끼·횃불 등, 아이템 체계는 Stage 4부터 채움) */
export type ItemId = string;
/** 상호작용 자리 (월드 소품이 빌드될 때 등록 → 게임 쪽에서 행동을 붙임) */
export type SpotKind = string;
export interface Spot { kind: SpotKind; x: number; z: number; y: number; id: string }
export const SPOTS: Spot[] = [];
let spotSeq = 0;
export function addSpot(kind: SpotKind, x: number, z: number, y = 1) {
  SPOTS.push({ kind, x, z, y, id: `${kind}#${spotSeq++}` });
}

/** 집 문 앞 자리 (house()가 등록). room 이 있으면 들어갈 수 있는 집 */
export interface Door { x: number; z: number; room: string | null; id: string }
export const DOORS: Door[] = [];

export interface Interactable {
  id: string;
  /** 위치는 매 프레임 물어봄 (양처럼 움직이는 대상 때문) */
  pos(): { x: number; z: number };
  /** 프롬프트를 띄울 높이 */
  height: number;
  /** 대상 크기(이만큼 떨어져 있어도 닿은 것으로 봄) */
  r: number;
  /** 프롬프트 문구. null 이면 지금은 할 수 없음 */
  label(): string | null;
  /** 지금 대상의 짧은 조작 설명. 성공 상태가 바뀌면 즉시 다시 평가한다. */
  hint?(): string | null;
  /** 같은 대상에서도 필요한 도구가 바뀌는 단계 (밭 갈기→심기→물 주기 등) */
  equipContext?(): string;
  act(): void;
  /** 이 대상에 쓸 물건 (앞의 것이 먼저). 가방에 있으면 겨눌 때 저절로 손에 듦 — 없으면 들기 그대로 */
  wants?(): readonly ItemId[] | null;
  /** 클수록 다른 대상보다 먼저 골라짐 (밭처럼 촘촘한 대상이 곁의 동물에 밀리지 않게) */
  bias?: number | (() => number);
}

/** 캐릭터 앞쪽에서 가장 가까운 대상 고르기 */
export class Interactions {
  private readonly list = new Map<string, Interactable>();
  /** 캐릭터 몸에서 대상 가장자리까지 닿는 거리 */
  reach = 0.85;

  add(...items: Interactable[]) {
    for (const it of items) this.list.set(it.id, it);
  }
  clear() {
    this.list.clear();
  }
  remove(id: string) {
    this.list.delete(id);
  }
  /** id 로 대상 찾기 (머리 위 표시가 씀) */
  get(id: string): Interactable | undefined {
    return this.list.get(id);
  }
  /** 등록된 모든 대상 (마우스 클릭으로 대상을 고를 때) */
  values(): IterableIterator<Interactable> {
    return this.list.values();
  }

  /** 문구가 null(지금은 못 함)이라 건너뛴 대상 (nearest 가 매번 비워 다시 씀) */
  private readonly skipped: Interactable[] = [];

  /**
   * 거리·방향·가중치로 가장 좋은 대상을 고름. label() 은 비싸거나 부수효과가 있을 수 있어 최종 후보에만 물음:
   * 후보가 지금 할 수 없는 일(null)이면 그 대상을 빼고 다음으로 좋은 것을 다시 고름 (결과는 모든 대상에 label 을 물은 것과 같음)
   */
  nearest(px: number, pz: number, facing: number): Interactable | null {
    const fx = Math.sin(facing), fz = Math.cos(facing), skipped = this.skipped;
    skipped.length = 0;
    for (;;) {
      let best: Interactable | null = null, bestScore = Infinity;
      for (const it of this.list.values()) {
        if (skipped.length && skipped.includes(it)) continue;
        const p = it.pos();
        const dx = p.x - px, dz = p.z - pz;
        const d = Math.hypot(dx, dz);
        const gap = d - it.r;
        if (gap > this.reach) continue;
        // 바라보는 쪽을 우선: 등 뒤 대상은 아주 가까울 때만
        const front = d > 1e-3 ? (dx * fx + dz * fz) / d : 1;
        if (front < -0.2 && gap > 0.25) continue;
        const score = gap - front * 0.4 - (typeof it.bias === 'function' ? it.bias() : it.bias ?? 0);
        if (score < bestScore) { bestScore = score; best = it; }
      }
      if (!best) return null;
      if (best.label() !== null) return best;
      skipped.push(best);
    }
  }
}
