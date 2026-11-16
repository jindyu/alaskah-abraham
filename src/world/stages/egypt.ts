import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildBorderChest } from '../props/biblicalProps';
import * as P from '../props';
import { buildFarField, buildHorizonPlane, scatterGroundCover } from './common';
import {
  buildStageGroundPlane,
  buildEgyptianObelisk,
  buildCustomsPylon,
  buildNileReedBank,
} from './scenery12';
import { fbm, hash2, valueNoise } from '../../core/rng';
import { ditherPick } from '../textures';

export interface EgyptStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  chest: THREE.Group;
  throneDais: THREE.Group;
  nileWater: THREE.Group;
  brazierLight: THREE.PointLight;
  update: (dt: number, time: number) => void;
}

/**
 * 제2권 애굽 국경 세관 및 바로 궁정 3D 복셀 무대
 * - 서쪽 나일강 수로와 파피루스 갈대숲 제방
 * - 중앙 국경 세관 파일런 성문, 열주랑, 보석 상자 검문대
 * - 동남쪽 광장의 황금 피라미디온 사암 오벨리스크
 * - 동북쪽 바로 궁정의 황금 옥좌 단상과 화려한 열주 회랑
 * - 남쪽 이집트 장터(과일/토기 가판대)와 대추야자 숲
 */
