import * as THREE from 'three';
import { VoxelBuilder } from '../voxel';
import { PAL, PAL_REGION } from '../palette';

/** 우상 4종 및 파편 빌더 */
export function buildIdols(): {
  smallIdols: THREE.Group[];
  largeIdol: THREE.Group;
  axeMesh: THREE.Group;
  brokenRubble: THREE.Group;
} {
  const smallIdols: THREE.Group[] = [];

  // 1. 작은 나무 우상 (동물 형상)
  const b1 = new VoxelBuilder(9, false);
  b1.box(0, 0.25, 0, 0.4, 0.5, 0.35, 0x6e4a2e, { tex: 'wood' });
  b1.box(0, 0.55, 0, 0.25, 0.3, 0.25, 0x5a3b22, { tex: 'wood' });
  b1.box(0, 0.72, 0, 0.12, 0.15, 0.12, 0xd4af37);
  smallIdols.push(b1.build());

  // 2. 작은 청동 우상 (바알/태양신)
  const b2 = new VoxelBuilder(9, false);
  b2.box(0, 0.3, 0, 0.35, 0.6, 0.3, 0x8c7853, { tex: 'metal' });
  b2.box(0, 0.68, 0, 0.28, 0.28, 0.28, 0xa38c62, { tex: 'metal' });
  b2.box(0, 0.86, 0, 0.45, 0.08, 0.1, 0xcaa668); // 머리 위 뿔/장식
  smallIdols.push(b2.build());

  // 3. 작은 돌 우상 (풍요의 여신)
  const b3 = new VoxelBuilder(9, false);
  b3.box(0, 0.28, 0, 0.45, 0.55, 0.38, PAL.stone[2], { tex: 'stone' });
  b3.box(0, 0.62, 0, 0.3, 0.32, 0.3, PAL.stone[3], { tex: 'stone' });
  smallIdols.push(b3.build());

  // 4. 큰 우상 (중앙 거대 신상)
  const largeGroup = new THREE.Group();
  const bLarge = new VoxelBuilder(9, false);
  // 기단
  bLarge.box(0, 0.4, 0, 1.4, 0.8, 1.2, PAL_REGION.MESOPOTAMIA.brick, { tex: 'brick' });
  // 몸체
  bLarge.box(0, 1.4, 0, 0.9, 1.4, 0.7, 0x685442, { tex: 'stone' });
  // 머리와 투구
  bLarge.box(0, 2.35, 0, 0.65, 0.7, 0.6, 0x7a6652, { tex: 'stone' });
  bLarge.box(0, 2.8, 0, 0.75, 0.35, 0.7, 0xd4af37); // 황금 투구
  // 왼쪽 팔 (가슴에 얹음)
  bLarge.box(-0.55, 1.35, 0.2, 0.25, 0.8, 0.3, 0x685442, { tex: 'stone' });
  // 오른쪽 팔 (도끼를 쥘 수 있게 앞으로 뻗음)
  bLarge.box(0.55, 1.4, 0.3, 0.25, 0.3, 0.7, 0x685442, { tex: 'stone' });
  largeGroup.add(bLarge.build());

  // 도끼 소품 (큰 우상 손에 쥐여줄 수 있음)
  const axeBuilder = new VoxelBuilder(9, false);
  axeBuilder.box(0, 0, 0, 0.08, 0.9, 0.08, 0x4a2e1e);
  axeBuilder.box(0, 0.35, 0.15, 0.1, 0.28, 0.32, 0xa0a8b0, { tex: 'metal' });
  const axeMesh = axeBuilder.build();
  axeMesh.position.set(0.55, 1.4, 0.7);
  axeMesh.rotation.x = Math.PI / 4;
  largeGroup.add(axeMesh);

  // 깨진 우상 파편들
  const rubbleBuilder = new VoxelBuilder(9, false);
  for (let i = 0; i < 8; i++) {
    const rx = (Math.random() - 0.5) * 1.6;
    const rz = (Math.random() - 0.5) * 1.6;
    rubbleBuilder.box(rx, 0.06, rz, 0.2 + Math.random() * 0.2, 0.12, 0.2 + Math.random() * 0.2, PAL.stone[1], { tex: 'stone' });
  }
  const brokenRubble = rubbleBuilder.build();

  return { smallIdols, largeIdol: largeGroup, axeMesh, brokenRubble };
}

