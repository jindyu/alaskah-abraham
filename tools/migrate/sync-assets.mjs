#!/usr/bin/env node
/**
 * alaskah-bibles 및 alaskah-noah 의 검증된 오디오·아이콘 자산을 alaskah-abraham 으로 동기화하고,
 * 런타임에서 즉시 조회할 수 있는 sfxManifest.json 및 voiceManifest.json 을 생성한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const BIBLES_AUDIO = path.resolve(ROOT, '../alaskah-bibles/godot/assets/audio');
const NOAH_PUBLIC = path.resolve(ROOT, '../alaskah-noah/public');
const PUB_AUDIO = path.join(ROOT, 'public/audio');
const DATA_DIR = path.join(ROOT, 'src/data');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyMatching(srcDir, dstDir, ext = '.ogg') {
  if (!fs.existsSync(srcDir)) return 0;
  ensureDir(dstDir);
  let count = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      count += copyMatching(s, d, ext);
    } else if (entry.name.endsWith(ext)) {
      fs.copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

ensureDir(PUB_AUDIO);
ensureDir(DATA_DIR);

// 1. 아이콘 복사 (alaskah-noah)
for (const icon of ['favicon.png', 'apple-touch-icon.png']) {
  const s = path.join(NOAH_PUBLIC, icon);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, path.join(ROOT, 'public', icon));
  }
}

// 2. BGM, Ambience, SFX, Voice(1권) 복사
const bgmCount = copyMatching(path.join(BIBLES_AUDIO, 'bgm'), path.join(PUB_AUDIO, 'bgm'));
const ambCount = copyMatching(path.join(BIBLES_AUDIO, 'ambience'), path.join(PUB_AUDIO, 'ambience'));
const sfxCount = copyMatching(path.join(BIBLES_AUDIO, 'sfx'), path.join(PUB_AUDIO, 'sfx'));
const voiceCount = copyMatching(
  path.join(BIBLES_AUDIO, 'voice/ko/abraham_1'),
  path.join(PUB_AUDIO, 'voice/ko/abraham_1'),
);

// 3. sfxManifest.json 생성
const rawSfxManifest = JSON.parse(fs.readFileSync(path.join(BIBLES_AUDIO, 'sfx_manifest.json'), 'utf8'));
const sfxMap = {};
for (const [id, info] of Object.entries(rawSfxManifest.sounds || {})) {
  const relPath = String(info.path || '').replace(/^res:\/\/assets\/audio\//, 'audio/');
  sfxMap[id] = {
    path: relPath,
    volumeDb: typeof info.volume_db === 'number' ? info.volume_db : 0,
    category: info.category || 'sfx',
    duration: typeof info.duration === 'number' ? info.duration : 0.4,
    loop: Boolean(info.loop),
  };
}
fs.writeFileSync(path.join(DATA_DIR, 'sfxManifest.json'), JSON.stringify(sfxMap, null, 2) + '\n');

// 4. voiceManifest.json 생성 (1권 전체 대사·내레이션 음성 매핑)
const rawVoiceManifest = JSON.parse(
  fs.readFileSync(path.join(BIBLES_AUDIO, 'voice/ko/abraham_1/voice_manifest.json'), 'utf8'),
);
const voiceEntries = {};
for (const entry of rawVoiceManifest.entries || []) {
  const relPath = String(entry.path || '').replace(/^res:\/\/assets\/audio\//, 'audio/');
  const fullDiskPath = path.join(ROOT, 'public', relPath);
  if (!fs.existsSync(fullDiskPath)) continue;
  const text = String(entry.text || '').trim();
  const role = String(entry.actor_id || entry.role || 'narrator').trim();
  const chapter = String(entry.chapter || '').trim();
  if (!text) continue;
  // 우선순위 1: chapter + role + text, 2: role + text, 3: text 단독
  voiceEntries[`${chapter}|${role}|${text}`] = relPath;
  if (!voiceEntries[`*|${role}|${text}`]) voiceEntries[`*|${role}|${text}`] = relPath;
  if (!voiceEntries[`*|*|${text}`]) voiceEntries[`*|*|${text}`] = relPath;
}
fs.writeFileSync(path.join(DATA_DIR, 'voiceManifest.json'), JSON.stringify(voiceEntries, null, 2) + '\n');

console.log(
  `[sync-assets] 완료: BGM ${bgmCount}곡, Ambience ${ambCount}종, SFX ${sfxCount}종, 1권 Voice ${voiceCount}클립 (매핑 ${Object.keys(voiceEntries).length}건)`,
);
