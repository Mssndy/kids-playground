import type { PlayerStats } from './types';
import { pushRecordToServer, fetchRecordsFromServer } from './api';

const STORAGE_KEY = 'bingo_player_stats';

export function loadAllStats(): Record<string, PlayerStats> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PlayerStats>) : {};
  } catch {
    return {};
  }
}

export function loadStatsForPlayer(name: string): PlayerStats | null {
  const all = loadAllStats();
  return all[name] ?? null;
}

export function saveStats(stats: PlayerStats): void {
  if (typeof window === 'undefined') return;
  const all = loadAllStats();
  all[stats.name] = stats;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function createEmptyStats(name: string): PlayerStats {
  return { name, wins: 0, losses: 0, gamesPlayed: 0 };
}

export function winRate(stats: PlayerStats): number {
  if (stats.gamesPlayed === 0) return 0;
  return Math.round((stats.wins / stats.gamesPlayed) * 100);
}

const STREAK_KEY_PREFIX = 'bingo_best_streak_';

export function getBestStreak(playerName: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(`${STREAK_KEY_PREFIX}${playerName}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export function saveBestStreak(playerName: string, streak: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${STREAK_KEY_PREFIX}${playerName}`, String(streak));
  pushRecordToServer(playerName, 'streak:practice', streak);
}

const EASY_STREAK_KEY_PREFIX = 'bingo_easy_streak_';

export function getEasyBestStreak(playerName: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(`${EASY_STREAK_KEY_PREFIX}${playerName}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export function saveEasyBestStreak(playerName: string, streak: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${EASY_STREAK_KEY_PREFIX}${playerName}`, String(streak));
  pushRecordToServer(playerName, 'streak:easy', streak);
}

const CHAR_STREAK_KEY_PREFIX = 'bingo_char_streak_';

export function getCharBestStreak(playerName: string, contentType: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(`${CHAR_STREAK_KEY_PREFIX}${contentType}_${playerName}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export function saveCharBestStreak(playerName: string, contentType: string, streak: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${CHAR_STREAK_KEY_PREFIX}${contentType}_${playerName}`, String(streak));
  pushRecordToServer(playerName, `streak:char:${contentType}`, streak);
}

// ── シール ────────────────────────────────────────────────────────────────────

export function getStickerCount(playerName: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    return parseInt(localStorage.getItem(`stickers_${playerName}`) ?? '0', 10);
  } catch {
    return 0;
  }
}

export function addSticker(playerName: string): number {
  const next = getStickerCount(playerName) + 1;
  localStorage.setItem(`stickers_${playerName}`, String(next));
  pushRecordToServer(playerName, 'stickers', next);
  return next;
}

// ── サーバー同期 ───────────────────────────────────────────────────────────────

// サーバーから記録を取得し、ローカルより大きければ上書き（起動時に1度だけ呼ぶ）
export async function syncRecordsFromServer(playerName: string): Promise<void> {
  try {
    const records = await fetchRecordsFromServer(playerName);

    for (const [fullKey, value] of Object.entries(records)) {
      if (fullKey === `streak:practice:${playerName}`) {
        const local = getBestStreak(playerName);
        if (value > local) localStorage.setItem(`${STREAK_KEY_PREFIX}${playerName}`, String(value));
      } else if (fullKey === `streak:easy:${playerName}`) {
        const local = getEasyBestStreak(playerName);
        if (value > local) localStorage.setItem(`${EASY_STREAK_KEY_PREFIX}${playerName}`, String(value));
      } else if (fullKey === `stickers:${playerName}`) {
        const local = getStickerCount(playerName);
        if (value > local) localStorage.setItem(`stickers_${playerName}`, String(value));
      } else {
        // streak:char:{contentType}:{playerName}
        const charMatch = fullKey.match(/^streak:char:([^:]+):/);
        if (charMatch) {
          const contentType = charMatch[1];
          const local = getCharBestStreak(playerName, contentType);
          if (value > local) {
            localStorage.setItem(`${CHAR_STREAK_KEY_PREFIX}${contentType}_${playerName}`, String(value));
          }
        }
      }
    }
  } catch {
    // サーバー取得失敗はサイレントに無視
  }
}

// ── さいごに使った名前 ─────────────────────────────────────────────────────────
// 遊びごとの URL（/play/xxx）に直接来たとき、名前を聞き直さずに始めるため。

const LAST_NAME_KEY = 'kp_last_name';

export function loadLastName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(LAST_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveLastName(name: string): void {
  try {
    localStorage.setItem(LAST_NAME_KEY, name);
  } catch {
    // 保存できなくても遊べる
  }
}
