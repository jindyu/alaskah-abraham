import * as THREE from 'three';
import { PAL, PAL_REGION } from '../world/palette';
import type { StageId } from '../world/stageManager';
import { timeOfDayFor } from './timeOfDay';

/** 미니맵 좌하단 지명 라벨 (스테이지별 짧은 이름) */
export const MINIMAP_LABELS: Record<StageId, string> = {
  ur_workshop: '우르',
  ur_palace: '우르 왕궁',
  ur_furnace: '풀무불',
  haran: '하란',
  shechem_bethel: '세겜·벧엘',
  egypt: '애굽',
  siddim_hobah: '싯딤',
  mamre: '마므레',
  sodom: '소돔',
  beersheba: '브엘세바',
  moriah: '모리아',
  hebron_machpelah: '막벨라',
  nahor_well: '나홀',
  esau_camp: '에서 진영',
};

export type Region = 'MESOPOTAMIA' | 'CANAAN' | 'EGYPT' | 'SODOM_NEGEV';

export interface AtmosphereDeps {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  setMinimapLabel: (name: string) => void;
  /** 지금 권 (시간대 프리셋 선택용) */
  currentBook: () => number;
}

/**
 * 무대를 불러올 때 지역 팔레트 기반 하늘·태양·반구광·안개를 맞추고, 책·무대별 시간대 프리셋(timeOfDay.ts)을 덧입힌다.
 * 돌려주는 함수는 스테이지를 불러올 때마다 부른다.
 */
export function createAtmosphere(deps: AtmosphereDeps): (region: Region, stageId: StageId) => void {
  const { scene, sun, hemi, setMinimapLabel, currentBook } = deps;
  return (region, stageId) => {
    setMinimapLabel(MINIMAP_LABELS[stageId] ?? '');
    scene.fog = null; // 선명한 3D 복셀 픽셀 아트를 위해 안개 제거 (소돔 제외)
    switch (region) {
      case 'MESOPOTAMIA':
        scene.background = new THREE.Color(PAL.skyGrad[0]); // 0x8cc8e8 따뜻하고 청명한 푸른 하늘
        sun.color.setHex(0xfff6e4);
        sun.intensity = 2.4;
        hemi.color.setHex(0xfff8f0);
        hemi.groundColor.setHex(0x8a6440);
        hemi.intensity = 1.3;
        break;

      case 'CANAAN':
        scene.background = new THREE.Color(PAL_REGION.CANAAN.sky[1]);
        sun.color.setHex(0xfff2d8);
        sun.intensity = 2.4;
        hemi.color.setHex(0xcfe4f0);
        hemi.groundColor.setHex(0x6f874e);
        hemi.intensity = 1.3;
        break;

      case 'EGYPT':
        scene.background = new THREE.Color(PAL_REGION.EGYPT.sky[1]);
        sun.color.setHex(0xfff8e0);
        sun.intensity = 2.6;
        hemi.color.setHex(0x8ec8e0);
        hemi.groundColor.setHex(0xd8b472);
        hemi.intensity = 1.3;
        break;

      case 'SODOM_NEGEV':
        if (stageId === 'sodom') {
          // 소돔: 종말론적 유황불빛 붉은 안개
          // 소돔: 주황 불빛 + 보랏빛 그림자·하늘로 색을 분리해 한 색조로 뭉개지지 않게 한다
          scene.background = new THREE.Color(0x3c2048);
          scene.fog = new THREE.FogExp2(0x58406a, 0.006);
          sun.color.setHex(0xffa860);
          sun.intensity = 2.5;
          hemi.color.setHex(0xa8b0ec);
          hemi.groundColor.setHex(0x6a4a5c);
          hemi.intensity = 1.6;
        } else {
          // 브엘세바 & 모리아: 메마른 광야 & 장엄한 산지
          scene.background = new THREE.Color(0xa67450);
          sun.color.setHex(0xffe8c0);
          sun.intensity = 2.4;
          hemi.color.setHex(0xe8d0b0);
          hemi.groundColor.setHex(0x9a7452);
          hemi.intensity = 1.3;
        }
        break;
    }

    // 책·무대별 시간대 보정: 같은 무대도 책마다 하늘·조명·그림자 방향이 달라진다
    const tod = timeOfDayFor(currentBook(), stageId);
    if (tod) {
      if (tod.sky !== undefined) scene.background = new THREE.Color(tod.sky);
      sun.color.setHex(tod.sunColor);
      sun.intensity = tod.sunIntensity;
      hemi.color.setHex(tod.hemiColor);
      hemi.groundColor.setHex(tod.hemiGround);
      hemi.intensity = tod.hemiIntensity;
      sun.position.set(tod.sunPos[0], tod.sunPos[1], tod.sunPos[2]);
    } else {
      sun.position.set(-8, 14, 6); // 기본 태양 방향으로 되돌림
    }
  };
}
