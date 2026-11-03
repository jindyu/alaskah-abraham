#!/usr/bin/env node
/**
 * alaskah-bibles 의 대본(.tres/.gd), 영문 번역(.csv), 오디오/음성을 alaskah-abraham 으로 완전 이식.
 * 
 * 출력:
 *  - src/data/books/abraham_{intro,1..6,outro}.json
 *  - src/data/catalog.json
 *  - src/data/voiceManifest.json
 *  - src/data/sfxManifest.json
 *  - src/i18n/en.json
 *  - public/audio/... (BGM, SFX, Ambience, Voice ko 전권)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const BIBLES_ROOT = path.resolve(ROOT, '../alaskah-bibles');
const GODOT = path.join(BIBLES_ROOT, 'godot');
const CUTSCENES_DIR = path.join(GODOT, 'data/cutscenes/genesis');
const AUDIO_SRC = path.join(GODOT, 'assets/audio');
const TRANS_EN_DIR = path.join(GODOT, 'localization/translations/en');

const PUB_AUDIO = path.join(ROOT, 'public/audio');
const DATA_DIR = path.join(ROOT, 'src/data');
const BOOKS_DIR = path.join(DATA_DIR, 'books');
const I18N_DIR = path.join(ROOT, 'src/i18n');

fs.mkdirSync(PUB_AUDIO, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BOOKS_DIR, { recursive: true });
fs.mkdirSync(I18N_DIR, { recursive: true });

// ── 1. TRES 파서 ──
function parseTres(tresText) {
  const subResources = new Map();
  // 정규식으로 [sub_resource ... id="Resource_xxx"] 블록 매칭
  const blockRegex = /\[sub_resource type="Resource" id="Resource_([^"]+)"\]([\s\S]*?)(?=(?:\[(?:sub_)?resource|\s*$))/g;
  let match;
  while ((match = blockRegex.exec(tresText)) !== null) {
    const id = match[1];
    const body = match[2];
    const stepTypeMatch = body.match(/step_type\s*=\s*"([^"]+)"/);
    const stepType = stepTypeMatch ? stepTypeMatch[1] : '';

    const paramsMatch = body.match(/params\s*=\s*\{([\s\S]*?)\n\}/);
    const params = {};
    if (paramsMatch) {
      const pText = paramsMatch[1];
      // 줄 단위 파싱
      const lines = pText.split('\n');
      for (const line of lines) {
        const m = line.match(/^\s*"([^"]+)"\s*:\s*(.*?),?$/);
        if (!m) continue;
        const key = m[1];
        let rawVal = m[2].trim();
        // 파싱
        if (rawVal.startsWith('"') && rawVal.endsWith('"')) {
          params[key] = JSON.parse(rawVal);
        } else if (rawVal === 'true') {
          params[key] = true;
        } else if (rawVal === 'false') {
          params[key] = false;
        } else if (!isNaN(Number(rawVal))) {
          params[key] = Number(rawVal);
        } else if (rawVal.startsWith('Vector2(')) {
          const coords = rawVal.slice(8, -1).split(',').map((v) => Number(v.trim()));
          params[key] = { x: coords[0] ?? 0, y: coords[1] ?? 0 };
        } else if (rawVal.startsWith('Color(')) {
          const parts = rawVal.slice(6, -1).split(',').map((v) => Number(v.trim()));
          params[key] = { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
        } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
          try {
            params[key] = JSON.parse(rawVal);
          } catch {
            params[key] = rawVal;
          }
        } else {
          params[key] = rawVal;
        }
      }
    }
    subResources.set(id, { step_type: stepType, ...params });
  }

  // [resource] 블록에서 steps 순서 추출
  const resourceBlockMatch = tresText.match(/\[resource\]([\s\S]*)$/);
  const orderedSteps = [];
  if (resourceBlockMatch) {
    const rBody = resourceBlockMatch[1];
    const subMatches = rBody.match(/SubResource\("Resource_([^"]+)"\)/g);
    if (subMatches) {
      for (const sm of subMatches) {
        const id = sm.match(/Resource_([^"]+)/)[1];
        const step = subResources.get(id);
        if (step) orderedSteps.push(step);
      }
    }
  }

  return orderedSteps.length > 0 ? orderedSteps : Array.from(subResources.values());
}

// ── 2. gen_abraham_*.gd 에서 chapter_defs 메타데이터 추출 ──
function extractChapterDefs(gdText) {
  const defs = [];
  const regex = /\{"slug":\s*"([^"]+)",\s*"title":\s*"([^"]+)"(?:,\s*"steps":\s*[^,]+)?,(?:\s*"summary":\s*"((?:\\.|[^"\\])*)")?,(?:\s*"characters":\s*\[(.*?)\])?,(?:\s*"location":\s*"((?:\\.|[^"\\])*)")?,(?:\s*"tags":\s*\[(.*?)\])?\}/g;
  let m;
  while ((m = regex.exec(gdText)) !== null) {
    const chars = (m[4] || '')
      .split(',')
      .map((s) => s.trim().replace(/^"(.*)"$/, '$1'))
      .filter(Boolean);
    const tags = (m[6] || '')
      .split(',')
      .map((s) => s.trim().replace(/^"(.*)"$/, '$1'))
      .filter(Boolean);
    defs.push({
      slug: m[1],
      title: m[2],
      summary: (m[3] || '').replace(/\\"/g, '"'),
      characters: chars,
      location: (m[5] || '').replace(/\\"/g, '"'),
      tags,
    });
  }
  return defs;
}

// ── 3. 도서 목록 및 파싱 실행 ──
const BOOKS = [
  { id: 'abraham_intro', title: '아브라함 · 인트로', gd: 'gen_abraham_story.gd' },
  { id: 'abraham_1', title: '아브라함 1권 · 불과 팥죽', gd: 'gen_abraham_1.gd' },
  { id: 'abraham_2', title: '아브라함 2권 · 약속의 땅', gd: 'gen_abraham_2.gd' },
  { id: 'abraham_3', title: '아브라함 3권 · 별과 언약', gd: 'gen_abraham_3.gd' },
  { id: 'abraham_4', title: '아브라함 4권 · 소돔의 불', gd: 'gen_abraham_4.gd' },
  { id: 'abraham_5', title: '아브라함 5권 · 모리아', gd: 'gen_abraham_5.gd' },
  { id: 'abraham_6', title: '아브라함 6권 · 막벨라', gd: 'gen_abraham_6.gd' },
  { id: 'abraham_outro', title: '아브라함 · 아우트로', gd: 'gen_abraham_story.gd' },
];

console.log('[extract-scripts] 도서별 챕터 및 대본 파싱 시작...');
const catalog = [];
let totalStepsCount = 0;

for (const book of BOOKS) {
  const bookDir = path.join(CUTSCENES_DIR, book.id);
  const bookTresPath = path.join(bookDir, 'book.tres');
  let chapterFiles = [];
  if (fs.existsSync(bookTresPath)) {
    const bookTres = fs.readFileSync(bookTresPath, 'utf8');
    const m = bookTres.match(/chapter_paths\s*=\s*Array\[String\]\(\[(.*?)\]\)/);
    if (m) {
      chapterFiles = m[1]
        .split(',')
        .map((s) => s.trim().replace(/^"res:\/\/data\/cutscenes\/genesis\/[^/]+\/|\.tres"$/g, ''))
        .filter(Boolean);
    }
  }

  // gd 파일에서 메타데이터 추출
  const gdPath = path.join(GODOT, 'tools', book.gd);
  const gdContent = fs.existsSync(gdPath) ? fs.readFileSync(gdPath, 'utf8') : '';
  const defs = extractChapterDefs(gdContent);
  const defMap = new Map(defs.map((d) => [d.slug, d]));

  const chapters = [];
  for (const slug of chapterFiles) {
    const tresFile = path.join(bookDir, `${slug}.tres`);
    if (!fs.existsSync(tresFile)) continue;
    const tresText = fs.readFileSync(tresFile, 'utf8');
    const steps = parseTres(tresText);
    totalStepsCount += steps.length;
    const meta = defMap.get(slug) || {};
    // 첫 타이틀 스텝이나 meta.title 사용
    let title = meta.title;
    if (!title) {
      const titleStep = steps.find((s) => s.step_type === 'title' && s.text);
      title = titleStep ? titleStep.text : slug;
    }
    chapters.push({
      slug,
      title,
      summary: meta.summary || '',
      characters: meta.characters || [],
      location: meta.location || '',
      tags: meta.tags || [],
      stepCount: steps.length,
      steps,
    });
  }

  const bookData = {
    id: book.id,
    title: book.title,
    chapterCount: chapters.length,
    chapters,
  };

  fs.writeFileSync(path.join(BOOKS_DIR, `${book.id}.json`), JSON.stringify(bookData, null, 2) + '\n');

  catalog.push({
    id: book.id,
    title: book.title,
    chapterCount: chapters.length,
    chapters: chapters.map((c) => ({
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      characters: c.characters,
      location: c.location,
      tags: c.tags,
      stepCount: c.stepCount,
    })),
  });
  console.log(`  ✓ ${book.id}: 챕터 ${chapters.length}개 (${book.title})`);
}

fs.writeFileSync(path.join(DATA_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`[extract-scripts] 전체 대본 파싱 완료: 총 ${totalStepsCount}개 연출 스텝`);

// ── 4. 영문 번역 사전(en.json) 생성 ──
console.log('[extract-scripts] 영문 번역 사전(en.json) 생성 중...');
const i18nEn = {};

// Noah 기본 UI 번역 가져오기
const noahEnPath = path.resolve(ROOT, '../alaskah-noah/src/i18n/en.json');
if (fs.existsSync(noahEnPath)) {
  const noahDict = JSON.parse(fs.readFileSync(noahEnPath, 'utf8'));
  for (const [k, v] of Object.entries(noahDict)) {
    i18nEn[k] = v;
  }
}

// 아브라함 전용 용어 및 책/장 타이틀 수동 보강
const abrahamCoreTranslations = {
  "아브라함": "Abraham",
  "아브람": "Abram",
  "사래": "Sarai",
  "사라": "Sarah",
  "데라": "Terah",
  "하란": "Haran",
  "니므롯": "Nimrod",
  "롯": "Lot",
  "하갈": "Hagar",
  "이스마엘": "Ishmael",
  "이삭": "Isaac",
  "엘리에셀": "Eliezer",
  "멜기세덱": "Melchizedek",
  "아비멜렉": "Abimelech",
  "리브가": "Rebekah",
  "라반": "Laban",
  "에서": "Esau",
  "야곱": "Jacob",
  "에브론": "Ephron",
  "노아": "Noah",
  "셈": "Shem",
  "함": "Ham",
  "야벳": "Japheth",
  "가나안": "Canaan",
  "믿음의 조상 — 아브라함": "Father of Faith — Abraham",
  "아브라함 1권 · 불과 팥죽": "Book 1: Fire and Lentil Stew",
  "아브라함 2권 · 약속의 땅": "Book 2: The Promised Land",
  "아브라함 3권 · 별과 언약": "Book 3: Stars and Covenant",
  "아브라함 4권 · 소돔의 불": "Book 4: Fire of Sodom",
  "아브라함 5권 · 모리아": "Book 5: Moriah",
  "아브라함 6권 · 막벨라": "Book 6: Machpelah",
  "아브라함 · 인트로": "Abraham · Prologue",
  "아브라함 · 아우트로": "Abraham · Epilogue",
  "권/장 선택": "Chapter Select",
  "이어서 시작한다 (제{0}권 {1}장)": "Continue (Book {0}, Chapter {1})",
  "돌 제단을 살펴보자": "Examine the stone altar",
  "돌 제단에 손을 얹었다": "Placed hand on the stone altar",
  "첫 제단을 살폈다": "Inspected the first altar",
  "제단 살피기": "Examine Altar",
  "도끼 들기": "Take Axe",
  "우상 부수기": "Smash Idol",
  "우상에 도끼 쥐여주기": "Place axe in idol's hands",
  "물 긷기": "Draw Water",
  "나그네 대접하기": "Serve the Visitors",
  "소돔 탈출하기": "Escape Sodom",
  "우물 파기": "Dig Well",
  "모리아산 오르기": "Ascend Mount Moriah",
  "제단 쌓기": "Build Altar",
  "수풀의 숫양": "Ram in the thicket",
  "막벨라 굴 매입": "Purchase Machpelah Cave",
  "낙타에게 물 먹이기": "Water the camels",
  "금 장신구 건네기": "Present gold jewelry",
};

for (const [k, v] of Object.entries(abrahamCoreTranslations)) {
  i18nEn[k] = v;
}

if (fs.existsSync(TRANS_EN_DIR)) {
  for (const f of fs.readdirSync(TRANS_EN_DIR)) {
    if (!f.endsWith('.csv')) continue;
    const csvContent = fs.readFileSync(path.join(TRANS_EN_DIR, f), 'utf8');
    const lines = csvContent.split('\n');
    for (const l of lines) {
      const idx = l.lastIndexOf(',');
      if (idx <= 0) continue;
      const k = l.slice(0, idx).trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"');
      const v = l.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"');
      if (k && v) {
        i18nEn[k] = v;
      }
    }
  }
}
fs.writeFileSync(path.join(I18N_DIR, 'en.json'), JSON.stringify(i18nEn, null, 2) + '\n');
console.log(`  ✓ en.json 생성 완료: 총 ${Object.keys(i18nEn).length}개 번역 쌍`);

// ── 5. 오디오 및 음성 전권 복사 & Manifest 생성 ──
console.log('[extract-scripts] 오디오 및 음성 클립 동기화 중...');
function copyRecursive(src, dst, ext = '.ogg') {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dst, { recursive: true });
  let count = 0;
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) {
      count += copyRecursive(s, d, ext);
    } else if (ent.name.endsWith(ext) || ent.name.endsWith('.json')) {
      fs.copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

copyRecursive(path.join(AUDIO_SRC, 'bgm'), path.join(PUB_AUDIO, 'bgm'));
copyRecursive(path.join(AUDIO_SRC, 'ambience'), path.join(PUB_AUDIO, 'ambience'));
copyRecursive(path.join(AUDIO_SRC, 'sfx'), path.join(PUB_AUDIO, 'sfx'));
const voiceTotal = copyRecursive(path.join(AUDIO_SRC, 'voice/ko'), path.join(PUB_AUDIO, 'voice/ko'));
console.log(`  ✓ 오디오 복사 완료 (Voice 파일 ${voiceTotal}개)`);

// ── 6. sfxManifest.json & voiceManifest.json 갱신 ──
const rawSfx = JSON.parse(fs.readFileSync(path.join(AUDIO_SRC, 'sfx_manifest.json'), 'utf8'));
const sfxMap = {};
for (const [id, info] of Object.entries(rawSfx.sounds || {})) {
  sfxMap[id] = {
    path: String(info.path || '').replace(/^res:\/\/assets\/audio\//, 'audio/'),
    volumeDb: typeof info.volume_db === 'number' ? info.volume_db : 0,
    category: info.category || 'sfx',
    duration: typeof info.duration === 'number' ? info.duration : 0.4,
    loop: Boolean(info.loop),
  };
}
fs.writeFileSync(path.join(DATA_DIR, 'sfxManifest.json'), JSON.stringify(sfxMap, null, 2) + '\n');

// 음성 매니페스트 통합
const voiceEntries = {};
const voiceKoDir = path.join(PUB_AUDIO, 'voice/ko');
if (fs.existsSync(voiceKoDir)) {
  for (const bookDir of fs.readdirSync(voiceKoDir)) {
    const manifestPath = path.join(voiceKoDir, bookDir, 'voice_manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    const vManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const ent of vManifest.entries || []) {
      const relPath = String(ent.path || '').replace(/^res:\/\/assets\/audio\//, 'audio/');
      const text = String(ent.text || '').trim();
      const role = String(ent.actor_id || ent.role || 'narrator').trim();
      const chapter = String(ent.chapter || '').trim();
      if (!text) continue;
      voiceEntries[`${chapter}|${role}|${text}`] = relPath;
      if (!voiceEntries[`*|${role}|${text}`]) voiceEntries[`*|${role}|${text}`] = relPath;
      if (!voiceEntries[`*|*|${text}`]) voiceEntries[`*|*|${text}`] = relPath;
    }
  }
}
fs.writeFileSync(path.join(DATA_DIR, 'voiceManifest.json'), JSON.stringify(voiceEntries, null, 2) + '\n');
console.log(`  ✓ 매니페스트 갱신 완료: SFX ${Object.keys(sfxMap).length}종, Voice ${Object.keys(voiceEntries).length}키 매핑`);
