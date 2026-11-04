import * as THREE from 'three';
import type { Grade } from '../renderer/pixelRenderer';
import { FX_PARAMS, type FxLevel } from '../renderer/fx';
import { createWaterMaterial } from '../renderer/water';
import { getTexture } from '../world/textures';
import { overrideMaterial } from '../world/voxel';
import { sampleInteriorLight, type InteriorLightState } from '../renderer/interiorLight';

/** 광원 자리 (소품이 빌드될 때 등록) */
export interface LampSpot {
  x: number; y: number; z: number; kind: 'torch' | 'fire' | 'window' | 'daylight';
  /** 방 안 광원: 방에 들어와 있을 때만 켜짐 */ indoor?: boolean;
  /** 꺼 두기 (아라랏 제단 불처럼 이야기가 켤 때까지). 광원 수는 그대로, 세기만 0 */ off?: boolean;
  tag?: string;
}
export const LAMPS: LampSpot[] = [];

interface Key {
  h: number;
  sun: number; sunI: number;
  sky: number; ground: number; hemiI: number;
  tint: number; lift: number; sat: number; contrast: number;
  bg: number;
  night: number;
}

/** 시간대 키프레임. 사이 값은 선형 보간 */
const NIGHT: Omit<Key, 'h'> = { sun: 0x000000, sunI: 0, sky: 0x5c6cae, ground: 0x2a2a4c, hemiI: 1.0, tint: 0xa6b6e6, lift: 0x060a20, sat: 0.8, contrast: 1.04, bg: 0x141a34, night: 1 };
const KEYS: Key[] = [
  { h: 0, ...NIGHT },
  { h: 4.8, ...NIGHT, sky: 0x6270b0, tint: 0xacb8e4 },
  { h: 6, sun: 0xffa27c, sunI: 1.3, sky: 0xffc4c8, ground: 0x5a4a78, hemiI: 1.15, tint: 0xffdce4, lift: 0x140a28, sat: 1.0, contrast: 1.03, bg: 0xf0b8b8, night: 0.3 },
  { h: 6.8, sun: 0xffc8a0, sunI: 1.6, sky: 0xffe0d8, ground: 0x60567a, hemiI: 1.15, tint: 0xffece8, lift: 0x080414, sat: 1.0, contrast: 1.01, bg: 0xd8d0e0, night: 0.05 },
  { h: 7.5, sun: 0xffe0b4, sunI: 1.8, sky: 0xfff0dc, ground: 0x6a5a78, hemiI: 1.15, tint: 0xfff6ee, lift: 0x000000, sat: 1.0, contrast: 1.0, bg: 0xb8dce8, night: 0 },
  { h: 12, sun: 0xfff4e2, sunI: 2.2, sky: 0xfff8f0, ground: 0x6a6078, hemiI: 1.25, tint: 0xffffff, lift: 0x000000, sat: 1.04, contrast: 1.0, bg: 0xa8d8e8, night: 0 },
  { h: 16, sun: 0xffe6b8, sunI: 2.1, sky: 0xfff0d8, ground: 0x6a5a78, hemiI: 1.25, tint: 0xfff8ee, lift: 0x000000, sat: 1.05, contrast: 1.0, bg: 0xb0d8e8, night: 0 },
  { h: 18, sun: 0xffc48c, sunI: 1.85, sky: 0xffe2c4, ground: 0x6a5068, hemiI: 1.12, tint: 0xfff0de, lift: 0x040004, sat: 1.02, contrast: 1.01, bg: 0xf0c8a0, night: 0.05 },
  { h: 19.2, sun: 0xff8c64, sunI: 0.7, sky: 0xbc9cc0, ground: 0x3e3860, hemiI: 1.0, tint: 0xe8cadc, lift: 0x0a0820, sat: 0.95, contrast: 1.03, bg: 0x8a6c98, night: 0.55 },
  { h: 20.5, ...NIGHT, sky: 0x6070b0, tint: 0xaab8e6, night: 0.92 },
  { h: 24, ...NIGHT },
];

