/** 평면(xz) 충돌: 축정렬 박스 + 원. 캐릭터는 원으로 취급해 밀어냄 */
export interface AABB { x: number; z: number; hw: number; hd: number }
export interface Circle { x: number; z: number; r: number }

export class Collision {
  readonly boxes: AABB[] = [];
  readonly circles: Circle[] = [];
  bounds = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };
  /** 1x1 격자 단위의 막힌 칸 (언덕) */
  solid: ((ix: number, iz: number) => boolean) | null = null;

  addBox(x: number, z: number, w: number, d: number) {
    this.boxes.push({ x, z, hw: w / 2, hd: d / 2 });
  }
  /** 회전된 박스는 y 회전 90° 단위만 지원 (w/d 교환) */
  addBoxRot(x: number, z: number, w: number, d: number, ry: number) {
    const q = Math.round(ry / (Math.PI / 2)) & 1;
    this.addBox(x, z, q ? d : w, q ? w : d);
  }
  addCircle(x: number, z: number, r: number) {
    this.circles.push({ x, z, r });
  }

  /** 막힌 칸(언덕) 박스를 담는 재사용 칸 (주변 3x3 = 최대 9개). resolve 가 매번 배열·객체를 만들지 않게 */
  private readonly cellPool: AABB[] = Array.from({ length: 9 }, () => ({ x: 0, z: 0, hw: 0.5, hd: 0.5 }));

  /** 박스 b 가 p(반지름 r)와 겹치면 p 를 밖으로 밀어냄 */
  private pushOut(p: { x: number; z: number }, b: AABB, r: number) {
    const cx = Math.max(b.x - b.hw, Math.min(p.x, b.x + b.hw));
    const cz = Math.max(b.z - b.hd, Math.min(p.z, b.z + b.hd));
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.z = cz + (dz / d) * r;
    } else {
      // 중심이 박스 안: 가장 얕은 축으로 밀어냄
      const ox = b.hw + r - Math.abs(p.x - b.x);
      const oz = b.hd + r - Math.abs(p.z - b.z);
      if (ox < oz) p.x += Math.sign(p.x - b.x || 1) * ox;
      else p.z += Math.sign(p.z - b.z || 1) * oz;
    }
  }

  /** p를 제자리에서 충돌 밖으로 밀어냄. 반복해서 모서리 끼임 방지 (매 호출 새 배열을 만들지 않음) */
  resolve(p: { x: number; z: number }, r: number) {
    const boxes = this.boxes, pool = this.cellPool;
    for (let iter = 0; iter < 3; iter++) {
      let nc = 0;
      if (this.solid) {
        const fx = Math.floor(p.x), fz = Math.floor(p.z);
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++)
            if (this.solid(fx + dx, fz + dz)) { const c = pool[nc++]; c.x = fx + dx + 0.5; c.z = fz + dz + 0.5; }
      }
      for (let i = 0; i < boxes.length; i++) this.pushOut(p, boxes[i], r);
      for (let i = 0; i < nc; i++) this.pushOut(p, pool[i], r);
      for (const c of this.circles) {
        const dx = p.x - c.x, dz = p.z - c.z;
        const min = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-4;
        p.x = c.x + (dx / d) * min;
        p.z = c.z + (dz / d) * min;
      }
    }
    const B = this.bounds;
    p.x = Math.max(B.minX + r, Math.min(B.maxX - r, p.x));
    p.z = Math.max(B.minZ + r, Math.min(B.maxZ - r, p.z));
  }

  blocked(x: number, z: number, r: number): boolean {
    const p = { x, z };
    this.resolve(p, r);
    return Math.abs(p.x - x) > 1e-3 || Math.abs(p.z - z) > 1e-3;
  }
}
