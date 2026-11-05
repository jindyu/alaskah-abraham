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
import { buildUrFurnaceStage, type FurnaceStage } from './stages/furnace';
import { buildUrPalaceStage, type UrPalaceStage } from './stages/urPalace';
import { buildEsauCampStage, type EsauCampStage } from './stages/esauCamp';
import { buildShechemBethelStage, type ShechemBethelStage } from './stages/shechemBethel';
import { buildEgyptStage, type EgyptStage } from './stages/egypt';
import { buildSiddimHobahStage, type SiddimHobahStage } from './stages/siddimHobah';
import { buildMamreStage, type MamreStage } from './stages/mamre';
import { buildSodomStage, type SodomStage } from './stages/sodom';
import { buildBeershebaStage, type BeershebaStage } from './stages/beersheba';
import { buildMoriahStage, type MoriahStage } from './stages/moriah';
import { buildHebronMachpelahStage, type HebronMachpelahStage } from './stages/hebronMachpelah';
import { buildNahorWellStage, type NahorWellStage } from './stages/nahorWell';
import { Collision } from './collision';
import * as P from './props';
import { Camel, Sheep } from '../entities/animals';

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
  | 'nahor_well'
  | 'esau_camp';

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
  furnaceDetails?: FurnaceStage;
  palaceDetails?: UrPalaceStage;
  esauCampDetails?: EsauCampStage;
  shechemDetails?: ShechemBethelStage;
  egyptDetails?: EgyptStage;
  siddimDetails?: SiddimHobahStage;
  mamreDetails?: MamreStage;
  sodomDetails?: SodomStage;
  beershebaDetails?: BeershebaStage;
  moriahDetails?: MoriahStage;
  machpelahDetails?: HebronMachpelahStage;
  nahorWellDetails?: NahorWellStage;
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

  update(dt: number, time: number): void {
    if (this.currentStage?.palaceDetails) {
      this.currentStage.palaceDetails.updateAnimations(dt, time);
    }
    if (this.currentStage?.esauCampDetails) {
      this.currentStage.esauCampDetails.updateAnimations(dt, time);
    }
    if (this.currentStage?.shechemDetails) {
      this.currentStage.shechemDetails.update(dt, time);
    }
    if (this.currentStage?.egyptDetails) {
      this.currentStage.egyptDetails.update(dt, time);
    }
    if (this.currentStage?.siddimDetails) {
      this.currentStage.siddimDetails.update(dt, time);
    }
    if (this.currentStage?.mamreDetails) {
      this.currentStage.mamreDetails.update(dt, time);
    }
    if (this.currentStage?.sodomDetails) {
      this.currentStage.sodomDetails.update(dt, time);
    }
    if (this.currentStage?.beershebaDetails) {
      this.currentStage.beershebaDetails.update(dt, time);
    }
    if (this.currentStage?.moriahDetails) {
      this.currentStage.moriahDetails.update(dt, time);
    }
    if (this.currentStage?.machpelahDetails) {
      this.currentStage.machpelahDetails.update(dt, time);
    }
    if (this.currentStage?.nahorWellDetails) {
      this.currentStage.nahorWellDetails.update(dt, time);
    }
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
      case 'esau_camp': return this.buildEsauCamp();
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

  // ── 2. 우르 니므롯 궁정 (고밀도 복셀 왕궁) ──
  private buildUrPalace(): StageInfo {
    const p = buildUrPalaceStage();
    return {
      id: 'ur_palace',
      name: '우르 니므롯 왕궁',
      region: 'MESOPOTAMIA',
      spawn: p.spawn,
      bounds: p.bounds,
      root: p.root,
      col: p.col,
      palaceDetails: p,
      bgm: 'bgm_nimrod_empire',
      ambience: 'amb_palace',
    };
  }

  // ── 3. 가나안 헤브론 장막 (붉은 팥죽 코다) ──
  private buildEsauCamp(): StageInfo {
    const c = buildEsauCampStage();
    return {
      id: 'esau_camp',
      name: '가나안 헤브론 장막 (붉은 팥죽)',
      region: 'CANAAN',
      spawn: c.spawn,
      bounds: c.bounds,
      root: c.root,
      col: c.col,
      esauCampDetails: c,
      bgm: 'bgm_covenant_stars',
      ambience: 'amb_field',
    };
  }

  // ── 3. 우르 풀무불 광장 ──
  private buildUrFurnace(): StageInfo {
    const f = buildUrFurnaceStage();
    return {
      id: 'ur_furnace',
      name: '우르 풀무불 광장',
      region: 'MESOPOTAMIA',
      spawn: f.spawn,
      bounds: f.bounds,
      root: f.root,
      col: f.col,
      furnaceDetails: f,
      bgm: 'bgm_judgment_fire',
      ambience: 'amb_cave',
    };
  }

  // ── 4. 하란 정착 캠프 ──
  private buildHaran(): StageInfo {
    const root = new THREE.Group();
    const col = new Collision();
    col.bounds = { minX: -16, maxX: 16, minZ: -16, maxZ: 16 };
    const hb = new VoxelBuilder(9, false);

    // 하란 오아시스 지면
    hb.box(0, -0.25, 0, 36, 0.5, 36, PAL_REGION.MESOPOTAMIA.ground, { tex: 'soil' });
    // 작은 오아시스 초목과 물가
    hb.box(6, 0.02, -5, 6, 0.05, 5, PAL.grass[2], { tex: 'grassTop' });
    hb.box(6, 0.03, -5, 4, 0.06, 3, PAL.water[1], { tex: 'water' });

    // 야외 모닥불
    P.campfire(hb, col, 0, 0);

    // 오아시스 종려나무와 덤불
    P.palmTree(hb, col, 7.5, -3.0);
    P.palmTree(hb, col, 5.0, -7.0);
    P.bush(hb, col, -6.0, 4.0, 0.9);

    root.add(hb.build());

    // 장막 2채 (아브람/사래 장막 및 데라의 장막)
    const tent1 = buildNomadTent(PAL.fabric.redDark);
    tent1.position.set(-4.5, 0, -3.5);
    const tent2 = buildNomadTent(PAL_REGION.CANAAN.tentBlack);
    tent2.position.set(4.0, 0, 2.5);
    root.add(tent1, tent2);

    // 쉬고 있는 낙타와 양
    const camel = new Camel(6.5, 4.5, true);
    camel.root.rotation.y = -Math.PI * 0.3;
    const sheep = new Sheep(-5.0, 3.0);
    root.add(camel.root, sheep.root);

    return {
      id: 'haran',
      name: '하란 오아시스 캠프',
      region: 'MESOPOTAMIA',
      spawn: { x: 0, z: 3 },
      bounds: col.bounds,
      root,
      col,
      bgm: 'bgm_lament',
      ambience: 'amb_night',
    };
  }

  // ── 5. 세겜 & 벧엘 상수리나무 언덕 ──
  private buildShechemBethel(): StageInfo {
    const details = buildShechemBethelStage();
    return {
      id: 'shechem_bethel',
      name: '세겜과 벧엘 언덕',
      region: 'CANAAN',
      spawn: { x: 0, z: 4 },
      bounds: details.bounds,
      root: details.root,
      col: details.col,
      bgm: 'bgm_peaceful',
      ambience: 'amb_field_day',
      shechemDetails: details,
    };
  }

  // ── 6. 애굽 국경 및 바로 궁정 ──
  private buildEgypt(): StageInfo {
    const details = buildEgyptStage();
    return {
      id: 'egypt',
      name: '애굽 국경과 궁정',
      region: 'EGYPT',
      spawn: { x: 0, z: 2 },
      bounds: details.bounds,
      root: details.root,
      col: details.col,
      bgm: 'bgm_shadow_intrigue',
      ambience: 'amb_river',
      egyptDetails: details,
    };
  }

  // ── 7. 싯딤 골짜기 및 호바 ──
  private buildSiddimHobah(): StageInfo {
    const details = buildSiddimHobahStage();
    return {
      id: 'siddim_hobah',
      name: '싯딤 골짜기 전장',
      region: 'SODOM_NEGEV',
      spawn: { x: 0, z: 5 },
      bounds: details.bounds,
      root: details.root,
      col: details.col,
      bgm: 'bgm_battle_deliverance',
      ambience: 'amb_battlefield',
      siddimDetails: details,
    };
  }

  // ── 8. 마므레 상수리나무 ──
  private buildMamre(): StageInfo {
    const details = buildMamreStage();
    return {
      id: 'mamre',
      name: '마므레 상수리나무 장막',
      region: 'CANAAN',
      spawn: { x: 1, z: 3 },
      bounds: details.bounds,
      root: details.root,
      col: details.col,
      bgm: 'bgm_pastoral_home',
      ambience: 'amb_field_day',
      mamreDetails: details,
    };
  }

  // ── 9. 소돔 성문 및 거리 ──
  private buildSodom(): StageInfo {
    const details = buildSodomStage();
    return {
      id: 'sodom',
      name: '소돔 성문과 거리',
      region: 'SODOM_NEGEV',
      spawn: { x: 0, z: 2 },
      bounds: details.bounds,
      root: details.root,
      col: details.col,
      bgm: 'bgm_danger_pursuit',
      ambience: 'amb_fire_aftermath',
      sodomDetails: details,
    };
  }

  // ── 10. 브엘세바 우물터 ──
  private buildBeersheba(): StageInfo {
    const details = buildBeershebaStage();
    return {
      id: 'beersheba',
      name: '브엘세바 우물터',
      region: 'SODOM_NEGEV',
      spawn: { x: 0, z: 4 },
      bounds: details.bounds,
      root: details.root,
      col: details.col,
      bgm: 'bgm_feast_celebration',
      ambience: 'amb_well',
      beershebaDetails: details,
    };
  }

  // ── 11. 모리아 산 정상 및 번제단 ──
  private buildMoriah(): StageInfo {
    const details = buildMoriahStage();
    return {
      id: 'moriah',
      name: '모리아 산 정상',
      region: 'SODOM_NEGEV',
      spawn: { x: 0, z: 8 },
      bounds: details.bounds,
      root: details.root,
      col: details.col,
      bgm: 'bgm_sacred_trial',
      ambience: 'amb_field_night',
      moriahDetails: details,
    };
  }

  // ── 12. 헤브론 막벨라 굴 ──
  private buildHebronMachpelah(): StageInfo {
    const details = buildHebronMachpelahStage();
    return {
      id: 'hebron_machpelah',
      name: '헤브론 막벨라 굴',
      region: 'CANAAN',
      spawn: { x: -4, z: 5 },
      bounds: details.bounds,
      root: details.root,
      col: details.col,
      bgm: 'bgm_hope_legacy',
      ambience: 'amb_cave',
      machpelahDetails: details,
    };
  }

  // ── 13. 나홀의 성 우물가 ──
  private buildNahorWell(): StageInfo {
    const details = buildNahorWellStage();
    return {
      id: 'nahor_well',
      name: '나홀의 성 우물가',
      region: 'MESOPOTAMIA',
      spawn: { x: 0, z: 4 },
      bounds: details.bounds,
      root: details.root,
      col: details.col,
      bgm: 'bgm_nomad_journey',
      ambience: 'amb_well',
      nahorWellDetails: details,
    };
  }
}
