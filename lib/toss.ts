export const TOSS_BALLS = 10;
/** 20 球までは 5×5、それより多いモードはマスを広げる (たまは空いたマスにしか落ちないので、25 マスに 25 球以上だと全部うまってしまう)。 */
export const BALL_OPTIONS = [8, 10, 12, 15, 20, 25, 30, 40, 50] as const;

/** たまの数に合うビンゴカードの一辺。マス数がたまの数より多くなるようにする。 */
export function gridSizeForBalls(balls: number): number {
  if (balls <= 20) return 5; // 25 マス
  if (balls <= 30) return 6; // 36 マス
  if (balls <= 40) return 7; // 49 マス
  return 8;                  // 64 マス
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Returns a size×size grid of numbers 1–size² in random order. */
export function generateTossGrid(size = 5): number[][] {
  const nums = shuffle(Array.from({ length: size * size }, (_, i) => i + 1));
  return Array.from({ length: size }, (_, r) => nums.slice(r * size, r * size + size));
}

import type { LineSegment } from '@/lib/types';

export function getTossLineSegments(marked: boolean[][]): LineSegment[] {
  const n = marked.length;
  const last = n - 1;
  const segs: LineSegment[] = [];
  for (let r = 0; r < n; r++) {
    if (marked[r].every(Boolean)) segs.push({ r1: r, c1: 0, r2: r, c2: last });
  }
  for (let c = 0; c < n; c++) {
    if (marked.every((row) => row[c])) segs.push({ r1: 0, c1: c, r2: last, c2: c });
  }
  if (marked.every((row, i) => row[i])) segs.push({ r1: 0, c1: 0, r2: last, c2: last });
  if (marked.every((row, i) => row[last - i])) segs.push({ r1: 0, c1: last, r2: last, c2: 0 });
  return segs;
}

export interface TossLineResult {
  /** Set of "r,c" keys belonging to at least one completed line. */
  cells: Set<string>;
  /** Number of completed lines (rows + cols + diags). */
  count: number;
}

export function checkTossLines(marked: boolean[][]): TossLineResult {
  const n = marked.length;
  const cells = new Set<string>();
  let count = 0;

  for (let r = 0; r < n; r++) {
    if (marked[r].every(Boolean)) {
      count++;
      for (let c = 0; c < n; c++) cells.add(`${r},${c}`);
    }
  }
  for (let c = 0; c < n; c++) {
    if (marked.every(row => row[c])) {
      count++;
      for (let r = 0; r < n; r++) cells.add(`${r},${c}`);
    }
  }
  if (marked.every((row, i) => row[i])) {
    count++;
    for (let i = 0; i < n; i++) cells.add(`${i},${i}`);
  }
  if (marked.every((row, i) => row[n - 1 - i])) {
    count++;
    for (let i = 0; i < n; i++) cells.add(`${i},${n - 1 - i}`);
  }

  return { cells, count };
}

/** Sum of all numbers in cells that are part of at least one bingo line. */
export function calcTossScore(grid: number[][], lineCells: Set<string>): number {
  let total = 0;
  for (const key of lineCells) {
    const [r, c] = key.split(',').map(Number);
    total += grid[r][c];
  }
  return total;
}

// ── Gauge mechanics ───────────────────────────────────────────────────────────

export type GaugeZone = 'perfect' | 'good' | 'ok' | 'miss';

/**
 * Determine zone from a normalised ring radius (0 = dot = smallest, 1 = full size).
 * PERFECT: ring is nearly a dot (nr < 0.15)
 * GOOD:    small ring (0.15–0.45)
 * OK:      medium ring (0.45–0.75)
 * MISS:    large ring (0.75–1.0)
 */
export function getZoneFromRadius(nr: number): GaugeZone {
  if (nr < 0.15) return 'perfect';
  if (nr < 0.45) return 'good';
  if (nr < 0.75) return 'ok';
  return 'miss';
}

/**
 * Calculate the actual cell the ball lands on, given the aimed target and
 * the gauge zone that was hit.
 * - perfect → exact target
 * - good    → target or ≤1 Manhattan distance (weighted toward target)
 * - ok      → target or ≤2 Manhattan distance (weighted toward target)
 * - miss    → any random unmarked cell
 */
export function calcLandingCell(
  targetRow: number,
  targetCol: number,
  zone: GaugeZone,
  marked: boolean[][],
): [number, number] {
  const unmarked: [number, number][] = [];
  for (let r = 0; r < marked.length; r++)
    for (let c = 0; c < marked[r].length; c++)
      if (!marked[r][c]) unmarked.push([r, c]);

  if (unmarked.length === 0) return [targetRow, targetCol];

  if (zone === 'perfect') return [targetRow, targetCol];

  if (zone === 'miss') {
    return unmarked[Math.floor(Math.random() * unmarked.length)];
  }

  const spread = zone === 'good' ? 1 : 2;
  const candidates = unmarked.filter(
    ([r, c]) => Math.abs(r - targetRow) + Math.abs(c - targetCol) <= spread,
  );
  const pool = candidates.length > 0 ? candidates : unmarked;

  // Weight: distance=0 → 6, distance=1 → 2, distance≥2 → 1
  const weights = pool.map(([r, c]) => {
    const d = Math.abs(r - targetRow) + Math.abs(c - targetCol);
    return d === 0 ? 6 : d === 1 ? 2 : 1;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
