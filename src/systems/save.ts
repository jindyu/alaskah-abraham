/**
 * 저장/불러오기 (localStorage, 세 칸).
 * - 슬롯 1은 예전 키(abraham.save.v1)를 그대로 써서 옛 저장이 이어짐. 슬롯 2·3은 뒤에 .s2/.s3
 * - 마지막으로 쓴 슬롯은 abraham.slot 에 기억. URL ?slot=n 이 우선
 * - 저장 시점: 새 날이 될 때, 게임 안 1시간마다, 탭을 숨기거나 닫을 때
 * - 외형(appearance)은 따로 저장됨 (entities/appearance.ts)
 * - 형식이 바뀌면 VERSION을 올리고 migrate에서 옛 형식을 옮긴다
 * - 저장소를 못 쓰는 환경(비공개 창 등)에서는 조용히 이번 세션만 유지
 * - 쓰기 전 직전 정상 저장을 .prev 로 한 세대 보관(.prev 를 마지막으로 갈아 끼운 지 3분이 지났을 때만 갱신 — 탭을 숨기고 닫는 연속 저장이 정상 세대를 밀어내지 않게. 갈아 낀 시각은 .prevAt), 백업 키(.bak·.bak2·.bak3·.prev)는 칸당 글자 수 상한 안에서 오래된 것부터 지움
 * - 다른 탭이 이 칸을 먼저 썼으면(저장된 savedAt이 이 탭이 마지막으로 읽거나 쓴 값보다 새로우면) 덮어쓰지 않음
 * - QA용: URL ?nosave=1 이면 읽지도 쓰지도 않음, ?fresh=1 이면 저장을 지우고 새로 시작
 */
import { isFiniteNum, isRecord } from '../core/values';

export const SAVE_KEY = 'abraham.save.v1';
export const SLOTS = 3;
const SLOT_KEY = 'abraham.slot';
export const slotKey = (n: number) => (n === 1 ? SAVE_KEY : `${SAVE_KEY}.s${n}`);
const VERSION = 1;

/** 저장되는 진행 상태. 최상위 키를 더하면 persistSpec.ts SAVE_KEYS 에 한 줄을 더한다. */
export interface SaveData {
  version: number;
  savedAt: number;
  /** 지금 권·장 (0 = 인트로, 1~6 = 권, 7 = 아우트로) 과 장 번호 (권 안에서 0부터) */
  story: { book: number; chapter: number; /** 현재 조작 인물 (abraham·lot·eliezer·esau …) */ hero?: string; /** 장 안의 단계 */ step?: number; /** 이야기 분기·퍼즐 진행 표시 */ flags?: Record<string, number | boolean | string>; /** 끝낸 장 ("book:chapter") */ done?: string[] };
  player: { x: number; z: number } | null;
  /** 이 슬롯에서 플레이한 시간(초) */
  playSeconds?: number;
}

/** 1~SLOTS 의 정수인가 (1.5·NaN 은 아님) */
export function validSlotNo(n: number): boolean { return Number.isInteger(n) && n >= 1 && n <= SLOTS; }

/** 지금 쓰는 슬롯 (1~3) */
export function activeSlot(): number {
  try {
    const q = Number(new URLSearchParams(location.search).get('slot'));
    if (validSlotNo(q)) return q;
    const n = Number(localStorage.getItem(SLOT_KEY));
    if (validSlotNo(n)) return n;
  } catch { /* 저장소 없음 */ }
  return latestSlot() ?? 1;
}
export function setActiveSlot(n: number) {
  try { localStorage.setItem(SLOT_KEY, String(n)); } catch { /* 저장소 없음 */ }
}

export type SaveStatus = 'ok' | 'empty' | 'broken' | 'newer';

/** 칸을 읽기만 함 (저장소를 바꾸지 않음). 칸 목록·타이틀이 씀 */
export function peekSave(slot: number): { status: SaveStatus; data: SaveData | null; raw: string | null } {
  let raw: string | null = null;
  try { raw = localStorage.getItem(slotKey(slot)); } catch { return { status: 'empty', data: null, raw: null }; }
  if (!raw) return { status: 'empty', data: null, raw };
  const c = classifyRaw(raw);
  return { status: c.status, data: c.data, raw };
}

