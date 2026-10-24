/**
 * Ranking / leaderboard storage.
 * All entries live in a single localStorage key (bingo_ranking_v1).
 * 端末の中だけのランキング（家族用）。子供の名前を外に出さないため、サーバーには送らない。
 * Max 500 entries total; oldest/lowest are pruned to keep the list lean.
 */

export type RankGameMode =
  | 'toss'           // たまなげビンゴ — score (points)
  | 'janken'         // じゃんけん      — wins in session
  | 'shiritori'      // しりとり        — chain length
  | 'memory'         // しんけいすいじゃく — points (time + mistakes)
  | 'mogura'         // こたえモグラ   — correct answers in time
  | 'rhythm'         // リズムタップ   — points
  | 'practice'       // けいさん練習   — streak
  | 'easy'           // かんたん学ぼう — streak
  | 'char-practice'; // もじ練習       — streak

export type RankPeriod = 'day' | 'week' | 'all';

export interface RankEntry {
  playerName: string;
  score: number;
  ts: number;        // unix ms
  mode: RankGameMode;
}

export const RANK_MODE_META: Record<RankGameMode, { label: string; emoji: string; unit: string }> = {
  toss:           { label: 'たまなげ',   emoji: '⚾', unit: 'てん'  },
  janken:         { label: 'じゃんけん', emoji: '✊', unit: 'かち'  },
  shiritori:      { label: 'しりとり',   emoji: '🦒', unit: 'ことば' },
  memory:         { label: 'しんけい',   emoji: '🧠', unit: 'てん'  },
  mogura:         { label: 'モグラ',     emoji: '🐹', unit: 'もん'  },
  rhythm:         { label: 'リズム',     emoji: '🎵', unit: 'てん'  },
  practice:       { label: 'けいさん',   emoji: '🧮', unit: 'もん'  },
  easy:           { label: 'かんたん',   emoji: '🍎', unit: 'もん'  },
  'char-practice':{ label: 'もじ',       emoji: '📖', unit: 'もん'  },
};

const RANK_KEY  = 'bingo_ranking_v1';
const MAX_TOTAL = 500;

// ── Read / write ─────────────────────────────────────────────────────────────

export function loadAllRankEntries(): RankEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RANK_KEY);
    return raw ? (JSON.parse(raw) as RankEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Save a new score entry.
 * Only saves if score > 0 (avoids polluting the board with empty sessions).
 */
export function saveRankEntry(entry: Omit<RankEntry, 'ts'>): void {
  if (typeof window === 'undefined') return;
  if (entry.score <= 0) return;

  const all = loadAllRankEntries();
  all.push({ ...entry, ts: Date.now() });

  // Keep top MAX_TOTAL entries by score (per mode) to bound storage size
  all.sort((a, b) => b.score - a.score);
  localStorage.setItem(RANK_KEY, JSON.stringify(all.slice(0, MAX_TOTAL)));
}

// ── Query ─────────────────────────────────────────────────────────────────────

function periodCutoff(period: RankPeriod): number {
  const now = Date.now();
  if (period === 'day')  return now - 24 * 60 * 60 * 1000;
  if (period === 'week') return now - 7  * 24 * 60 * 60 * 1000;
  return 0;
}

export function getTopEntries(
  mode: RankGameMode,
  period: RankPeriod,
  limit = 10,
): RankEntry[] {
  const cutoff = periodCutoff(period);
  return loadAllRankEntries()
    .filter(e => e.mode === mode && e.ts >= cutoff)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** True if the given score is a new personal best for the player+mode+period. */
export function isPersonalBest(
  playerName: string,
  mode: RankGameMode,
  score: number,
): boolean {
  const cutoff = periodCutoff('all');
  const best = loadAllRankEntries()
    .filter(e => e.mode === mode && e.playerName === playerName && e.ts >= cutoff)
    .reduce((max, e) => Math.max(max, e.score), 0);
  return score > best;
}
