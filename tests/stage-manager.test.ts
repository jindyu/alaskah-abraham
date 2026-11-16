import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { StageManager, type StageId } from '../src/world/stageManager';
import { TravelMap, ANCIENT_WAYPOINTS } from '../src/world/travelMap';
import { Sheep, Camel, Donkey, RamInThicket, KiteBird } from '../src/entities/animals';

describe('Stage 3: StageManager, 지역 팔레트, 성경 소품 및 동물 (Stage & Environment)', () => {
  it('StageManager 가 14개 주요 성경 무대(esau_camp 포함)를 메모리 누수 없이 빌드하고 전환한다', () => {
    const scene = new THREE.Scene();
    const sm = new StageManager(scene);

    const stages: StageId[] = [
      'ur_workshop',
      'ur_palace',
      'ur_furnace',
      'haran',
      'shechem_bethel',
      'egypt',
      'siddim_hobah',
      'mamre',
      'sodom',
      'beersheba',
      'moriah',
      'hebron_machpelah',
      'nahor_well',
      'esau_camp',
    ];

    for (const id of stages) {
      const stage = sm.loadStage(id);
      expect(stage.id).toBe(id);
      expect(stage.root).toBeInstanceOf(THREE.Group);
      expect(stage.spawn).toBeDefined();
      expect(stage.bounds.minX).toBeLessThan(stage.bounds.maxX);
      expect(scene.children).toContain(stage.root);
    }

    // 마지막 무대도 scene에 정상 유지
    expect(sm.stage?.id).toBe('esau_camp');
  }, 30000); // 14개 무대를 모두 짓는 테스트 — 원경 지형이 늘어 기본 5초를 부하 시 넘긴다

  it('모든 StageId(14개 무대, esau_camp 포함)가 빌드되고 지오메트리·머티리얼·텍스처 dispose 가 정상 호출된다', () => {
    const scene = new THREE.Scene();
    const sm = new StageManager(scene);

    const stages: StageId[] = [
      'ur_workshop',
      'ur_palace',
      'ur_furnace',
      'haran',
      'shechem_bethel',
      'egypt',
      'siddim_hobah',
      'mamre',
      'sodom',
      'beersheba',
      'moriah',
      'hebron_machpelah',
      'nahor_well',
      'esau_camp',
    ];

    const geomSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const matSpy = vi.spyOn(THREE.Material.prototype, 'dispose');
    const texSpy = vi.spyOn(THREE.Texture.prototype, 'dispose');

    for (const id of stages) {
      geomSpy.mockClear();
      matSpy.mockClear();

      const stage = sm.loadStage(id);
      expect(stage.id).toBe(id);
      expect(stage.root).toBeInstanceOf(THREE.Group);
      expect(stage.spawn).toBeDefined();
      expect(stage.bounds.minX).toBeLessThan(stage.bounds.maxX);
      expect(scene.children).toContain(stage.root);

      // 무대 전환 및 해제 시 geometry 및 non-shared material 이 해제되는지 검증
      (sm as any).disposeCurrentStage();
      expect(geomSpy).toHaveBeenCalled();
      expect(matSpy).toHaveBeenCalled();
    }

    // 텍스처 dispose 검증: 커스텀 지면 텍스처를 가진 무대(ur_workshop, esau_camp) 해제 시 Texture dispose 호출 확인
    texSpy.mockClear();
    sm.loadStage('ur_workshop');
    (sm as any).disposeCurrentStage();
    expect(texSpy).toHaveBeenCalled();

    texSpy.mockClear();
    sm.loadStage('esau_camp');
    (sm as any).disposeCurrentStage();
    expect(texSpy).toHaveBeenCalled();

    geomSpy.mockRestore();
    matSpy.mockRestore();
    texSpy.mockRestore();
  });

  it('TravelMap 이 고대 근동 거점과 여정 경로를 정상적으로 구성한다', () => {
    const map = new TravelMap();
    expect(map.root).toBeInstanceOf(THREE.Group);
    expect(ANCIENT_WAYPOINTS.length).toBeGreaterThanOrEqual(10);

    // 경로 표시 (우르 -> 하란)
    map.showRoute('ur', 'haran');
    expect(map.root.children.length).toBeGreaterThan(1);

    map.dispose();
  });

  it('성경 동물들(양, 낙타, 나귀, 수풀의 숫양, 솔개)이 정상 생성된다', () => {
    const sheep = new Sheep(0, 0);
    expect(sheep.root).toBeInstanceOf(THREE.Group);
    sheep.update(0.016, 1.0);

    const camelStand = new Camel(0, 0, false);
    const camelKneel = new Camel(0, 0, true);
    expect(camelStand.root).toBeInstanceOf(THREE.Group);
    expect(camelKneel.root).toBeInstanceOf(THREE.Group);
    camelStand.setKneeling(true);

    const donkey = new Donkey(0, 0, true);
    expect(donkey.root).toBeInstanceOf(THREE.Group);

    const ram = new RamInThicket(0, 0);
    expect(ram.root).toBeInstanceOf(THREE.Group);

    const bird = new KiteBird(0, 0);
    expect(bird.root).toBeInstanceOf(THREE.Group);
    bird.update(0.016, 0, 0);
  });
});
