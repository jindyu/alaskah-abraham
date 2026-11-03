import * as THREE from 'three';

/**
 * 픽셀 물 셰이더. 월드 좌표를 텍셀 격자(1/16)로 양자화해서
 * 잔물결 띠 · 반짝이는 점 · 하늘 반사 · 빗방울 파문을 계단진 픽셀로 그린다.
 * 얕고 깊은 정도는 정점 색(빌더가 넣음)으로 받는다.
 */
export function createWaterMaterial(hull?: THREE.Vector4) {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: {
      uTime: { value: 0 },
      uSky: { value: new THREE.Color(0.8, 0.9, 1) },
      uLight: { value: new THREE.Color(1, 1, 1) },
      uSparkle: { value: 1 },
      uRain: { value: 0 },
      uHull: { value: hull ?? new THREE.Vector4() },
      uSeaMotion: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vCol;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vCol = color;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSky;
      uniform vec3 uLight;
      uniform float uSparkle;
      uniform float uRain;
      varying vec3 vWorld;
      varying vec3 vCol;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      ${hull ? 'uniform vec4 uHull; uniform float uSeaMotion;' : ''}
      void main() {
        vec2 q = floor(vWorld.xz * 16.0);
        vec3 c = vCol;
        // 느리게 흐르는 잔물결 띠 (밝은 줄 / 어두운 줄)
        float band = sin(q.x * 0.35 + q.y * 0.9 + uTime * 1.6) + sin(q.x * 0.8 - q.y * 0.3 - uTime * 1.1) * 0.6;
        if (band > 1.25) c = mix(c, uSky, 0.45);
        else if (band < -1.35) c *= 0.82;
        // 반짝임: 칸마다 짧게 켜졌다 꺼지는 점
        float t = floor(uTime * 5.0);
        float h = hash(q + vec2(t * 7.0, t * 3.0));
        if (h > 1.0 - 0.0045 * uSparkle) c = mix(c, vec3(1.0), 0.85);
        // 빗방울 파문: 격자 칸마다 퍼지는 고리
        if (uRain > 0.0) {
          vec2 cell = floor(vWorld.xz * 1.5);
          float ph = fract(uTime * 0.9 + hash(cell) * 7.0);
          vec2 ctr = (cell + 0.2 + vec2(hash(cell + 3.1), hash(cell + 5.7)) * 0.6) / 1.5;
          float d = length((q + 0.5) / 16.0 - ctr);
          float ring = abs(d - ph * 0.28);
          if (ring < 0.035 && hash(cell + 9.0) < uRain) c = mix(c, uSky, 0.6 * (1.0 - ph));
        }
        ${hull ? /* glsl */ `
        // Voyage only: quantized swells and hull contact shading.
        vec2 sea=(q+0.5)/16.0;
        float swell=sin(sea.x*0.55+sea.y*0.8-uTime*0.9)
          +sin(sea.x*0.28-sea.y*0.46+uTime*0.65)*0.5;
        c*=1.0+swell*(0.12+0.06*uSeaMotion)*uSeaMotion;
        // Storm only (large uSeaMotion): scattered whitecaps on the swell crests.
        float crest=smoothstep(0.95,1.5,swell)*smoothstep(0.45,1.0,uSeaMotion);
        c=mix(c,uSky,crest*step(0.55,hash(floor(sea*7.0)+floor(uTime*2.0)))*0.55);
        vec2 local=abs(sea-uHull.xy);
        float taper=mix(1.0,0.48,smoothstep(uHull.z*0.65,uHull.z,local.x));
        vec2 edge=local-vec2(uHull.z,uHull.w*taper);
        float distanceToHull=length(max(edge,0.0))+min(max(edge.x,edge.y),0.0);
        float contact=1.0-smoothstep(0.05,0.5,distanceToHull);
        c*=1.0-contact*0.28;
        if(uSeaMotion>0.0){
          float surge=0.18+0.12*sin(sea.x*1.8+sea.y*2.1-uTime*1.9);
          float foam=(1.0-smoothstep(0.04,0.17,abs(distanceToHull-surge)))
            *step(0.34,hash(floor(sea*8.0)+floor(uTime*3.0))) * uSeaMotion;
          c=mix(c,uSky,foam*0.65);
        }
        // Haze merges the distant water into the horizon without hiding the hull.
        float distanceHaze=smoothstep(6.0,18.0,uHull.y-sea.y);
        c=mix(c,uSky*0.78,distanceHaze);
        ` : ''}
        c *= uLight;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
