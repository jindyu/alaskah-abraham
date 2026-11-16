# Alaskah Abraham — 아키텍처 및 런타임 규약

> 이 문서는 **실제 코드**를 기준으로 쓴다. 코드와 어긋나면 문서를 고친다 (`tests/` 가 지키는 사실은 ⓣ 로 표시).

## 1. 한눈에

- 스택: Three.js + Vite + TypeScript + Vitest. 3D 복셀(`VoxelBuilder`)을 직교 픽셀 렌더(`pixelRenderer.ts`)로 그리고, UI 는 단일 캔버스 HUD(`src/ui/hud.ts`).
- 이야기: 인트로 + 1~6권 + 아우트로, **총 50개 챕터** (1권 13 · 2권 9 · 3권 6 · 4권 5 · 5권 8 · 6권 7 · 인트로 1 · 아우트로 1). 메타데이터는 `src/data/catalog.json` ⓣ.
- 진입점: `src/main.ts` → `createGame()` (`src/game/createGame.ts`, 조립 루트 ~230줄: 서브시스템을 만들어 서로 연결만 한다).

### 핵심 규약 (CLAUDE.md)
1. **프레임당 할당 금지**: 매 프레임 도는 코드(`frame()`, `Player.update`, HUD draw)는 새 배열·객체·클로저를 만들지 않는다. 레이아웃은 캐시한다 (HUD `wrapMemo`/`captionLayout`/`toastLayout`, 모듈 상수 하트 도트).
2. **지연 스테이지**: 활성 무대만 빌드하고 전환 때 지오메트리·비공유 재질·텍스처를 해제한다 (`StageManager.disposeCurrentStage`, 공유 재질은 `voxel.ts` 의 `sharedMaterials` Set 으로 O(1) 판별) ⓣ.
3. **성경 vs 전승 구분**: 카탈로그 태그(미드라시·탈무드·랍바·산헤드린 …)가 있는 챕터는 진입 시 `[전해오는 이야기 · 출처]` 를 알린다 (`chapterScript.traditionSources`) ⓣ.
4. **번역**: 한국어 문자열이 키. `en.json` + `en_extra.json`(우선순위는 en.json) ⓣ.

## 2. 모듈 지도 (`src/game/`)

