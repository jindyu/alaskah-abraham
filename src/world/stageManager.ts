import * as THREE from 'three';
import { VoxelBuilder } from './voxel';
import { PAL, PAL_REGION } from './palette';
import {
  buildIdols,
  buildFurnace,
  buildStoneAltar,
  buildNomadTent,
  buildMamreOak,
  buildTamarisk,
  buildWell,
  buildBorderChest,
  buildMachpelahCave,
} from './props/biblicalProps';

import { buildUrStage, type UrStage } from './stages/ur';
import type { Collision } from './collision';

export type StageId =
  | 'ur_workshop'
  | 'ur_palace'
  | 'ur_furnace'
  | 'haran'
  | 'shechem_bethel'
  | 'egypt'
  | 'siddim_hobah'
  | 'mamre'
  | 'sodom'
  | 'beersheba'
  | 'moriah'
  | 'hebron_machpelah'
  | 'nahor_well';

export interface StageInfo {
  id: StageId;
  name: string;
  region: 'MESOPOTAMIA' | 'CANAAN' | 'EGYPT' | 'SODOM_NEGEV';
  spawn: { x: number; z: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  root: THREE.Group;
  bgm: string;
  ambience: string;
  col?: Collision;
  urDetails?: UrStage;
}

export class StageManager {
  private currentStage: StageInfo | null = null;
  readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get stage(): StageInfo | null {
    return this.currentStage;
  }

  loadStage(id: StageId): StageInfo {
    if (this.currentStage) {
      this.disposeCurrentStage();
    }

    const stage = this.buildStage(id);
    this.currentStage = stage;
    this.scene.add(stage.root);
    return stage;
  }