const tmpA = new THREE.Color(), tmpB = new THREE.Color();
const tmpBounce = new THREE.Vector3(-12, 7, -8);
function lerpHex(a: number, b: number, t: number, out: THREE.Color) {
  tmpA.setHex(a); tmpB.setHex(b);
  return out.copy(tmpA).lerp(tmpB, t);
}

/** 각진 픽셀 후광 텍스처 (가짜 블룸) */
function haloTexture(): THREE.Texture {
  const n = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      // 3단 계단으로 끊어서 픽셀아트 후광처럼
      const a = d < 0.35 ? 0.55 : d < 0.65 ? 0.3 : d < 1 ? 0.12 : 0;
      const i = (y * n + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 190; img.data[i + 2] = 110; img.data[i + 3] = a * 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Lamp { halo: THREE.Sprite; spot: LampSpot; seed: number; x: number; y: number; z: number; level: number; dist: number }
/** 초점에서 가까운 순 (매 프레임 새 클로저를 만들지 않도록 모듈 상수) */
const byDist = (p: Lamp, q: Lamp) => p.dist - q.dist;

/**
 * 점광원은 최대 이만큼만 만든다 (화면 효과 단계가 낮으면 이 가운데 일부만 켬: FX_PARAMS.lights). 등불 자리(마을·방 안·제단 약 26곳) 가운데 켜져 있고 화면 가운데(초점)에
 * 가까운 것부터 매 프레임 이 광원들을 옮겨 씀. 광원 수가 늘 같아서 셰이더를 다시 컴파일하지 않고,
 * three.js가 모든 조각에서 세는 광원도 26개 → 8개로 줄어듦
 */
export const LIGHT_POOL = 8;

export class DayNight {
  readonly sun = new THREE.DirectionalLight(0xffffff, 1);
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  /** 그림자를 추가하지 않는 하늘 반사광. 그늘 쪽 윤곽을 은은하게 분리한다. */
  readonly bounce = new THREE.DirectionalLight(0xc8ddf0, 0.2);
  readonly water = createWaterMaterial();
  readonly glowMat: THREE.MeshLambertMaterial;
  readonly flameMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  readonly skyWindowMat = new THREE.MeshBasicMaterial({ vertexColors: true, map: getTexture('skyWindow') });
  readonly interiorLight: InteriorLightState = { daylight: 0, shaft: 0, warmth: 0, drift: 0 };
  /** 0=한낮 ~ 1=깊은 밤 */
  night = 0;
  /** 비 세기 (날씨 시스템이 설정) */
  rain = 0;
  /** 항해 컷(방주가 물 위에 뜬 원경)인가: 시각·비와 상관없이 선체의 옆면이 읽히는 흐린 낮빛으로 */
  voyage = false;
  /** 방 안에 있는가 (0/1). 해 대신 따뜻한 실내광 */
  indoor = 0;
  private lamps: Lamp[] = [];
  private readonly pool: THREE.PointLight[] = [];
  private readonly order: Lamp[] = [];
  private readonly shadowR = 22;
  /** 지금 그림자 맵 한 변 (화면 효과 단계가 정함. 기본 보통 = 예전 값 2048) */
  private shadowSize = FX_PARAMS.normal.shadow;
  /** 지금 켜 두는 점광원 수 (풀 앞쪽부터) */
  private lightCount = Math.min(LIGHT_POOL, FX_PARAMS.normal.lights);
  /** 그림자 맵을 몇 프레임마다 갱신하나 (1 이면 three 가 매 프레임) */
  private shadowEvery = FX_PARAMS.normal.shadowEvery;
  private shadowTick = 0;
  /** 실내라 해 그림자 맵 갱신을 멈춘 상태인가 (야외로 돌아오는 첫 프레임에 한 번 새로 그리려고 기억) */
  private shadowIdle = false;
  /** 해 그림자를 그리나 (끔 단계에서는 false) */
  private shadowOn: boolean = FX_PARAMS.normal.shadowOn;
  private readonly sunOffset = new THREE.Vector3();
  private readonly snapped = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene, private readonly grade: Grade) {
    // 해와 달은 방향광 하나가 번갈아 맡음 (광원/그림자 수가 바뀌면 셰이더 재컴파일로 끊김이 생김)
    for (const l of [this.sun]) {
      l.castShadow = true;
      l.shadow.mapSize.set(this.shadowSize, this.shadowSize);
      l.shadow.bias = -0.0004;
      l.shadow.normalBias = 0.02;
      const R = this.shadowR;
      Object.assign(l.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 120 });
      scene.add(l, l.target);
    }
    scene.add(this.hemi, this.bounce, this.bounce.target);
    this.glowMat = new THREE.MeshLambertMaterial({
      map: getTexture('glow'), vertexColors: true,
      emissive: new THREE.Color(0xffa850), emissiveMap: getTexture('glow'), emissiveIntensity: 0,
    });
    // 빌더가 이 키들을 만나면 이 재질을 쓰도록 (마을 빌드 전에 호출되어야 함)
    overrideMaterial('water', this.water);
    overrideMaterial('glow', this.glowMat);
    overrideMaterial('flame', this.flameMat);
    overrideMaterial('skyWindow', this.skyWindowMat);
  }

  /** 마을 빌드 후 등록된 광원 자리에 점광원 + 후광 배치 */
  placeLamps() {
    const halo = haloTexture();
    LAMPS.forEach((spot, i) => {
      const fire = spot.kind === 'fire';
      const y = spot.y + (fire ? 1.3 : 0.15);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
      }));
      s.position.set(spot.x, y, spot.z);
      s.scale.setScalar(fire ? 3.2 : spot.indoor || spot.kind === 'window' ? 1.0 : 1.8);
      this.scene.add(s);
      s.visible = spot.kind !== 'daylight';
      this.lamps.push({ halo: s, spot, seed: i * 1.37, x: spot.x, y, z: spot.z, level: 0, dist: 0 });
    });
    for (let i = 0; i < LIGHT_POOL; i++) {
      const light = new THREE.PointLight(0xffb060, 0, 6.5, 1.4);
      light.visible = i < this.lightCount;
      this.pool.push(light);
      this.scene.add(light);
    }
  }

  /**
   * 화면 효과 단계에 맞춰 그림자 맵 크기·갱신 간격·켜 둘 점광원 수를 바꿈 (바뀐 것만 건드림).
   * - 그림자 맵: 크기가 바뀔 때만 이전 것을 dispose 하고 비워 두면 three 가 다음 그리기에서 새로 만듦 (텍스처 샘플러 종류는 같아 재컴파일 없음)
   * - 점광원: 풀 크기는 그대로(8) 두고 visible 만 바꿈. 켜진 광원 수가 바뀌면 three 가 재질을 한 번 다시 컴파일함
   *   (단계를 바꾸는 순간의 한 번뿐. main.ts 가 첫 그리기 전에 부르므로 시작할 때는 추가 컴파일 없음)
   */
  setFx(level: FxLevel) {
    const p = FX_PARAMS[level];
    const n = Math.max(1, Math.min(LIGHT_POOL, p.lights));
    if (n !== this.lightCount) {
      this.lightCount = n;
      for (let i = 0; i < this.pool.length; i++) this.pool[i].visible = i < n;
    }
    const sh = this.sun.shadow;
    sh.radius = p.shadowRadius;
    if (p.shadow !== this.shadowSize) {
      this.shadowSize = p.shadow;
      sh.mapSize.set(p.shadow, p.shadow);
      if (sh.map) {
        sh.map.depthTexture?.dispose();
        sh.map.dispose();
        sh.map = null;
      }
    }
    this.shadowEvery = Math.max(1, Math.round(p.shadowEvery));
    this.shadowOn = p.shadowOn;
    // 그림자 끔: castShadow 를 꺼 그림자 패스·셰이더 샘플링을 모두 건너뜀 (켜짐/꺼짐이 바뀔 때 재질이 한 번 다시 컴파일됨) + 맵 메모리 해제
    if (this.sun.castShadow !== p.shadowOn) {
      this.sun.castShadow = p.shadowOn;
      if (!p.shadowOn && sh.map) {
        sh.map.depthTexture?.dispose();
        sh.map.dispose();
        sh.map = null;
      }
    }
    sh.autoUpdate = p.shadowOn && this.shadowEvery === 1;
    sh.needsUpdate = p.shadowOn;
    this.shadowTick = 0;
  }

  private sample(h: number) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = THREE.MathUtils.clamp((h - a.h) / (b.h - a.h), 0, 1);
    return { a, b, t };
  }

  update(hour: number, focus: THREE.Vector3, time: number, beam?: { strength: number; group: { position: THREE.Vector3 } }) {
    sampleInteriorLight(hour, this.rain, this.interiorLight);
    const daylight = this.interiorLight.daylight;
    const { a, b, t } = this.sample(hour);
    const L = THREE.MathUtils.lerp;
    const rain = this.rain;
    const dim = 1 - rain * 0.45;
    this.night = L(a.night, b.night, t);
    // 비 감쇠 완화: 이미 해가 낮은 새벽·저녁(키프레임 해 세기 ≲ 2)일수록 비 감쇠가 겹쳐 검게 뭉개지므로 줄임. 한낮·밤은 0 이라 그대로 (맑으면 rain=0 이라 전부 무영향)
    const rainSoft = THREE.MathUtils.clamp((2.05 - L(a.sunI, b.sunI, t)) / 0.7, 0, 1) * (1 - this.night);

    // 해: 동쪽(+x)에서 떠서 서쪽으로. 남쪽(+z)에서 비춰 그림자는 화면 위로 떨어짐
    const ang = THREE.MathUtils.clamp((hour - 5.5) / 14, 0, 1) * Math.PI;
    this.sunOffset.set(Math.cos(ang) * 0.85, Math.sin(ang) * 1.1 + 0.25, 0.45).normalize();
    const sunI = L(a.sunI, b.sunI, t) * (1 - rain * (0.6 - rainSoft * 0.25));
    // 달: 밤에만. 푸른빛으로 그림자를 약하게 유지
    const moonI = this.night * 0.9 * dim;
    const useSun = sunI >= moonI;
    if (useSun) lerpHex(a.sun, b.sun, t, this.sun.color);
    else this.sun.color.setHex(0x9ab0ff);
    this.sun.intensity = useSun ? sunI : moonI;
    lerpHex(a.sky, b.sky, t, this.hemi.color);
    lerpHex(a.ground, b.ground, t, this.hemi.groundColor);
    // 평평한 환경광을 살짝 낮춰 해의 방향과 등불 주변의 명암을 읽기 쉽게.
    this.hemi.intensity = L(a.hemiI, b.hemiI, t) * (0.8 - this.night * 0.04) * (1 - rain * (0.2 - rainSoft * 0.12));
    this.bounce.intensity = this.indoor ? 0.08 + daylight * 0.08 : (0.22 * (1 - this.night) + 0.06) * (1 - rain * (0.65 - rainSoft * 0.25));
    if (this.voyage) {
      this.sun.color.setHex(0xdfe6f0);
      this.sun.intensity = 1.9 * (1 - rain * 0.12);
      this.hemi.intensity = Math.max(this.hemi.intensity, 1.25);
      this.bounce.intensity = Math.max(this.bounce.intensity, 0.45);
    }
    this.bounce.target.position.copy(focus);
    this.bounce.position.copy(focus).add(tmpBounce);
    if (rain > 0) this.hemi.color.lerp(tmpA.setHex(0xa8b0c0), rain * 0.5 * (1 - rainSoft * 0.5));

    // 그림자 카메라를 초점 따라 텍셀 스냅
    const texel = (this.shadowR * 2) / this.shadowSize;
    const f = this.snapped.copy(focus);
    f.x = Math.round(f.x / texel) * texel;
    f.z = Math.round(f.z / texel) * texel;
    this.sun.target.position.copy(f);
    if (!useSun) this.sunOffset.set(-0.4, 1, 0.5).normalize();
    // 항해 컷: 카메라는 선체의 옆구리(+z)를 낮게 바라봄 — 해를 앞쪽 위에서 비춰 옆면이 어둡게 가라앉지 않게 함
    if (this.voyage) this.sunOffset.set(-0.25, 0.75, 1).normalize();
    this.sun.position.copy(f).addScaledVector(this.sunOffset, 50);
    // 실내(항해 컷 제외)는 해 세기가 0 이라 그림자가 쓰이지 않음: 맵 갱신만 멈춤 (castShadow 를 끄면 셰이더 재컴파일로 끊기므로 건드리지 않음). 야외로 돌아오는 첫 프레임에 한 번 새로 그림
    const shadowIdle = this.shadowOn && !!this.indoor && !this.voyage;
    const sh = this.sun.shadow;
    if (shadowIdle) sh.autoUpdate = false;
    else if (this.shadowIdle && this.shadowOn) { sh.autoUpdate = this.shadowEvery === 1; sh.needsUpdate = true; }
    this.shadowIdle = shadowIdle;
    // 낮음·끔: 그림자 맵을 N 프레임에 한 번만 다시 그림 (그 사이엔 지난 그림자 유지). 보통은 three 의 매 프레임 갱신 그대로
    if (this.shadowOn && !shadowIdle && this.shadowEvery > 1 && this.shadowTick++ % this.shadowEvery === 0) sh.needsUpdate = true;

    // 색 보정
    const g = this.grade;
    lerpHex(a.tint, b.tint, t, g.tint);
    lerpHex(a.lift, b.lift, t, g.lift);
    g.saturation = L(a.sat, b.sat, t) * (1 - rain * (0.25 - rainSoft * 0.15));
    g.contrast = L(a.contrast, b.contrast, t);
    g.brightness = -rain * 0.03 * (1 - rainSoft);
    g.vignette = 0.22 + this.night * 0.2 + rain * 0.1 * (1 - rainSoft * 0.6);
    if (rain > 0) g.tint.lerp(tmpA.setHex(0xc8d0dc), rain * 0.5 * (1 - rainSoft * 0.5));
    if (this.scene.background instanceof THREE.Color) lerpHex(a.bg, b.bg, t, this.scene.background);

    // 항해 컷은 방주 안에서 시작해 indoor 가 켜진 채로 들어오므로(playRainStops·eve 장면) 실내 조명이 야외 하늘을 덮지 않게 뺌
    if (this.indoor && !this.voyage) {
      // 실내: 해는 끄고 따뜻한 반구광 + 색 보정 고정
      this.sun.intensity = 0;
      this.hemi.color.setHex(0xffebd4).lerp(tmpA.setHex(0xd5e5f0), daylight * 0.7);
      this.hemi.groundColor.setHex(0x6a4c38); this.hemi.intensity = 0.68 + daylight * 0.42;
      g.tint.setHex(0xfff0dc).lerp(tmpA.setHex(0xffffff), daylight * 0.7);
      g.lift.setHex(0x080608); g.saturation = 1.02; g.contrast = 1.03; g.brightness = 0; g.vignette = 0.24 + this.night * .04;
      if (this.scene.background instanceof THREE.Color) this.scene.background.setHex(0x120c08);
    }
    this.skyWindowMat.color.setHex(0x738bb8).multiplyScalar(0.35 + daylight * 0.65)
      .lerp(tmpA.setHex(0xe2edfa), daylight)
      .lerp(tmpB.setHex(0xffd29b), daylight * this.interiorLight.warmth * 0.65);

    // 등불: 해질녘부터 켜지고 흔들림
    const on = THREE.MathUtils.smoothstep(this.night + rain * 0.3, 0.2, 0.6);
    for (const l of this.lamps) {
      const fire = l.spot.kind === 'fire';
      const flick = l.spot.kind === 'window' || l.spot.kind === 'daylight' ? 1 : 0.85 + Math.sin(time * 9 + l.seed) * 0.06 + Math.sin(time * 23.7 + l.seed * 3) * 0.05 + Math.sin(time * 3.1 + l.seed) * 0.04;
      // 모닥불은 낮에도 약하게 켜 둠
      const lvl = l.spot.off ? 0 : l.spot.kind === 'daylight' ? this.indoor * daylight : l.spot.indoor ? this.indoor : this.indoor ? 0 : fire ? Math.max(on, 0.25) : on;
      l.level = (fire ? 16 : l.spot.kind === 'daylight' ? 8 : l.spot.kind === 'window' ? 7 : l.spot.indoor ? 24 * (1 - daylight * 0.22) : 15) * lvl * flick;
      l.dist = (l.x - focus.x) ** 2 + (l.z - focus.z) ** 2;
      (l.halo.material as THREE.SpriteMaterial).opacity = lvl * flick * (fire ? 0.75 : 0.6) * (0.4 + this.night * 0.6);
    }
    // 켜진 등불 가운데 초점에 가까운 것부터 광원 풀에 배정 (나머지 풀 광원은 세기 0)
    this.order.length = 0;
    for (const l of this.lamps) if (l.level > 0) this.order.push(l);
    this.order.sort(byDist);
    // 풀 밖으로 밀려날 등불과 바꿔치기될 때 번쩍이지 않게: 첫 탈락 등불까지 거리 차이가 2유닛 안이면 서서히 줄임
    // 빛기둥도 주변 인물과 돌을 실제로 비춘다. 기존 풀 한 자리를 빌려 광원 수를 유지.
    const beamLevel = this.indoor ? 0 : THREE.MathUtils.clamp(beam?.strength ?? 0, 0, 1);
    const n = this.lightCount - (beamLevel > 0.001 ? 1 : 0);
    const cut = this.order[n];
    const cutD = cut ? Math.sqrt(cut.dist) : Infinity;
    for (let i = 0; i < this.pool.length; i++) {
      const light = this.pool[i];
      const l = i < n ? this.order[i] : undefined;
      if (!l) { light.intensity = 0; continue; }
      const fire = l.spot.kind === 'fire';
      light.position.set(l.x, l.y, l.z);
      light.color.setHex(fire ? 0xff8a3c : l.spot.kind === 'window' ? 0xffd09a : 0xffb060);
      if (l.spot.kind === 'daylight') light.color.copy(this.skyWindowMat.color);
      light.distance = fire ? 10 : l.spot.kind === 'window' ? 4.5 : l.spot.indoor ? 7 : 7.2;
      // 풀의 마지막 두 자리만 서서히 (등불이 몰린 곳에서 가까운 등불까지 어두워지지 않게)
      const edge = i < n - 2 ? 1 : THREE.MathUtils.clamp((cutD - Math.sqrt(l.dist)) / 2, 0, 1);
      light.intensity = l.level * edge;
    }
    if (beam && beamLevel > 0.001) {
      const light = this.pool[n];
      if (light) {
        light.position.copy(beam.group.position); light.position.y += 2.8;
        light.color.setHex(0xffe5ab); light.distance = 11; light.intensity = beamLevel * 10;
      }
    }
    this.glowMat.emissiveIntensity = this.indoor ? 1.1 : on * 1.5;

    // 물: 하늘색 반사 + 밝기
    const wu = this.water.uniforms;
    wu.uTime.value = time;
    wu.uSky.value.copy(this.hemi.color).lerp(tmpA.setHex(0xffffff), 0.3);
    const lightLevel = Math.max(0.28, L(a.hemiI, b.hemiI, t) * 0.62 + L(a.sunI, b.sunI, t) * 0.2) * dim;
    wu.uLight.value.setScalar(Math.min(1.15, lightLevel));
    wu.uSparkle.value = Math.max(0.25, 1 - this.night) * (1 - rain * 0.6);
    wu.uRain.value = rain;
  }
}
