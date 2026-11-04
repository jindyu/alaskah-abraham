// 마을 건물: 집(옥상·계단·창·차양)과 우물
import { PAL } from '../palette';
import type { TexKey } from '../textures';
import type { VoxelBuilder } from '../voxel';
import type { Collision } from '../collision';
import { addSpot, DOORS } from '../../systems/interaction';
import { T, WHITE, colLocal } from './common';
import { LAMPS } from '../../systems/lighting';

export interface HouseOpts {
  w: number; d: number; h: number; ry?: number;
  style?: 'plaster' | 'brick';
  upper?: boolean;
  stairs?: -1 | 0 | 1;
  awning?: TexKey | null;
  roofProps?: boolean;
  /** 들어갈 수 있는 방 (interiors.ts 의 RoomId) */
  interior?: string;
}

export function house(b: VoxelBuilder, col: Collision, x: number, z: number, o: HouseOpts) {
  const { w, d, h } = o;
  const ry = o.ry ?? 0;
  const wallTex: TexKey = o.style === 'brick' ? 'brick' : 'plaster';
  const r = b.rng;
  const base = 0.19;
  const top = base + h;
  // 노아의 집 앞 창빛: 불꽃 소품 없이 기존 점광원 풀에 등록한다.
  if (o.interior === 'home') {
    const lx = 0.32, lz = d / 2 + 0.55;
    LAMPS.push({ x: x + lx * Math.cos(ry) + lz * Math.sin(ry), y: 1.65, z: z - lx * Math.sin(ry) + lz * Math.cos(ry), kind: 'window' });
  }

  b.at(x, 0, z, ry, () => {
    // 돌 기단
    b.box(0, 0, 0, w + 0.19, base, d + 0.19, WHITE, { tex: 'stone' });
    // 몸체 + 평지붕
    b.box(0, base, 0, w, h, d, WHITE, { tex: { side: wallTex, top: 'mudRoof' }, jitter: 0.03 });
    // 아랫단 흙 튄 자국 띠
    if (wallTex === 'plaster') b.box(0, base, 0, w + 0.04, 0.44, d + 0.04, 0xd6bea0, { tex: 'plaster', jitter: 0.02 });
    // 모서리 보강 기둥
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      b.box(sx * (w / 2 - 0.1), base, sz * (d / 2 - 0.1), 0.25, h + 0.06, 0.25, 0xf4e8d0, { tex: wallTex, jitter: 0.02 });
    // 난간(파라펫)
    const pt = 0.125, ph = 0.31;
    b.box(0, top, d / 2 - pt / 2, w, ph, pt, 0xfff6e8, { tex: { side: wallTex, top: 'plaster' }, jitter: 0.02 });
    b.box(0, top, -d / 2 + pt / 2, w, ph, pt, 0xfff6e8, { tex: { side: wallTex, top: 'plaster' }, jitter: 0.02 });
    b.box(w / 2 - pt / 2, top, 0, pt, ph, d - 2 * pt, 0xfff6e8, { tex: { side: wallTex, top: 'plaster' }, jitter: 0.02 });
    b.box(-w / 2 + pt / 2, top, 0, pt, ph, d - 2 * pt, 0xfff6e8, { tex: { side: wallTex, top: 'plaster' }, jitter: 0.02 });
    // 튀어나온 서까래 끝(비가)
    for (let vx = -w / 2 + 0.45; vx < w / 2 - 0.3; vx += 0.62) {
      for (const s of [-1, 1]) b.box(vx, top - 0.3, s * (d / 2 + 0.1), 0.14, 0.14, 0.22, PAL.wood[2], { tex: 'wood', jitter: 0.1 });
    }

    // 문
    const fz = d / 2;
    const dx = o.stairs === 1 ? -w * 0.18 : o.stairs === -1 ? w * 0.18 : 0;
    const detail = { tex: wallTex, jitter: 0.015, ao: false, variationSeed: 718 } as const;
    // 인방 아래 그늘과 두꺼운 문설주. 장식 색은 별도 해시를 써 기존 생성 순서를 유지한다.
    b.box(0, top - 0.36, fz + 0.008, w - 0.3, 0.13, 0.025, 0xba9872, detail);
    for (const side of [-1, 1]) {
      b.box(dx + side * 0.5, base, fz + 0.055, 0.16, 1.5, 0.18, 0xe1c59e, detail);
      b.box(side * (w / 2 - 0.36), base + 0.05, fz + 0.024, 0.4, 0.12, 0.035, 0xb79b78, detail);
      // 흙 난간 위의 작고 불규칙한 보수 흔적.
      b.box(side * (w * 0.28), top + ph - 0.025, fz - pt / 2, 0.48, 0.045, pt + 0.018, 0xe4ccaa, detail);
    }
    {
      // 문 앞 매트의 월드 좌표 (회전 반영)
      const lz = fz + 0.5, c = Math.cos(ry), s = Math.sin(ry);
      DOORS.push({ x: x + dx * c + lz * s, z: z - dx * s + lz * c, room: o.interior ?? null, id: `door#${DOORS.length}` });
    }
    b.box(dx, base, fz, 0.94, 1.5, 0.05, 0x3a2618, { jitter: 0 });
    b.box(dx, base, fz + 0.03, 0.75, 1.38, 0.04, PAL.wood[2], { tex: 'wood' });
    b.box(dx, base + 0.62, fz + 0.06, 0.8, 0.07, 0.03, PAL.wood[1], { tex: 'wood' }); // 가로대
    b.box(dx + 0.24, base + 0.7, fz + 0.07, 0.06, 0.06, 0.03, PAL.stone[1], { jitter: 0 }); // 손잡이
    b.box(dx, base + 1.5, fz + 0.03, 1.2, 0.16, 0.2, PAL.wood[2], { tex: 'wood' }); // 인방
    b.box(dx, 0, fz + 0.2, 1.1, 0.12, 0.34, PAL.stone[3], { tex: 'plain' }); // 문턱돌
    b.box(dx, 0, fz + 0.62, 0.9, 0.02, 0.5, WHITE, { tex: 'reed', ao: false }); // 문앞 매트

    // 창문: 어두운 창 + 격자 + 창턱
    const win = (wx: number, wy: number, wz: number, ryWin: number) => {
      b.at(wx, wy, wz, ryWin, () => {
        // 창 안쪽: 대부분은 밤에 등잔불이 비치는 발광 면
        if (r.chance(0.75)) b.box(0, 0, 0, 0.5, 0.5, 0.04, 0x3a2616, { tex: 'glow', jitter: 0 });
        else b.box(0, 0, 0, 0.5, 0.5, 0.04, 0x241810, { jitter: 0 });
        b.box(0, 0, 0.02, 0.06, 0.5, 0.03, PAL.wood[2], { jitter: 0 });
        b.box(0, 0.22, 0.02, 0.5, 0.06, 0.03, PAL.wood[2], { jitter: 0 });
        b.box(0, -0.07, 0.05, 0.64, 0.07, 0.12, 0xfff4e0, { tex: 'plaster', jitter: 0 });
        b.box(0, 0.5, 0.03, 0.62, 0.1, 0.08, PAL.wood[2], { tex: 'wood' });
      });
    };
    const winY = base + 1.25;
    const nWin = w > 4.5 ? 2 : 1;
    for (let i = 0; i < nWin; i++) {
      const side = i === 0 ? (dx >= 0 ? -1 : 1) : dx >= 0 ? 1 : -1;
      const wx = dx + side * (nWin === 2 ? (i === 0 ? 1.4 : 1.35) : 1.25);
      if (Math.abs(wx) < w / 2 - 0.5) win(wx, winY, fz, 0);
    }
    if (o.stairs !== 1) win(w / 2, winY, -0.3, Math.PI / 2);
    if (o.stairs !== -1) win(-w / 2, winY, 0.2, -Math.PI / 2);

    // 주거는 갈대 차양, 가게 입구는 무염색 천. 주 지붕의 흙 마감과 분리한다.
    if (o.awning) {
      const shadeTex: TexKey = o.interior === 'shop' ? 'fabricCream' : 'reed';
      for (const s of [-1, 1]) b.box(dx + s * 0.8, 0, fz + 1.05, 0.1, 1.95, 0.1, PAL.wood[2], { tex: 'wood' });
      b.box(dx, 1.9, fz + 1.05, 1.8, 0.08, 0.08, PAL.wood[1], { tex: 'wood' });
      b.at(dx, 2.05, fz + 0.52, 0, () => {
        for (let strip = 0; strip < 5; strip++) {
          const sag = (1 - Math.abs(strip - 2) / 2) * 0.085;
          b.box((strip - 2) * 0.38, -sag, 0, 0.38, 0.05, 1.2, WHITE,
            { tex: shadeTex, ao: false, jitter: 0, variationSeed: strip === 0 ? undefined : 719 });
        }
      }, 0.3);
      // 앞 늘어뜨림 술
      for (let i = 0; i < 7; i++)
        b.box(dx - 0.81 + i * 0.27, 1.73, fz + 1.12, 0.2, 0.13 - (i % 2) * 0.05, T, i % 2 ? PAL.straw[1] : PAL.straw[2], { jitter: 0, ao: false });
    }

    // 빗물 홈통(앞쪽 파라펫 아래로 삐죽)
    for (const gx of [-w / 2 + 0.6, w / 2 - 0.6])
      b.box(gx, top + 0.02, d / 2 + 0.12, 0.1, 0.08, 0.3, PAL.wood[1], { tex: 'wood', ao: false, jitter: 0.06 });

    // 옥상 방
    if (o.upper) {
      const uw = w * 0.45, ud = d * 0.55, uh = 1.5;
      const ux = -w / 2 + uw / 2 + 0.12, uz = -d / 2 + ud / 2 + 0.12;
      b.box(ux, top, uz, uw, uh, ud, WHITE, { tex: { side: wallTex, top: 'mudRoof' }, ao: false, jitter: 0.03 });
      b.box(ux, top + uh, uz + ud / 2 - 0.06, uw, 0.22, 0.12, 0xfff6e8, { tex: wallTex, ao: false });
      b.box(ux, top + uh, uz - ud / 2 + 0.06, uw, 0.22, 0.12, 0xfff6e8, { tex: wallTex, ao: false });
      b.box(ux + 0.3, top, uz + ud / 2, 0.6, 1.1, 0.04, 0x3a2618, { jitter: 0, ao: false });
      b.box(ux + 0.3, top + 1.1, uz + ud / 2 + 0.03, 0.8, 0.12, 0.14, PAL.wood[2], { tex: 'wood', ao: false });
      b.at(ux - 0.45, top + 0.8, uz + ud / 2, 0, () => {
        b.box(0, 0, 0, 0.36, 0.36, 0.04, 0x3a2616, { tex: 'glow', jitter: 0, ao: false });
        b.box(0, -0.06, 0.04, 0.46, 0.06, 0.1, 0xfff4e0, { jitter: 0, ao: false });
      });
      for (let vx = ux - uw / 2 + 0.35; vx < ux + uw / 2 - 0.2; vx += 0.6)
        b.box(vx, top + uh - 0.25, uz + ud / 2 + 0.08, 0.12, 0.12, 0.18, PAL.wood[2], { tex: 'wood', ao: false });
    }

    // 난간 안쪽 그늘 띠 (가짜 AO)
    for (const sz of [-1, 1]) b.box(0, top, sz * (d / 2 - pt - 0.06), w - 2 * pt, 0.01, 0.12, 0x8a6a4a, { ao: false, jitter: 0 });
    for (const sx of [-1, 1]) b.box(sx * (w / 2 - pt - 0.06), top, 0, 0.12, 0.01, d - 2 * pt - 0.24, 0x8a6a4a, { ao: false, jitter: 0 });

    // 옥상 살림: 집마다 조합을 다르게
    if (o.roofProps !== false) {
      const rx0 = o.upper ? w * 0.18 : -w * 0.18;
      const kind = r.int(0, 2);
      if (kind === 0) {
        // 말리는 과일을 늘어놓은 갈대 돗자리
        b.box(rx0, top, d * 0.08, 1.2, 0.03, 0.8, WHITE, { tex: 'reed', ao: false });
        for (let i = 0; i < 9; i++)
          b.box(rx0 + r.range(-0.5, 0.5), top + 0.03, d * 0.08 + r.range(-0.3, 0.3), 0.12, 0.07, 0.12,
            r.pick([PAL.produce.fig, PAL.produce.date, PAL.produce.lemon]), { ao: false, jitter: 0.1 });
      } else if (kind === 1) {
        // 말리는 아마 줄기 다발
        for (let i = 0; i < 6; i++)
          b.box(rx0 - 0.5 + i * 0.2, top, d * 0.05, 0.14, 0.08 + (i % 2) * 0.04, 1.1, PAL.straw[1 + (i % 3)], { ao: false, jitter: 0.06 });
        b.box(rx0, top + 0.12, d * 0.05, 1.2, 0.04, 0.06, PAL.wood[1], { ao: false });
      } else {
        // 앉는 자리: 깔개 + 방석 + 물항아리
        b.box(rx0, top, d * 0.05, 1.3, 0.03, 0.9, WHITE, { tex: 'reed', ao: false, jitter: 0 });
        b.box(rx0 - 0.4, top + 0.03, d * 0.05 - 0.25, 0.36, 0.1, 0.3, PAL.fabric.saffron, { ao: false });
        b.box(rx0 + 0.35, top + 0.03, d * 0.05 + 0.2, 0.36, 0.1, 0.3, PAL.fabric.rose, { ao: false });
        b.box(rx0 + 0.1, top + 0.03, d * 0.05 - 0.05, 0.2, 0.2, 0.2, PAL.clay[2], { ao: false });
      }
      // 곡식 단
      if (r.chance(0.6)) {
        const gx = -rx0 * 0.6, gz = d * 0.2;
        for (let i = 0; i < 3; i++) {
          b.box(gx + i * 0.22, top, gz, 0.16, 0.36, 0.16, PAL.straw[2], { ao: false, jitter: 0.06 });
          b.box(gx + i * 0.22, top + 0.36, gz, 0.22, 0.1, 0.22, PAL.straw[3], { ao: false, jitter: 0.06 });
          b.box(gx + i * 0.22, top + 0.14, gz, 0.18, 0.04, 0.18, PAL.wood[1], { ao: false, jitter: 0 });
        }
      }
      const sx = w / 2 - 0.55, sz = -d / 2 + 0.55;
      b.box(sx, top, sz, 0.3, 0.32, 0.3, PAL.clay[2], { ao: false });
      b.box(sx, top + 0.32, sz, 0.18, 0.08, 0.18, PAL.clay[3], { ao: false });
      b.box(sx - 0.38, top, sz + 0.1, 0.24, 0.24, 0.24, PAL.clay[1], { ao: false });
      if (!o.upper && w > 4) {
        const gx = -w / 2 + 1.0, gz = -d / 2 + 0.85;
        for (const [px, pz] of [[-0.6, -0.45], [0.6, -0.45], [-0.6, 0.45], [0.6, 0.45]])
          b.box(gx + px, top, gz + pz, 0.08, 1.1, 0.08, PAL.wood[2], { tex: 'wood', ao: false });
        b.box(gx, top + 1.1, gz, 1.4, 0.05, 1.1, WHITE, { tex: 'reed', ao: false });
        // 초가 가장자리 늘어진 짚
        for (let i = 0; i < 6; i++) b.box(gx - 0.6 + i * 0.24, top + 0.98, gz + 0.56, 0.14, 0.12, T, PAL.straw[1], { ao: false });
      }
    }
    // 계단이 없는 집은 옆벽에 사다리
    if (!o.stairs && o.roofProps !== false) {
      b.at(w / 2 + 0.2, 0, d * 0.1, 0, () => {
        for (const s2 of [-1, 1]) b.box(0, 0, s2 * 0.2, 0.07, top + 0.35, 0.07, PAL.wood[3], { tex: 'wood' });
        for (let y2 = 0.3; y2 < top; y2 += 0.35) b.box(0, y2, 0, 0.06, 0.06, 0.4, PAL.wood[2], { ao: false });
      }, 0, 0.12);
    }

    // 옥상 계단 (옆벽을 따라 앞→뒤로 올라감)
    if (o.stairs) {
      const sxw = 0.7;
      const sx = o.stairs * (w / 2 + sxw / 2);
      const steps = Math.ceil(h / 0.3);
      const stepD = (d - 0.4) / steps;
      for (let i = 0; i < steps; i++) {
        const sh = (i + 1) * (top / steps);
        b.box(sx, 0, d / 2 - 0.2 - stepD * (i + 0.5), sxw, sh, stepD, WHITE, { tex: { side: wallTex, top: 'mudRoof' }, jitter: 0.02 });
      }
      b.box(sx + o.stairs * (sxw / 2 - 0.05), top, -d / 2 + 0.6, 0.1, 0.35, 0.8, 0xfff6e8, { tex: wallTex, ao: false });
    }
  });

  const sw = o.stairs ? 0.7 : 0;
  colLocal(col, x, z, ry, (o.stairs ?? 0) * sw / 2, 0, w + 0.3 + sw, d + 0.3);
  if (o.awning) {
    const dx = o.stairs === 1 ? -w * 0.18 : o.stairs === -1 ? w * 0.18 : 0;
    for (const s of [-1, 1]) colLocal(col, x, z, ry, dx + s * 0.8, d / 2 + 1.05, 0.2, 0.2);
  }
}