/** 저장 글 하나를 불러올 수 있는지 가름 (순수 — 칸 읽기·내보내기·가져오기 검증이 같은 길을 씀). 빈 글은 broken */
export function classifyRaw(raw: string): { status: 'ok' | 'broken' | 'newer'; data: SaveData | null } {
  try {
    const d: unknown = JSON.parse(raw);
    if (!isRecord(d)) return { status: 'broken', data: null };
    if (typeof d.version === 'number' && d.version > VERSION) return { status: 'newer', data: null };
    const m = migrateSave(d);
    return m && validSave(m) ? { status: 'ok', data: m } : { status: 'broken', data: null };
  } catch { return { status: 'broken', data: null }; }
}

/** 이 칸의 저장 글 그대로 (불러올 수 있을 때만, 아니면 null). 파일로 내보낼 때 씀. 읽기만 함 */
export function exportSlot(slot: number): string | null {
  const p = peekSave(slot);
  return p.status === 'ok' ? p.raw : null;
}

/**
 * 검증된 저장 글(raw)을 이 칸에 넣음. 지금 칸의 내용은 먼저 .bak 으로 남기므로 잃지 않음 (남기지 못하면 쓰지 않고 false).
 * 불러올 수 없는 글이면 false 이고 칸은 그대로. 이 탭이 방금 쓴 것으로 쳐서 다른 탭 충돌 기준도 갱신
 */
export function importIntoSlot(slot: number, raw: string): boolean {
  try {
    if (!validSlotNo(slot) || classifyRaw(raw).status !== 'ok') return false;
    const k = slotKey(slot), cur = localStorage.getItem(k);
    if (cur === raw) { known.set(slot, savedAtOf(raw)); return true; }
    if (cur && !ensureBackup(slot, cur)) { backupFailed.add(slot); return false; }
    try { localStorage.setItem(k, raw); } catch {
      // 공간이 모자라면 오래된 보관본부터 줄여 한 번 더 (.bak 은 방금 지금 칸의 원본이므로 건드리지 않음)
      localStorage.removeItem(`${k}.bak3`); localStorage.removeItem(`${k}.bak2`);
      localStorage.setItem(k, raw);
    }
    try { localStorage.removeItem(`${k}.broken`); } catch { /* 알림 표시만 */ }
    known.set(slot, savedAtOf(raw));
    return true;
  } catch { return false; }
}

/**
 * 불러오려고 읽음. 깨진 저장(JSON·형식 오류)은 덮어쓰기 전에 .bak 으로 옮겨 둠.
 * 더 새 버전에서 만든 저장은 건드리지 않고 null (main.ts가 그 칸을 잠금)
 */
export function readSave(slot = activeSlot()): SaveData | null {
  const p = peekSave(slot);
  if (p.status === 'broken') quarantine(slot, p.raw);
  // 이 탭이 본 마지막 저장 시각 (다른 탭이 그 뒤에 썼는지 판정하는 기준)
  known.set(slot, storedSavedAt(slot) ?? 0);
  return p.data;
}

/** 이 탭이 칸마다 마지막으로 읽거나 쓴 savedAt */
const known = new Map<number, number>();
/**
 * 이 탭이 이 칸을 아직 본 적이 없으면 저장소의 지금 savedAt(빈 칸이면 0)을 기준으로 기록 (이미 본 적이 있으면 그대로).
 * 불러오지 않고 연 칸(loadfail 등)도 이후 다른 탭의 쓰기를 알아보게 함. 돌려주는 값 = 이 탭의 기준
 */
