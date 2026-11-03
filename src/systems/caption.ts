/** 컷신 자막. voice = 하늘의 음성(화면 가운데 금빛 글자), narration = 이야기꾼(아래 레터박스), title = 제목 */
export type CaptionStyle = 'voice' | 'narration' | 'title';
export interface CaptionState { text: string; style: CaptionStyle; age: number; hold: number }