// ───────────── 우물 ─────────────

export function well(b: VoxelBuilder, col: Collision, x: number, z: number) {
  b.at(x, 0, z, 0, () => {
    // 팔각 돌 테두리
    const R = 0.78;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.at(Math.cos(a) * R, 0, Math.sin(a) * R, -a + Math.PI / 2, () => {
        b.box(0, 0, 0, 0.7, 0.66, 0.32, WHITE, { tex: 'stone', jitter: 0.04 });
        b.box(0, 0, 0, 0.71, 0.22, 0.33, WHITE, { tex: 'wetStone', jitter: 0.02 });
        b.box(0, 0.66, 0, 0.72, 0.1, 0.38, PAL.stone[4], { tex: 'plain', jitter: 0.04 });
      });
    }
    b.box(0, 0, 0, 1.3, 0.3, 1.3, 0x1a2430, { jitter: 0 });
    b.box(0, 0.3, 0, 1.3, 0.12, 1.3, PAL.water[0], { tex: 'water', jitter: 0, ao: false });
    // 도르래 틀
    for (const s of [-1, 1]) b.box(s * 0.98, 0, 0, 0.14, 2.0, 0.14, PAL.wood[2], { tex: 'wood' });
    b.box(0, 1.92, 0, 2.2, 0.12, 0.14, PAL.wood[1], { tex: 'wood' });
    b.box(0, 1.62, 0, 0.5, 0.16, 0.16, PAL.wood[3], { tex: 'bark' });
    b.box(0.26, 1.64, 0, 0.12, T, T, PAL.wood[0]);
    b.box(0.1, 0.98, 0, 0.03, 0.64, 0.03, PAL.straw[1], { jitter: 0 }); // 밧줄
    b.box(0.1, 0.78, 0, 0.26, 0.22, 0.26, PAL.wood[2], { tex: 'wood', ao: false }); // 두레박
    b.box(0.1, 0.98, 0, 0.3, 0.04, 0.03, PAL.wood[0], { ao: false });
  });
  col.addCircle(x, z, 1.1);
  addSpot('well', x, z, 2.1);
}