export function observeSlot(slot: number): number {
  const had = known.get(slot);
  if (had !== undefined) return had;
  const at = storedSavedAt(slot) ?? 0;
  known.set(slot, at);
  return at;
}
/** 이 탭이 이 칸에서 마지막으로 본 savedAt (아직 읽거나 쓴 적이 없으면 undefined). 'storage' 이벤트 판정(game/saveLifecycle.ts)이 씀 */
export function seenAt(slot: number): number | undefined { return known.get(slot); }
/**
 * 다른 탭이 쓴 저장을 "이 탭이 본 것"으로 받아들여 충돌을 풂 (읽기 전용이 된 탭의 "이 탭에서 계속하기").
 * 저장소의 지금 savedAt(칸이 비었으면 0)을 이 탭의 기준으로 삼으므로, 다음 저장부터는 이 탭의 진행이 그 칸을 덮어씀.
 * 돌려주는 값 = 받아들인 savedAt
 */
export function adoptForeign(slot: number): number {
  const at = storedSavedAt(slot) ?? 0;
  known.set(slot, at);
  return at;
}
/** 이 탭이 본 저장 시각 기억을 지움 (칸을 지웠거나 테스트에서 저장소를 비울 때) */
export function forgetSeen(slot?: number) {
  if (slot === undefined) known.clear(); else known.delete(slot);
}
/** 저장 글에서 savedAt 만 꺼냄 (전체를 파싱하지 않음) */
export function savedAtOf(raw: string | null): number {
  if (!raw) return 0;
  const re = /"savedAt":\s*(\d+)/g;
  let m: RegExpExecArray | null, last = 0;
  while ((m = re.exec(raw))) last = Number(m[1]);
  return last;
}
/** 저장소에 지금 들어 있는 이 칸의 savedAt (칸이 비었으면 null) */
function storedSavedAt(slot: number): number | null {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    return raw === null ? null : savedAtOf(raw);
  } catch { return null; }
}
/**
 * 다른 탭이 쓴 저장인가 (순수 판정). stored = 저장소의 savedAt(칸이 비었으면 null), seen = 이 탭이 마지막으로 읽거나 쓴 값.
 * 저장소 쪽이 더 새롭거나, 이 탭이 본 저장이 사라졌으면(다른 탭이 새로 시작) 덮어쓰면 안 됨
 */
export function isForeignWrite(stored: number | null, seen: number): boolean {
  return stored === null ? seen > 0 : stored > seen;
}

/** 칸당 백업 키 글자 수 상한 (저장소 용량을 백업이 다 차지하지 않게) */
export const BACKUP_LIMIT = 600_000;
/** 오래된 것부터 (savedAt 이 같거나 읽을 수 없을 때 이 순서가 앞설수록 먼저 지움) */
const BACKUP_SUFFIXES = ['.bak3', '.bak2', '.bak', '.prev'];
/** 합이 limit 을 넘으면 오래된 것부터 지울 키 목록 (순수). 가장 새로운 하나는 남김 */
export function pickBackupsToDrop(entries: { key: string; size: number; savedAt: number }[], limit: number): string[] {
  const sorted = [...entries].sort((a, b) => a.savedAt - b.savedAt);
  let total = sorted.reduce((a, e) => a + e.size, 0);
  const drop: string[] = [];
  for (let i = 0; i < sorted.length - 1 && total > limit; i++) { drop.push(sorted[i].key); total -= sorted[i].size; }
  return drop;
}
export function trimBackups(slot: number, limit = BACKUP_LIMIT) {
  try {
    const k = slotKey(slot);
    const entries: { key: string; size: number; savedAt: number }[] = [];
    for (const suf of BACKUP_SUFFIXES) {
      const v = localStorage.getItem(k + suf);
      if (v) entries.push({ key: k + suf, size: v.length, savedAt: savedAtOf(v) });
    }
    for (const key of pickBackupsToDrop(entries, limit)) localStorage.removeItem(key);
  } catch { /* 저장소 없음 */ }
}

/** 불러오기 전에 꼭 있어야 하는 모양만 확인 (나머지는 각 restore가 기본값으로 채움) */
export function validSave(d: SaveData): boolean {
  const s: unknown = d;
  return isRecord(s) && isRecord(s.story) && isFiniteNum(s.story.book) && isFiniteNum(s.story.chapter);
}