| 모듈 | 책임 | 순수? | 테스트 |
|---|---|---|---|
| `createGame.ts` | 조립 루트: 렌더러·HUD·오디오·스테이지·컷신·저장·입력을 만들어 아래 모듈에 연결 | 아니오 | 간접(헤드리스 QA) |
| `gameState.ts` | 한 판의 진행 상태(권·장·선택·끝낸 장·플레이 시간) + `loopSignature` | 예 | `gameModules.test.ts` |
| `chapterFlow.ts` | 장 불러오기·상호작용 루프·다음 장·에필로그 흐름 (`createChapterFlow`) | 아니오(deps 주입) | `stageForMapId`·`toStageId` 만 |
| `frameLoop.ts` | rAF 프레임 본문(할당 0)·오류 격리·전역 오류 토스트 | 아니오 | 간접 |
| `playerMotion.ts` | 키 + 클릭 이동 → 이동 입력 (`resolveMove`, 제자리 갱신) | 예 | `gameModules.test.ts` |
| `saveSession.ts` | 스냅샷·`SaveLifecycle` 연결·이어하기 복원·도움말 본 표시 | 일부 | `buildSnapshot`·`toOutcome` |
| `protagonists.ts` · `gameLights.ts` | 주인공별 외형 표 · 조명 생성/횃불 밝기 | 예 | `gameModules.test.ts` |
| `progression.ts` | 다음 장/권 계산, 범위 보정 (`nextChapterTarget`, `bookStartTarget`, `clampTarget`) | 예 | ⓣ `progression.test.ts` |
| `chapterRouter.ts` | (권, 장) → 직접 쓴 컷신 장면 키 표 (`sceneKeyFor`) | 예 | ⓣ `chapterRouter.test.ts` |
| `chapterScript.ts` | JSON 대본에서 재생 가능한 대사만 추림, 전승 출처 추출 | 예 | ⓣ `chapterScript.test.ts` |
| `timeOfDay.ts` | 책·무대별 하늘/태양/그림자 방향 프리셋 | 예 | ⓣ |
| `guard.ts` | 프레임 연속 실패 감시 (`FrameHealth`) | 예 | ⓣ |
| `guidance.ts` | 목표 안내 핀 대상 선택 (`findGuidanceTarget`, 안전망보다 실제 상호작용 우선) | 예 | ⓣ `guidance.test.ts` |
| `actionWiring.ts` | (권, 장, 무대) → 액션 모듈 선택·등록 (`wireChapterActions`) | 예(의존 주입) | ⓣ `actionWiring.test.ts` |
| `panelToggles.ts` | 장 선택·일시정지·도움말·도감 열기/닫기 규칙(서로 겹쳐 열리지 않게) | 예 | ⓣ `panelToggles.test.ts` |
| `storyFlags.ts` | story.flags/done 직렬화·복원 (`loop:`·`pick:`·`chlog:`) | 예 | ⓣ `storyFlags.test.ts` |
| `chapterPlayback.ts` | 장 대본(JSON) 대사 재생(지연 로드·재시도·장 바뀜 가드)과 전승 출처 안내 (`createChapterPlayback`) | 예(의존 주입) | ⓣ `chapterPlayback.test.ts` |
| `timers.ts` | 장 전환 시 무효화되는 `after()` (대사·선택지 체인용) | 예 | ⓣ `timers.test.ts` |
| `chapterLog.ts` | 장 내부 진행 기록·재생(프록시) | 예 | ⓣ `chapterLog.test.ts` |
| `atmosphere.ts` | 지역 팔레트 대기 + 시간대 덧입힘 + 미니맵 지명 (`createAtmosphere`) | three 의존 | |
| `menus.ts` | 선택지·권/장 선택·도감·도움말·일시정지(새로 시작·언어)·컷신 넘기기 키 라우팅 | DOM 없음(deps 주입) | 헤드리스 QA |
| `devHooks.ts` | 개발 전용 `window.__abraham` / `__AGY_DEBUG__` (DEV 에서만 호출) | | |
| `fatal.ts` | 그래픽 초기화 실패·오류 안내 화면, WebGL 컨텍스트 손실 감시 | DOM 주입 | |
| `saveLifecycle.ts`, `saveLock.ts` | 자동 저장·탭 간 충돌 방지 | 일부 | ⓣ |
| `input.ts`, `panels.ts`, `pointer.ts` | 키·포인터 우선순위 라우팅 | 일부 | ⓣ |

## 3. 챕터가 재생되는 순서

`loadChapter(book, chapter, forceLoop)` (createGame.ts):

1. `cancelTimers()` 로 이전 장의 지연 실행을 무효화, 목표 패널을 권·장 제목으로 초기화.
2. `loadChapterCore`: 무대(`StageManager`)·대기(`applyAtmosphere` + `timeOfDayFor`)·주인공 외형을 세운다.
3. 상호작용 루프 등록(`setupInteractiveLoop`): 1권은 우르 통합 루프(`book1Actions`), 2~6권은 `book2..6Actions`(무대별).
   - 같은 상호작용 묶음(시그니처 `권:id,id,…`)을 한 번 끝냈으면 **순차 진행에서는 건너뛰고** `story_continue`("다음 이야기로")만 둔다. 장 선택 메뉴로 들어오면(`forceLoop`) 다시 플레이한다. 완료 기록은 저장된다(`story.flags['loop:…']`).
   - 어떤 상호작용도 없는 장에는 `story_continue` 안전망이 붙어 **빈 장(소프트락)이 없다**.
4. `chapterRouter.sceneKeyFor(book, chapter)` 에 직접 쓴 장면이 있으면 `Cutscene`(`src/systems/scenes/book*/`)으로 재생.
5. 직접 쓴 장면이 없는 장은 챕터 대본(`abraham_N.json`)의 **대사만** 동적 import 로 불러 `CutsceneEngine` 으로 재생한다 (화자 초상화 패널 + 보이스 클립). 대본의 Godot 2D 연출 스텝(spawn/move/camera)은 3D 무대에서 재현할 수 없어 쓰지 않는다.
6. 전승 챕터면 출처 토스트.

