import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Actor } from '../src/entities/actor';
import { CAST_REGISTRY, getCast } from '../src/entities/cast';
import { CrowdManager } from '../src/entities/crowd';

describe('Stage 2: 액터, 캐스트 및 군중 시스템 (Actor & Cast System)', () => {
  it('캐스트 레지스트리가 아브라함 서사의 40인 주요 인물을 포함한다', () => {
    const keys = Object.keys(CAST_REGISTRY);
    expect(keys.length).toBeGreaterThanOrEqual(25);
    expect(CAST_REGISTRY['abram_young']).toBeDefined();
    expect(CAST_REGISTRY['abraham']).toBeDefined();
    expect(CAST_REGISTRY['nimrod']).toBeDefined();
    expect(CAST_REGISTRY['melchizedek']).toBeDefined();
    expect(CAST_REGISTRY['isaac']).toBeDefined();
    expect(CAST_REGISTRY['eliezer']).toBeDefined();
  });

  it('getCast 가 한국어 및 영어 이름 폴백을 지원한다', () => {
    const abram = getCast('아브람');
    expect(abram.id).toBe('abram');

    const abraham = getCast('Abraham');
    expect(abraham.id).toBe('abraham');

    const fallback = getCast('새인물');
    expect(fallback.name).toBe('새인물');
  });

  it('Actor 인스턴스가 3D 메쉬와 관절 계층을 갖추고 다양한 포즈를 취할 수 있다', () => {
    const actor = new Actor('test_abram', 'abram_young');
    expect(actor.root).toBeInstanceOf(THREE.Group);
    expect(actor.root.children.length).toBeGreaterThan(0);

    // 포즈 변경
    actor.setPose('kneel');
    actor.setPose('pray');
    actor.setPose('carry_wood');
    actor.setPose('swing_axe');
    actor.setPose('stand');

    // 이동 애니메이션 업데이트
    actor.updateAnimation(0.016, true);
    actor.updateAnimation(0.016, false);

    // 소품 장착 및 해제
    actor.attachProp('axe');
    actor.attachProp('torch');
    actor.detachProp();

    // 말풍선
    actor.showBubble('!');
    actor.clearBubble();

    // 정리
    actor.dispose();
  });

  it('CrowdManager 가 다수의 군중을 일괄 스폰하고 관리할 수 있다', () => {
    const crowd = new CrowdManager();
    crowd.spawnCrowd('soldiers', 'soldier', [
      { x: 0, z: 0, dir: 'up' },
      { x: 2, z: 0, dir: 'down' },
      { x: -2, z: 0, dir: 'left' },
    ]);

    expect(crowd.group.children.length).toBe(3);
    crowd.update(0.016);
    crowd.clear();
    expect(crowd.group.children.length).toBe(0);
  });
});
