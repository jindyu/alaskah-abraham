// 소품 모듈 공통: 텍셀 단위·기본 색 상수와 회전된 사각 충돌 헬퍼
import type { Collision } from '../collision';

/** 1텍셀 = 1/16 유닛. 치수는 되도록 이 배수로 잡아 픽셀이 반듯하게 떨어지게 함 */
export const T = 1 / 16;
export const WHITE = 0xffffff;
export const DARK = 0x2a1c14;

/** 로컬(회전 전) 사각형을 월드 충돌에 추가. ry는 90° 단위만 */
export function colLocal(col: Collision, x: number, z: number, ry: number, lx: number, lz: number, w: number, d: number) {
  const c = Math.round(Math.cos(ry)), s = Math.round(Math.sin(ry));
  col.addBoxRot(x + lx * c + lz * s, z - lx * s + lz * c, w, d, ry);
}
