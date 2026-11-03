import * as THREE from 'three';
import { GlContextWatch, GraphicsInitError } from '../game/fatal';
import { FX_PARAMS, type FxLevel } from './fx';
import { DEFAULT_TARGET_H, DESIGN_VIEW_UNITS, framingForWidth, pickViewport, viewHalfExtent } from './viewport';

/** URL 값을 범위 안으로 (잘못된 ?h=·?view= 로 렌더 크기가 0·무한이 되지 않게) */
const urlNum = (key: string, def: number, lo: number, hi: number) => {
  const n = Number(new URLSearchParams(location.search).get(key));
  return Number.isFinite(n) && n !== 0 ? Math.min(hi, Math.max(lo, n)) : def;
};
/** 목표 내부 세로 해상도. 창 크기에 맞춰 정수 배율을 고르고 가로는 창을 채움 */
export const TARGET_H = urlNum('h', DEFAULT_TARGET_H, 180, 2160);
/** 창 크기 변경이 멈춘 뒤 화면을 다시 맞추기까지 기다리는 시간(ms) */
const RESIZE_SETTLE_MS = 100;
/** 화면 세로에 보이는 월드 범위(유닛). ?view= 로 비교 가능. PPU 는 이것과 내부 세로에서 정해짐 (renderer/viewport.ts) */
export const VIEW_UNITS = urlNum('view', DESIGN_VIEW_UNITS, 4, 40);
/** 평소 카메라 기울기 (도). 컷신에서만 setTilt로 낮춰 하늘·원경을 보여줌 */
export const BASE_TILT = 50;
/** 카메라 가까운·먼 면. 윤곽선 깊이 문턱이 이 범위를 쓴다 */
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 260;

/** 색 보정 파라미터 (낮밤/날씨가 매 프레임 채움) */
export interface Grade {
  tint: THREE.Color;
  /** 어두운 영역에 더해지는 색 (밤의 푸른 그림자) */
  lift: THREE.Color;
  saturation: number;
  contrast: number;
  brightness: number;
  vignette: number;
}

