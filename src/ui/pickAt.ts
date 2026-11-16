// DOM 에 의존하지 않는 순수 데이터 (단위 테스트가 hudMenus → pixelText(document) 를 끌어오지 않게 분리)

/** 선택 id → 그 선택을 한 장 [권, 장 인덱스] (장 선택에는 그 장의 실제 제목을 보인다 — 번호 매기기가 어긋나지 않게) */
export const PICK_AT: Record<string, readonly [number, number]> = {
  palace_answer: [1, 6],
  haran_depart: [1, 9],
  esau_eat: [1, 11],
  war_envoy: [2, 4],
  archery_target: [3, 0],
  sarah_tent: [3, 0],
  satan_elder: [5, 4],
  isaac_field: [6, 2],
};
