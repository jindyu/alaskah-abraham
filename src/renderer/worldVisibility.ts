import * as THREE from 'three';

/** 정적 월드만 공유하는 재질 변형. 인물·짐승의 원래 재질과 그림자 깊이 패스는 유지한다. */
const variants = new WeakMap<THREE.Material, THREE.Material>();
const uniforms = {
  uSightPlayer: { value: new THREE.Vector3() }, uSightTarget: { value: new THREE.Vector3() },
  uSightCamera: { value: new THREE.Vector3() }, uSightOn: { value: 0 },
};
export function prepareOccluders<T extends THREE.Object3D>(root: T): T {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const adapt = (source: THREE.Material): THREE.Material => {
      if (source.userData.sightCutaway || source.transparent || !(source instanceof THREE.MeshStandardMaterial || source instanceof THREE.MeshLambertMaterial)) return source;
      let mat = variants.get(source);
      if (!mat) {
        mat = source.clone(); mat.userData.sightCutaway = true;
        mat.onBeforeCompile = (shader, renderer) => {
          source.onBeforeCompile(shader, renderer);
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = 'varying vec3 vSightWorld;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvSightWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
          shader.fragmentShader = /* glsl */ `
            varying vec3 vSightWorld; uniform vec3 uSightPlayer,uSightTarget,uSightCamera; uniform float uSightOn;
            float sightMask(vec3 focus){
              vec3 ray=uSightCamera-focus; float len=length(ray); vec3 dir=ray/max(len,0.001);
              vec3 p=vSightWorld-focus; float along=dot(p,dir);
              float radial=length(p-dir*along);
              return step(0.65,along)*step(along,len-0.5)*(1.0-smoothstep(0.48,0.88,radial));
            }
          ` + shader.fragmentShader.replace('#include <clipping_planes_fragment>', /* glsl */ `
            #include <clipping_planes_fragment>
            if(uSightOn>0.0){
              float mask=max(sightMask(uSightPlayer),sightMask(uSightTarget))*uSightOn;
              vec2 cell=mod(floor(gl_FragCoord.xy),4.0);
              float dither=mod(cell.x*2.0+cell.y*3.0,4.0)/4.0;
              if(mask>0.05 && dither<mask*0.78) discard;
            }
          `);
        };
        mat.customProgramCacheKey = () => source.customProgramCacheKey() + ':sight-v1';
        variants.set(source, mat);
      }
      return mat;
    };
    node.material = Array.isArray(node.material) ? node.material.map(adapt) : adapt(node.material);
  });
  return root;
}
/** 프레임마다 벡터를 재사용한다. 컷신·창에서는 원래 구도를 그대로 보여준다. */
export function updateWorldVisibility(camera: THREE.Camera, player: THREE.Vector3, target: { x: number; z: number } | null, enabled: boolean): void {
  uniforms.uSightCamera.value.copy(camera.position);
  uniforms.uSightPlayer.value.set(player.x, player.y + 0.85, player.z);
  uniforms.uSightTarget.value.set(target?.x ?? player.x, player.y + 0.65, target?.z ?? player.z);
  uniforms.uSightOn.value = enabled ? 1 : 0;
}