/** 이 글이 불러올 수 있는 저장인가 (.prev 로 보관할 만한지 가릴 때 씀) */
function goodRaw(raw: string): boolean {
  try {
    const m = migrateSave(JSON.parse(raw));
    return !!m && validSave(m);
  } catch { return false; }
}

/** 이 세션에서 복사본(.bak)을 만들지 못한 칸 (quarantine 실패). main 이 타이틀·토스트로 알리려고 takeBackupFailedNotice 로 꺼냄 */
const backupFailed = new Set<number>();
export function takeBackupFailedNotice(slot: number): boolean { return backupFailed.delete(slot); }

/** 이 칸의 원본(raw)이 .bak 에 그대로 남게 함. 공간이 모자라면 .prev 를 버리고 한 번 더. 남았으면 true */
function ensureBackup(slot: number, raw: string): boolean {
  const bak = `${slotKey(slot)}.bak`;
  try {
    rotateBackups(slot); // 실패해도 아래에서 .bak 이 raw 인지 직접 확인하므로 알림 표시는 하지 않음
    if (localStorage.getItem(bak) === raw) return true;
    // 공간이 모자라면 오래된 백업(.bak3 → .bak2)부터 줄이고, 그래도 안 되면 마지막 수단으로 .prev 를 버림 (정상 사본을 먼저 버리지 않음)
    const k = slotKey(slot);
    const attempts: string[][] = [[], [`${k}.bak3`, `${k}.bak2`], [`${k}.bak3`, `${k}.bak2`, `${k}.prev`]];
    for (const drop of attempts) {
      try { drop.forEach(key => localStorage.removeItem(key)); localStorage.setItem(bak, raw); break; } catch { /* 다음 단계 */ }
    }
    return localStorage.getItem(bak) === raw;
  } catch { return false; }
}

/**
 * 깨진 저장을 .bak 으로 옮기고 칸을 비움. 그 칸을 다음에 열 때 타이틀에서 한 번 알림.
 * 복사본을 못 만들면(저장 공간 부족 등) 원본을 그대로 두고 false — takeBackupFailedNotice(slot) 로도 알 수 있음
 */
export function quarantine(slot: number, raw?: string | null): boolean {
  try {
    const r = raw ?? localStorage.getItem(slotKey(slot));
    // 백업이 실제로 남았을 때만 원본을 치움
    if (r && !ensureBackup(slot, r)) { backupFailed.add(slot); return false; }
    localStorage.removeItem(slotKey(slot));
    try { localStorage.setItem(`${slotKey(slot)}.broken`, String(Date.now())); } catch { /* 알림 표시만 못 남김 */ }
    return true;
  } catch { backupFailed.add(slot); return false; }
}
/**
 * 원본은 그대로 두고 복사본만 남김 (.bak ← 가장 최근, .bak2, .bak3 순으로 밀려남).
 * 불러오다 코드 쪽 문제로 실패했을 때 씀 — 데이터가 멀쩡할 수 있으니 칸을 비우지 않는다
 */
function rotateBackups(slot: number): boolean {
  try {
    const k = slotKey(slot), raw = localStorage.getItem(k);
    if (!raw) return true;
    const b2 = localStorage.getItem(`${k}.bak2`), b1 = localStorage.getItem(`${k}.bak`);
    if (b1 === raw) return true; // 같은 내용을 되풀이해 밀어내지 않음
    if (b2) localStorage.setItem(`${k}.bak3`, b2);
    if (b1) localStorage.setItem(`${k}.bak2`, b1);
    localStorage.setItem(`${k}.bak`, raw);
    trimBackups(slot);
    return true;
  } catch { return false; /* 저장소 없음·공간 부족 */ }
}
/**
 * 회전 중 예외는 삼키되 false 를 돌려주고, 칸을 backupFailed 에 올려 takeBackupFailedNotice 로도 알 수 있게 함 (성공·할 일 없음은 true).
 * 호출부는 반환값을 무시해도 됨
 */
export function backupSave(slot: number): boolean {
  const ok = rotateBackups(slot);
  if (!ok) backupFailed.add(slot);
  return ok;
}

