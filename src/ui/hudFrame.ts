import { centerY } from './pixelText';
import { INK } from './theme';
import { drawChapterSelect, drawPauseMenu, drawHelp, drawCodex } from './hudMenus';
import { drawCinematicTitle, drawDialogue, drawDialoguePanel, drawChoicePanel, drawCaption } from './hudDialogue';
import { textPolicyFor, textStep } from './textSize';
import { advanceOnboard, markOnboardSeen } from './onboarding';
import { drawOnboarding, goalPanel, toastsTop, drawBanner, prompt as drawPrompt, drawMinimap } from './hudPanels';
import { drawHeartsAndSpeech } from './hudWorld';
import type { Hud } from './hud';
import type { Prompt } from './hudTypes';

/** 터치 기기 왼쪽 위 도움말 DOM 단추의 폭 (CSS px, 안전 영역 여백 안쪽부터. 알림이 그 오른쪽부터 시작) */
const TOUCH_GUIDE_BTN_CSS = 124;
/** 상호작용 프롬프트 키캡 옆에 'Space' 도 같은 행동임을 덧붙이는 처음 몇 번 (그 뒤엔 E 만 보임) */
const SPACE_HINT_PROMPTS = 5;

/** 화면 가장자리를 은은하게 어둡게. 그라디언트는 크기가 바뀔 때만 다시 만든다 (hud.vignette* 가 캐시) */
function drawVignette(hud: Hud): void {
  const g = hud.ctx;
  if (!hud.vignette || hud.vignetteW !== hud.w || hud.vignetteH !== hud.h) {
    const r = Math.hypot(hud.w, hud.h) / 2;
    const gr = g.createRadialGradient(hud.w / 2, hud.h / 2, r * 0.55, hud.w / 2, hud.h / 2, r);
    gr.addColorStop(0, 'rgba(10, 6, 2, 0)');
    gr.addColorStop(1, 'rgba(10, 6, 2, 0.22)');
    hud.vignette = gr; hud.vignetteW = hud.w; hud.vignetteH = hud.h;
  }
  g.fillStyle = hud.vignette;
  g.fillRect(0, 0, hud.w, hud.h);
}