  private disposeCurrentStage(): void {
    if (!this.currentStage) return;
    this.scene.remove(this.currentStage.root);
    this.currentStage.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
      }
    });
    this.currentStage = null;
  }

  private buildStage(id: StageId): StageInfo {
    switch (id) {
      case 'ur_workshop': return this.buildUrWorkshop();
      case 'ur_palace': return this.buildUrPalace();
      case 'ur_furnace': return this.buildUrFurnace();
      case 'haran': return this.buildHaran();
      case 'shechem_bethel': return this.buildShechemBethel();
      case 'egypt': return this.buildEgypt();
      case 'siddim_hobah': return this.buildSiddimHobah();
      case 'mamre': return this.buildMamre();
      case 'sodom': return this.buildSodom();
      case 'beersheba': return this.buildBeersheba();
      case 'moriah': return this.buildMoriah();
      case 'hebron_machpelah': return this.buildHebronMachpelah();
      case 'nahor_well': return this.buildNahorWell();
      default: return this.buildUrWorkshop();
    }
  }

  // ── 1. 우르 데라의 우상 공방 및 시가지 ──
  private buildUrWorkshop(): StageInfo {
    const ur = buildUrStage();
    return {
      id: 'ur_workshop',
      name: '우르 데라의 우상 공방 및 시가지',
      region: 'MESOPOTAMIA',
      spawn: ur.spawn,
      bounds: ur.bounds,
      root: ur.root,
      col: ur.col,
      urDetails: ur,
      bgm: 'bgm_nimrod_empire',
      ambience: 'amb_palace',
    };
  }

  // ── 2. 우르 니므롯 궁정 ──
  private buildUrPalace(): StageInfo {
    const root = new THREE.Group();
    const pb = new VoxelBuilder(9, false);
    const reg = PAL_REGION.MESOPOTAMIA;

    pb.box(0, -0.25, 0, 26, 0.5, 26, 0x4a3222, { tex: 'brick' });
    // 이슈타르 청유리 기둥 4쌍
    for (let z = -8; z <= 6; z += 4.5) {
      pb.box(-5, 2.2, z, 0.9, 4.4, 0.9, reg.ishtarBlue, { tex: 'stone' });
      pb.box(5, 2.2, z, 0.9, 4.4, 0.9, reg.ishtarBlue, { tex: 'stone' });
    }
    // 니므롯 왕좌 단
    pb.box(0, 0.6, -9, 4.4, 1.2, 3.0, 0xd4a024);
    pb.box(0, 1.6, -9.8, 2.4, 2.0, 0.8, 0x8a2018);

    root.add(pb.build());

    return {
      id: 'ur_palace',
      name: '우르 니므롯 왕궁',
      region: 'MESOPOTAMIA',
      spawn: { x: 0, z: 4 },
      bounds: { minX: -7, maxX: 7, minZ: -9, maxZ: 9 },
      root,
      bgm: 'bgm_nimrod_empire',
      ambience: 'amb_palace',
    };
  }

  // ── 3. 우르 풀무불 광장 ──
  private buildUrFurnace(): StageInfo {
    const root = new THREE.Group();
    const fb = new VoxelBuilder(9, false);

    fb.box(0, -0.25, 0, 28, 0.5, 28, 0x5a4232, { tex: 'soil' });
    // 관람 석조 난간
    fb.box(0, 0.45, 6, 20, 0.9, 0.6, PAL.stone[2], { tex: 'stone' });
    root.add(fb.build());

    // 거대 화로 중앙 배치
    const furnace = buildFurnace();
    furnace.position.set(0, 0, -4);
    root.add(furnace);

    return {
      id: 'ur_furnace',
      name: '우르 풀무불 광장',
      region: 'MESOPOTAMIA',
      spawn: { x: 0, z: 4 },
      bounds: { minX: -9, maxX: 9, minZ: -8, maxZ: 9 },
      root,
      bgm: 'bgm_judgment_fire',
      ambience: 'amb_cave',
    };
  }

  // ── 4. 하란 정착 캠프 ──
  private buildHaran(): StageInfo {
    const root = new THREE.Group();
    const hb = new VoxelBuilder(9, false);

    hb.box(0, -0.25, 0, 26, 0.5, 26, PAL_REGION.MESOPOTAMIA.ground, { tex: 'soil' });
    root.add(hb.build());

    const tent1 = buildNomadTent(PAL.fabric.redDark);
    tent1.position.set(-4, 0, -3);
    const tent2 = buildNomadTent(PAL_REGION.CANAAN.tentBlack);
    tent2.position.set(4, 0, -2);
    root.add(tent1, tent2);

    return {
      id: 'haran',
      name: '하란 캠프',
      region: 'MESOPOTAMIA',
      spawn: { x: 0, z: 3 },
      bounds: { minX: -9, maxX: 9, minZ: -9, maxZ: 9 },
      root,
      bgm: 'bgm_lament',
      ambience: 'amb_night',
    };
  }

  // ── 5. 세겜 & 벧엘 상수리나무 언덕 ──
  private buildShechemBethel(): StageInfo {
    const root = new THREE.Group();
    const sb = new VoxelBuilder(9, false);

    sb.box(0, -0.25, 0, 28, 0.5, 28, PAL_REGION.CANAAN.ground, { tex: 'soil' });
    // 벧엘 언덕 전망대
    sb.box(6, 0.8, -6, 10, 1.6, 10, PAL.stone[3], { tex: 'cliff' });
    root.add(sb.build());

    // 첫 제단
    const altar = buildStoneAltar(true);
    altar.position.set(0, 0, -2);
    root.add(altar);

    // 상수리나무
    const oak = buildMamreOak();
    oak.position.set(-5, 0, -4);
    root.add(oak);

    return {
      id: 'shechem_bethel',
      name: '세겜과 벧엘 언덕',
      region: 'CANAAN',
      spawn: { x: 0, z: 4 },
      bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
      root,
      bgm: 'bgm_covenant_stars',
      ambience: 'amb_wind',
    };
  }

  // ── 6. 애굽 국경 및 바로 궁정 ──
  private buildEgypt(): StageInfo {
    const root = new THREE.Group();
    const eb = new VoxelBuilder(9, false);
    const reg = PAL_REGION.EGYPT;

    eb.box(0, -0.25, 0, 26, 0.5, 26, reg.sand, { tex: 'plain' });
    // 나일강 수로
    eb.box(-9, -0.05, 0, 4, 0.3, 26, reg.nileWater, { tex: 'water' });
    // 애굽 국경 관문 기둥들
    eb.box(2, 2.0, -6, 1.2, 4.0, 1.2, reg.sandstonePillar, { tex: 'stone' });
    eb.box(7, 2.0, -6, 1.2, 4.0, 1.2, reg.sandstonePillar, { tex: 'stone' });
    root.add(eb.build());

    // 세관 상자
    const chest = buildBorderChest();
    chest.position.set(4.5, 0, -6);
    root.add(chest);

    return {
      id: 'egypt',
      name: '애굽 국경과 궁정',
      region: 'EGYPT',
      spawn: { x: 0, z: 2 },
      bounds: { minX: -7, maxX: 10, minZ: -8, maxZ: 8 },
      root,
      bgm: 'bgm_shadow_intrigue',
      ambience: 'amb_wind',
    };
  }

  // ── 7. 싯딤 골짜기 및 호바 ──
  private buildSiddimHobah(): StageInfo {
    const root = new THREE.Group();
    const wb = new VoxelBuilder(9, false);

    wb.box(0, -0.25, 0, 30, 0.5, 30, PAL_REGION.SODOM_NEGEV.canyonRed, { tex: 'soil' });
    // 골짜기 협곡 바위들
    wb.box(-11, 2.2, 0, 6, 4.4, 30, PAL.stone[1], { tex: 'cliff' });
    wb.box(11, 2.2, 0, 6, 4.4, 30, PAL.stone[1], { tex: 'cliff' });
    root.add(wb.build());

    return {
      id: 'siddim_hobah',
      name: '싯딤 골짜기 전장',
      region: 'SODOM_NEGEV',
      spawn: { x: 0, z: 5 },
      bounds: { minX: -7, maxX: 7, minZ: -10, maxZ: 10 },
      root,
      bgm: 'bgm_battle_deliverance',
      ambience: 'amb_wind',
    };
  }

  // ── 8. 마므레 상수리나무 ──
  private buildMamre(): StageInfo {
    const root = new THREE.Group();
    const mb = new VoxelBuilder(9, false);

    mb.box(0, -0.25, 0, 28, 0.5, 28, PAL_REGION.CANAAN.ground, { tex: 'soil' });
    // 식사 대접 야외 평상
    mb.box(2, 0.3, 0, 2.0, 0.6, 1.4, PAL.wood[2], { tex: 'wood' });
    root.add(mb.build());

    // 마므레 상수리나무
    const oak = buildMamreOak();
    oak.position.set(0, 0, -2);
    root.add(oak);

    // 아브라함과 사라의 장막
    const tent = buildNomadTent(PAL_REGION.CANAAN.tentBlack);
    tent.position.set(-6, 0, 2);
    root.add(tent);

    // 우물
    const well = buildWell();
    well.position.set(6, 0, 4);
    root.add(well);

    return {
      id: 'mamre',
      name: '마므레 상수리나무 장막',
      region: 'CANAAN',
      spawn: { x: 1, z: 3 },
      bounds: { minX: -9, maxX: 9, minZ: -9, maxZ: 9 },
      root,
      bgm: 'bgm_family_warmth',
      ambience: 'amb_pastoral',
    };
  }

  // ── 9. 소돔 성문 및 거리 ──
  private buildSodom(): StageInfo {
    const root = new THREE.Group();
    const sb = new VoxelBuilder(9, false);

    sb.box(0, -0.25, 0, 26, 0.5, 26, PAL_REGION.SODOM_NEGEV.canyonRed, { tex: 'soil' });
    // 소돔 성벽과 성문
    sb.box(-6, 2.5, -8, 8, 5.0, 1.4, PAL.stone[2], { tex: 'brick' });
    sb.box(6, 2.5, -8, 8, 5.0, 1.4, PAL.stone[2], { tex: 'brick' });
    sb.box(0, 4.2, -8, 4, 1.6, 1.4, PAL.stone[2], { tex: 'brick' }); // 성문 아치

    // 소금 기둥 받침대
    sb.box(7, 0.4, 5, 1.2, 0.8, 1.2, PAL.stone[1]);
    // 회백색 소금 기둥
    sb.box(7, 1.6, 5, 0.5, 1.6, 0.5, PAL_REGION.SODOM_NEGEV.saltPillar);

    root.add(sb.build());

    return {
      id: 'sodom',
      name: '소돔 성문과 거리',
      region: 'SODOM_NEGEV',
      spawn: { x: 0, z: 2 },
      bounds: { minX: -8, maxX: 8, minZ: -7, maxZ: 8 },
      root,
      bgm: 'bgm_danger_pursuit',
      ambience: 'amb_cave',
    };
  }

  // ── 10. 브엘세바 우물터 ──
  private buildBeersheba(): StageInfo {
    const root = new THREE.Group();
    const bb = new VoxelBuilder(9, false);

    bb.box(0, -0.25, 0, 26, 0.5, 26, PAL_REGION.SODOM_NEGEV.desertSand, { tex: 'plain' });
    root.add(bb.build());

    // 브엘세바 우물
    const well = buildWell();
    well.position.set(0, 0, 0);
    root.add(well);

    // 에셀나무
    const tamarisk = buildTamarisk();
    tamarisk.position.set(-5, 0, -3);
    root.add(tamarisk);

    // 암양 우리 울타리
    const fenceBuilder = new VoxelBuilder(9, false);
    fenceBuilder.box(5, 0.4, -2, 4, 0.8, 0.2, PAL.wood[1], { tex: 'wood' });
    fenceBuilder.box(5, 0.4, 2, 4, 0.8, 0.2, PAL.wood[1], { tex: 'wood' });
    fenceBuilder.box(7, 0.4, 0, 0.2, 0.8, 4, PAL.wood[1], { tex: 'wood' });
    root.add(fenceBuilder.build());

    return {
      id: 'beersheba',
      name: '브엘세바 우물터',
      region: 'SODOM_NEGEV',
      spawn: { x: 0, z: 4 },
      bounds: { minX: -9, maxX: 9, minZ: -9, maxZ: 9 },
      root,
      bgm: 'bgm_feast_celebration',
      ambience: 'amb_wind',
    };
  }

  // ── 11. 모리아 산 정상 및 번제단 ──
  private buildMoriah(): StageInfo {
    const root = new THREE.Group();
    const mb = new VoxelBuilder(9, false);

    // 산봉우리 암반 기단
    mb.box(0, -0.5, 0, 24, 1.0, 24, PAL.stone[2], { tex: 'cliff' });
    mb.box(0, 0.5, 0, 16, 1.0, 16, PAL.stone[3], { tex: 'cliff' });
    root.add(mb.build());

    // 번제단
    const altar = buildStoneAltar(true);
    altar.position.set(0, 1.0, 0);
    root.add(altar);

    return {
      id: 'moriah',
      name: '모리아 산 정상',
      region: 'SODOM_NEGEV',
      spawn: { x: 0, z: 6 },
      bounds: { minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
      root,
      bgm: 'bgm_sacred_trial',
      ambience: 'amb_wind',
    };
  }

  // ── 12. 헤브론 막벨라 굴 ──
  private buildHebronMachpelah(): StageInfo {
    const root = new THREE.Group();
    const hb = new VoxelBuilder(9, false);

    hb.box(0, -0.25, 0, 26, 0.5, 26, PAL_REGION.CANAAN.ground, { tex: 'soil' });
    root.add(hb.build());

    // 막벨라 굴 입구
    const cave = buildMachpelahCave();
    cave.position.set(0, 0, -6);
    root.add(cave);

    return {
      id: 'hebron_machpelah',
      name: '헤브론 막벨라 굴',
      region: 'CANAAN',
      spawn: { x: 0, z: 4 },
      bounds: { minX: -9, maxX: 9, minZ: -8, maxZ: 8 },
      root,
      bgm: 'bgm_hope_legacy',
      ambience: 'amb_pastoral',
    };
  }

  // ── 13. 나홀의 성 우물가 ──
  private buildNahorWell(): StageInfo {
    const root = new THREE.Group();
    const nb = new VoxelBuilder(9, false);

    nb.box(0, -0.25, 0, 26, 0.5, 26, PAL_REGION.MESOPOTAMIA.ground, { tex: 'soil' });
    root.add(nb.build());

    const well = buildWell();
    well.position.set(0, 0, 0);
    root.add(well);

    return {
      id: 'nahor_well',
      name: '나홀의 성 우물가',
      region: 'MESOPOTAMIA',
      spawn: { x: 0, z: 4 },
      bounds: { minX: -9, maxX: 9, minZ: -9, maxZ: 9 },
      root,
      bgm: 'bgm_nomad_journey',
      ambience: 'amb_wind',
    };
  }
}
