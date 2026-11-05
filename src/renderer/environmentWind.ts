import type { Material } from 'three';
import type { FxLevel } from './fx';

const wind = { uWindTime: { value: 0 }, uWindStrength: { value: 0 } };

export function addFoliageWind(material: Material): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, wind);
    shader.vertexShader =
      'uniform float uWindTime,uWindStrength;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
      #include <begin_vertex>
      if (uWindStrength > 0.0) {
        vec3 windWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float w1 = sin(windWorld.x * 0.6 + windWorld.z * 0.4 + uWindTime * 2.2);
        float w2 = cos(windWorld.x * 0.3 - windWorld.z * 0.5 + uWindTime * 1.5) * 0.5;
        float hFactor = clamp(windWorld.y * 0.3, 0.2, 1.6);
        transformed.x += (w1 + w2) * uWindStrength * hFactor;
        transformed.z += cos(windWorld.z * 0.5 + uWindTime * 1.8) * uWindStrength * 0.6 * hFactor;
      }
    `,
      );
  };
  material.customProgramCacheKey = () => 'foliage-wind-v2';
}

export function updateEnvironmentWind(time: number, rain: number, level: FxLevel): void {
  wind.uWindTime.value = time;
  wind.uWindStrength.value =
    level === 'off' ? 0 : (level === 'high' ? 0.05 : 0.035) * (1 + rain * 0.4);
}

