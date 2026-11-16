import * as THREE from 'three';

export interface GameLights { sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; torchLight: THREE.PointLight }

/** 해(그림자 포함)·반구광·횃불 점광원을 만들어 장면에 단다 */
export function createLights(scene: THREE.Scene): GameLights {
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
  sun.position.set(-8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  const shadowR = 22;
  Object.assign(sun.shadow.camera, { left: -shadowR, right: shadowR, top: shadowR, bottom: -shadowR, near: 1, far: 60 });
  const hemi = new THREE.HemisphereLight(0xcfe4f0, 0x8a6440, 1.1);
  const torchLight = new THREE.PointLight(0xff6611, 0, 16);
  scene.add(sun, sun.target, hemi, torchLight);
  return { sun, hemi, torchLight };
}

/** 횃불·화로 무대의 깜빡임 밝기 (그 밖의 무대는 0) */
export function torchIntensity(stageId: string | null | undefined, nowMs: number): number {
  if (stageId === 'ur_furnace' || stageId === 'sodom') return 1.8 + Math.sin(nowMs * 0.015) * 0.35 + Math.cos(nowMs * 0.031) * 0.2;
  return 0;
}
