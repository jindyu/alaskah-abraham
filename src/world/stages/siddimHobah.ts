import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildNomadTent } from '../props/biblicalProps';
import * as P from '../props';
import { buildFarField, buildHorizonPlane, scatterGroundCover, tintColor } from './common';
import {
  buildStageGroundPlane,
  buildTarPit,
  buildBattleStandard,
} from './scenery12';
import { fbm, hash2, valueNoise } from '../../core/rng';
import { ditherPick } from '../textures';

export interface SiddimHobahStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  torchLights: THREE.PointLight[];
  melchizedekTable: THREE.Group;
  update: (dt: number, time: number) => void;
}

/**
 * 제2권 싯딤 골짜기 전장 및 호바 야간 기습 3D 복셀 무대
 * - 붉은 사암 협곡과 솟구치는 검은 역청(아스팔트) 구덩이들
 * - 엘람 및 4개국 연합군 적진 야영지(텐트, 군기, 바리케이드, 보급 상자)
 * - 318명 사병의 야간 기습 횃불 진격로와 구출된 롯
 * - 남쪽 살렘 왕 멜기세덱의 거룩한 떡과 포도주 축복 단상
 */
export function buildSiddimHobahStage(): SiddimHobahStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.SODOM_NEGEV;

  // 1. 원경 붉은 사막 협곡 지평선 바닥
  root.add(buildHorizonPlane(reg.canyonRed));
  buildFarField(root, 18, { seed: 14, pal: [0x9a4a30, 0x8a3e28, 0xaa5a3a, 0x703020], tex: 'cliff', accents: [0x5a2e20, 0x7a5a40], depth: 40, ground: 0xb86a44, haze: reg.canyonRed, rim: { min: 2.0, max: 4.0, south: 0.35 } });

  // 2. 고해상도 절차적 지면 (붉은 사암 흙, 그을린 전장 검댕, 검은 역청 얼룩, 살렘 석재 바닥)
  const groundMesh = buildStageGroundPlane({
    size: 52,
    res: 512,
    yOffset: -0.01,
    painter: (x, z, i, j) => {
      // 1) 남쪽 멜기세덱 축복 성소 (z >= 4.5)
      if (z >= 4.5 && Math.abs(x) <= 4.0) {
        const nSanctuary = valueNoise(i / 10, j / 10, 401);
        return ditherPick([PAL.stone[2], PAL.stone[3], 0xdad2c2, reg.canyonRed], nSanctuary, i, j, 0.3);
      }

      // 2) 역청 구덩이 주변 번들거리는 피치 및 타르 얼룩
      const dTar1 = Math.hypot(x - (-4.0), z - (-4.0));
      const dTar2 = Math.hypot(x - 3.5, z - (-7.5));
      const dTar3 = Math.hypot(x - (-3.0), z - 3.0);
      if (dTar1 < 3.2 || dTar2 < 3.0 || dTar3 < 2.5) {
        const minDist = Math.min(dTar1, dTar2, dTar3);
        const nTar = hash2(i, j, 411);
        if (minDist < 1.8 && nTar < 0.75) return ditherPick([0x0e0c0e, 0x1a1618, 0x241c20, 0x16181e], fbm(x * 2.2, z * 2.2, 415, 2), i, j, 0.5); // 짙은 타르 (기름막 얼룩)
        return ditherPick([0x261e1a, 0x3a2c24, reg.sulfurYellow, reg.canyonRed], nTar, i, j, 0.4);
      }

      // 3) 전장 야영지 및 횃불 주변 그을린 흔적
      const dTorch1 = Math.hypot(x - (-5.0), z - 0);
      const dTorch2 = Math.hypot(x - 5.0, z - 0);
      const dCamp = Math.hypot(x - 0, z - (-10.0));
      if (dTorch1 < 2.2 || dTorch2 < 2.2 || dCamp < 4.5) {
        const nBurn = fbm(x * 1.5, z * 1.5, 421, 2);
        if (nBurn > 0.4) {
          return ditherPick([0x3c2a22, 0x2e1e18, 0x5a3e30, reg.canyonRed], nBurn, i, j, 0.35);
        }
      }

      // 4) 기본 싯딤 협곡 붉은 사암 토양
      const nBase = fbm(x / 7, z / 7, 431, 2) * 0.6 + valueNoise(i / 14, j / 14, 432) * 0.4;
      return ditherPick([reg.canyonRed, 0xa86c44, 0x985e38, 0xc88c60], nBase, i, j, 0.32);
    },
  });
  root.add(groundMesh);

  // ─────────────────────────────────────────────────────────────
  // 3. 동서 양쪽의 깎아지른 붉은 사암 협곡 절벽 (Canyon Walls)
  // ─────────────────────────────────────────────────────────────
  // 서쪽 협곡 절벽 (x: -11 ~ -18)
  for (let z = -18; z <= 18; z += 3.2) {
    const h1 = 5.2 + Math.sin(z * 0.3) * 1.4;
    vb.box(-14.5, 0, z, 7.5, h1, 3.4, tintColor(reg.canyonRed, 0.62 + hash2(z, 1, 471) * 0.2), { tex: 'farStrata', jitter: 0.04 });
    const h2 = 3.2 + Math.cos(z * 0.25) * 0.9;
    vb.box(-11.2, 0, z, 2.4, h2, 3.4, tintColor(reg.canyonRed, 0.92 + hash2(z, 3, 475) * 0.2), { tex: 'farStrata', jitter: 0.04 }); // 전면 암붕
  }
  col.addBox(-14, 0, 8, 36);

  // 동쪽 협곡 절벽 (x: 11 ~ 18)
  for (let z = -18; z <= 18; z += 3.2) {
    const h1 = 5.4 + Math.cos(z * 0.28) * 1.5;
    vb.box(14.5, 0, z, 7.5, h1, 3.4, tintColor(reg.canyonRed, 0.62 + hash2(z, 2, 473) * 0.2), { tex: 'farStrata', jitter: 0.04 });
    const h2 = 3.0 + Math.sin(z * 0.32) * 1.0;
    vb.box(11.2, 0, z, 2.4, h2, 3.4, tintColor(reg.canyonRed, 0.92 + hash2(z, 4, 477) * 0.2), { tex: 'farStrata', jitter: 0.04 }); // 전면 암붕
  }
  col.addBox(14, 0, 8, 36);

  // 북쪽 퇴로를 차단하는 바위 봉우리 능선
  for (let x = -10; x <= 10; x += 3.2) {
    const h = 4.0 + Math.sin(x * 0.35) * 1.2;
    vb.box(x, 0, -17.5, 3.4, h, 4.0, tintColor(reg.canyonRed, 0.6 + hash2(x, 5, 479) * 0.2), { tex: 'farStrata', jitter: 0.04 });
  }
  col.addBox(0, -17.5, 24, 4.0);

  // ─────────────────────────────────────────────────────────────
  // 4. 검은 역청(Bitumen/Asphalt) 웅덩이 3곳
  // ─────────────────────────────────────────────────────────────
  buildTarPit(vb, col, -4, -4, 2.4, 2.2);
  buildTarPit(vb, col, 3.5, -7.5, 2.2, 2.0);
  buildTarPit(vb, col, -3.2, 3.2, 1.8, 1.6);

  // ─────────────────────────────────────────────────────────────
  // 5. 북쪽 적진 연합군 야영지 지휘 단상 및 주둔지
  // ─────────────────────────────────────────────────────────────
  // 군사 단상 (x: 0, z: -11)
  vb.box(0, 0, -11, 14, 1.2, 7.5, reg.canyonRed, { tex: 'cliff' });
  col.addBox(0, -11, 13.5, 7.0);

  // 단상 앞 사병 진격 방어용 목재 바리케이드
  vb.box(-3.5, 0, -7.2, 0.18, 1.1, 2.6, PAL.wood[1], { tex: 'wood' });
  vb.box(3.5, 0, -7.2, 0.18, 1.1, 2.6, PAL.wood[1], { tex: 'wood' });
  // 교차된 바리케이드 목책
  vb.box(-3.5, 0.5, -7.2, 2.2, 0.18, 0.18, PAL.wood[2], { tex: 'wood' });
  vb.box(3.5, 0.5, -7.2, 2.2, 0.18, 0.18, PAL.wood[2], { tex: 'wood' });
  col.addBox(-3.5, -7.2, 2.4, 0.6);
  col.addBox(3.5, -7.2, 2.4, 0.6);

  // 보급품 궤짝 및 탈취된 곡물 자루들
  P.crate(vb, -6.5, 1.2, -10.5, 0.2, 0.6);
  P.crate(vb, -5.5, 1.2, -11.2, -0.1, 0.55);
  P.sack(vb, 5.5, -10.5, 0.4);
  P.sack(vb, 6.2, -11.0, -0.3);
  P.woodpile(vb, col, 5.8, -8.5, 0.2);

  // 무기 거치대 (창과 방패)
  vb.box(-1.8, 1.2, -12, 1.4, 0.9, 0.5, PAL.wood[0], { tex: 'wood' });
  vb.box(-1.8, 1.4, -11.7, 0.8, 0.8, 0.1, 0x8a7250, { tex: 'metal' }); // 청동 방패

  // ─────────────────────────────────────────────────────────────
  // 6. 남쪽 살렘 왕 멜기세덱의 축복 석조 단상과 제단 (x: 0, z: 6)
  // ─────────────────────────────────────────────────────────────
  // 2단 석조 단상
  vb.box(0, 0, 6, 5.4, 0.4, 4.4, PAL.stone[2], { tex: 'stone' });
  vb.box(0, 0.4, 6, 3.8, 0.5, 3.0, PAL.stone[3], { tex: 'stone' });

  // 멜기세덱 제단 석탁 (중앙 탁자)
  vb.box(0, 0.9, 6, 2.4, 0.6, 1.5, 0xdcd6c8, { tex: 'stone' });
  col.addBox(0, 6, 3.8, 3.0);

  // 떡 바구니 (떡 조각들과 순백의 보자기를 얹음)
  vb.box(-0.6, 1.5, 6, 0.7, 0.15, 0.7, PAL.fabric.cream, { tex: 'plain' });
  vb.box(-0.6, 1.65, 6, 0.5, 0.12, 0.5, PAL.produce.bread, { tex: 'plain' });

  // 지극히 높으신 하나님의 제사장의 황금 포도주 잔 (Golden Chalice)
  vb.box(0.6, 1.5, 6, 0.4, 0.1, 0.4, PAL_REGION.EGYPT.gold, { tex: 'metal' });
  vb.box(0.6, 1.6, 6, 0.12, 0.25, 0.12, PAL_REGION.EGYPT.gold, { tex: 'metal' });
  vb.box(0.6, 1.85, 6, 0.45, 0.35, 0.45, PAL_REGION.EGYPT.gold, { tex: 'metal' });
  vb.box(0.6, 2.1, 6, 0.35, 0.05, 0.35, 0x7a1828, { tex: 'plain' }); // 붉은 포도주

  // ─────────────────────────────────────────────────────────────
  // 7. 연합군 군기(Battle Standards), 횃불 기둥, 야영 화덕
  // ─────────────────────────────────────────────────────────────
  // 군기 (적진 및 전장 곳곳)
  buildBattleStandard(vb, -4.5, -9.5, PAL.fabric.redDark, 4.0);
  buildBattleStandard(vb, 4.5, -9.5, PAL.fabric.indigo, 4.0);
  buildBattleStandard(vb, -6.8, -1.5, 0x8e2c20, 3.6);
  buildBattleStandard(vb, 6.8, -1.5, 0x4a3424, 3.6);

  // 야간 기습 횃불 기둥 (torchPost)
  P.torchPost(vb, col, -5, 0);
  P.torchPost(vb, col, 5, 0);
  P.torchPost(vb, col, 0, -8.5);
  P.torchPost(vb, col, -1.8, 6.0);
  P.torchPost(vb, col, 1.8, 6.0);

  // 야전 캠프파이어 (Campfire)
  P.campfire(vb, col, -1.8, -1.5);
  P.campfire(vb, col, 1.8, -1.5);

  // ─────────────────────────────────────────────────────────────
  // 8. 험준한 바위 엄폐물과 사막 관목들 (40개 이상 풍성한 배치)
  // ─────────────────────────────────────────────────────────────
  P.rock(vb, col, -7.5, 2.5, 1.8);
  P.rock(vb, col, 7.5, 2.8, 1.6);
  P.rock(vb, col, -6.5, -7.5, 1.7);
  P.rock(vb, col, 7.2, -6.0, 1.5);
  P.rock(vb, col, -2.5, -5.5, 1.2);
  P.rock(vb, col, 2.0, -3.8, 1.1);
  P.rock(vb, col, -8.5, 7.5, 2.0);
  P.rock(vb, col, 8.5, 7.2, 1.9);
  P.rock(vb, col, -4.5, 9.5, 1.4);
  P.rock(vb, col, 4.5, 9.5, 1.3);

  // 사막 가시덤불
  P.bush(vb, col, -6.0, 5.0, 0.9, PAL.dryGrass);
  P.bush(vb, col, 6.0, 5.0, 0.9, PAL.dryGrass);
  P.bush(vb, col, -8.0, -4.5, 0.8, PAL.dryGrass);
  P.bush(vb, col, 8.0, -4.5, 0.8, PAL.dryGrass);

  // 마른 풀포기
  P.tuft(vb, -2, 1, true);
  P.tuft(vb, 2, 1, true);
  P.tuft(vb, -1, -6, true);
  P.tuft(vb, 1, -6, true);
  P.tuft(vb, -5, 3, true);
  P.tuft(vb, 5, 3, true);

  scatterGroundCover(vb, col, { seed: 401, half: 18, count: 120, tufts: [0x6a6030, 0x7a7038, 0x5a5028], pebbles: [0x5e5a58, 0x7e7870, 0x3a3430] });
  const stageMesh = vb.build();
  root.add(stageMesh);

  // 9. 적진 군사 텐트 (4개국 연합군 장막)
  const enemyTent1 = buildNomadTent(PAL.fabric.redDark);
  enemyTent1.position.set(-4, 1.2, -11);
  const enemyTent2 = buildNomadTent(PAL.stone[2]);
  enemyTent2.position.set(4, 1.2, -11);
  root.add(enemyTent1, enemyTent2);

  // 10. 야간 기습 횃불 및 모닥불 점광원들
  const torchLights: THREE.PointLight[] = [];
  const torchPositions = [
    { x: -5, y: 1.8, z: 0 },
    { x: 5, y: 1.8, z: 0 },
    { x: 0, y: 2.2, z: -9 },
    { x: 0, y: 2.0, z: 6 },
    { x: -1.8, y: 1.2, z: -1.5 },
    { x: 1.8, y: 1.2, z: -1.5 },
  ];

  torchPositions.forEach((pos) => {
    const light = new THREE.PointLight(0xff6622, 2.0, 10, 1.6);
    light.position.set(pos.x, pos.y, pos.z);
    root.add(light);
    torchLights.push(light);
  });

  const melchizedekTable = new THREE.Group();
  melchizedekTable.position.set(0, 0, 6);
  root.add(melchizedekTable);

  col.bounds = { minX: -10, maxX: 10, minZ: -16, maxZ: 16 };

  const update = (_dt: number, time: number) => {
    // 횃불 조명 깜빡임 (Zero allocation)
    for (let i = 0; i < torchLights.length; i++) {
      torchLights[i].intensity = 2.0 + Math.sin(time * 7.0 + i * 1.5) * 0.4;
    }
  };

  return {
    root,
    col,
    bounds: col.bounds,
    torchLights,
    melchizedekTable,
    update,
  };
}
