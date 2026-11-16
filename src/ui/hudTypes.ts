/** HUD 가 주고받는 자료형 (상태 모양만; 그리기·배치 코드는 hud*.ts 의 다른 파일) */
export interface ActiveDialogue {
  speaker: string | null;
  text: string;
  age: number;
  life: number;
}

export interface GoalProgress {
  current: number;
  total: number;
  label?: string;
}

export interface DialogueOption {
  text: string;
  badge?: string;
  badgeColor?: string;
}

export interface DialogueChoice {
  prompt: string;
  options: DialogueOption[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export interface CodexEntry {
  id: string;
  title: string;
  source: string;
  summary: string;
  detail: string;
  unlocked: boolean;
}

export interface Toast { key: string; iconId: string | null; name: string; count: number; age: number; life: number }
export interface Heart { x: number; y: number; z: number; age: number }
export interface Speech { x: number; y: number; z: number; text: string; age: number; life: number; delay: number; follow?: () => { x: number; z: number } }
export interface Prompt { x: number; y: number; label: string; hint?: string }
