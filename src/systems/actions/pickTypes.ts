/**
 * 선택(갈래) 읽기·기록 함수와 성향의 공용 타입 — 액션 모듈마다 따로 선언하던 것을 한 곳에 모았다.
 * 값은 createGame 의 `picks` 맵(저장됨, story.flags 'pick:…')이 가진다.
 */
export type GetPick = (beatId: string) => string | undefined;
export type SetPick = (beatId: string, tag: string) => void;
/** 지금까지 한 선택에서 가장 많은 성향 */
export type Trait = 'courage' | 'trust' | 'care';
export type GetTrait = () => Trait | null;
