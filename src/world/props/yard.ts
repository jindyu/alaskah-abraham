// 마당 가구·생활 소품: 장작더미, 벤치, 화덕, 구유, 건초, 수레, 빨래줄, 등잔 기둥
import { PAL } from '../palette';
import type { VoxelBuilder } from '../voxel';
import type { Collision } from '../collision';
import { LAMPS } from '../../systems/lighting';
import { addSpot } from '../../systems/interaction';
import { T, WHITE, colLocal } from './common';

export function woodpile(b: VoxelBuilder, col: Collision, x: number, z: number, ry = 0) {
  b.at(x, 0, z, ry, () => {
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4 - row; i++)
        b.box(-0.38 + i * 0.25 + row * 0.125, row * 0.2, 0, 0.22, 0.2, 1.0, WHITE, { tex: 'bark', jitter: 0.1 });
    // 통나무 단면(밝은 나무) 앞쪽 캡
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4 - row; i++)
        b.box(-0.38 + i * 0.25 + row * 0.125, row * 0.2 + 0.02, 0.5, 0.17, 0.16, T, PAL.wood[4], { jitter: 0.08 });
  });
  colLocal(col, x, z, ry, 0, 0, 1.1, 1.1);
}

export function bench(b: VoxelBuilder, col: Collision, x: number, z: number, ry = 0) {
  b.at(x, 0, z, ry, () => {
    b.box(0, 0.32, 0, 1.3, 0.1, 0.38, PAL.wood[3], { tex: 'wood' });
    for (const lx of [-0.5, 0.5]) b.box(lx, 0, 0, 0.12, 0.32, 0.32, PAL.wood[1], { tex: 'wood' });
  });
  colLocal(col, x, z, ry, 0, 0, 1.3, 0.4);
}

/** 설계도 작업대: 세 발 받침 위에 비스듬히 얹은 판과 펼친 양피지 (방주 터에서 노아가 들여다봄) */
export function blueprintEasel(b: VoxelBuilder, col: Collision, x: number, z: number, ry = 0) {
  b.at(x, 0, z, ry, () => {
    for (const lx of [-0.42, 0.42]) b.box(lx, 0, 0.1, 0.07, 0.95, 0.07, PAL.wood[1], { tex: 'wood' });
    b.box(0, 0, -0.3, 0.07, 1.1, 0.07, PAL.wood[1], { tex: 'wood' });
    b.box(0, 0.78, 0, 1.05, 0.06, 0.62, PAL.wood[3], { tex: 'wood' });
    // 양피지와 선
    b.box(0, 0.84, 0, 0.9, 0.02, 0.5, 0xe8d9ae, { jitter: 0.02 });
    b.box(-0.05, 0.86, 0.05, 0.7, 0.01, 0.025, PAL.wood[0], { jitter: 0 });
    b.box(0.12, 0.86, -0.08, 0.4, 0.01, 0.025, PAL.wood[0], { jitter: 0 });
    b.box(-0.22, 0.86, -0.12, 0.025, 0.01, 0.26, PAL.wood[0], { jitter: 0 });
    b.box(0.3, 0.86, 0.12, 0.2, 0.01, 0.025, PAL.wood[0], { jitter: 0 });
    // 눌러 둔 돌
    b.box(0.38, 0.86, -0.18, 0.12, 0.06, 0.1, PAL.stone[2]);
  });
  colLocal(col, x, z, ry, 0, 0, 1.1, 0.7);
}

/** 길 끝 표지판: 말뚝에 나무판 두 장 (한 장은 아랫마을 쪽을 가리킴) */
export function signpost(b: VoxelBuilder, col: Collision, x: number, z: number, ry = 0) {
  b.at(x, 0, z, ry, () => {
    b.box(0, 0, 0, 0.14, 1.5, 0.14, PAL.wood[1], { tex: 'wood' });
    b.box(0.2, 1.15, 0.0, 0.7, 0.22, 0.06, PAL.wood[3], { tex: 'wood' });
    b.box(0.5, 1.15, 0.0, 0.14, 0.22, 0.06, PAL.wood[3], { tex: 'wood' });
    b.box(-0.18, 0.82, 0.0, 0.62, 0.2, 0.06, PAL.wood[3], { tex: 'wood' });
    b.box(0.2, 1.15, 0.035, 0.5, 0.03, 0.01, PAL.wood[0], { jitter: 0 });
    b.box(-0.18, 0.82, 0.035, 0.4, 0.03, 0.01, PAL.wood[0], { jitter: 0 });
  });
  colLocal(col, x, z, ry, 0, 0, 0.2, 0.2);
}

export function oven(b: VoxelBuilder, col: Collision, x: number, z: number) {
  // 타분(흙 화덕): 층층이 좁아지는 돔 + 어두운 아궁이
  const c = PAL.clay[2];
  b.at(x, 0, z, 0, () => {
    b.box(0, 0, 0, 0.9, 0.3, 0.9, c, { tex: 'plaster', jitter: 0.02 });
    b.box(0, 0.3, 0, 0.78, 0.2, 0.78, c, { tex: 'plaster', jitter: 0.02 });
    b.box(0, 0.5, 0, 0.6, 0.14, 0.6, c, { tex: 'plaster', jitter: 0.02 });
    b.box(0, 0.64, 0, 0.3, 0.06, 0.3, PAL.clay[1], { jitter: 0 });
    b.box(0, 0.05, 0.43, 0.32, 0.28, T, 0x1a1010, { jitter: 0 });
    b.box(0, 0.05, 0.44, 0.2, 0.06, T, 0xe07030, { jitter: 0, ao: false }); // 남은 불씨
  });
  col.addCircle(x, z, 0.5);
}