/** 우르 풀무불 거대 화로 */
export function buildFurnace(): THREE.Group {
  const grp = new THREE.Group();
  const fb = new VoxelBuilder(9, false);

  // 화로 외벽 (원형 복셀 원통형 탑)
  fb.box(0, 1.5, 0, 4.4, 3.0, 4.4, PAL_REGION.MESOPOTAMIA.brick, { tex: 'brick' });
  // 상부 굴뚝
  fb.box(0, 3.5, 0, 3.0, 1.2, 3.0, 0x4a3222, { tex: 'brick' });
  // 불길이 보이는 전면 입구 개구부
  fb.box(0, 0.9, 2.0, 2.2, 1.8, 0.6, 0x111111);
  // 내부 타오르는 숯과 불길
  fb.box(0, 0.4, 0.5, 3.2, 0.6, 2.8, PAL_REGION.MESOPOTAMIA.furnaceFire, { tex: 'flame' });
  fb.box(0, 0.7, 0.5, 2.2, 0.6, 1.8, 0xffa030, { tex: 'flame' });

  grp.add(fb.build());

  // 화염 점광원
  const fireLight = new THREE.PointLight(0xff7722, 3.5, 16);
  fireLight.position.set(0, 1.2, 2.2);
  grp.add(fireLight);

  return grp;
}

/** 자연석 거친 제단 (세겜, 벧엘, 모리아 번제단) */
export function buildStoneAltar(withWood = true): THREE.Group {
  const ab = new VoxelBuilder(9, false);
  // 하단 주춧돌 4개
  ab.box(-0.6, 0.25, -0.5, 0.7, 0.5, 0.6, PAL.stone[1], { tex: 'stone' });
  ab.box(0.6, 0.25, -0.5, 0.65, 0.5, 0.6, PAL.stone[2], { tex: 'stone' });
  ab.box(-0.55, 0.25, 0.55, 0.6, 0.5, 0.65, PAL.stone[3], { tex: 'stone' });
  ab.box(0.55, 0.25, 0.55, 0.7, 0.5, 0.6, PAL.stone[2], { tex: 'stone' });

  // 중단 평석
  ab.box(0, 0.7, 0, 1.8, 0.45, 1.6, PAL.stone[3], { tex: 'stone' });
  // 상단 번제 제단면
  ab.box(0, 1.05, 0, 1.6, 0.35, 1.4, PAL.stone[2], { tex: 'stone' });

  if (withWood) {
    // 번제 나무 장작 3단 쌓기
    ab.box(0, 1.3, -0.3, 1.4, 0.16, 0.2, 0x6e4628, { tex: 'wood' });
    ab.box(0, 1.3, 0.3, 1.4, 0.16, 0.2, 0x6e4628, { tex: 'wood' });
    ab.box(-0.35, 1.45, 0, 0.2, 0.16, 1.2, 0x5a361c, { tex: 'wood' });
    ab.box(0.35, 1.45, 0, 0.2, 0.16, 1.2, 0x5a361c, { tex: 'wood' });
  }

  return ab.build();
}