→ 1~6권 모든 장은 "직접 쓴 장면 또는 대본 대사 ≥1줄"을 가진다 ⓣ(`chapterRouter.test.ts`).

## 4. 컷신 두 엔진

- **`Cutscene`** (`cutscene.ts`) — 코드로 쓴 스텝(`caption`/`do`/`wait`/`animate`/`until`). 캡션은 `speaker` 가 있으면 자막바에 화자 초상화(`src/ui/portraits.ts`)와 이름을 그린다. 음성은 `voice` 필드 또는 캡션 텍스트 자동 조회.
- **`CutsceneEngine`** (`cutsceneEngine.ts`) — Godot JSON 스텝 해석기. 지금은 인트로·아우트로 전체와, 위 5번의 대사 전용 재생에만 쓴다.

## 5. 데이터

- `src/data/catalog.json` — 장 제목·요약·태그 (장 선택·세이브·전승 표기의 원천). `src/data/books/index.ts` 가 1~6권을 이것으로 만든다 (`steps: []`).
- `src/data/books/abraham_intro|outro.json` — 번들에 포함 (인트로/아우트로 스텝).
- `src/data/books/abraham_1..6.json` (~780KB, Godot 덤프) — **번들에 넣지 않고** 필요한 권만 `import()` 로 지연 로드한다 (별도 청크). 장 선택 `Tab` 으로 들어간 권만 내려받는다.
- `voiceManifest.json`/`sfxManifest.json` — 오디오 키 검증(`VALID_VOICE_PATHS`, SFX 키는 테스트가 소스와 대조) ⓣ.

## 6. 남은 레거시 (정직한 현황)

- `src/systems/actions/book1LentilActions.ts` (이전 이름 `bookActions.ts`) — 1권 12장(팥죽) 단일 상호작용만 남겼다. 나머지 분기는 도달 불가라 제거했고, 이름을 실제 책임에 맞췄다.
- `createGame.ts` 는 880줄 → ~230줄 조립 루트로 줄였다. 장 흐름은 `chapterFlow.ts`, 프레임 루프는 `frameLoop.ts`, 진행 상태는 `gameState.ts`, 저장은 `saveSession.ts`, 이동은 `playerMotion.ts` 로 분리했다. (이전 기록: ~0.88k줄, 대본 재생·전승 안내는 `chapterPlayback.ts`, 저장 플래그는 `storyFlags.ts`, 메뉴 토글은 `panelToggles.ts`, 액션 배선은 `actionWiring.ts` 로 분리: 입력/메뉴·대기·개발 훅은 `menus.ts`/`atmosphere.ts`/`devHooks.ts` 로 분리함). 남은 큰 덩어리는 `frame()` 본문과 월드 클릭/이동 바인딩, 챕터 로딩이다. 다음 분리 후보: 목표 안내 마커 갱신, 월드 클릭 바인딩.
- 챕터 **내부** 진행은 `chapterLog.ts` 의 입력 기록(`story.flags['chlog:권:장|a:id|c:n…']`)을 시작 시 재생해 복원한다 (`Interactions.onAct` 로 기록, HUD·오디오·입자·컷신은 재생 중 무음 프록시, `timers.setReplayImmediate`). 완료한 루프(`loop:*`)와 위치도 저장한다.

## 7. 개발 전용 훅 (프로덕션 번들에서 제거됨)

`import.meta.env.DEV` 안에서만 노출: `window.__abraham`(상태·상호작용 목록·`goto`·`activate`·`skipCutscenes`), `window.__AGY_DEBUG__`/`__GAME__`. 헤드리스 QA(`tools/qa/qa-abraham.mjs`)는 `__abraham.state()` 로 **각 권이 실제로 로드됐는지 단언**한다. 빌드 후 `dist/` 에 이 이름들이 없어야 한다.

## 8. 저장 (`src/systems/save.ts`)

선택한 갈래는 `story.flags['pick:<단계 id>']` 에 문자열로 저장되고 (`GameState.picks` 맵), `beatLoop` 의 `toast` 함수가 `getPick` 으로 읽어 이후 장의 대사를 바꾼다.

