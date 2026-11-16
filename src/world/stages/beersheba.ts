import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';
import { Collision } from '../collision';
import { buildWell, buildTamarisk } from '../props/biblicalProps';
import * as P from '../props';
import { Sheep } from '../../entities/animals';
import { buildFarField, buildHorizonPlane, scatterGroundCover } from './common';
import {
  createStageGroundMesh,
  buildPerimeterRidges,
  buildRichNomadTent,
  buildFencePen,
  buildTroughLong,
  buildTorchStand,
  buildStoragePropCluster,
  buildSplitWoodBundle,
  buildFoliageTree,
} from './scenery36';
import { fbm, hash2, valueNoise } from '../../core/rng';

export interface BeershebaStage {
  root: THREE.Group;
  col: Collision;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  well: THREE.Group;
  tamarisk: THREE.Group;
  feastTable: THREE.Group;
  update: (dt: number, time: number) => void;
}

const BEERSHEBA_HALF = 18;

/** 브엘세바 고해상도 지면: 사막 모래, 오아시스 초목, 우물터 방사형 석재 보도, 흙길 */
function buildBeershebaGroundMesh(): THREE.Mesh {
  const reg = PAL_REGION.SODOM_NEGEV;
  const resolution = 480;

  return createStageGroundMesh(BEERSHEBA_HALF, resolution, (x, z, _u, _v, i, j) => {
    // 1. 기본 네게브 사막 모래 지면
    const nSand = fbm(x / 8, z / 8, 301, 2) * 0.62 + valueNoise(i / 14, j / 14, 302) * 0.3 + hash2(i, j, 303) * 0.08; // 잔 잡음 비중을 줄여 얼룩덜룩해 보이지 않게
    let c = nSand > 0.62 ? 0xd6b47c : nSand > 0.38 ? reg.desertSand : 0xb89258;

    // 모래 물결 리플 및 미세 사암 입자
    const hGrit = hash2(i, j, 305);
    if (hGrit < 0.015) c = 0xa47e48;
    else if (hGrit > 0.985) c = 0xebd29a;

    // 2. 우물 주변 방사형 석재 포장 (중앙 x: 0, z: 0)
    const dWell = Math.hypot(x, z);
    // 포장 가장자리는 둥글고 들쭉날쭉하게 (칼같은 사각형·균일한 격자로 보이지 않게): 반경을 소음으로 흔들고, 바깥일수록 판석이 빠진다
    const edgeNoise = valueNoise(Math.atan2(z, x) * 3 + 10, dWell * 0.4, 309) * 1.1;
    if (dWell < 4.6 + edgeNoise - 0.5) {
      if (dWell < 2.5) {
        // 우물 바로 둘레: 물에 젖은 짙은 석판
        const cell = 10;
        const li = i % cell, lj = j % cell;
        if (li === 0 || lj === 0) {
          c = 0x483a2c; // 젖은 흙 줄눈
        } else {
          const tones = [0x928a7e, 0xa49c90, 0x868074, 0xb0a89a];
          c = tones[Math.floor(hash2(Math.floor(i / cell), Math.floor(j / cell), 311) * 4)];
          if (hash2(i, j, 313) < 0.08) c = PAL.water[1]; // 튄 물방울
        }
      } else {
        // 바깥 테두리: 크기·모양이 제각각인 사암 판석, 가장자리에서는 모래에 묻혀 사라진다
        const cell = 11 + Math.floor(hash2(Math.floor(i / 11), 0, 315) * 5); // 열마다 판석 폭이 다름
        const li = i % cell, lj = (j + Math.floor(hash2(Math.floor(i / cell), 1, 317) * cell)) % cell; // 열마다 어긋난 이음매
        const buried = hash2(Math.floor(i / 6), Math.floor(j / 6), 319) < (dWell - 2.5) / (2.6 + edgeNoise) * 0.9;
        if (!buried) {
          if (li === 0 || lj === 0) {
            c = 0x6e5a42;
          } else {
            const tones = [0xbda888, 0xb09a78, 0xc8b490, 0xa89070];
            c = tones[Math.floor(hash2(Math.floor(i / cell), Math.floor(j / cell), 321) * 4)];
          }
        }
      }
    }

    // 3. 오아시스 풀밭 (우물터 서북쪽 에셀나무 반경 및 관개 수로)
    const dTam = Math.hypot(x - (-6), z - (-4));
    // 풀밭 가장자리를 소음으로 흔들어 칼같은 원이 아니라 번져 가는 풀밭으로
    const tamEdge = 5.2 + (valueNoise(Math.atan2(z + 4, x + 6) * 2.5 + 20, dTam * 0.3, 325) - 0.5) * 3.2;
    if (dTam < tamEdge) {
      const nGrass = fbm(x * 1.5, z * 1.5, 321, 2);
      if (nGrass > 0.38) {
        c = nGrass > 0.65 ? PAL.grass[2] : PAL.dryGrass[1];
        if (hash2(i, j, 323) < 0.03) c = PAL.grass[3];
      }
    }

    // 4. 오아시스 동선 흙길 (장막 -> 우물 -> 잔치터 -> 모리아 길)
    // 우물(0,0)과 잔치터(6,-5), 모리아 길목(10,-10)을 잇는 길
    const distToTrail1 = Math.abs((z - (-0.8 * x))); // 대각선 길 근사
    const tEdge = Math.min(x + 4, 9 - x, z + 9, 5 - z); // 사각 경계 대신 가장자리에서 서서히 사라지게
    if (tEdge > 0 && distToTrail1 < 2.2 - (1.2 - Math.min(1.2, tEdge)) * 0.8 - valueNoise(x * 0.7, z * 0.7, 335) * 0.5) {
      const nTrail = valueNoise(i / 8, j / 8, 331);
      if (nTrail > 0.3) {
        c = 0xb28c5a;
        if (hash2(i, j, 333) < 0.04) c = 0x8e663a; // 다져진 바퀴자국/발자국
      }
    }

    // 5. 양 우리 안 짚단 얼룩 (동남쪽 x: 7, z: 6)
    const pEdge = Math.min(x - 4.5, 12.5 - x, z - 3.5, 10.5 - z);
    if (pEdge > -0.6) {
      const nPen = fbm(x * 2, z * 2, 341, 2);
      if (nPen > 0.45 + Math.max(0, 1.2 - pEdge) * 0.22) {
        c = 0xd4b868; // 짚 얼룩
      }
    }

    return c;
  });
}