/** 복구할 수 있는 보관본 한 개 (불러올 수 있는 것만) */
export interface BackupInfo { suffix: string; label: string; savedAt: number; book: number; chapter: number; playSeconds: number }
const BACKUP_LABELS: Record<string, string> = { '.prev': '직전 저장', '.bak': '보관본 1', '.bak2': '보관본 2', '.bak3': '보관본 3' };

/** 이 칸의 보관본(.prev·.bak·.bak2·.bak3) 중 불러올 수 있는 것을 새것부터. 같은 내용은 한 번만. 읽기만 함 */
export function listBackups(slot: number): BackupInfo[] {
  const out: BackupInfo[] = [];
  try {
    const k = slotKey(slot), seen = new Set<string>();
    const cur = localStorage.getItem(k);
    if (cur) seen.add(cur); // 지금 칸과 같은 내용은 복구할 필요가 없음
    for (const suf of [...BACKUP_SUFFIXES].reverse()) { // 새것(.prev)부터 보아야 같은 내용 중 가장 새 이름이 남음
      const raw = localStorage.getItem(k + suf);
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      let d: SaveData | null = null;
      try { d = migrateSave(JSON.parse(raw)); } catch { d = null; }
      if (!d || !validSave(d)) continue;
      out.push({
        suffix: suf, label: BACKUP_LABELS[suf] ?? suf, savedAt: d.savedAt ?? 0, book: d.story.book, chapter: d.story.chapter, playSeconds: d.playSeconds ?? 0,
      });
    }
  } catch { /* 저장소 없음 */ }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * 보관본을 이 칸으로 되살림. 지금 칸의 내용은 먼저 보관본으로 밀어 두므로 잃지 않음 (깨진 칸이면 .bak 으로).
 * 불러올 수 없는 보관본이거나 쓰기에 실패하면 false 이고 칸은 그대로
 */
export function restoreBackup(slot: number, suffix: string): boolean {
  try {
    if (!(suffix in BACKUP_LABELS)) return false;
    const k = slotKey(slot);
    const raw = localStorage.getItem(k + suffix); // 회전하기 전에 먼저 읽어 둠 (회전하면 보관본 자리가 바뀜)
    if (!raw || !goodRaw(raw)) return false;
    rotateBackups(slot);
    localStorage.setItem(k, raw);
    try { localStorage.removeItem(`${k}.broken`); } catch { /* 알림 표시만 */ }
    known.set(slot, savedAtOf(raw)); // 이 탭이 방금 쓴 것으로 침 (다른 탭 충돌 판정 기준)
    return true;
  } catch { return false; }
}

/** 이 칸의 저장이 손상되어 보관된 적이 있나 (알림을 보여 준 뒤 지움) */
export function takeBrokenNotice(slot: number): boolean {
  try {
    const k = `${slotKey(slot)}.broken`;
    if (!localStorage.getItem(k)) return false;
    localStorage.removeItem(k);
    return true;
  } catch { return false; }
}

/** .prev 를 갈아 끼우기까지 최소 간격 (저장 시각 savedAt 기준) */
export const PREV_MIN_GAP_MS = 3 * 60_000;
/**
 * .prev 를 갈아 끼워도 되는가 (순수 정책). lastReplacedAt = .prev 를 마지막으로 갈아 끼운 시각(savedAt 기준, 없으면 null/0), nowSavedAt = 이번 저장의 savedAt.
 * 마지막 교체 뒤 minGap(3분)이 안 지났으면 그대로 둠 → 탭 숨김·닫힘처럼 짧은 간격의 연속 저장이 여러 번 나도 .prev 는 "몇 분 전 정상 저장"으로 남는다.
 * 시계가 거꾸로 가서 마지막 교체가 미래면(이상 상태) 바꿈
 */
export function shouldReplacePrev(lastReplacedAt: number | null, nowSavedAt: number, minGapMs = PREV_MIN_GAP_MS): boolean {
  if (lastReplacedAt === null || !(lastReplacedAt > 0)) return true;
  return nowSavedAt < lastReplacedAt || nowSavedAt - lastReplacedAt >= minGapMs;
}

export type WriteResult = 'ok' | 'fail' | 'conflict';
/** 쓰기가 안 된 까닭: quota 저장 공간 부족 · unavailable 저장소를 못 씀(시크릿 창·차단 등) · conflict 다른 탭이 더 새로 저장 */
export type WriteReason = 'quota' | 'unavailable' | 'conflict';
export interface WriteDetail { result: WriteResult; reason?: WriteReason }

/** 저장소 예외가 용량 부족인가 (순수). 브라우저마다 이름·코드가 다름 (QuotaExceededError · NS_ERROR_DOM_QUOTA_REACHED · code 22/1014) */
export function isQuotaError(err: unknown): boolean {
  const e = err as { name?: unknown; code?: unknown; message?: unknown } | null;
  if (!e || typeof e !== 'object') return false;
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014
    || (typeof e.message === 'string' && /quota/i.test(e.message));
}
/** 저장 쓰기 실패 예외 → 까닭 (순수) */
export function failReason(err: unknown): 'quota' | 'unavailable' { return isQuotaError(err) ? 'quota' : 'unavailable'; }

/**
 * 저장 쓰기. 'conflict' = 다른 탭이 이 칸에 더 새 저장을 써 두어서 덮어쓰지 않음.
 * 성공하면 바로 전 정상 저장을 .prev 로 보관 (실패하면 .prev 는 그대로).
 * 용량이 모자라 쓰기가 실패하면 .prev 를 버리고 한 번 더 시도
 */
export function writeSaveEx(d: Omit<SaveData, 'version' | 'savedAt'>, slot = activeSlot()): WriteResult {
  return writeSaveDetail(d, slot).result;
}

/** writeSaveEx 와 같되 실패한 까닭(reason)도 돌려줌 */
export function writeSaveDetail(d: Omit<SaveData, 'version' | 'savedAt'>, slot = activeSlot()): WriteDetail {
  try {
    const k = slotKey(slot);
    const cur = localStorage.getItem(k);
    // 이 탭이 이 칸을 본 적이 없으면 "빈 칸(0)을 보았다"로 침 — 그 사이 다른 탭이 쓴 저장을 첫 쓰기가 덮지 않음 (빈 칸에 처음 쓰는 정상 저장은 그대로 통과)
    const seen = known.get(slot) ?? 0;
    const curAt = cur === null ? null : savedAtOf(cur);
    if (isForeignWrite(curAt, seen)) return { result: 'conflict', reason: 'conflict' };
    const savedAt = Date.now();
    const json = JSON.stringify({ ...d, version: VERSION, savedAt });
    let squeezed = false; // 공간이 모자라 .prev 를 버리고 쓴 경우: 이번엔 .prev 를 다시 만들지 않음
    try { localStorage.setItem(k, json); } catch {
      // 오래된 백업부터 줄여 보고, 그래도 안 되면 .prev 까지 버림
      try { localStorage.removeItem(`${k}.bak3`); localStorage.removeItem(`${k}.bak2`); localStorage.setItem(k, json); squeezed = true; } catch {
        try { localStorage.removeItem(`${k}.prev`); localStorage.removeItem(`${k}.prevAt`); localStorage.setItem(k, json); squeezed = true; } catch (err2) { return { result: 'fail', reason: failReason(err2) }; }
      }
    }
    known.set(slot, savedAt);
    // 가벼운 경로: 먼저 savedAt 만 읽어 정책으로 거르고, 갈아 끼울 때만 전체를 파싱해 정상 저장인지 확인
    const prevRaw = cur ? localStorage.getItem(`${k}.prev`) : null;
    let lastReplaced: number | null = null;
    if (prevRaw !== null) { const m = Number(localStorage.getItem(`${k}.prevAt`)); lastReplaced = m > 0 ? m : savedAtOf(prevRaw); } // 표시가 없는 옛 .prev 는 그 저장 시각으로
    if (cur && !squeezed && shouldReplacePrev(lastReplaced, savedAt) && goodRaw(cur)) {
      try { localStorage.setItem(`${k}.prev`, cur); try { localStorage.setItem(`${k}.prevAt`, String(savedAt)); } catch { /* 표시만 못 남김 */ } } catch { /* 공간이 모자라면 예전 .prev 를 그대로 둠 */ }
      trimBackups(slot);
    }
    return { result: 'ok' };
  } catch (err) {
    return { result: 'fail', reason: failReason(err) };
  }
}

export function writeSave(d: Omit<SaveData, 'version' | 'savedAt'>, slot = activeSlot()): boolean {
  return writeSaveEx(d, slot) === 'ok';
}

export function clearSave(slot = activeSlot()) {
  try { localStorage.removeItem(slotKey(slot)); } catch { /* 저장소 없음 */ }
}

/**
 * "새로 시작": 기존 칸을 지우기 전에 .bak 으로 옮겨 둠. 공간이 모자라면 .prev 를 버리고 한 번 더 시도.
 * 백업이 끝내 안 되어도 칸은 비움 (고른 대로 새로 시작). 백업이 남았으면 true
 */
export function discardSave(slot = activeSlot()): boolean {
  let kept = true;
  try {
    const k = slotKey(slot), raw = localStorage.getItem(k);
    if (raw) kept = ensureBackup(slot, raw);
    localStorage.removeItem(k);
    known.set(slot, 0); // 칸을 비웠으니 이 탭의 기준은 "빈 칸" (그 뒤 다른 탭이 먼저 쓰면 첫 저장이 덮어쓰지 않음)
  } catch { kept = false; }
  return kept;
}

export interface SlotInfo { slot: number; savedAt: number; book: number; chapter: number; playSeconds: number; status?: SaveStatus }

/** 슬롯 목록 화면용 요약 (비어 있으면 null). 읽기만 하고 저장소는 바꾸지 않음 */
export function slotInfo(slot: number): SlotInfo | null {
  const p = peekSave(slot);
  if (p.status === 'broken' || p.status === 'newer') return { slot, savedAt: 0, book: 0, chapter: 0, playSeconds: 0, status: p.status };
  const d = p.data;
  if (!d) return null;
  return {
    slot, savedAt: d.savedAt ?? 0, book: d.story.book, chapter: d.story.chapter, playSeconds: d.playSeconds ?? 0,
  };
}

/** 가장 최근에 저장한 슬롯 */
export function latestSlot(): number | null {
  let best: SlotInfo | null = null;
  for (let n = 1; n <= SLOTS; n++) { const i = slotInfo(n); if (i && !i.status && (!best || i.savedAt > best.savedAt)) best = i; }
  return best?.slot ?? null;
}

/**
 * 버전별 이주 사슬: MIGRATIONS[v] 는 v 형식의 저장을 v+1 형식으로 올림 (입력은 바꾸지 않고 새 객체를 돌려줌).
 * 형식을 바꿀 때는 VERSION 을 올리고 (옛 VERSION) 자리에 함수 하나를 더한다. 사슬에 빠진 번호가 있으면 그 저장은 못 읽는 것으로 친다.
 */
export const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {
  // v0 → v1: version 필드가 없던 저장. 내용 형식은 같아 번호만 붙임
  0: (d) => ({ ...d }),
};
/**
 * 저장을 target(기본 VERSION) 형식으로 올림 (순수). version 이 없으면 v0 으로 봄.
 * 객체가 아니거나, version 이 음이 아닌 정수가 아니거나, target 보다 새 버전이거나, 사슬이 끊겼거나, 이주 함수가 객체를 안 돌려주면 null
 */
export function migrateSave(d: unknown, target: number = VERSION, steps: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = MIGRATIONS): SaveData | null {
  if (!isRecord(d)) return null;
  let v = d.version === undefined ? 0 : d.version;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > target) return null;
  let cur: Record<string, unknown> = { ...d, version: v };
  while (v < target) {
    const step = Object.prototype.hasOwnProperty.call(steps, v) ? steps[v] : undefined;
    if (typeof step !== 'function') return null;
    let next: unknown;
    try { next = step(cur); } catch { return null; }
    if (!isRecord(next)) return null;
    v++;
    cur = { ...next, version: v };
  }
  return cur as unknown as SaveData;
}
