'use client';

import { useState, useEffect } from 'react';
import { getTopEntries, RANK_MODE_META } from '@/lib/ranking';
import type { RankGameMode, RankPeriod, RankEntry } from '@/lib/ranking';

interface Props {
  onHome: () => void;
}

const MODES: RankGameMode[] = ['toss', 'janken', 'shiritori', 'memory', 'mogura', 'rhythm', 'practice', 'easy', 'char-practice'];

const PERIOD_LABELS: Record<RankPeriod, string> = {
  day:  '日',
  week: '週',
  all:  '歴代',
};
const PERIODS: RankPeriod[] = ['day', 'week', 'all'];

const MEDALS = ['🥇', '🥈', '🥉'];

const MODE_BG: Record<RankGameMode, string> = {
  toss:           'linear-gradient(135deg, #ff922b 0%, #e03131 100%)',
  janken:         'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  shiritori:      'linear-gradient(135deg, #38d9a9 0%, #1098ad 100%)',
  memory:         'linear-gradient(135deg, #5f3dc4 0%, #9c36b5 100%)',
  mogura:         'linear-gradient(135deg, #f59f00 0%, #b45309 100%)',
  rhythm:         'linear-gradient(135deg, #f06595 0%, #845ef7 100%)',
  practice:       'linear-gradient(135deg, #cc5de8 0%, #4d96ff 100%)',
  easy:           'linear-gradient(135deg, #ff6b9d 0%, #ff922b 100%)',
  'char-practice':'linear-gradient(135deg, #6bcb77 0%, #4d96ff 100%)',
};

export default function RankingScreen({ onHome }: Props) {
  const [mode, setMode]     = useState<RankGameMode>('toss');
  const [period, setPeriod] = useState<RankPeriod>('all');
  const [entries, setEntries] = useState<RankEntry[]>([]);

  useEffect(() => {
    setEntries(getTopEntries(mode, period));
  }, [mode, period]);

  const meta = RANK_MODE_META[mode];

  return (
    <div className="flex flex-col items-center gap-4 py-5 animate-[fade-in_0.3s_ease_both]">

      {/* Header */}
      <div className="w-full max-w-sm px-4 flex items-center justify-between">
        <button
          onClick={onHome}
          className="text-2xl p-2 rounded-full hover:bg-black/5 active:scale-90 transition-all"
          aria-label="ホームにもどる"
        >
          🏠
        </button>
        <div className="text-center">
          <h2 className="text-xl font-black text-gray-700">🏆 おうちランキング</h2>
        </div>
        <div className="w-10" />
      </div>

      {/* Mode tabs */}
      <div className="w-full max-w-sm px-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {MODES.map((m) => {
            const mt = RANK_MODE_META[m];
            const active = m === mode;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all active:scale-95"
                style={{
                  background: active ? MODE_BG[m] : 'rgba(0,0,0,0.05)',
                  border: `2px solid ${active ? 'transparent' : 'rgba(0,0,0,0.08)'}`,
                  minWidth: 60,
                }}
              >
                <span className="text-xl leading-none">{mt.emoji}</span>
                <span
                  className="text-[10px] font-black leading-tight"
                  style={{ color: active ? 'white' : '#6b7280' }}
                >
                  {mt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Period tabs */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="px-4 py-1.5 rounded-full text-sm font-black transition-all active:scale-95"
            style={{
              background: period === p ? MODE_BG[mode] : 'rgba(0,0,0,0.06)',
              color:      period === p ? 'white' : '#9ca3af',
              border:     `2px solid ${period === p ? 'transparent' : 'rgba(0,0,0,0.08)'}`,
            }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Board */}
      <div className="w-full max-w-sm px-4">
        <div
          className="rounded-3xl overflow-hidden shadow-xl"
          style={{ background: 'white', border: '2px solid rgba(0,0,0,0.06)' }}
        >
          {/* Board header */}
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ background: MODE_BG[mode] }}
          >
            <span className="text-2xl">{meta.emoji}</span>
            <div>
              <p className="text-base font-black text-white">{meta.label}</p>
              <p className="text-[11px] text-white/80 font-bold">
                {PERIOD_LABELS[period]}のトップ10
              </p>
            </div>
          </div>

          {/* Entries */}
          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <span className="text-5xl">📭</span>
              <p className="text-sm font-black text-gray-400 text-center">
                まだ記録がないよ！<br />遊んでみよう！
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {entries.map((e, i) => (
                <div
                  key={`${e.playerName}-${e.ts}`}
                  className="flex items-center gap-3 px-4 py-3 animate-[fade-in_0.2s_ease_both]"
                  style={{
                    animationDelay: `${i * 0.04}s`,
                    background: i === 0 ? 'rgba(251,191,36,0.08)' : 'transparent',
                  }}
                >
                  {/* Rank */}
                  <div className="w-8 text-center flex-shrink-0">
                    {i < 3 ? (
                      <span className="text-2xl leading-none">{MEDALS[i]}</span>
                    ) : (
                      <span className="text-base font-black text-gray-300">{i + 1}</span>
                    )}
                  </div>

                  {/* Player name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-black text-gray-700 truncate">
                      {e.playerName}
                    </p>
                    <p className="text-[11px] text-gray-400 font-bold">
                      {new Date(e.ts).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <p
                      className="text-xl font-black leading-tight"
                      style={{
                        color: i === 0 ? '#d97706' : i === 1 ? '#6b7280' : i === 2 ? '#92400e' : '#374151',
                      }}
                    >
                      {e.score}
                    </p>
                    <p className="text-[11px] text-gray-400 font-bold">{meta.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-400 font-bold text-center px-6">
        ゲームで遊ぶとここに記録されるよ！
      </p>
    </div>
  );
}