/** 한 프레임의 HUD 전체 그리기 (Hud.draw 가 부른다). 프레임당 할당 없음: 제자리 갱신·인덱스 루프만 쓴다 */
export function drawFrame(hud: Hud, dt: number, pr: Prompt | null): void {
    hud.time += dt;
    if (hud.fadeAnim) {
      const f = hud.fadeAnim;
      f.t += dt;
      const p = Math.min(1, f.t / f.dur);
      hud.fade = f.start + (f.end - f.start) * p;
      if (p >= 1) hud.fadeAnim = null;
    }
    hud.goalFlash = Math.max(0, hud.goalFlash - dt * 1.2);
    hud.promptRect = null;
    hud.textPolicy = textPolicyFor(textStep(), hud.touch);
    const g = hud.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, hud.canvas.width, hud.canvas.height);
    g.setTransform(hud.d, 0, 0, hud.d, 0, 0);
    g.imageSmoothingEnabled = false;

    // 컷신 등으로 게임 UI 가 꺼지면 '완료!' 띠도 버림 (띠 시간은 그릴 때만 흐르므로, 두면 컷신이 끝난 뒤 다시 나타남)
    if (!hud.gameUi) hud.banner = null;
    const e = hud.edge;
    hud.toastRight = hud.w - 8 - e.right;
    if (hud.gameUi && !hud.letterbox) drawVignette(hud);
    if (hud.gameUi) {
      // ── 미니맵 (왼쪽 위) ──
      if (hud.minimap.visible && !hud.letterbox) {
        drawMinimap(hud, 8 + e.left, 8 + e.top);
      }

      // ── 할 일 (오른쪽 위) ──
      // 전체 화면 메뉴(장 선택·일시정지·도움말·도감)가 열려 있는 동안은 그 아래에 비치지 않게 숨김
      const modalOpen = hud.chapterSelect.open || hud.pauseMenu.open || hud.help.open || hud.codex.open;
      // 컷신(자막·제목 띠) 동안은 이전 장의 목표가 장면과 어긋나므로 숨긴다 (자막 사이 빈틈엔 잠깐 더 유지)
      if (hud.caption || hud.cinematicTitle || hud.letterbox > 0) hud.goalHideLeft = 0.8;
      else if (hud.goalHideLeft > 0) hud.goalHideLeft = Math.max(0, hud.goalHideLeft - dt);
      if (!hud.hideClock && hud.goal && !modalOpen && hud.goalHideLeft <= 0) goalPanel(hud, hud.goal, 8 + e.top);

      // ── 알림 토스트 (왼쪽 아래, 새 것이 아래) ──
      { // 지난 알림 빼기 (새 배열을 만들지 않고 제자리에서)
        const ts = hud.toasts;
        let j = 0;
        for (let i = 0; i < ts.length; i++) { const t = ts[i]; t.age += dt; if (t.age < t.life) ts[j++] = t; }
        ts.length = j;
      }
      // 터치 기기: 왼쪽 아래는 이동 스틱이 덮으므로 위 가운데로 (아래로 쌓임)
      if (hud.touch) toastsTop(hud, dt, e.top, e.left + Math.ceil(TOUCH_GUIDE_BTN_CSS / hud.cssScale));
      let ty = hud.h - 12 - e.bottom;
      for (let i = hud.toasts.length - 1; !hud.touch && i >= 0; i--) { // 터치는 위에서 이미 그림
        const t = hud.toasts[i];
        const text = t.count ? `+${t.count} ${t.name}` : t.name;
        const label = hud.txt(text, 13, INK);
        const tw = Math.ceil(hud.tw(label)) + 14, th = 26 + hud.grow(13);
        ty -= th;
        // 들어올 때 계단식으로 밀려 들어오고, 나갈 때 두 단계로 흐려짐
        const slide = t.age < 0.2 ? Math.round((1 - t.age / 0.2) * 4) * -(tw / 4) : 0;
        const fade = t.life - t.age;
        g.globalAlpha = fade < 0.2 ? 0.35 : fade < 0.45 ? 0.7 : 1;
        const tx = 8 + e.left + slide;
        hud.panel(tx, ty, tw, th);
        hud.put(label, tx + 7, centerY(label, ty + 5, ty + th - 6));
        g.globalAlpha = 1;
        ty -= 3;
      }

      // ── 할 일 완료 띠 ──
      if (hud.banner) {
        const b = hud.banner; b.age += dt;
        if (b.age > 2.8) hud.banner = null; else drawBanner(hud, b);
      }

      // ── 상호작용 프롬프트 ──
      if (pr) {
        if (!hud.promptOn) { hud.promptOn = true; hud.promptSeen++; }
        drawPrompt(hud, pr, !hud.touch && hud.promptSeen <= SPACE_HINT_PROMPTS);
      } else hud.promptOn = false;

      // ── 첫 플레이 안내 (조용한 때만 흐르고 저절로 사라짐) ──
      {
        const quiet = !hud.letterbox && !modalOpen && !hud.dialogue && !hud.choice && !hud.caption && !hud.activeDialogue && !hud.cinematicTitle && !hud.banner;
        if (advanceOnboard(hud.onboard, dt, quiet)) markOnboardSeen();
        if (quiet) drawOnboarding(hud);
      }

      // ── 목표 가이드 마커 (월드 HUD 공중 마커) ──
      if (hud.targetMarker && !hud.letterbox && !hud.chapterSelect.open && !hud.pauseMenu.open && !hud.codex.open && !hud.help.open) {
        const tm = hud.targetMarker;
        const mp = hud.project(tm.x, tm.y + 0.5, tm.z);
        const bob = Math.sin(hud.time * 6) * 3;
        const mx = Math.round(mp.x);
        let my = Math.round(mp.y - 12 + bob);
        // 상호작용 안내 상자와 겹치면 상자 바로 위로(자리가 없으면 아래로) 비킨다 — 화살표 끝(my)·몸통(my-7) 높이 기준
        const pr2 = hud.promptRect as { x: number; y: number; w: number; h: number } | null; // prompt() 가 위에서 채움 (TS 좁힘을 풂)
        if (pr2 && mx + 5 > pr2.x - 2 && mx - 5 < pr2.x + pr2.w + 2 && my > pr2.y - 2 && my - 8 < pr2.y + pr2.h + 2) {
          my = pr2.y - 4 >= 12 ? pr2.y - 4 : pr2.y + pr2.h + 12;
        }

        g.fillStyle = '#ffcc22';
        g.beginPath();
        g.moveTo(mx, my);
        g.lineTo(mx - 4, my - 7);
        g.lineTo(mx + 4, my - 7);
        g.closePath();
        g.fill();
        g.strokeStyle = '#2b1a0e';
        g.lineWidth = 1;
        g.stroke();
        g.fillStyle = '#ffffff';
        g.fillRect(mx - 1, my - 6, 2, 2);
      }
    }

    drawHeartsAndSpeech(hud, dt);

    // ── 컷신: 레터박스와 자막 ──
    if (hud.letterbox > 0) {
      const bh = Math.round(hud.h * 0.12 * hud.letterbox);
      g.fillStyle = '#0a0806';
      g.fillRect(0, 0, hud.w, bh);
      g.fillRect(0, hud.h - bh, hud.w, bh);
    }
    if (hud.fade > 0) {
      g.globalAlpha = Math.min(1, hud.fade);
      g.fillStyle = '#120c08';
      g.fillRect(0, 0, hud.w, hud.h);
      g.globalAlpha = 1;
    }
    if (hud.screenFlash) {
      hud.screenFlash.age += dt;
      const progress = hud.screenFlash.age / hud.screenFlash.duration;
      if (progress >= 1) {
        hud.screenFlash = null;
      } else {
        const curAlpha = (1 - progress) * hud.screenFlash.a;
        g.globalAlpha = Math.min(1, Math.max(0, curAlpha));
        g.fillStyle = `rgb(${hud.screenFlash.r},${hud.screenFlash.g},${hud.screenFlash.b})`;
        g.fillRect(0, 0, hud.w, hud.h);
        g.globalAlpha = 1;
      }
    }
    if (hud.caption) drawCaption(hud, hud.caption);
    if (hud.cinematicTitle) drawCinematicTitle(hud, hud.cinematicTitle);
    drawDialogue(hud, dt);
    if (hud.dialogue) drawDialoguePanel(hud, hud.dialogue);
    if (hud.choice) drawChoicePanel(hud, hud.choice);
    if (hud.codex.open) drawCodex(hud);
    if (hud.chapterSelect.open) drawChapterSelect(hud);
    if (hud.pauseMenu.open) drawPauseMenu(hud);
    if (hud.help.open) drawHelp(hud);
}