/** 사막 유목민 장막 (아브라함, 사라, 롯, 야곱) */
export function buildNomadTent(tentColor: number = PAL_REGION.CANAAN.tentBlack): THREE.Group {
  const tent = new THREE.Group();
  const tb = new VoxelBuilder(9, false);

  // 중심 기둥 2개
  tb.box(-1.6, 1.4, 0, 0.12, 2.8, 0.12, PAL.wood[0], { tex: 'wood' });
  tb.box(1.6, 1.4, 0, 0.12, 2.8, 0.12, PAL.wood[0], { tex: 'wood' });
  // 상부 서까래
  tb.box(0, 2.7, 0, 3.4, 0.12, 0.12, PAL.wood[1], { tex: 'wood' });

  // 장막 지붕 천 (경사면 복셀 박스들)
  tb.box(0, 2.5, 0, 3.6, 0.15, 1.2, tentColor, { tex: 'wool' });
  tb.box(0, 2.1, -0.9, 3.6, 0.15, 1.0, tentColor, { tex: 'wool' });
  tb.box(0, 1.6, -1.6, 3.6, 0.15, 0.9, tentColor, { tex: 'wool' });
  tb.box(0, 2.1, 0.9, 3.6, 0.15, 1.0, tentColor, { tex: 'wool' });
  tb.box(0, 1.6, 1.6, 3.6, 0.15, 0.9, tentColor, { tex: 'wool' });

  // 좌우 옆면 차양 천
  tb.box(-1.8, 1.2, 0, 0.15, 2.0, 2.8, tentColor, { tex: 'wool' });
  tb.box(1.8, 1.2, 0, 0.15, 2.0, 2.8, tentColor, { tex: 'wool' });

  // 장막 안 돗자리 및 토기
  tb.box(0, 0.05, 0, 2.8, 0.08, 2.2, PAL.fabric.cream, { tex: 'fabricCream' });
  tb.box(0.8, 0.25, -0.6, 0.35, 0.45, 0.35, 0xba6a44, { tex: 'soil' });

  tent.add(tb.build());
  return tent;
}

/** 마므레 상수리나무 (거대한 고목) */
export function buildMamreOak(): THREE.Group {
  const ob = new VoxelBuilder(9, false);

  // 거대한 밑동
  ob.box(0, 1.0, 0, 1.4, 2.0, 1.4, PAL_REGION.CANAAN.oakBark, { tex: 'bark' });
  // 가지 뻗음
  ob.box(-0.8, 2.3, 0.4, 0.9, 1.2, 0.9, PAL_REGION.CANAAN.oakBark, { tex: 'bark' });
  ob.box(0.8, 2.4, -0.3, 0.9, 1.3, 0.9, PAL_REGION.CANAAN.oakBark, { tex: 'bark' });
  ob.box(0, 2.8, 0, 1.1, 1.5, 1.1, PAL_REGION.CANAAN.oakBark, { tex: 'bark' });

  // 풍성한 잎사귀 덩어리들
  ob.box(0, 4.2, 0, 4.6, 2.2, 4.6, PAL_REGION.CANAAN.oakLeaf, { tex: 'leafVine' });
  ob.box(-1.4, 3.6, 0.8, 3.2, 1.8, 3.2, PAL.olive[2], { tex: 'leafVine' });
  ob.box(1.4, 3.7, -0.8, 3.2, 1.8, 3.2, PAL.olive[3], { tex: 'leafVine' });
  ob.box(0, 5.2, 0, 3.0, 1.4, 3.0, PAL.olive[4], { tex: 'leafVine' });

  return ob.build();
}

/** 브엘세바 에셀나무 (위성류) */
export function buildTamarisk(): THREE.Group {
  const tb = new VoxelBuilder(9, false);
  tb.box(0, 0.9, 0, 0.6, 1.8, 0.6, 0x5a4838, { tex: 'bark' });
  tb.box(-0.4, 2.0, 0, 0.4, 1.2, 0.4, 0x5a4838, { tex: 'bark' });
  tb.box(0.4, 2.1, 0, 0.4, 1.3, 0.4, 0x5a4838, { tex: 'bark' });

  // 깃털 같은 회록색 잎
  tb.box(0, 3.2, 0, 2.8, 2.0, 2.8, PAL_REGION.SODOM_NEGEV.tamariskLeaf, { tex: 'leafVine' });
  tb.box(-0.7, 3.0, 0.5, 1.8, 1.6, 1.8, PAL.olive[4], { tex: 'leafVine' });
  tb.box(0.7, 3.1, -0.5, 1.8, 1.6, 1.8, PAL.olive[3], { tex: 'leafVine' });
  return tb.build();
}

