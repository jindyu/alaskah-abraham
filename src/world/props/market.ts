// 시장 천막(stall): 차양·판매대·상품 진열
import { PAL } from '../palette';
import type { TexKey } from '../textures';
import type { VoxelBuilder } from '../voxel';
import type { Collision } from '../collision';
import { addSpot } from '../../systems/interaction';
import { T, WHITE, colLocal } from './common';
import { basket, pot } from './small';

export type Goods = 'fruit' | 'pots' | 'cloth' | 'bread';

export function stall(b: VoxelBuilder, col: Collision, x: number, z: number, fabric: TexKey, goods: Goods, ry = 0) {
  const r = b.rng;
  b.at(x, 0, z, ry, () => {
    // 기둥 (뒤가 높아 차양이 앞으로 기울어짐)
    for (const px of [-1.15, 1.15]) {
      b.box(px, 0, 0.8, 0.12, 2.1, 0.12, PAL.wood[2], { tex: 'wood' });
      b.box(px, 0, -0.8, 0.12, 2.5, 0.12, PAL.wood[2], { tex: 'wood' });
    }
    b.box(0, 2.05, 0.8, 2.42, 0.1, 0.1, PAL.wood[1], { tex: 'wood' });
    b.at(0, 2.28, 0, 0, () => b.box(0, 0, 0, 2.7, 0.06, 1.95, WHITE, { tex: fabric, jitter: 0, ao: false }), 0.24);
    // 앞 늘어뜨림(삼각 술)
    for (let i = 0; i < 9; i++) {
      const fx = -1.2 + i * 0.3;
      b.box(fx, 1.87, 0.97, 0.26, 0.16, T, i % 2 ? PAL.fabric.cream : PAL.fabric.redDark, { jitter: 0, ao: false });
      b.box(fx, 1.79, 0.97, 0.12, 0.08, T, i % 2 ? PAL.fabric.cream : PAL.fabric.redDark, { jitter: 0, ao: false });
    }
    // 판매대: 차양 앞으로 내놓아서 위에서 상품이 보이게
    const cz = 1.2;
    b.box(0, 0.72, cz, 2.2, 0.1, 0.66, PAL.wood[3], { tex: 'wood' });
    b.box(0, 0.78, cz + 0.33, 2.24, 0.06, 0.04, PAL.wood[1], { tex: 'wood', ao: false });
    b.box(0, 0.12, cz + 0.32, 2.1, 0.6, 0.05, WHITE, { tex: fabric === 'stripeRed' ? 'fabricTeal' : 'fabricCream' });
    for (const lx of [-1.0, 1.0]) b.box(lx, 0, cz, 0.1, 0.72, 0.1, PAL.wood[1]);
    // 뒤쪽 선반과 상인 의자
    b.box(0, 0.95, -0.6, 2.1, 0.08, 0.35, PAL.wood[2], { tex: 'wood' });
    for (const lx of [-0.95, 0.95]) b.box(lx, 0, -0.6, 0.08, 0.95, 0.08, PAL.wood[1]);
    b.box(0.5, 0, 0.1, 0.36, 0.36, 0.36, PAL.wood[2], { tex: 'wood' });
    b.box(0.5, 0.36, 0.1, 0.38, 0.08, 0.38, WHITE, { tex: 'fabricTeal', ao: false });
    // 흙바닥에 깐 갈대 돗자리
    b.box(0, 0, 0.1, 2.3, 0.02, 1.6, WHITE, { tex: 'reed', ao: false });

    const ty = 0.82;
    if (goods === 'fruit') {
      const fruits = [PAL.produce.pomegranate, PAL.produce.fig, PAL.produce.lemon, PAL.produce.melon, PAL.produce.date];
      for (let i = 0; i < 4; i++) basket(b, -0.72 + i * 0.48, ty, cz, fruits[i]);
      for (let i = 0; i < 3; i++) basket(b, -0.6 + i * 0.6, 1.03, -0.6, fruits[(i + 2) % 5], 0.4, 0.26);
      // 매달린 양파/마늘 줄
      for (const hx of [-0.8, -0.35, 0.5]) {
        b.box(hx, 1.6, 0.8, 0.02, 0.45, 0.02, PAL.straw[1], { jitter: 0, ao: false });
        for (let k = 0; k < 3; k++) b.box(hx, 1.61 + k * 0.12, 0.8, 0.12, 0.1, 0.12, PAL.produce.onion, { ao: false, jitter: 0.1 });
      }
    } else if (goods === 'pots') {
      for (let i = 0; i < 4; i++) {
        const px = -0.75 + i * 0.5, c = r.pick([PAL.clay[1], PAL.clay[2], PAL.clay[3]]);
        const hh = r.range(0.2, 0.34);
        b.box(px, ty, cz, 0.26, hh, 0.26, c, { ao: false });
        b.box(px, ty + hh, cz, 0.16, 0.08, 0.16, c, { ao: false });
        b.box(px, ty + hh * 0.5, cz, 0.27, 0.03, 0.27, PAL.clay[0], { ao: false, jitter: 0 });
      }
      for (let i = 0; i < 5; i++) b.box(-0.8 + i * 0.4, 1.03, -0.6, 0.22, 0.26, 0.22, r.pick([PAL.clay[1], PAL.clay[2]]), { ao: false });
      // 판매대 앞 큰 항아리
      pot(b, -1.55, 1.3, 1.3);
      pot(b, 1.6, 1.4, 1.1, PAL.clay[1]);
    } else if (goods === 'cloth') {
      const cols = [PAL.fabric.indigo, PAL.fabric.saffron, PAL.fabric.teal, PAL.fabric.rose, PAL.fabric.cream];
      for (let i = 0; i < 5; i++) {
        b.box(-0.8 + i * 0.4, ty, cz, 0.34, 0.14, 0.6, cols[i], { ao: false, jitter: 0.03 });
        b.box(-0.8 + i * 0.4, ty + 0.14, cz, 0.3, 0.1, 0.56, cols[(i + 2) % 5], { ao: false, jitter: 0.03 });
      }
      // 걸린 천
      for (let i = 0; i < 4; i++)
        b.box(-0.9 + i * 0.6, 1.1, -0.78, 0.5, 0.95, T, cols[i], { ao: false, jitter: 0.03 });
      for (let i = 0; i < 3; i++) b.box(-0.6 + i * 0.6, 1.03, -0.6, 0.18, 0.18, 0.3, cols[(i + 1) % 5], { ao: false });
    } else {
      for (let i = 0; i < 6; i++) {
        const bx = -0.8 + (i % 3) * 0.5 + (i > 2 ? 0.25 : 0), bz = i > 2 ? cz - 0.15 : cz + 0.15;
        b.box(bx, ty, bz, 0.34, 0.1, 0.3, PAL.produce.bread, { ao: false, jitter: 0.08 });
        b.box(bx, ty + 0.1, bz, 0.26, 0.05, 0.22, 0xe8b870, { ao: false, jitter: 0.06 });
      }
      basket(b, 0.8, ty, cz, PAL.produce.olive, 0.36, 0.3);
      for (let i = 0; i < 3; i++) basket(b, -0.6 + i * 0.6, 1.03, -0.6, PAL.produce.bread, 0.4, 0.26);
    }
  });
  colLocal(col, x, z, ry, 0, 0.3, 2.5, 2.5);
  addSpot('stall', x, z + 1.2, 1.3);
}
