import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import * as P from '../props';
import { buildNomadTent, buildWell } from '../props/biblicalProps';
import { Camel, Sheep } from '../../entities/animals';
import { buildFarField, buildHorizonPlane, scatterGroundCover, tintColor } from './common';
import { buildStageGroundPlane } from './scenery12';
import { buildPerimeterRidges, buildMudbrickBuilding } from './scenery36';
import { fbm, hash2, valueNoise } from '../../core/rng';

export interface HaranStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const HARAN_HALF = 18;

/** 하란 오아시스 지면: 마른 모래 + 다져진 장막 마당 + 물가 풀밭/젖은 흙 + 성문으로 이어지는 길 */
function buildHaranGround(): THREE.Mesh {
  const reg = PAL_REGION.MESOPOTAMIA;
  return buildStageGroundPlane({
    size: HARAN_HALF * 2 + 8,
    res: 512,
    painter: (x, z, i, j) => {
      const n = fbm(x / 6, z / 6, 1201, 2) * 0.5 + valueNoise(i / 10, j / 10, 1202) * 0.3 + hash2(i, j, 1203) * 0.2;
      let c = n > 0.62 ? 0xc49a62 : n > 0.4 ? reg.ground : 0xa07a48;
      if (hash2(i, j, 1205) < 0.02) c = 0x7a5a38;
      // 바람결 모래 물결
      if (Math.sin((x * 0.9 + z * 1.4) * 1.6 + fbm(x / 4, z / 4, 1207, 2) * 5) > 0.93) c = 0xd6b078;
      // 오아시스 물가: 풀밭 → 젖은 흙
      const dPond = Math.hypot((x - 6.5) / 1.25, z + 5);
      if (dPond < 6.2) {
        const g = valueNoise(i / 7, j / 7, 1211);
        if (dPond < 3.4) c = g > 0.5 ? 0x5a4630 : 0x4a3a28;
        else if (g > dPond / 8.2 - 0.1) c = g > 0.65 ? 0x6a9a48 : 0x547c3a;
      }
      // 장막 마당 다져진 흙 (모닥불 둘레 + 두 장막 사이)
      const dCamp = Math.hypot(x - 0, z - 0);
      if (dCamp < 4.4 && valueNoise(i / 6, j / 6, 1221) > dCamp / 6) c = 0x8a6a42;
      const dT1 = Math.hypot(x + 4.5, z + 3.5), dT2 = Math.hypot(x - 4.0, z - 2.5);
      if ((dT1 < 3.4 || dT2 < 3.4) && hash2(i, j, 1223) < 0.8) c = 0x8e6e46;
      // 북문으로 이어지는 순례길 (x≈0, z -12 → 0): 밟혀 단단하고 밝은 흙
      const dPath = Math.abs(x - Math.sin(z * 0.35) * 1.2);
      if (z < -0.5 && z > -14 && dPath < 1.5 - valueNoise(i / 5, j / 5, 1231) * 0.5) c = hash2(i, j, 1233) < 0.05 ? 0xe0c490 : 0xcca878;
      // 성문 앞 벽돌 포석
      if (z < -11 && z > -14.5 && Math.abs(x) < 3.2) {
        const li = i % 12, lj = j % 12;
        c = li === 0 || lj === 0 ? 0x6a4c30 : (hash2(Math.floor(i / 12), Math.floor(j / 12), 1241) < 0.5 ? 0xb08a5c : 0xa07c52);
      }
      return c;
    },
  });
}

