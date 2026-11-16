import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildStoneAltar } from '../props/biblicalProps';
import * as P from '../props';
import { Sheep } from '../../entities/animals';
import { buildPerimeterRidges } from './scenery36';
import { buildFarField, buildHorizonPlane } from './common';
import {
  buildStageGroundPlane,
  buildTerebinthOak,
  buildChieftainTent,
} from './scenery12';
import { fbm, hash2, valueNoise } from '../../core/rng';
import { ditherPick } from '../textures';

export interface ShechemBethelStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  altar: THREE.Group;
  altarLight: THREE.PointLight;
  shechemOak: THREE.Group;
  sheepGroup: THREE.Group;
  update: (dt: number, time: number) => void;
}

/**
 * 제2권 세겜 & 벧엘 상수리나무 언덕 3D 복셀 무대
 * - 세겜 모레 상수리나무 아래 첫 제단
 * - 벧엘과 아이 사이의 석회암 언덕 전망대 (사다리 실루엣 계단식 바위 능선)
 * - 가나안 유목 장막과 양 떼 방목지, 건천(와디), 올리브 구릉
 */
export function buildShechemBethelStage(): ShechemBethelStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.CANAAN;

  // 1. 원경 지평선 바닥 (광활한 가나안 구릉 지평선)
  root.add(buildHorizonPlane(reg.ground));
  buildFarField(root, 18, { seed: 15, pal: [0x5a7a3a, 0x6a8a44, 0x7a8a58, 0x8a8470], tex: 'soil', accents: [0x7e7a68, 0x3e5a2c], depth: 40, haze: reg.ground, ground: 0x4e6e3c, rim: { min: 1.8, max: 3.6, south: 0.4 } });

  // 2. 고해상도 절차적 지면 (비옥한 황토, 초원 잔디, 흙길, 자갈 건천)
  const groundMesh = buildStageGroundPlane({
    size: 52,
    res: 512,
    yOffset: -0.01,
    painter: (x, z, i, j) => {
      // 1) 기본 지형: 비옥한 가나안 초원과 올리브 흙
      const nBase = fbm(x / 8, z / 8, 201, 2) * 0.5 + valueNoise(i / 16, j / 16, 202) * 0.3 + hash2(i, j, 203) * 0.2;
      let c = ditherPick([reg.ground, PAL.grass[2], PAL.grass[3], PAL.dryGrass[1]], nBase, i, j, 0.35);

      // 2) 흙길 오솔길: 남서쪽 장막(-8, 4) -> 중앙(0, 1) -> 제단(-2, -2) -> 벧엘 능선(10, -10)
      const dPath1 = Math.abs(z - (0.5 * x + 4.5)); // 장막~중앙
      const dPath2 = Math.abs(z - (-0.8 * x - 2.0)); // 제단 길목
      const dPath3 = Math.abs(z - (-0.9 * x - 1.0)); // 벧엘 방향 오솔길
      const onPath = (dPath1 < 1.4 && x >= -8.5 && x <= 0) ||
                     (dPath2 < 1.3 && x >= -4 && x <= 0 && z >= -3 && z <= 1) ||
                     (dPath3 < 1.5 && x >= -1 && x <= 10 && z <= 0 && z >= -10.5);

      if (onPath) {
        const nPath = valueNoise(i / 8, j / 8, 211);
        c = ditherPick([0xa57c50, 0x8a6440, 0xbe9764, reg.ground], nPath, i, j, 0.4);
      }

      // 3) 건천(와디): 동남쪽을 가로지르는 메마른 자갈 하천 (x: 4~16, z: 6~16)
      const wadiZ = 8 + Math.sin(x * 0.4) * 2.2;
      const dWadi = Math.abs(z - wadiZ);
      if (dWadi < 2.2 && x >= 3 && x <= 18) {
        const nWadi = hash2(i, j, 221);
        if (nWadi < 0.25) c = 0x8c8676; // 자갈
        else if (nWadi < 0.5) c = 0xa8a090; // 석회석 조각
        else c = 0x6e5238; // 젖은 모래흙
      }

      // 4) 벧엘 석회암 능선 암반 지대 (북동쪽)
      if (x >= 6 && z <= -6) {
        const nRock = fbm(x / 4, z / 4, 231, 2);
        if (nRock > 0.45) {
          c = ditherPick([reg.limestone, PAL.stone[2], PAL.stone[3], reg.ground], nRock, i, j, 0.3);
        }
      }

      return c;
    },
  });
  root.add(groundMesh);

  // ─────────────────────────────────────────────────────────────
  // 3. 벧엘 석회암 언덕 바위 능선 (사다리 실루엣 계단식 바위 전망대)
  // ─────────────────────────────────────────────────────────────
  // 거대한 1단 테라스 기단 (x: 5~16, z: -5~-16)
  vb.box(10, 0, -10, 12, 1.2, 12, reg.limestone, { tex: 'cliff' });
  col.addBox(10, -10, 11, 11);

  // 벧엘 사다리 형상의 계단식 바위 슬래브 (Ladder-like rocky stair silhouette)
  const stairTiers = [
    { x: 7, z: -7, w: 3.5, h: 0.5, d: 3.5, y: 1.2 },
    { x: 8.2, z: -8.2, w: 3.2, h: 0.5, d: 3.2, y: 1.7 },
    { x: 9.5, z: -9.5, w: 3.0, h: 0.5, d: 3.0, y: 2.2 },
    { x: 10.8, z: -10.8, w: 2.8, h: 0.5, d: 2.8, y: 2.7 },
  ];
  for (const tier of stairTiers) {
    vb.box(tier.x, tier.y, tier.z, tier.w, tier.h, tier.d, PAL.stone[2], { tex: 'cliff' });
  }

  // 벧엘 정상 파노라마 조망 단상 (x: 10, z: -10)
  vb.box(10, 1.2, -10, 6, 0.6, 6, PAL.stone[3], { tex: 'cliff' });
  vb.box(12, 1.8, -12, 4, 1.4, 4, PAL.stone[1], { tex: 'cliff' }); // 북동쪽 높은 봉우리
  col.addBox(12, -12, 4.2, 4.2);

  // ─────────────────────────────────────────────────────────────
  // 4. 세겜 모레 첫 제단 언덕 (돌 제단이 놓일 완만한 둔덕)
  // ─────────────────────────────────────────────────────────────
  vb.box(-2, 0, -2, 4.5, 0.25, 4.5, reg.ground, { tex: 'soil' });
  vb.box(-2, 0.25, -2, 3.2, 0.2, 3.2, PAL.stone[2], { tex: 'stone' });

  // ─────────────────────────────────────────────────────────────
  // 5. 남서쪽 유목민 장막 구역 (아브람 & 사래의 장막 터)
  // ─────────────────────────────────────────────────────────────
  // 장막 바닥 다진 흙 및 차양 평상
  vb.box(-8, 0, 4, 5.4, 0.15, 5.0, PAL.dirt[2], { tex: 'soil' });

  // ─────────────────────────────────────────────────────────────
  // 6. 외곽 구릉 및 능선 (허공 차단 및 원경 입체감 조성)
  // ─────────────────────────────────────────────────────────────
  // 시각 외곽은 buildFarField 의 rim(매끈한 능선 → 안개)이 그린다 — 여기서는 충돌체만
  buildPerimeterRidges(vb, col, 18, [], { openNorth: false });

  // ─────────────────────────────────────────────────────────────
  // 7. 풍성한 식생 및 소품 배치 (30~50개 이상)
  // ─────────────────────────────────────────────────────────────
  // 올리브 나무 군락 (언덕 및 능선 주변)
  P.oliveTree(vb, col, -13, -12);
  P.oliveTree(vb, col, -12, -4);
  P.oliveTree(vb, col, -14, 8);
  P.oliveTree(vb, col, 14, 2);
  P.oliveTree(vb, col, 13, -3);
  P.oliveTree(vb, col, 5, -14);

  // 무화과 나무
  P.figTree(vb, col, -6, 12);
  P.figTree(vb, col, 12, 12);

  // 관목 (Bush)
  P.bush(vb, col, -5, 1, 1.1);
  P.bush(vb, col, -7, -2, 0.9);
  P.bush(vb, col, -3, -7, 1.0);
  P.bush(vb, col, 5, 1, 1.2);
  P.bush(vb, col, 8, 4, 0.9);
  P.bush(vb, col, 4, -8, 1.1);
  P.bush(vb, col, 14, -8, 1.0);
  P.bush(vb, col, -11, 4, 0.8);

  // 바위 군락 (Rock of various sizes)
  P.rock(vb, col, -4, -4, 1.4);
  P.rock(vb, col, 3, -2, 1.1);
  P.rock(vb, col, 6, -5, 1.5);
  P.rock(vb, col, 14, -14, 2.2);
  P.rock(vb, col, -14, -14, 1.8);
  P.rock(vb, col, 7, 7, 1.3);
  P.rock(vb, col, 11, 8, 1.6);
  P.rock(vb, col, -8, 13, 1.4);
  P.rock(vb, col, -1, 10, 1.1);

  // 목축 울타리와 돌담 (Stone wall & fence)
  P.stoneWall(vb, col, 1, 5, 6, 5);
  P.stoneWall(vb, col, 6, 5, 6, 10);
  P.fence(vb, col, 1, 10, 5, 10);

  // 목축 물 구유 및 건초더미 (Trough & Hay)
  P.trough(vb, col, 2.5, 6.5, 0);
  P.hay(vb, col, 4.5, 8.5, 0.4);
  P.hay(vb, col, 5.2, 9.2, -0.3);

  // 장막 생활 소품 (야외 화덕, 장작더미, 토기, 곡물 자루)
  P.campfire(vb, col, -4.5, 3.2);
  P.woodpile(vb, col, -3.2, 4.5, 0.3);
  P.bench(vb, col, -6.5, 5.5, 0);
  P.pot(vb, -5.8, 2.8, 1.2);
  P.pot(vb, -5.2, 2.4, 0.9);
  P.sack(vb, -6.8, 2.2, 0.4);
  P.sack(vb, -7.4, 2.4, -0.2);

  // 들꽃 및 풀포기 장식
  P.tuft(vb, -1, 3);
  P.tuft(vb, 1, -1);
  P.tuft(vb, 7, 2);
  P.tuft(vb, -6, -6);
  P.tuft(vb, 3, 7);
  P.flower(vb, -2, 4, PAL.flower[0]);
  P.flower(vb, 0, 2, PAL.flower[1]);
  P.flower(vb, 3, -1, PAL.flower[2]);
  P.flower(vb, 7, 3, PAL.flower[3]);

  // 세겜 모레 거목 상수리나무 (서북쪽 -6, -5)
  buildTerebinthOak(vb, col, -6, -5, 1.35, 777);

  // 웅장한 아브람의 족장 장막 (차양 및 평상 포함)
  buildChieftainTent(vb, col, -8, 4, reg.tentBlack, { width: 4.6, depth: 3.8, awningZ: 1.8 });

  // 복셀 전체 지오메트리 빌드 & 추가
  root.add(vb.build());

  // 8. 첫 제단 오브젝트 (인터랙션 및 시네마틱 앵커)
  const altar = buildStoneAltar(true);
  altar.position.set(-2, 0.45, -2);
  col.addBox(-2, -2, 2.0, 1.8);
  root.add(altar);

  // 제단 번제 화염 점광원
  const altarLight = new THREE.PointLight(0xff7722, 2.0, 9, 1.6);
  altarLight.position.set(-2, 1.6, -2);
  root.add(altarLight);

  // 세겜 상수리나무 더미 그룹 (기존 인터페이스 호환용)
  const shechemOak = new THREE.Group();
  shechemOak.position.set(-6, 0, -5);
  root.add(shechemOak);

  // 9. 방목 중인 양 떼 (가나안 목축)
  const sheepGroup = new THREE.Group();
  const sheep1 = new Sheep(3.5, 7.5);
  const sheep2 = new Sheep(5.0, 6.5);
  const sheep3 = new Sheep(2.0, 8.5);
  const sheep4 = new Sheep(4.0, 9.5);
  sheepGroup.add(sheep1.root, sheep2.root, sheep3.root, sheep4.root);
  root.add(sheepGroup);

  // 경계 영역
  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  const update = (_dt: number, time: number) => {
    // 번제 화염 빛의 미세 깜빡임
    altarLight.intensity = 2.0 + Math.sin(time * 8.0) * 0.35 + Math.cos(time * 15.0) * 0.15;
  };

  return {
    root,
    col,
    bounds: col.bounds,
    altar,
    altarLight,
    shechemOak,
    sheepGroup,
    update,
  };
}