const GRADE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec3 uTint;
uniform vec3 uLift;
uniform float uSat;
uniform float uContrast;
uniform float uBright;
uniform float uVignette;
uniform vec2 uRes;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uTilt;
uniform float uFocus;
uniform sampler2D tDepth;
uniform float uOutline;
uniform float uDepthStep;
varying vec2 vUv;
void main() {
  vec4 src = texture2D(tScene, vUv);
  // 윤곽선: 이웃보다 깊이가 크게 더 먼 픽셀(= 물체 바로 바깥)만 어둡게. 직교 카메라라 깊이가 선형
  if (uOutline > 0.0) {
    vec2 ot = 1.0 / uRes;
    float d0 = texture2D(tDepth, vUv).r;
    float near = max(max(d0 - texture2D(tDepth, vUv + vec2(ot.x, 0.0)).r, d0 - texture2D(tDepth, vUv - vec2(ot.x, 0.0)).r),
                     max(d0 - texture2D(tDepth, vUv + vec2(0.0, ot.y)).r, d0 - texture2D(tDepth, vUv - vec2(0.0, ot.y)).r));
    src.rgb *= 1.0 - uOutline * step(uDepthStep, near) * step(d0, 0.9999);
  }
  // 틸트 시프트: 초점 띠(화면 세로 uFocus 근처) 밖은 정수 텍셀 간격으로 흐림 → 픽셀 격자가 깨지지 않음
  float away = smoothstep(0.22, 0.65, abs(vUv.y - uFocus)) * uTilt;
  float rad = floor(away * 2.5 + 0.5);
  if (rad > 0.5) {
    vec2 o = rad / uRes;
    vec2 d = o * 0.7071;
    vec4 acc = src * 2.0;
    acc += texture2D(tScene, vUv + vec2(o.x, 0.0)) + texture2D(tScene, vUv - vec2(o.x, 0.0));
    acc += texture2D(tScene, vUv + vec2(0.0, o.y)) + texture2D(tScene, vUv - vec2(0.0, o.y));
    acc += texture2D(tScene, vUv + d) + texture2D(tScene, vUv - d);
    acc += texture2D(tScene, vUv + vec2(d.x, -d.y)) + texture2D(tScene, vUv + vec2(-d.x, d.y));
    src = acc / 10.0;
  }
  if (uBloom > 0.0) src.rgb += texture2D(tBloom, vUv).rgb * uBloom;
  // HDR 하이라이트만 부드럽게 압축. 채널별 클리핑으로 창빛·밝은 돌의 색이 사라지지 않게.
  float peak = max(src.r, max(src.g, src.b));
  if (peak > 0.8) src.rgb *= (0.8 + 0.2 * (1.0 - exp(-(peak - 0.8) / 0.2))) / peak;
  // 감마 공간에서 보정해야 톤이 직관적으로 움직임
  vec3 c = linearToOutputTexel(src).rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(lum), c, uSat);
  c = (c - 0.5) * uContrast + 0.5 + uBright;
  // 밝은 픽셀(불꽃·창문)과 붉은빛이 강한 픽셀(등불에 비친 곳)은 밤 틴트에서 보호 → 따뜻한 빛이 살아남음
  float keep = max(smoothstep(0.55, 0.95, lum), smoothstep(0.08, 0.3, c.r - c.b));
  c = mix(c * uTint, c, keep);
  c += uLift * (1.0 - smoothstep(0.0, 0.7, lum)) * (1.0 - keep);
  // 픽셀 단위로 계단진 비네트
  vec2 p = (floor(vUv * uRes) + 0.5) / uRes - 0.5;
  p.x *= uRes.x / uRes.y;
  float v = smoothstep(0.45, 1.05, length(p));
  c *= 1.0 - v * uVignette;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  // 1/4 해상도로 줄이며 밝은 부분만 뽑음 (불꽃·등불·빛기둥)
  vec3 a = texture2D(tScene, vUv + uTexel * vec2(-1.5, -1.5)).rgb;
  vec3 b = texture2D(tScene, vUv + uTexel * vec2(1.5, -1.5)).rgb;
  vec3 c = texture2D(tScene, vUv + uTexel * vec2(-1.5, 1.5)).rgb;
  vec3 d = texture2D(tScene, vUv + uTexel * vec2(1.5, 1.5)).rgb;
  // 축소 전에 추출: 작은 불꽃이 주변 어두운 픽셀과 섞여 사라지지 않게.
  // HDR 문턱은 유지해 한낮의 흰 벽이 화면 전체를 흐리지 않게 한다.
  a *= smoothstep(0.85, 1.4, max(a.r, max(a.g, a.b)));
  b *= smoothstep(0.85, 1.4, max(b.r, max(b.g, b.b)));
  c *= smoothstep(0.85, 1.4, max(c.r, max(c.g, c.b)));
  d *= smoothstep(0.85, 1.4, max(d.r, max(d.g, d.b)));
  gl_FragColor = vec4((a + b + c + d) * 0.25, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.227027;
  c += (texture2D(tSrc, vUv + uDir * 1.3846).rgb + texture2D(tSrc, vUv - uDir * 1.3846).rgb) * 0.316216;
  c += (texture2D(tSrc, vUv + uDir * 3.2308).rgb + texture2D(tSrc, vUv - uDir * 3.2308).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`;

const FULLSCREEN_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

/** 저해상도 렌더 + 픽셀 스냅 카메라 + 색 보정 (+ 선택: 블룸·틸트 시프트) */
export class PixelRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly grade: Grade = {
    tint: new THREE.Color(1, 1, 1), lift: new THREE.Color(0, 0, 0),
    saturation: 1, contrast: 1, brightness: 0, vignette: 0.25,
  };
  /** 현재 내부 해상도 (HUD가 같은 격자에 그리도록 공개). ppu: 월드 1유닛 = 텍셀 수 (세로가 VIEW_UNITS 유닛이 되게 고름) */
  readonly size = { w: 1, h: 1, scale: 1, ppu: 49 };
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3(1, 0, 0);
  private readonly followTmp = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  tilt = BASE_TILT;
  private framing = 1;
  private interiorPresentation = false;
  private presentationRain = 0;
  private readonly dist = 60;
  private rt: THREE.WebGLRenderTarget;
  /** 블룸용 1/4 해상도 타깃 둘 (밝은 곳 추출 → 가로·세로 흐림) */
  private bloomA!: THREE.WebGLRenderTarget;
  private bloomB!: THREE.WebGLRenderTarget;
  private brightMat!: THREE.ShaderMaterial;
  private blurMat!: THREE.ShaderMaterial;
  private postMesh!: THREE.Mesh;
  private fxLevel: FxLevel = 'normal';
  private fxBloom = 0;
  private fxTilt = 0;
  private fxOutline = 0;
  private readonly focusTmp = new THREE.Vector3();
  private readonly postScene = new THREE.Scene();
  private readonly postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly postMat: THREE.ShaderMaterial;
  private readonly onResize: (() => void)[] = [];
  /** 컨텍스트 손실·복구 감시 (잃은 동안 render 를 건너뜀) */
  readonly gl: GlContextWatch;
  /** 컨텍스트가 돌아왔는데 렌더 타깃을 다시 만들지 못했을 때 (main.ts 가 새로 고침 안내를 띄움) */
  onRestoreFailed: ((err: unknown) => void) | null = null;

  /** WebGL 을 못 만들거나 초기화가 실패하면 만든 것을 치우고 GraphicsInitError 를 던짐 (main.ts 가 안내 화면을 띄움) */
  constructor(parent: HTMLElement) {
    let created: THREE.WebGLRenderer | undefined;
    try {
      // stencil: 플레이어 외곽선(entities/player.ts 의 stencilWrite)이 메인 타깃의 스텐실을 씀 → 유지
      this.renderer = created = new THREE.WebGLRenderer({ antialias: false, stencil: true });
      this.renderer.setPixelRatio(1);
      // 한 프레임에 render 를 여러 번 부르므로(장면 + 후처리) 통계는 프레임 시작에 직접 비움
      this.renderer.info.autoReset = false;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      parent.appendChild(this.renderer.domElement);

      // 블룸이 1 을 넘는 밝기(HDR)를 쓰려고 HalfFloat. 그 타깃에 그릴 수 있는 확장이 없는 기기는 8비트로 폴백(블룸만 약해짐)
      const ext = this.renderer.extensions;
      const hdrType = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
      this.rt = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        depthBuffer: true, stencilBuffer: true, type: hdrType,
        // 윤곽선용 깊이 읽기. 스텐실(플레이어 외곽선)을 유지하려고 깊이+스텐실 형식
        depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedInt248Type, undefined, undefined, undefined, undefined, undefined, undefined, THREE.DepthStencilFormat),
      });
      this.postMat = new THREE.ShaderMaterial({
        uniforms: {
          tScene: { value: this.rt.texture },
          uTint: { value: this.grade.tint }, uLift: { value: this.grade.lift },
          uSat: { value: 1 }, uContrast: { value: 1 }, uBright: { value: 0 }, uVignette: { value: 0.25 },
          uRes: { value: new THREE.Vector2(1, 1) },
          tBloom: { value: null }, uBloom: { value: 0 }, uTilt: { value: 0 }, uFocus: { value: 0.5 },
          tDepth: { value: this.rt.depthTexture }, uOutline: { value: 0 }, uDepthStep: { value: 0.6 / (CAMERA_FAR - CAMERA_NEAR) },
        },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: GRADE_FRAG,
        depthTest: false, depthWrite: false,
      });
      this.postMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
      this.postScene.add(this.postMesh);
      const bloomOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, type: hdrType };
      this.bloomA = new THREE.WebGLRenderTarget(1, 1, bloomOpts);
      this.bloomB = new THREE.WebGLRenderTarget(1, 1, bloomOpts);
      this.postMat.uniforms.tBloom.value = this.bloomA.texture;
      const fsq = { vertexShader: FULLSCREEN_VERT, depthTest: false, depthWrite: false };
      this.brightMat = new THREE.ShaderMaterial({ ...fsq, fragmentShader: BRIGHT_FRAG, uniforms: { tScene: { value: this.rt.texture }, uTexel: { value: new THREE.Vector2(1, 1) } } });
      this.blurMat = new THREE.ShaderMaterial({ ...fsq, fragmentShader: BLUR_FRAG, uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } } });

      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, CAMERA_NEAR, CAMERA_FAR);
      this.setTilt(BASE_TILT);
      // 창 크기를 끌어 바꾸는 동안 이벤트가 프레임마다 쏟아지는데, fit 은 렌더 타깃을 다시 만들어 무거움 → 멈춘 뒤 한 번만
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      window.addEventListener('resize', () => {
        if (resizeTimer !== null) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { resizeTimer = null; this.fit(); }, RESIZE_SETTLE_MS);
      });
      this.fit();
      this.gl = new GlContextWatch(this.renderer.domElement, () => this.restoreTargets(), (e) => this.onRestoreFailed?.(e));
    } catch (err) {
      try { created?.domElement.remove(); created?.dispose(); } catch { /* 치우다 실패해도 원인을 그대로 알림 */ }
      throw new GraphicsInitError(err);
    }
  }

  /**
   * 컨텍스트가 돌아온 뒤: three 가 자기 상태를 다시 만든 다음, 렌더 타깃(HalfFloat)·색 보정 셰이더를 GPU 에 다시 올리게 함.
   * 지오메트리·캔버스 텍스처는 CPU 쪽 데이터가 있어 다음 그리기에서 저절로 다시 올라감
   */
  private restoreTargets() {
    this.rt.dispose(); this.bloomA.dispose(); this.bloomB.dispose();
    this.postMat.needsUpdate = true; this.brightMat.needsUpdate = true; this.blurMat.needsUpdate = true;
    this.fit();
  }

  /** 내부 해상도가 바뀔 때 호출 (HUD 캔버스 크기 맞춤용) */
  resized(fn: () => void) {
    this.onResize.push(fn);
    fn();
  }

  /** 정수 배율·PPU 를 고르고, 창을 꽉 채우도록 내부 해상도·카메라 절두체를 갱신 */
  private fit() {
    const vp = pickViewport(innerWidth, innerHeight, TARGET_H, VIEW_UNITS);
    const { w, h, scale } = vp;
    Object.assign(this.size, vp);
    this.renderer.setSize(w, h, false);
    this.rt.setSize(w, h);
    const bw = Math.max(1, Math.ceil(w / 4)), bh = Math.max(1, Math.ceil(h / 4));
    this.bloomA.setSize(bw, bh); this.bloomB.setSize(bw, bh);
    this.brightMat.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.postMat.uniforms.uRes.value.set(w, h);
    const c = this.renderer.domElement;
    c.style.width = `${w * scale}px`;
    c.style.height = `${h * scale}px`;
    // 항해 전경의 최소 가로 폭(fitWidth)은 CameraRig 가 매 프레임 setFraming 으로 새 폭에 다시 맞춘다
    this.applyFrustum();
    for (const fn of this.onResize) fn();
  }

  private applyFrustum() {
    const { halfW, halfH } = viewHalfExtent(this.size, this.framing);
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.camera.updateProjectionMatrix();
  }

  /** 정수 배율 확대 (커스터마이징 미리보기 등). 정수라 픽셀이 반듯하게 유지됨 */
  setZoom(z: number) {
    this.camera.zoom = Math.max(1, Math.round(z));
    this.camera.updateProjectionMatrix();
  }

  /** 지금 카메라가 평소보다 얼마나 넓게 보는가 (1 = 평소) */
  get viewFraming() { return this.framing; }

  /** 컷신의 넓은 구도. 렌더 타깃 재할당 없이 절두체와 픽셀 스냅만 함께 바꾼다. */
  setFraming(value: number, fitWidth = 0) {
    // 세로 화면에서도 항해 전경의 방주 전체를 보여 준다. 평소 배율은 기존 범위를 유지한다.
    const next = Math.max(THREE.MathUtils.clamp(value, 1, fitWidth > 0 ? 8 : 4), framingForWidth(this.size, fitWidth));
    if (next === this.framing) return;
    this.framing = next;
    this.applyFrustum();
  }

  /** 카메라 기울기 (도, 수평=0). 낮을수록 하늘과 먼 산이 보임 */
  setTilt(deg: number) {
    this.tilt = deg;
    const t = THREE.MathUtils.degToRad(deg);
    this.forward.set(0, -Math.sin(t), -Math.cos(t));
    this.up.set(0, Math.cos(t), -Math.sin(t));
  }

  /** 대상 위치를 카메라 평면 기준 텍셀 격자에 스냅해서 흔들림 제거 */
  follow(target: THREE.Vector3) {
    const ppu = this.size.ppu * this.camera.zoom / this.framing;
    const x = Math.round(target.dot(this.right) * ppu) / ppu;
    const y = Math.round(target.dot(this.up) * ppu) / ppu;
    const z = target.dot(this.forward);
    const focus = this.followTmp.copy(this.right).multiplyScalar(x)
      .addScaledVector(this.up, y)
      .addScaledVector(this.forward, z);
    // 넓은 세로 전경에서는 화면 아래의 광선도 수면 위에서 시작해야 한다.
    // 직교 투영의 구도는 유지하면서 가까운 절단면이 전경을 잘라내지 않게 물러난다.
    const halfH = (this.camera.top - this.camera.bottom) / (2 * this.camera.zoom);
    const dist = Math.max(this.dist, halfH * Math.max(0, this.up.y) / Math.max(.1, -this.forward.y) + 10);
    const far = Math.max(260, dist + 100);
    if (this.camera.far !== far) { this.camera.far = far; this.camera.updateProjectionMatrix(); }
    this.camera.position.copy(focus).addScaledVector(this.forward, -dist);
    this.camera.lookAt(focus);
    // 틸트 시프트의 초점 띠가 화면에서 따라가는 지점의 세로 위치(0~1)
    this.camera.updateMatrixWorld();
    this.postMat.uniforms.uFocus.value = this.focusTmp.copy(target).project(this.camera).y * 0.5 + 0.5;
  }

  /** 화면 효과 단계를 바꿈 (끔·낮음·보통·높음). 바로 다음 프레임부터 적용 */
  setFx(level: FxLevel) {
    this.fxLevel = level;
    this.fxBloom = FX_PARAMS[level].bloom;
    this.fxTilt = FX_PARAMS[level].tilt;
    this.fxOutline = FX_PARAMS[level].outline;
  }
  get fx(): FxLevel { return this.fxLevel; }

  applyTint(r: number, g: number, b: number, _a = 0.3) {
    this.grade.tint.setRGB(r, g, b);
  }

  applyTintPreset(preset: 'none' | 'night' | 'fire' | 'sulfur' | 'dusk' | 'water') {
    switch (preset) {
      case 'night':
        this.grade.tint.setRGB(0.35, 0.45, 0.75);
        this.grade.saturation = 0.75;
        break;
      case 'fire':
        this.grade.tint.setRGB(1.0, 0.55, 0.25);
        this.grade.saturation = 1.3;
        break;
      case 'sulfur':
        this.grade.tint.setRGB(0.9, 0.8, 0.25);
        this.grade.saturation = 1.2;
        break;
      case 'dusk':
        this.grade.tint.setRGB(0.9, 0.55, 0.55);
        this.grade.saturation = 1.0;
        break;
      case 'water':
        this.grade.tint.setRGB(0.4, 0.7, 0.9);
        this.grade.saturation = 1.0;
        break;
      case 'none':
      default:
        this.grade.tint.setRGB(1, 1, 1);
        this.grade.saturation = 1.0;
        break;
    }
  }

  toVista() {
    this.setTilt(4);
    this.setFraming(2.5);
  }

  resetTilt() {
    this.setTilt(BASE_TILT);
    this.setFraming(1.0);
  }

  shake(intensity = 0.3, duration = 0.4) {
    const origX = this.camera.position.x;
    const origZ = this.camera.position.z;
    let t = 0;
    const shakeTimer = setInterval(() => {
      t += 0.03;
      const decay = Math.max(0, 1 - t / duration);
      this.camera.position.x = origX + (Math.random() - 0.5) * intensity * decay;
      this.camera.position.z = origZ + (Math.random() - 0.5) * intensity * decay;
      if (t >= duration) {
        clearInterval(shakeTimer);
        this.camera.position.x = origX;
        this.camera.position.z = origZ;
      }
    }, 30);
  }

  /** 실내는 우리와 바닥까지 선명하게, 비 오는 화면은 후광을 줄여 윤곽을 유지한다. */
  setScenePresentation(indoor: boolean, rain: number) {
    this.interiorPresentation = indoor;
    this.presentationRain = Math.max(0, Math.min(1, rain));
  }

  /** 디버그용: 마지막 프레임의 그리기 호출·삼각형 수와 GPU 에 올라가 있는 지오메트리·텍스처 수 */
  renderStats() {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures };
  }

  render() {
    if (this.gl.lost || this.gl.failed) return;
    const u = this.postMat.uniforms, g = this.grade;
    this.renderer.info.reset();
    u.uSat.value = g.saturation;
    u.uContrast.value = g.contrast;
    u.uBright.value = g.brightness;
    u.uVignette.value = g.vignette;
    // 카메라를 눕힌 컷신(하늘이 보임)에서는 흐림을 줄임
    u.uTilt.value = this.fxTilt * Math.min(1, Math.max(0, (this.tilt - 30) / (BASE_TILT - 30)))
      * (this.interiorPresentation ? .22 : 1) / Math.sqrt(this.framing);
    u.uBloom.value = this.fxBloom * (this.interiorPresentation ? .72 : 1 - this.presentationRain * .22);
    // 실내 연출·컷신(카메라를 눕힘)에서는 윤곽을 줄임
    u.uOutline.value = this.fxOutline * (this.interiorPresentation ? 0.7 : 1) * Math.min(1, Math.max(0, (this.tilt - 30) / (BASE_TILT - 30)));
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    if (this.fxBloom > 0) this.renderBloom();
    this.renderer.setRenderTarget(null);
    this.postMesh.material = this.postMat;
    this.renderer.render(this.postScene, this.postCam);
  }

  /** 밝은 곳만 뽑아 1/4 해상도에서 가로·세로로 흐림 (결과는 bloomA) */
  private renderBloom() {
    const r = this.renderer, m = this.postMesh;
    m.material = this.brightMat;
    r.setRenderTarget(this.bloomA); r.render(this.postScene, this.postCam);
    const bw = this.bloomA.width, bh = this.bloomA.height;
    m.material = this.blurMat;
    this.blurMat.uniforms.tSrc.value = this.bloomA.texture; this.blurMat.uniforms.uDir.value.set(1 / bw, 0);
    r.setRenderTarget(this.bloomB); r.render(this.postScene, this.postCam);
    this.blurMat.uniforms.tSrc.value = this.bloomB.texture; this.blurMat.uniforms.uDir.value.set(0, 1 / bh);
    r.setRenderTarget(this.bloomA); r.render(this.postScene, this.postCam);
  }
}
