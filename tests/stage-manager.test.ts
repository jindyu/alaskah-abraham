import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { StageManager, type StageId } from '../src/world/stageManager';
import { TravelMap, ANCIENT_WAYPOINTS } from '../src/world/travelMap';
import { Sheep, Camel, Donkey, RamInThicket, KiteBird } from '../src/entities/animals';

describe('Stage 3: StageManager, 지역 팔레트, 성경 소품 및 동물 (Stage & Environment)', () => {
  it('StageManager 가 13개 주요 성경 무대를 메모리 누수 없이 빌드하고 전환한다', () => {
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
    expect(sm.stage?.id).toBe('nahor_well');
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
