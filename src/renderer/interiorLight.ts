/** 실내 창빛의 시간·날씨 상태. 매 프레임 같은 객체에 채워 할당을 피한다. */
export interface InteriorLightState { daylight: number; shaft: number; warmth: number; drift: number }
const smooth = (x: number, a: number, b: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function sampleInteriorLight(hour: number, rain: number, out: InteriorLightState): void {
  const h = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : 0;
  const wet = Number.isFinite(rain) ? Math.max(0, Math.min(1, rain)) : 0;
  const sun = smooth(h, 5.5, 8) * (1 - smooth(h, 17, 20));
  out.daylight = sun * (1 - wet * 0.65);
  out.shaft = sun * (1 - wet) ** 2;
  out.warmth = Math.min(1, 1 - smooth(h, 7, 11) + smooth(h, 15, 19));
  out.drift = Math.max(-0.55, Math.min(0.55, (h - 12) / 12));
}
