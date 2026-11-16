import type { Hud } from './hud';
import { centerY } from './pixelText';
import { INK, OUTLINE, PAPER } from './theme';

/**
 * 월드 위에 떠 있는 하트(쓰다듬기)와 말풍선(동료 양 "음메~")을 갱신하고 그린다 (hud.ts 에서 분리).
 * 하트는 프롬프트 위에 그려서 가려지지 않게 하고, 말풍선은 상호작용 안내 상자와 겹치면 그 위로 비킨다.
 */
export function drawHeartsAndSpeech(hud: Hud, dt: number): void {
  const g = hud.ctx;
    // ── 하트 (쓰다듬기) — 프롬프트 위에 그려서 가려지지 않게 ──
    { const hs = hud.hearts; let j = 0; for (let i = 0; i < hs.length; i++) { const h = hs[i]; h.age += dt; if (h.age < 1.1) hs[j++] = h; } hs.length = j; }
    for (const h of hud.hearts) {
      const p = hud.project(h.x, h.y, h.z);
      hud.heartIcon(Math.round(p.x) - 3, Math.round(p.y - 6 - Math.floor(h.age * 18)), h.age > 0.8);
    }

    // ── 말풍선 (동료 양 "음메~") ──
    { const sp = hud.speech; let j = 0; for (let i = 0; i < sp.length; i++) { const s = sp[i]; s.age += dt; if (s.age < s.delay + s.life) sp[j++] = s; } sp.length = j; }
    for (const s0 of hud.speech) {
      if (s0.age < s0.delay) continue; // 앞 줄이 끝난 뒤에 뜨는 말풍선
      const sp = s0, age = s0.age - s0.delay;
      const at = sp.follow ? sp.follow() : sp;
      const p = hud.project(at.x, sp.y, at.z);
      const t = hud.txt(sp.text, 11, INK);
      const w = Math.ceil(hud.tw(t)) + 10, h = 17 + hud.grow(11);
      const x = Math.round(p.x - w / 2);
      let y = Math.round(p.y - h - 4 - Math.min(3, Math.floor(age * 10)));
      // 상호작용 안내 상자와 겹치면 그 위로 비킴 (꼬리는 말하는 이를 가리키지 못하니 생략)
      const pr = hud.promptRect as { x: number; y: number; w: number; h: number } | null; // 위에서 null 로 비웠다가 prompt() 가 채우므로 TS 좁힘을 풂
      const dodge = !!pr && x < pr.x + pr.w && x + w > pr.x && y < pr.y + pr.h && y + h + 3 > pr.y;
      if (dodge && pr) y = Math.max(4, pr.y - h - 3);
      g.globalAlpha = age > sp.life - 0.3 ? 0.5 : 1;
      const bf = hud.frame(x, y, w, h);
      hud.fillIn(OUTLINE, bf, 1, 0, 1, 0); hud.fillIn(OUTLINE, bf, 0, 1, 0, 1);
      hud.fillIn(PAPER, bf, 1, 1, 1, 1);
      g.fillStyle = OUTLINE;
      if (!dodge) { g.fillRect(Math.round(p.x) - 1, y + h, 3, 1); g.fillRect(Math.round(p.x), y + h + 1, 1, 2); }
      hud.put(t, x + 5, centerY(t, y + 2, y + h - 3));
      g.globalAlpha = 1;
    }
}