멀티 슬롯, `.prev`/`.bak` 세대 보관, 깨진 저장 격리, 더 새 버전 저장 잠금, 용량 초과 처리, Web Locks + `storage` 이벤트로 탭 충돌 방지. `story`: `book/chapter/hero/flags(loop:*)`, `player`(위치), `stageId`. 일시정지 메뉴의 **새로 시작**은 확인 후 `discardSave()`(백업 보관) → 새로고침. 다른 탭과 충돌하면 이 탭은 읽기 전용이 되고 새로고침하면 최신 저장에서 이어진다.

## 9. 오류 처리

`frame()` 은 try/catch 로 감싸고 `requestAnimationFrame` 을 항상 다시 건다. 연속 30프레임 실패하면(`FrameHealth`) '새로고침' 안내 화면을 띄운다. 전역 `error`/`unhandledrejection` 은 기록하고 토스트를 10초에 한 번만 띄운다.

## 10. HUD (`src/ui/hud.ts`, `hudMenus.ts`, `hudDialogue.ts`, `hudPanels.ts`, `hudClicks.ts`, `hudWorld.ts`)

`hudMenus.ts` 는 장 선택·일시정지·도움말·도감 패널 그리기(`drawChapterSelect` 등, `Hud` 를 인자로 받는 함수)를 담는다 — `hudDialogue.ts` 는 대사 패널·선택지·자막·시네마틱 제목 그리기를 담는다. `hudPanels.ts` 는 목표 패널·토스트·배너·프롬프트·미니맵을, `hudClicks.ts` 는 메뉴 마우스·터치 클릭 처리를, `hudWorld.ts` 는 월드 위 하트·말풍선을 담는다. `hudFrame.ts` 는 프레임 전체 그리기(`drawFrame`, 비네트·토스트 쌓기·배너·프롬프트·마커), `hudLayout.ts` 는 자막 줄 나눔 배치, `hudCodex.ts` 는 도감 항목 데이터, `hudTypes.ts` 는 자료형을 담는다. 이렇게 `hud.ts` 는 2178줄 → 995줄 → ~514줄(상태·공개 API·글자 도우미)로 줄었다. HUD 그리기 경로의 `Math.max(...)`·`.filter`·`.map`·Map 반복자 할당은 인덱스 루프·모듈 버퍼로 바꿨다(토스트 배치 캐시 미스 때만 실행, 배너 부제는 캐시, 선택 요약은 `Map.forEach` + 모듈 콜백).

단일 캔버스, 정수 배율 픽셀 스냅. 패널 우선순위는 `panels.ts`. 장 선택·일시정지·도움말은 키보드와 마우스/터치 모두 지원(히트 사각형은 재사용 객체). 초상화는 `portraits.ts` 가 절차적으로 그린 캔버스를 한 번 캐시해 `drawImage` 한다.

## 11. 계획의 4대 확장 ↔ 실제 코드 (이름 대응)

CLAUDE.md 가 말하는 네 확장은 같은 이름의 모듈이 아니라 아래 코드로 구현되어 있다 (이름만 찾으면 없는 것처럼 보이므로 명시한다).

| 계획의 이름 | 실제 구현 |
|---|---|
| `StageManager` | `src/world/stageManager.ts` — 14개 무대를 지연 빌드·해제 |
| `CastRegistry` | `src/entities/cast.ts` (`CAST_REGISTRY`, `ProtagonistId`) + `protagonists.ts` 의 `PROTAGONIST_APPEARANCES` |
| `Choreography` | 코드 스텝 `Cutscene`(`systems/cutscene/cutscene.ts`) + 장면 파일(`systems/scenes/book*/`) + 라우팅 표(`game/chapterRouter.ts`) + Godot 스텝 해석기 `CutsceneEngine` |
| `BiblesAssetBridge` | `data/catalog.json`(메타) + 지연 로드 `abraham_N.json`(대본, `game/chapterScript.ts`) + `voiceManifest.json`/`sfxManifest.json` + `audioManager` 의 `VALID_VOICE_PATHS` 검증 |