export function buildEgyptStage(): EgyptStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.EGYPT;

  // 1. 원경 사막 지평선 바닥
  root.add(buildHorizonPlane(reg.sand));
  buildFarField(root, 24, { seed: 13, pal: [0xd8b472, 0xc8a460, 0xe0c080, 0xb89450], tex: 'dune', accents: [0xa08850, 0x4a6a34], depth: 40, haze: reg.sand, ground: 0xdcc088, rim: { min: 1.4, max: 2.6, south: 0.35 } });

  // 2. 고해상도 절차적 지면 (나일강 청록 물결, 비옥한 흑토, 사암 포석 광장, 황금 모래)
  const groundMesh = buildStageGroundPlane({
    size: 52,
    res: 512,
    yOffset: -0.01,
    painter: (x, z, i, j) => {
      // 1) 서쪽 나일강 수로 영역 (x < -10)
      if (x < -10.2) {
        const nWater = valueNoise(i / 12, j / 12, 301) * 0.6 + hash2(i, j, 302) * 0.4;
        return ditherPick([reg.nileWater, 0x2e5f86, 0x3f86a8, 0x6cb4cc], nWater, i, j, 0.4);
      }

      // 2) 나일강변 충적토 제방 (x: -10.2 ~ -8.0)
      if (x <= -8.0) {
        const nSilt = fbm(x * 2, z * 2, 311, 2);
        return ditherPick([0x3c2e22, 0x4e3e2c, 0x2f4c36, reg.sand], nSilt, i, j, 0.35);
      }

      // 3) 바로 궁정 바닥 대리석 타일 (x: 6.5 ~ 16, z: -14 ~ -2)
      if (x >= 6.5 && z <= -2.5) {
        const cellX = Math.floor((x - 6.5) / 1.5);
        const cellZ = Math.floor((z - (-14)) / 1.5);
        const isBorder = (i % 24 === 0) || (j % 24 === 0);
        if (isBorder) return reg.lapis;
        return (cellX + cellZ) % 2 === 0 ? 0xf0e6d2 : 0xdfd4bc;
      }

      // 4) 세관 광장 사암 포석 (x: -5.5 ~ 6.0, z: -8 ~ 2)
      if (x >= -5.5 && x <= 6.0 && z >= -8.5 && z <= 2.5) {
        const nTile = valueNoise(i / 10, j / 10, 321);
        return ditherPick([reg.sandstonePillar, 0xe4c99c, 0xd2b184, reg.sand], nTile, i, j, 0.35);
      }

      // 5) 기본 사막 모래 및 잔모래결
      const nSand = fbm(x / 7, z / 7, 331, 2) * 0.6 + hash2(i, j, 332) * 0.4;
      return ditherPick([reg.sand, 0xe2c282, 0xcfa864, 0xbfa05a], nSand, i, j, 0.3);
    },
  });
  root.add(groundMesh);

  // ─────────────────────────────────────────────────────────────
  // 3. 서쪽 나일강 제방 및 석조 수로 둑
  // ─────────────────────────────────────────────────────────────
  vb.box(-13, -0.2, 0, 7, 0.5, 36, reg.nileWater, { tex: 'water' });
  col.addBox(-13, 0, 7, 36);

  // 나일강 부벽 석조 부두 (하역용 돌 계단)
  vb.box(-9.2, 0, 0, 1.4, 0.5, 36, reg.sandstonePillar, { tex: 'stone' });
  vb.box(-8.2, 0, 0, 0.8, 0.25, 36, reg.sandstonePillar, { tex: 'stone' });

  // 갈대 및 파피루스 군락 (남북 2개 구획)
  buildNileReedBank(vb, col, -9.8, -14, 10, true);
  buildNileReedBank(vb, col, -9.8, 4, 10, true);

  // ─────────────────────────────────────────────────────────────
  // 4. 중앙 애굽 국경 세관 관문 파일런(Pylon)과 거대 열주 회랑
  // ─────────────────────────────────────────────────────────────
  // 좌우 파일런 성문 탑
  buildCustomsPylon(vb, col, -5.5, -7.5, 3.8, 3.0);
  buildCustomsPylon(vb, col, 4.5, -7.5, 3.8, 3.0);

  // 관문 성벽과 상인방 (대들보)
  vb.box(-0.5, 5.2, -7.5, 6.4, 0.9, 2.2, reg.sandstonePillar, { tex: 'stone' });
  vb.box(-0.5, 5.8, -7.5, 6.8, 0.3, 2.4, reg.gold, { tex: 'metal' });

  // 중앙 통로 양옆의 화려한 연꽃 문양 기둥들
  const columnPositions = [
    { x: -2.5, z: -7.5 },
    { x: 1.5, z: -7.5 },
    { x: -2.5, z: -4.5 },
    { x: 1.5, z: -4.5 },
  ];
  for (const cp of columnPositions) {
    // 주춧돌
    vb.box(cp.x, 0, cp.z, 1.6, 0.35, 1.6, reg.sandstonePillar, { tex: 'stone' });
    // 원통형 기둥 몸체
    vb.box(cp.x, 0.35, cp.z, 1.1, 4.2, 1.1, reg.sandstonePillar, { tex: 'stone' });
    // 청금석 띠 장식
    vb.box(cp.x, 2.4, cp.z, 1.16, 0.35, 1.16, reg.lapis, { tex: 'plain' });
    // 연꽃 주두와 황금 장식
    vb.box(cp.x, 4.55, cp.z, 1.8, 0.65, 1.8, reg.gold, { tex: 'plain' });
    col.addBox(cp.x, cp.z, 1.5, 1.5);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. 국경 세관 검문대 및 행정 가구 (미드라시 보석 상자 구역)
  // ─────────────────────────────────────────────────────────────
  // 세관 관헌의 업무용 긴 목재 탁자
  vb.box(-0.2, 0, -2, 2.4, 0.8, 1.2, PAL.wood[2], { tex: 'wood' });
  col.addBox(-0.2, -2, 2.4, 1.2);

  // 탁자 위 파피루스 두루마리, 점토 인장함, 저울
  vb.box(-0.7, 0.8, -2, 0.5, 0.12, 0.3, 0xf0e6d0, { tex: 'plain' }); // 두루마리
  vb.box(0.4, 0.8, -2, 0.4, 0.25, 0.35, 0x9a7a50, { tex: 'wood' }); // 인장함

  // 세관 관헌 의자
  vb.box(-0.2, 0, -3.1, 0.7, 0.55, 0.7, PAL.wood[1], { tex: 'wood' });

  // 세관 창고 화물 항아리와 곡물 자루들
  P.pot(vb, -2.2, -1.8, 1.3);
  P.pot(vb, -2.8, -2.2, 1.1);
  P.sack(vb, -2.2, -0.8, 0.2);
  P.sack(vb, -2.7, -1.0, -0.4);
  P.crate(vb, -3.2, 0, -2.8, 0.3, 0.6);
  P.crate(vb, 3.2, 0, -2.2, -0.2, 0.55);

  // ─────────────────────────────────────────────────────────────
  // 6. 동남쪽 광장의 웅장한 사암 오벨리스크
  // ─────────────────────────────────────────────────────────────
  buildEgyptianObelisk(vb, col, 7, 5);

  // ─────────────────────────────────────────────────────────────
  // 7. 동북쪽 바로 궁정 황금 옥좌 단상 (Pharaoh Throne Dais)
  // ─────────────────────────────────────────────────────────────
  // 2단 웅장한 궁정 단상 (x: 11, z: -7)
  vb.box(11, 0, -7, 7.5, 0.6, 8.5, PAL.stone[3], { tex: 'stone' });
  vb.box(11, 0.6, -7, 6.0, 0.4, 7.0, reg.lapis, { tex: 'plain' });
  col.addBox(11, -7, 7.2, 8.2);

  // 단상 앞 청금석 진입 계단
  vb.box(7.5, 0, -7, 1.5, 0.3, 3.2, PAL.stone[3], { tex: 'stone' });
  vb.box(7.8, 0.3, -7, 1.0, 0.3, 2.4, reg.lapis, { tex: 'plain' });

  // 황금 보좌 (Throne of Pharaoh)
  vb.box(12, 1.0, -7, 2.4, 1.4, 1.8, reg.gold, { tex: 'metal' });
  vb.box(12, 2.4, -7.8, 2.4, 1.8, 0.4, reg.gold, { tex: 'metal' }); // 옥좌 등받이
  vb.box(12, 4.2, -7.8, 1.2, 0.8, 0.45, reg.gold, { tex: 'plain' }); // 태양 원반 머리 장식

  // 궁정 회랑 기둥 2개 (옥좌 좌우 호위 기둥)
  vb.box(11, 1.0, -10, 1.0, 4.8, 1.0, reg.sandstonePillar, { tex: 'stone' });
  vb.box(11, 5.8, -10, 1.6, 0.6, 1.6, reg.gold, { tex: 'plain' });
  vb.box(11, 1.0, -4, 1.0, 4.8, 1.0, reg.sandstonePillar, { tex: 'stone' });
  vb.box(11, 5.8, -4, 1.6, 0.6, 1.6, reg.gold, { tex: 'plain' });

  // ─────────────────────────────────────────────────────────────
  // 8. 남쪽 이집트 바자르 장터 (Market Stalls)
  // ─────────────────────────────────────────────────────────────
  // 과일 가판대 (나일강 멜론, 대추야자, 석류)
  P.stall(vb, col, -1.5, 8, 'stripeSaffron', 'fruit', 0);
  // 토기 및 향유 가판대
  P.stall(vb, col, 3.2, 8, 'stripeIndigo', 'pots', 0);

  // ─────────────────────────────────────────────────────────────
  // 9. 외곽 애굽 성벽과 방어 망루 (바깥 허공 차단)
  // ─────────────────────────────────────────────────────────────
  // 북쪽 진흙벽돌 성벽 라인 (z: -14 ~ -16)
  for (let x = -16; x <= 16; x += 4) {
    if (x >= -4 && x <= 3) continue; // 중앙 관문 입구 트임
    vb.box(x, 0, -14, 4.2, 5.0, 2.2, 0xa68252, { tex: 'brick' });
    vb.box(x, 5.0, -14, 4.2, 0.6, 2.4, 0xb89262, { tex: 'brick' }); // 총안 흉벽
  }
  col.addBox(-10, -14, 12, 2.4);
  col.addBox(10, -14, 12, 2.4);

  // 동쪽 궁정 외벽 (x: 15 ~ 17)
  vb.box(15.5, 0, 0, 2.4, 4.6, 34, 0xa68252, { tex: 'brick' });
  col.addBox(15.5, 0, 2.4, 34);

  // 남쪽 모래언덕 사구 라인 (z: 14 ~ 18)
  // 시각은 buildFarField 의 rim(매끈한 사구 능선)이 그린다 — 박스 사구 띠는 화면 아래를 갈색 블록으로 가렸다
  col.addBox(0, 15.5, 34, 4.0);

  // ─────────────────────────────────────────────────────────────
  // 10. 식생 및 세부 소품 (종려나무 숲, 관목, 바위, 항아리)
  // ─────────────────────────────────────────────────────────────
  // 나일강변 및 광장 대추야자 종려나무
  P.palmTree(vb, col, -7.5, -3.5);
  P.palmTree(vb, col, -7.0, 6.0);
  P.palmTree(vb, col, -6.5, 12.0);
  P.palmTree(vb, col, 13.5, 3.5);
  P.palmTree(vb, col, 14.0, 11.0);
  P.palmTree(vb, col, 7.5, -12.0);

  // 사막 관목
  P.bush(vb, col, -4.5, 4.5, 1.0);
  P.bush(vb, col, 0.5, 4.8, 0.9);
  P.bush(vb, col, 9.5, 8.5, 1.1);
  P.bush(vb, col, -2.5, 12.5, 0.8);

  // 사암 바위 덩어리들
  P.rock(vb, col, -6.0, 1.5, 1.2);
  P.rock(vb, col, 6.0, 1.2, 1.4);
  P.rock(vb, col, 10.5, 2.0, 1.1);
  P.rock(vb, col, -4.5, 13.5, 1.5);
  P.rock(vb, col, 7.5, 12.5, 1.6);

  // 추가 항아리와 물바구니
  P.pot(vb, 5.5, 7.5, 1.1);
  P.pot(vb, -3.2, 7.5, 1.0);
  P.pot(vb, 1.8, -1.2, 0.8);
  P.basket(vb, -1.8, 0, 7.0, PAL.produce.date);
  P.basket(vb, 3.8, 0, 7.0, PAL.produce.fig);

  scatterGroundCover(vb, col, { seed: 201, half: 24, count: 240, flowers: [0xf4d84a,0xe86a4a], tufts: [0x6a8a3c,0x58783a,0x7a9a48], pebbles: [0xb09a6a,0xc8b080] });
  const stageMesh = vb.build();
  root.add(stageMesh);

  // 11. 세관 보석 상자 (미드라시 핵심 인터랙션 오브젝트)
  const chest = buildBorderChest();
  chest.position.set(1.5, 0, -2);
  col.addBox(1.5, -2, 1.8, 1.4);
  root.add(chest);

  // 12. 궁정 화로 조명 (황금 옥좌 단상 앞 삼각 화로)
  const brazierLight = new THREE.PointLight(0xff9933, 2.0, 12, 1.8);
  brazierLight.position.set(9.5, 2.6, -7);
  root.add(brazierLight);

  // 화로 거치대 복셀 (별도 소형 그룹)
  const bzVb = new VoxelBuilder(9, false);
  bzVb.box(9.5, 0, -7, 0.8, 1.2, 0.8, 0x4a3222, { tex: 'metal' });
  bzVb.box(9.5, 1.2, -7, 1.1, 0.35, 1.1, 0xca9a50, { tex: 'metal' });
  bzVb.box(9.5, 1.5, -7, 0.7, 0.3, 0.7, 0xff7722, { tex: 'flame', ao: false });
  root.add(bzVb.build());

  const throneDais = new THREE.Group();
  throneDais.position.set(11, 0, -7);
  root.add(throneDais);

  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  const update = (_dt: number, time: number) => {
    // 화로 조명 깜빡임
    brazierLight.intensity = 2.0 + Math.sin(time * 7.0) * 0.35 + Math.cos(time * 13.0) * 0.15;
  };

  return {
    root,
    col,
    bounds: col.bounds,
    chest,
    throneDais,
    nileWater: stageMesh,
    brazierLight,
    update,
  };
}