export function trough(b: VoxelBuilder, col: Collision, x: number, z: number, ry = 0) {
  b.at(x, 0, z, ry, () => {
    b.box(0, 0, 0, 1.6, 0.4, 0.5, PAL.wood[2], { tex: 'wood' });
    b.box(0, 0.4, 0, 1.6, 0.06, 0.08, PAL.wood[3], { tex: 'wood' });
    b.box(0, 0.33, 0, 1.45, 0.05, 0.36, PAL.water[1], { tex: 'water', jitter: 0, ao: false });
  });
  colLocal(col, x, z, ry, 0, 0, 1.6, 0.5);
  addSpot('trough', x, z, 0.9);
}

export function hay(b: VoxelBuilder, col: Collision, x: number, z: number, ry = 0) {
  b.at(x, 0, z, ry, () => {
    b.box(0, 0, 0, 0.9, 0.5, 0.6, WHITE, { tex: 'reed' });
    b.box(0, 0.5, 0, 0.8, 0.08, 0.5, PAL.straw[3], { tex: 'reed' });
    b.box(-0.25, 0, 0, T, 0.51, 0.61, PAL.wood[1]);
    b.box(0.25, 0, 0, T, 0.51, 0.61, PAL.wood[1]);
  });
  colLocal(col, x, z, ry, 0, 0, 0.9, 0.6);
}

export function cart(b: VoxelBuilder, col: Collision, x: number, z: number, ry = 0) {
  b.at(x, 0, z, ry, () => {
    b.box(0, 0.5, 0, 1.6, 0.12, 1.0, PAL.wood[3], { tex: 'wood' });
    for (const s of [-1, 1]) b.box(0, 0.62, s * 0.47, 1.6, 0.25, 0.06, PAL.wood[2], { tex: 'wood' });
    b.box(-0.77, 0.62, 0, 0.06, 0.25, 1.0, PAL.wood[2], { tex: 'wood' });
    // 손잡이 두 개
    for (const s of [-1, 1]) b.box(1.3, 0.55, s * 0.35, 1.0, 0.07, 0.07, PAL.wood[1], { tex: 'wood' });
    // 바퀴: 테 + 살
    for (const s of [-1, 1]) {
      b.at(0, 0.36, s * 0.56, 0, () => {
        for (let i = 0; i < 8; i++)
          b.at(0, 0, 0, 0, () => b.box(0, 0.28, 0, 0.23, 0.08, 0.08, PAL.wood[1], { tex: 'wood', ao: false }), 0, (i * Math.PI) / 4);
        b.at(0, 0, 0, 0, () => b.box(0, -0.3, 0, 0.06, 0.6, 0.07, PAL.wood[2], { ao: false }));
        b.at(0, 0, 0, 0, () => b.box(0, -0.3, 0, 0.06, 0.6, 0.07, PAL.wood[2], { ao: false }), 0, Math.PI / 2);
        b.box(0, -0.06, 0, 0.12, 0.12, 0.1, PAL.wood[0], { ao: false });
      });
    }
    // 실린 짐: 자루와 항아리
    b.at(-0.35, 0.62, -0.1, 0.2, () => b.box(0, 0, 0, 0.4, 0.34, 0.36, WHITE, { tex: 'fabricCream', ao: false }));
    b.at(0.2, 0.62, 0.15, -0.3, () => b.box(0, 0, 0, 0.36, 0.3, 0.34, WHITE, { tex: 'fabricCream', ao: false }));
    b.box(0.45, 0.62, -0.2, 0.25, 0.3, 0.25, PAL.clay[2], { ao: false });
  });
  colLocal(col, x, z, ry, 0.3, 0, 2.3, 1.2);
}

export function laundry(b: VoxelBuilder, col: Collision, x: number, z: number, ry = 0) {
  const cloths = [PAL.fabric.cream, PAL.fabric.indigo, PAL.fabric.rose, PAL.fabric.cream, PAL.fabric.saffron];
  b.at(x, 0, z, ry, () => {
    for (const s of [-1, 1]) b.box(s * 1.3, 0, 0, 0.1, 1.7, 0.1, PAL.wood[2], { tex: 'wood' });
    b.box(0, 1.6, 0, 2.6, 0.03, 0.03, PAL.wood[0], { jitter: 0 });
    let cx = -1.05;
    for (const c of cloths) {
      const w = b.rng.range(0.28, 0.45), h = b.rng.range(0.4, 0.62);
      b.box(cx + w / 2, 1.6 - h, 0, w, h, T, c, { jitter: 0.04, ao: false });
      cx += w + 0.08;
    }
  });
  colLocal(col, x, z, ry, -1.3, 0, 0.2, 0.2);
  colLocal(col, x, z, ry, 1.3, 0, 0.2, 0.2);
}

export function torchPost(b: VoxelBuilder, col: Collision, x: number, z: number) {
  // 기름 등잔 기둥: 밤이 되면 점광원이 켜짐 (lighting.LAMPS)
  b.box(x, 0, z, 0.24, 0.12, 0.24, PAL.stone[2], { tex: 'plain' });
  b.box(x, 0.12, z, 0.1, 1.5, 0.1, PAL.wood[1], { tex: 'wood' });
  b.box(x, 1.62, z, 0.26, 0.08, 0.26, PAL.wood[2]);
  b.box(x, 1.7, z, 0.2, 0.1, 0.2, PAL.clay[1]);
  b.box(x, 1.8, z, 0.08, 0.1, 0.08, 0xffd070, { tex: 'flame', jitter: 0, ao: false });
  b.box(x, 1.9, z, 0.04, 0.06, 0.04, 0xfff0b0, { tex: 'flame', jitter: 0, ao: false });
  col.addCircle(x, z, 0.15);
  LAMPS.push({ x, y: 1.85, z, kind: 'torch' });
}
