export interface LineSegment { r1: number; c1: number; r2: number; c2: number; }

export type AppScreen =
  | 'home' | 'settings' | 'game' | 'result'
  | 'practice-settings' | 'practice'
  | 'easy-settings' | 'easy'
  | 'char-settings' | 'char-game'
  | 'char-practice-settings' | 'char-practice'
  /** components/games.ts に登録された standalone の遊び（activeGameId で選ぶ） */
  | 'play'
  | 'ranking'
  | 'session-complete';

// ── Character mode types ──────────────────────────────────────────────────────

export type ContentType = 'numbers' | 'hiragana' | 'katakana' | 'alphabet';

export interface CharGameSettings {
  contentType: Exclude<ContentType, 'numbers'>;
  bingoSubMode: 'char-show' | 'sound-match';
  cardMode: CardMode;
}

export interface CharPracticeSettings {
  contentType: Exclude<ContentType, 'numbers'>;
}

export interface PracticeSettings {
  operators: MathOperator[];
  maxNumber: MaxNumber;
}

export interface EasySettings {
  operators: Array<'+' | '-' | '×'>;
}

export interface EasyProblem {
  operator: '+' | '-' | '×';
  operandA: number;
  operandB: number;
  answer: number;
  expression: string;
  /** emoji used for the multiplication groups visual */
  emoji?: string;
}
export type MathOperator = '+' | '-' | '×' | '÷';
export type MaxNumber = 30 | 50 | 75;
export type CardMode = 'paper' | 'web';
/** reveal: tap to show answer  /  input: type the answer */
export type AnswerMode = 'reveal' | 'input';

export interface PlayerStats {
  name: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
}

export interface MathProblem {
  expression: string; // e.g. "12 × 5"
  answer: number;
}

export interface GameSettings {
  mode: 'standard' | 'calculation';
  answerMode: AnswerMode;
  operators: MathOperator[];
  maxNumber: MaxNumber;
  cardMode: CardMode;
}

/** 5×5 bingo card */
export interface BingoCard {
  cells: (number | 'FREE')[][];
  marked: boolean[][];
}

export interface GameState {
  remainingNumbers: number[];
  drawnNumbers: number[];
  currentNumber: number | null;
  currentProblem: MathProblem | null;
  /** true when input mode is active and waiting for player to submit an answer */
  awaitingAnswer: boolean;
  /** true = last draw matched card, false = recycled (miss or wrong), null = no draw yet */
  lastMatchFound: boolean | null;
  /** true when the last answer submission was wrong (input mode) */
  lastAnswerWrong: boolean;
  bingoCard: BingoCard | null;
  isGameOver: boolean;
}
