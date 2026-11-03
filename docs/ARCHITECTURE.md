# 아브라함 (Abraham) 아키텍처 및 런타임 규약

## 1. 렌더 파이프라인 및 프레임 루프
- **Orthographic Pixel Art Pipeline**:
  - Three.js OrthographicCamera (기본 50° 틸트, 수평 Vista 시 4° 틸트).
  - 내부 세로 540px 해상도 렌더링 후 정수 배율 업스케일링.
  - VoxelBuilder: 16 texels/unit (`TD=16`), 머티리얼별 청크 분할 및 지오메트리 통합.
- **Zero Allocation in `frame(dt)`**:
  - 프레임 루프 내부에서 새 객체나 배열을 생성하지 않고 정적 버퍼를 재사용한다.

## 2. 지연 스테이지 관리 (`StageManager`)
- 12개 이상의 대규모 성경 역사 무대를 권/장 단위로 지연 빌드:
  - `MESOPOTAMIA`: 우르 공방, 니므롯 왕궁, 풀무불 광장, 하란 캠프.
  - `CANAAN`: 세겜/벧엘 상수리나무 언덕, 살렘 성문, 마므레 장막 일대.
  - `EGYPT`: 애굽 국경 세관, 바로의 왕궁.
  - `SODOM_NEGEV`: 소돔 성문 및 거리, 브엘세바 우물터, 모리아산 등산로 및 정상, 헤브론 막벨라 굴.
- 활성 무대만 메모리에 적재하고 다른 권/장 진입 시 지오메트리를 `dispose()`하여 메모리 누수를 완전히 방지.

## 3. 액터 & 40인 캐스트 시스템 (`Actor`, `CastRegistry`)
- `CastRegistry`: 40여 명의 성경 인물 외형(Appearance: 신체 크기, 옷 색상, 모자/면류관, 수염, 소품) 프리셋.
- 주인공 시점 전환:
  - `abram_young` (1권 청년 아브람)
  - `abram` (2~3권 중년 아브람)
  - `abraham` (4~6권 노년 아브라함)
  - `lot` (4권 소돔 성문 및 탈출)
  - `eliezer` (6권 나홀 성 우물가)
  - `esau` (1권 코다 들판 추격 및 팥죽)
- 3D 복셀 관절 포즈: `stand`, `walk`, `kneel`, `fallen`, `pray`, `carry_wood`, `swing_axe`, `sit`.
- 소품 부착(`attachProp`): `axe`, `torch`, `staff`, `knife`, `pitcher`, `jewels`, `wood`.

## 4. 확장 컷신 엔진 (`Choreography` / `CutsceneEngine`)
- Godot `.tres` 대본 기반 3644개 연출 스텝 실행.
- 지원 스텝:
  - `dialogue`: 화자, 자막(타이프라이터), 초상화, TTS 음성 동기화
  - `spawn` / `despawn` / `spawn_crowd`: 액터 및 군중 생성/제거
  - `move_actor` / `face_actor` / `pose_actor`: 이동, 방향, 복셀 포즈
  - `camera_move` / `to_vista`: 카메라 이동 및 원경 파노라마
  - `play_bgm` / `stop_bgm` / `play_sfx` / `play_ambience`: 오디오 제어
  - `title` / `fade` / `shake` / `wait` / `tint`: 시각 효과 및 연출
  - `choice` / `action_prompt`: 플레이어 선택지 및 인터랙션 유도

## 5. 저장/로드/백업 (`SaveLifecycle`)
- 3개 독립 슬롯 지원, 탭 충돌 방지 및 자동 복구.
- 저장 데이터: 현재 권/장, 주인공 ID, 위치, 플레이 시간, 챕터별 상호작용 진행도.