/** 하란 정착 캠프: 오아시스, 장막 마을, 우물, 양 우리, 북쪽 성문과 흙벽돌 도시 성벽 */
export function buildHaranStage(): HaranStage {
  const root = new THREE.Group();
  const col = new Collision();
  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };
  const reg = PAL_REGION.MESOPOTAMIA;
  const vb = new VoxelBuilder(9, false);

  root.add(buildHorizonPlane(reg.ground));
  buildFarField(root, HARAN_HALF, { seed: 21, pal: [0xc49a62, 0xb58e58, 0xd2aa70, 0xa07a48], tex: 'dune', accents: [0x8a7650, 0x4a6a34], depth: 44, haze: 0xd0b890 });
  root.add(buildHaranGround());
  buildPerimeterRidges(vb, col, HARAN_HALF, [0xc49a62, 0xb58e58, 0xd2aa70, 0xa07a48], { seed: 1301, minH: 2.4, maxH: 4.6, tex: 'dune', openNorth: true });

  // 오아시스: 풀밭 가장자리 + 물 (계단식 불규칙 윤곽) + 갈대
  vb.box(6.5, 0.02, -5, 7.5, 0.05, 6, PAL.grass[2], { tex: 'grassTop' });
  vb.box(6.5, 0.03, -5, 4.2, 0.06, 3.4, PAL.water[1], { tex: 'water' });
  vb.box(7.6, 0.03, -5.6, 3.0, 0.06, 3.0, PAL.water[1], { tex: 'water' });
  vb.box(5.4, 0.03, -4.3, 2.4, 0.06, 2.0, PAL.water[2], { tex: 'water' });
  for (let k = 0; k < 18; k++) {
    const a = k * 0.37 + 0.4, rx = 3.6 + hash2(k, 1, 1301) * 0.8, rz = 3.0 + hash2(k, 2, 1301) * 0.6;
    const rxp = 6.5 + Math.cos(a * 3.4) * rx, rzp = -5 + Math.sin(a * 3.4) * rz;
    const rh = 0.7 + hash2(k, 3, 1301) * 0.7;
    vb.box(rxp, 0, rzp, 0.07, rh, 0.07, tintColor(0x5c7a3c, 0.8 + hash2(k, 4, 1301) * 0.4), { tex: 'reed' });
    vb.box(rxp + 0.1, 0, rzp, 0.06, rh * 0.8, 0.06, tintColor(0x6a8a44, 0.8 + hash2(k, 5, 1301) * 0.4), { tex: 'reed' });
    if (k % 3 === 0) vb.box(rxp, rh, rzp, 0.12, 0.26, 0.12, 0x6a4a2a);
  }
  // 물가 돌
  for (let k = 0; k < 9; k++) {
    const a = k * 0.7;
    vb.box(6.5 + Math.cos(a) * 3.9, 0, -5 + Math.sin(a) * 2.9, 0.3 + hash2(k, 7, 1303) * 0.3, 0.2, 0.3, tintColor(PAL.stone[2], 0.85 + hash2(k, 8, 1303) * 0.3), { tex: 'stone' });
  }

  // 오아시스 종려나무 숲 (그늘진 물가)
  P.palmTree(vb, col, 7.5, -3.0);
  P.palmTree(vb, col, 5.0, -7.0);
  P.palmTree(vb, col, 9.8, -6.8);
  P.palmTree(vb, col, 10.6, -2.4);
  P.palmTree(vb, col, 3.6, -5.0);
  P.palmTree(vb, col, 12.5, -9.5);
  P.palmTree(vb, col, -13.0, -2.0);
  P.palmTree(vb, col, -12.0, 8.5);
  P.bush(vb, col, -6.0, 4.0, 0.9);
  P.bush(vb, col, 8.8, -8.6, 0.8);
  P.bush(vb, col, 2.5, -8.0, 0.8);

  // 야외 모닥불과 둘러앉는 통나무·돗자리
  P.campfire(vb, col, 0, 0);
  vb.box(-1.3, 0, 0.9, 1.0, 0.3, 0.35, PAL.wood[2], { tex: 'wood' });
  vb.box(1.4, 0, -0.9, 1.0, 0.3, 0.35, PAL.wood[2], { tex: 'wood' });
  vb.box(1.1, 0.01, 1.3, 1.6, 0.04, 1.1, 0xa84a38, { tex: 'wool' });
  vb.box(1.1, 0.05, 1.3, 1.2, 0.02, 0.7, 0xe0c070, { tex: 'wool' });

  // 북쪽 흙벽돌 도시 성벽 + 성문 (z=-12.5): 하란 도성으로 이어지는 문
  const wz = -12.5;
  const brick = reg.brick;
  for (const sx of [-1, 1]) {
    // 성벽 (벽돌 줄눈이 보이도록 두 단 + 여장)
    const cx = sx * 9.2;
    vb.box(cx, 0, wz, 11.6, 3.0, 1.6, brick, { tex: 'brick' });
    vb.box(cx, 3.0, wz, 11.6, 0.25, 1.9, tintColor(brick, 1.15), { tex: 'brick' });
    for (let k = 0; k < 8; k++) vb.box(cx - 5.2 + k * 1.5, 3.25, wz, 0.85, 0.7, 1.2, tintColor(brick, 1.05 + hash2(k, sx + 3, 1311) * 0.12), { tex: 'brick' });
    col.addBox(cx, wz, 11.6, 1.7);
    // 성벽 앞 기대 놓은 흙벽돌 더미 / 항아리
    vb.box(cx + 1.8, 0, wz + 1.5, 1.4, 0.6, 0.8, tintColor(brick, 0.9), { tex: 'brick' });
    P.pot(vb, cx - 2.2, wz + 1.5, 1.1, PAL.clay[2]);
    P.pot(vb, cx - 1.6, wz + 1.7, 0.8, PAL.clay[1]);
  }
  // 성문 문주 + 아치 상인방 + 청색 타일 띠 + 횃불
  for (const sx of [-1, 1]) {
    vb.box(sx * 2.7, 0, wz, 1.8, 4.6, 2.2, tintColor(brick, 1.08), { tex: 'brick' });
    vb.box(sx * 2.7, 4.6, wz, 2.2, 0.35, 2.5, 0xd8b050, { tex: 'metal' });
    vb.box(sx * 2.7, 3.5, wz + 1.12, 1.4, 0.35, 0.06, reg.ishtarBlue, { tex: 'stone' });
    vb.box(sx * 2.7, 2.6, wz + 1.12, 1.4, 0.12, 0.06, 0xd8b050, { tex: 'metal' });
    col.addBox(sx * 2.7, wz, 1.9, 2.3);
    P.torchPost(vb, col, sx * 4.3, wz + 2.1);
  }
  vb.box(0, 3.6, wz, 3.6, 1.0, 2.0, tintColor(brick, 1.12), { tex: 'brick' });
  vb.box(0, 4.6, wz, 3.8, 0.35, 2.4, 0xd8b050, { tex: 'metal' });

  // 성벽 너머로 보이는 도시 지붕들 (낮은 흙벽돌 집들 — 하란 도성)
  buildMudbrickBuilding(vb, col, -9.5, -17.0, 5.4, 4.4, 4.6, { brickColor: 0xc09a68, roofColor: 0x9a6a40, seed: 1331 });
  buildMudbrickBuilding(vb, col, 8.5, -17.5, 5.0, 5.2, 4.6, { brickColor: 0xb48c5c, roofColor: 0x8e5e38, seed: 1332 });
  buildMudbrickBuilding(vb, col, -1.5, -19.5, 4.6, 6.0, 4.2, { brickColor: 0xcaa474, roofColor: 0xa07048, seed: 1333 });

  // 마당 가장자리 우물 (낙타·양이 물 마시는 곳)
  const well = buildWell();
  well.position.set(-10.0, 0, -4.5);
  well.rotation.y = 0.3;
  root.add(well);
  col.addBox(-10.0, -4.5, 3.4, 2.2);
  vb.box(-8.0, 0, -6.2, 0.9, 0.4, 0.5, PAL.stone[2], { tex: 'stone' });
  P.pot(vb, -8.3, -3.0, 1.2, PAL.clay[2]);
  P.pot(vb, -7.6, -2.7, 0.9, PAL.clay[1]);

  // 양 우리: 울타리 + 건초 + 구유
  P.fence(vb, col, -14, 4, -9, 4);
  P.fence(vb, col, -14, 4, -14, 10);
  P.fence(vb, col, -14, 10, -9, 10);
  P.fence(vb, col, -9, 4, -9, 10, [[6.0, 8.0]]);
  P.hay(vb, col, -12.6, 5.4, 0.2);
  P.trough(vb, col, -10.8, 8.8, 0);

  // 장막 마을: 추가 장막과 생활 소품
  const extra = [
    { x: -10.5, z: -9.0, c: 0x6a3a2c, r: 0.4 },
    { x: 11.5, z: 7.5, c: 0x3a3028, r: -0.5 },
    { x: -2.0, z: 9.5, c: 0xb89a6a, r: 0.1 },
    { x: 10.5, z: -12.0, c: 0x7a5a3a, r: 2.9 },
  ];
  for (const e of extra) {
    const t = buildNomadTent(e.c);
    t.position.set(e.x, 0, e.z);
    t.rotation.y = e.r;
    root.add(t);
    col.addBox(e.x, e.z, 3.8, 2.6);
  }
  P.cart(vb, col, 4.8, 8.0, 0.6);
  P.sack(vb, -7.2, 7.4, 0.4); P.sack(vb, -6.6, 7.9, 1.0); P.sack(vb, 3.0, -1.4, 0.2);
  P.crate(vb, 7.8, 0, 7.2, 0.3, 0.6); P.crate(vb, 8.5, 0, 7.8, 0.1, 0.5); P.crate(vb, 8.1, 0.6, 7.5, 0.5, 0.4);
  P.woodpile(vb, col, -3.8, 8.6, 0.5);
  P.laundry(vb, col, 1.0, 11.6, 0);
  P.hay(vb, col, 8.8, 4.5, 0.6);
  P.basket(vb, -5.4, 0, -1.0, 0xc8a050);
  P.basket(vb, 6.6, 0, 0.6, 0xa0703c);
  // 양탄자 줄: 길가 천막 장터 느낌
  vb.box(-3.0, 0.01, -8.6, 2.4, 0.04, 1.2, 0x9a3a2c, { tex: 'wool' });
  vb.box(-3.0, 0.05, -8.6, 1.9, 0.02, 0.8, 0xe0b848, { tex: 'wool' });
  vb.box(3.2, 0.01, -9.6, 2.0, 0.04, 1.0, 0x2c5a88, { tex: 'wool' });
  vb.box(3.2, 0.05, -9.6, 1.5, 0.02, 0.6, 0xe0d0a0, { tex: 'wool' });

  scatterGroundCover(vb, col, { seed: 1337, half: 18, count: 150, flowers: [0xf0e0a0, 0xe8a8b8], tufts: [0x9a8a52, 0x8a7a46, 0x6a8a48], pebbles: [0x9a8460, 0xb89c70, 0x7a6448] });
  root.add(vb.build());

  // 쉬고 있는 낙타와 양 (기존 위치 유지 + 마을 가축)
  const camel = new Camel(6.5, 4.5, true);
  camel.root.rotation.y = -Math.PI * 0.3;
  const camel2 = new Camel(10.2, 5.2, true);
  camel2.root.rotation.y = Math.PI * 0.6;
  const sheep = new Sheep(-5.0, 3.0);
  root.add(camel.root, camel2.root, sheep.root);
  const flock = [[-12.4, 6.8], [-11.2, 7.4], [-13.0, 8.4], [-11.6, 5.6]];
  for (let i = 0; i < flock.length; i++) root.add(new Sheep(flock[i][0], flock[i][1]).root);

  return { root, col, bounds: col.bounds };
}