/**
 * 제5권 브엘세바 우물터 3D 복셀 무대
 */
export function buildBeershebaStage(): BeershebaStage {
  const root = new THREE.Group();
  const col = new Collision();
  const vb = new VoxelBuilder(16, false); // TD=16
  const reg = PAL_REGION.SODOM_NEGEV;

  // 1. 브엘세바 원경 지평선 및 고해상도 지면 메쉬
  root.add(buildHorizonPlane(0xe2d0aa, 360, -0.05, 0.2));
  buildFarField(root, BEERSHEBA_HALF, { seed: 11, pal: [0xb48c58, 0xc9a56e, 0xdcbb84, 0xe6cb98], tex: 'dune', accents: [0x9a8660], depth: 40, haze: 0xe2d0aa, ground: 0xc4a470, rim: { min: 2.2, max: 4.2, south: 0.4 }, maxH: 3 });
  root.add(buildBeershebaGroundMesh());

  // 2. 외곽 공허 차단: 부드러운 사막 모래언덕 및 사암 능선 (사방)
  buildPerimeterRidges(vb, col, BEERSHEBA_HALF, [0xcca872, 0xba945e, 0xddb882, 0xa8824e], {
    seed: 501,
    minH: 3.2,
    maxH: 6.2,
    tex: 'dune',
  });

  // 3. 중앙 맹세의 우물 (브엘세바) 및 방사형 디딤돌
  const well = buildWell();
  well.position.set(0, 0, 0);
  col.addBox(0, 0, 2.6, 2.6);
  root.add(well);

  // 우물 좌우 긴 돌 물구유 (양들과 나귀들이 물을 마시는 곳)
  buildTroughLong(vb, col, 0, 2.6, 3.8, 'x');
  buildTroughLong(vb, col, -2.6, 0, 3.4, 'z');

  // 4. 서북쪽 에셀나무 (아브라함이 심고 영원하신 여호와의 이름을 부른 나무)
  // 풍성한 캐노피를 가진 위성류
  const tamarisk = new THREE.Group();
  tamarisk.position.set(-6, 0, -4);
  root.add(tamarisk);

  buildFoliageTree(vb, col, -6, -4, {
    trunkH: 2.8,
    trunkThickness: 0.55,
    rx: 2.5,
    ry: 2.0,
    rz: 2.5,
    foliagePal: [0x506a46, 0x628054, 0x769666, 0x8aab78, 0x9ec08a], // 회록색 에셀 잎
    barkColor: 0x5a4434,
    seed: 812,
  });

  // 에셀나무 아래 기도 바위 단상
  vb.box(-6, 0, -2.2, 1.8, 0.45, 1.4, PAL.stone[3], { tex: 'stone' });
  col.addBox(-6, -2.2, 2.0, 1.6);

  // 5. 북동쪽 이삭 젖 뗀 날 큰 잔치 평상과 연회 장막 (x: 6, z: -5)
  const feastTable = new THREE.Group();
  feastTable.position.set(6, 0, -5);
  root.add(feastTable);

  // 메인 연회 평상 (장목 평상)
  vb.box(6, 0, -5, 5.6, 0.75, 3.2, PAL.wood[2], { tex: 'wood' });
  col.addBox(6, -5, 5.8, 3.4);

  // 평상 위 차양 그늘막 (적/황 스트라이프 천막)
  vb.box(6, 3.0, -5, 6.2, 0.1, 3.8, PAL.fabric.cream, { tex: 'stripeSaffron' });
  // 4모퉁이 목재 지주 기둥
  vb.box(3.2, 0, -6.6, 0.14, 3.0, 0.14, PAL.wood[1], { tex: 'wood' });
  vb.box(8.8, 0, -6.6, 0.14, 3.0, 0.14, PAL.wood[1], { tex: 'wood' });
  vb.box(3.2, 0, -3.4, 0.14, 3.0, 0.14, PAL.wood[1], { tex: 'wood' });
  vb.box(8.8, 0, -3.4, 0.14, 3.0, 0.14, PAL.wood[1], { tex: 'wood' });

  // 잔치 평상 위 음식과 식기
  vb.box(4.2, 0.75, -5, 1.0, 0.35, 0.8, PAL.produce.bread, { tex: 'plain' }); // 큰 빵 덩어리
  vb.box(5.4, 0.75, -5.2, 0.6, 0.45, 0.6, PAL_REGION.EGYPT.gold, { tex: 'metal' }); // 황금 잔
  vb.box(6.2, 0.75, -4.8, 0.5, 0.4, 0.5, PAL_REGION.EGYPT.gold, { tex: 'metal' }); // 황금 잔 2
  vb.box(7.0, 0.75, -5, 0.9, 0.3, 0.9, PAL.produce.pomegranate, { tex: 'plain' }); // 석류와 무화과 접시
  vb.box(7.8, 0.75, -5.2, 0.5, 0.6, 0.5, 0x8a4a2a, { tex: 'plain' }); // 포도주 토기 주전자

  // 잔치 평상 둘레 나무 의자들
  vb.box(6, 0, -3.1, 4.4, 0.45, 0.6, PAL.wood[1], { tex: 'wood' });
  vb.box(6, 0, -6.9, 4.4, 0.45, 0.6, PAL.wood[1], { tex: 'wood' });

  // 6. 아브라함과 사라의 검은 염소털 본 장막 (서남쪽 x: -8, z: 4)
  buildRichNomadTent(vb, col, -8, 4, 6.2, 5.2, 0x5c4838);

  // 종들의 작은 장막 (동북쪽 x: 11, z: -1)
  buildRichNomadTent(vb, col, 11, -1, 4.5, 3.8, 0x6e5844);

  // 7. 아비멜렉과의 화친 언약 증표: 7마리 암양 우리 (동남쪽 x: 7.5, z: 6.5)
  buildFencePen(vb, col, 7.5, 6.5, 6.5, 6.5, 'west');

  // 언약의 암양들
  const sheep1 = new Sheep(6.5, 5.5);
  const sheep2 = new Sheep(8.5, 6.0);
  const sheep3 = new Sheep(7.2, 7.8);
  const sheep4 = new Sheep(9.0, 7.5);
  root.add(sheep1.root, sheep2.root, sheep3.root, sheep4.root);

  // 8. 야외 취사 화덕, 장작더미, 저장 항아리
  P.campfire(vb, col, -4, 2);
  buildSplitWoodBundle(vb, col, -5.2, 0, 2.4, 1.4, 0.8, 0.9);
  buildStoragePropCluster(vb, -9.5, 1.5, 6, 731);
  buildStoragePropCluster(vb, 3.5, -4.5, 4, 732);

  // 9. 모리아 산 출발 길목 (남동쪽 x: 10, z: -10)
  // 사흘 길을 가리키는 돌무더기(Cairn) 이정표
  vb.box(10, 0, -10, 1.4, 1.4, 1.4, PAL.stone[2], { tex: 'stone' });
  vb.box(10, 1.4, -10, 0.9, 0.8, 0.9, PAL.stone[3], { tex: 'stone' });
  vb.box(10, 2.2, -10, 0.5, 0.5, 0.5, PAL.stone[4], { tex: 'stone' });
  col.addBox(10, -10, 1.6, 1.6);

  // 10. 사막 관목 및 풍화된 사암 바위들 (30-60개 소품 충족)
  P.rock(vb, col, -11, 2, 1.6);
  P.rock(vb, col, 12, -8, 1.8);
  P.rock(vb, col, -3, -9, 1.5);
  P.rock(vb, col, 11, 11, 1.7);
  P.rock(vb, col, -12, 10, 1.6);

  P.bush(vb, col, -7, 7, 1.2, PAL.shrub);
  P.bush(vb, col, -4, -8, 1.1, PAL.shrub);
  P.bush(vb, col, 4, -9, 1.0, PAL.shrub);
  P.bush(vb, col, 12, 3, 1.1, PAL.shrub);
  P.bush(vb, col, -12, -3, 1.0, PAL.shrub);

  // 횃불대 2기 (장막 앞, 잔치터 앞)
  buildTorchStand(vb, col, -5.5, 4.2, 2.0);
  buildTorchStand(vb, col, 3.6, -2.8, 2.0);

  scatterGroundCover(vb, col, { seed: 501, half: 18, count: 256, flowers: [0xe8c870,0xd98a50], tufts: [0x8a8a4a,0x9a9250,0x7a7a40], pebbles: [0xb8a078,0xa08a64,0xcdb890] });
  const stageMesh = vb.build();
  root.add(stageMesh);

  col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };

  const update = (_dt: number, _time: number) => {
    // Zero allocation per frame
  };

  return {
    root,
    col,
    bounds: col.bounds,
    well,
    tamarisk,
    feastTable,
    update,
  };
}
