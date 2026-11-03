import type { Material } from 'three';
import type { FxLevel } from './fx';
const wind = { uWindTime: { value: 0 }, uWindStrength: { value: 0 } };
export function addFoliageWind(material: Material): void {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, wind);
    shader.vertexShader = 'uniform float uWindTime,uWindStrength;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      if(uWindStrength>0.0){
      vec3 windWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
      transformed.x+=sin(windWorld.x*0.55+windWorld.z*0.35+uWindTime*0.8)*uWindStrength;
      }
    `);
  };
  material.customProgramCacheKey = () => 'foliage-wind-v1';
}
export function updateEnvironmentWind(time: number, rain: number, level: FxLevel): void {
  wind.uWindTime.value = time;
  wind.uWindStrength.value = level === 'off' || level === 'low' ? 0 : (level === 'high' ? 0.025 : 0.015) * (1 + rain * 0.5);
}
