# Alaskah Abraham — QA 런북 (QA Runbook)

본 문서는 `alaskah-abraham`의 헤드리스 브라우저 QA 테스트 하네스 사용법, 검증 항목 및 문제 해결 절차를 안내합니다.

---

## 1. 개요 (Overview)

`alaskah-abraham`은 Three.js 기반의 3D 복셀 렌더링과 단일 캔버스 2D HUD를 사용하므로, 정적 단위 테스트(Vitest) 외에도 실제 브라우저 환경에서의 렌더 파이프라인 무결성을 보장하기 위해 Puppeteer 기반의 헤드리스 QA 시스템(`tools/qa/`)을 운용합니다.

핵심 테스트 러너인 `tools/qa/qa-abraham.mjs`는 게임의 6개 전권(Book 1~6)을 자동으로 탐색하여 다음을 종합 검증합니다:
1. **무결성 검증**: 브라우저 콘솔 에러(`console.error`) 및 페이지 예외(`pageerror`) 0건 보장.
2. **렌더러 상태**: `<canvas>` 뷰포트의 정상 마운트 및 0이 아닌 유효한 해상도(non-zero bounding box).
3. **독립 컨텍스트**: 각 권마다 신선한 브라우저 컨텍스트(`createBrowserContext`)를 사용하여 `localStorage` 및 세션 오염 방지.
4. **시각적 차별성 (Visual Uniqueness)**: 6개 권의 렌더링 프레임 스크린샷(`docs/qa/books/bookN.png`)의 SHA-256 해시를 비교하여 동일한 빈 화면이나 정체된 프레임이 아님을 수학적으로 검증.

---

## 2. 사전 요구사항 (Prerequisites)

- **Node.js**: v18.0.0 이상
- **Google Chrome 또는 Chromium**:
  - macOS 기본 경로: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
  - Linux: `/usr/bin/google-chrome` 또는 `/usr/bin/chromium-browser`
  - 환경변수 `CHROME_PATH`로 임의의 경로 지정 가능 (지정하지 않을 경우 Puppeteer의 `'chrome'` 채널 자동 탐색)

---

## 3. 실행 방법 (Quick Start)

### 1단계: 로컬 개발 서버 기동
터미널 1에서 Vite 개발 서버를 실행합니다:
```bash
npm run dev
# 기본 포트 5174로 실행됩니다.
```

### 2단계: 헤드리스 QA 실행
터미널 2에서 QA 러너를 실행합니다:
```bash
# 기본 포트(5174) 및 기본 크롬 경로 사용
node tools/qa/qa-abraham.mjs

# 또는 포트 및 크롬 경로를 환경변수로 지정
PORT=5174 CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/qa/qa-abraham.mjs
```

---

## 4. 자동 탐색 시퀀스 (Automation Workflow)

`qa-abraham.mjs`는 각 권(Book 1 ~ 6)에 대해 순차적으로 다음 작업을 수행합니다:

1. **신규 브라우저 컨텍스트 생성**: 독립된 쿠키 및 로컬스토리지 환경 격리.
2. **페이지 접속**: `http://localhost:${PORT}` 접속 후 WebGL 초기화 대기 (2.5초).
3. **캔버스 크기 검증**: DOM의 `<canvas>` 요소를 취득하여 폭과 높이가 양수인지 확인.
4. **부팅 인트로 스킵**: `Space` 키를 16회 연타하여 첫 시작 컷신 대사 고속 통과.
5. **권/장 선택 UI 진입**: `Tab` 키 입력으로 챕터 셀렉트 모달 열기.
6. **목표 권으로 이동**: `ArrowRight` 키를 `(bookNum - 1)`회 입력하여 목적지 권 선택.
7. **챕터 로드**: `Enter` 키를 입력하여 해당 권 1장 시작.
8. **컷신 대사 스킵**: `Space` 키 10회 연타 후 무대 렌더링 안정화 대기 (1.5초).
9. **스크린샷 캡처 및 해시 계산**:
   - 파일 저장: `docs/qa/books/book${bookNum}.png`
   - SHA-256 해시를 계산하여 메모리에 기록.
10. **브라우저 컨텍스트 파기**.
11. **전체 해시 상이성 평가**: 6개 스크린샷 간 해시 충돌(동일 화면)이 있을 시 즉시 실패 처리.
12. **에러 요약 출력 및 프로세스 종료**: 누적된 콘솔/페이지 에러가 존재할 경우 exit code 1로 종료.

---

## 5. 산출물 (Artifacts)

QA 실행 성공 시 다음 경로에 각 권의 고유 무대 스크린샷이 저장됩니다:

- `docs/qa/books/book1.png`: 제1권 우르 공방 / 풀무불
- `docs/qa/books/book2.png`: 제2권 세겜 모레 상수리나무 제단 / 애굽
- `docs/qa/books/book3.png`: 제3권 마므레 뭇별과 언약의 밤
- `docs/qa/books/book4.png`: 제4권 마므레 세 나그네 영접 / 소돔 성문
- `docs/qa/books/book5.png`: 제5권 브엘세바 에셀나무 / 모리아 번제단
- `docs/qa/books/book6.png`: 제6권 헤브론 막벨라 굴 / 나홀 성 우물가

---

## 6. 추가 특화 QA 스크립트

특정 권 또는 핵심 서사 구간에 대한 심층 검증 스크립트 목록입니다:

| 스크립트 | 대상 서사 및 검증 내용 | 산출물 위치 |
|---|---|---|
| `tools/qa/qa-furnace.mjs` | 우르 풀무불 기적 및 니므롯 대치 (6단계 연속 캡처) | `docs/qa/furnace/` |
| `tools/qa/qa-book1-improvement2.mjs` | 1권 전체 서사 17개 주요 포인트 종합 워크스루 | `docs/qa/improvement2/` |
| `tools/qa/qa-stages.mjs` | 1~6권 **전 장(48개)** 이동 단언(state 가 맞는지) + 화면 해시 중복 검사. 권별 첫·마지막 장과 새 무대 첫 장면을 저장 | `docs/qa/stages/` |

---

## 7. 문제 해결 (Troubleshooting)

### Q1. `Failed to launch the browser process!` 에러
- **원인**: 시스템에 Chrome이 설치되어 있지 않거나 경로 탐색에 실패한 경우입니다.
- **해결**: 크롬 설치 경로를 확인한 후 `CHROME_PATH` 환경변수를 설정하여 실행하세요:
  ```bash
  export CHROME_PATH="/usr/bin/google-chrome"
  node tools/qa/qa-abraham.mjs
  ```

### Q2. `net::ERR_CONNECTION_REFUSED` 에러
- **원인**: 로컬 개발 서버가 기동되지 않았거나 포트가 일치하지 않는 경우입니다.
- **해결**: `npm run dev`가 정상 실행 중인지 확인하고, 출력된 포트에 맞추어 `PORT=5174 node tools/qa/qa-abraham.mjs`와 같이 포트를 명시하세요.

### Q3. `Assertion Failed: 제N권과 제M권의 렌더링 프레임 해시가 동일합니다`
- **원인**: 씬 전환 시 화면이 검은 화면으로 멈췄거나, 키 입력이 전달되지 않아 첫 화면에 정체된 상태입니다.
- **해결**: 개발자 도구를 띄운 상태로 브라우저를 열어(또는 `headless: false` 설정) 키 입력 딜레이(`sleep`)를 조정하거나 WebGL 그래픽 초기화 실패 여부를 확인하세요.

## 모바일 터치 QA (에뮬레이션)

개발 서버(`npm run dev`)를 띄운 뒤 `PORT=5174 npm run qa:mobile`. 모바일 가로 뷰포트와 터치 입력으로 터치 UI 표시와 도움말·장 선택·일시정지 메뉴 탭 동작을 단언하고 `docs/qa/mobile/` 에 스크린샷을 남긴다. 실제 기기 QA 를 대신하지 않는다.

### 한 번에 전부

`npm run qa:all` (개발 서버가 없으면 스스로 띄우고 끝나면 끈다. `QA_NO_SERVER=1` 이면 이미 떠 있는 `PORT` 서버만 쓴다) — `qa:abraham`(6권 진입)·`qa:mobile`·`qa:progress`·`qa:visual`·`qa-stages`·`qa-furnace`(권별 연출 스크린샷) 을 차례로 돌리고 하나라도 실패하면 실패 목록과 함께 종료 코드 1 로 끝난다(`tools/qa/run-all.mjs`). `qa-book1*.mjs` 는 1권 개발용 보조 스크립트라 포함하지 않는다.

### 시각 회귀 QA

개발 서버를 띄운 뒤 `PORT=5174 npm run qa:visual`. 6개 권 첫 장면과 장 선택 화면을 960×600 으로 찍어 `docs/qa/baseline/` 의 기준 이미지와 비교한다(채널 차이 24 초과 픽셀이 4% 넘으면 실패 — 입자·물결 움직임은 허용). 의도한 시각 변경 뒤에는 `node tools/qa/qa-visual.mjs --update` 로 기준을 갱신하되, 실패 시 저장되는 `*.actual.png` 를 기준과 눈으로 비교한 뒤에 한다. 일부러 3권 조명을 어둡게 바꿔 보면 3권만 26.8% 로 실패하고 나머지는 0.8% 이하로 통과함을 확인했다.

### 진행 표시 QA

개발 서버를 띄운 뒤 `PORT=5174 npm run qa:progress`. 1권 7장(궁정)을 끝까지 플레이해 끝낸 장 목록(`✓`)·한 선택(`지금까지 한 선택`)·선택에 따라 생기는 다음 장 단계(`furnace_bold`)를 단언하고 장 선택 화면 스크린샷을 `docs/qa/progress/` 에 남긴다.

## HUD 사용성 점검 (docs/qa/stages, docs/qa/mobile 스크린샷으로 눈 확인)
- 전승 안내 상자: 화면 맨 아래 띠, 상호작용 프롬프트(E)를 덮지 않는다 (`src/ui/dialogueLayout.ts`, `tests/hudUsability.test.ts`).
- 글자: 터치가 아니어도 12 CSS px 미만으로 그리지 않는다 (`textSize.DESKTOP_MIN_CSS_PX`), 할 일 본문은 작은 창에서 14.
- 장 선택: `이어하기`(지금 하던 장)·`추천`(처음 끝내지 않은 장) 꼬리표, 스크롤 막대와 ▲▼ 개수, 자유 선택 안내 줄.
- 첫 플레이 안내(3단계, 각 4.5초, 대사·메뉴 중에는 멈춤): 새 브라우저 프로필에서 확인. 한 번 끝나면 `abraham.onboard.v1` 로 다시 뜨지 않는다.