/** 원형 돌 우물 및 구유 (브엘세바, 나홀 성, 마므레) */
export function buildWell(): THREE.Group {
  const grp = new THREE.Group();
  const wb = new VoxelBuilder(9, false);

  // 원형 돌 둘레
  wb.box(0, 0.45, -0.9, 1.8, 0.9, 0.4, PAL.stone[2], { tex: 'stone' });
  wb.box(0, 0.45, 0.9, 1.8, 0.9, 0.4, PAL.stone[2], { tex: 'stone' });
  wb.box(-0.9, 0.45, 0, 0.4, 0.9, 1.8, PAL.stone[2], { tex: 'stone' });
  wb.box(0.9, 0.45, 0, 0.4, 0.9, 1.8, PAL.stone[2], { tex: 'stone' });

  // 우물 내부 물
  wb.box(0, 0.35, 0, 1.4, 0.2, 1.4, PAL.water[1], { tex: 'water' });

  // 도르래 기둥 2개 및 가로대
  wb.box(-0.9, 1.3, 0, 0.12, 1.6, 0.12, PAL.wood[1], { tex: 'wood' });
  wb.box(0.9, 1.3, 0, 0.12, 1.6, 0.12, PAL.wood[1], { tex: 'wood' });
  wb.box(0, 2.05, 0, 1.9, 0.12, 0.12, PAL.wood[2], { tex: 'wood' });

  // 물 구유 (낙타나 양이 물을 마시는 길쭉한 돌 구유)
  wb.box(1.8, 0.2, 0, 1.4, 0.4, 0.6, PAL.stone[1], { tex: 'stone' });
  wb.box(1.8, 0.3, 0, 1.2, 0.15, 0.45, PAL.water[2], { tex: 'water' });

  grp.add(wb.build());
  return grp;
}

/** 애굽 국경 세관 나무 상자 */
export function buildBorderChest(): THREE.Group {
  const grp = new THREE.Group();
  const cb = new VoxelBuilder(9, false);

  // 나무 궤짝
  cb.box(0, 0.4, 0, 1.2, 0.8, 0.8, 0x6e4628, { tex: 'wood' });
  // 청동 띠 및 자물쇠
  cb.box(0, 0.42, 0, 1.22, 0.1, 0.82, 0x9a8050, { tex: 'metal' });
  cb.box(-0.4, 0.42, 0, 0.08, 0.82, 0.82, 0x9a8050, { tex: 'metal' });
  cb.box(0.4, 0.42, 0, 0.08, 0.82, 0.82, 0x9a8050, { tex: 'metal' });

  grp.add(cb.build());
  return grp;
}

/** 헤브론 막벨라 굴 입구 바위산 */
export function buildMachpelahCave(): THREE.Group {
  const grp = new THREE.Group();
  const mb = new VoxelBuilder(9, false);

  // 거대한 석회암 바위 언덕
  mb.box(0, 2.0, 0, 7.0, 4.0, 5.0, PAL.stone[2], { tex: 'cliff' });
  mb.box(0, 4.2, -0.4, 5.5, 2.0, 4.2, PAL.stone[3], { tex: 'cliff' });

  // 굴 입구 아치 (어두운 내부)
  mb.box(0, 1.2, 2.4, 2.4, 2.4, 0.8, 0x0a0806);
  // 입구를 막는 큰 둥근 돌
  mb.box(1.4, 1.0, 2.6, 1.2, 1.8, 0.7, PAL.stone[1], { tex: 'stone' });

  grp.add(mb.build());
  return grp;
}
