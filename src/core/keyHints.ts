/**
 * 화면에 나오는 핵심 키 이름의 단일 출처 (순수 문자열 — systems/ui 어디서나 import 해도 계층이 꼬이지 않도록 core 에 둠).
 * 쓰는 곳: 타이틀 TITLE_HINT·외형 customizeKeys (ui/onboarding.ts), F1 도움말 GUIDE_HTML (ui/guide.ts),
 * 첫날 조작 패널 CONTROLS_PANEL·첫 토스트 (systems/messages.ts), 막힘 토스트 STUCK_HINT_TOAST.
 * 키를 바꾸면 여기와 game/input.ts 만 고치면 문구가 함께 따라온다.
 */
export const KEY_MOVE = 'WASD';
export const KEY_ACT = 'E / Space';
export const KEY_MENU = 'Esc';
export const KEY_HELP = 'F1';
export const KEY_BAG = 'I';
/** 가방을 닫는 키들 (표시는 ' / ' 또는 ' · ' 로 이어 씀) */
export const BAG_CLOSE_KEYS = [KEY_BAG, 'Esc', 'B'] as const;
/** 짐승 도감을 닫는 키들 */
export const JOURNAL_CLOSE_KEYS = ['J', 'Esc', KEY_BAG] as const;

/** 키 목록 이어 쓰기: 'I / Esc / B' */
export const keysSlash = (keys: readonly string[]) => keys.join(' / ');
/** 키 목록 이어 쓰기: 'I · Esc · B' (도움말 괄호 안 표기) */
export const keysDot = (keys: readonly string[]) => keys.join(' · ');
