'use client';

import { useState } from 'react';
import type { PlayerStats } from '@/lib/types';
import { winRate } from '@/lib/storage';
import { GAMES, SHELVES, type GameEntry } from '@/components/games';

interface Props {
  initialName: string;
  onSelectGame: (game: GameEntry, name: string) => void;
  onRanking: () => void;
  stats: PlayerStats | null;
  stickerCount: number;
}

const BOB_ANIMS = ['float-bob-1 4s', 'float-bob-2 4.2s', 'float-bob-3 3.8s'];

export default function HomeScreen({ initialName, onSelectGame, onRanking, stats, stickerCount }: Props) {
  const [name, setName] = useState(initialName);

  const trimmed = name.trim();

  return (
    <div className="flex flex-col gap-3 px-4 py-4 animate-[fade-in_0.3s_ease_both]">

      {/* Title + name input row */}
      <div className="flex items-center gap-3">
        {/* Compact logo */}
        <div
          className="shrink-0 flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg"
          style={{ background: 'linear-gradient(135deg, #40c057, #1098ad)' }}
        >
          <span className="text-2xl">🛝</span>
        </div>
        <div className="flex-1">
          <h1
            className="text-2xl font-black tracking-wide leading-tight"
            style={{
              background: 'linear-gradient(90deg, #ff6b9d 0%, #ffd93d 50%, #cc5de8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            あそびのひろば
          </h1>
          <p className="text-xs text-gray-400 font-bold">なにして あそぶ？ ✨</p>
        </div>
      </div>

      {/* Name input */}
      <div className="flex flex-col gap-1.5">
        <p className="text-center text-xs font-bold text-gray-400">なまえをいれてね</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="なまえ"
          maxLength={10}
          className="w-full text-2xl font-bold text-center rounded-2xl border-4 border-[var(--color-bingo-blue)] px-4 py-2 outline-none focus:border-[var(--color-bingo-purple)] transition-colors bg-white shadow-md"
        />
      </div>

      {/* Shelves of games */}
      {SHELVES.map((shelf) => {
        const games = GAMES.filter((g) => g.shelf === shelf.id);
        if (games.length === 0) return null;
        return (
          <section key={shelf.id}>
            <p className="text-sm font-black text-gray-500 mb-1.5 px-1">
              {shelf.emoji} {shelf.label}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {games.map((game, i) => (
                <button
                  key={game.id}
                  disabled={!trimmed}
                  onClick={() => trimmed && onSelectGame(game, trimmed)}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl py-3 px-1 shadow active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
                  style={{
                    background: trimmed ? game.gradient : 'linear-gradient(135deg, #ddd, #ccc)',
                    border: `2px solid ${trimmed ? game.border : 'transparent'}`,
                    animation: trimmed
                      ? `${BOB_ANIMS[i % BOB_ANIMS.length]} ease-in-out infinite ${(i * 0.7).toFixed(1)}s`
                      : undefined,
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 55%)' }}
                  />
                  <span className="text-3xl leading-none relative z-10" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                    {game.emoji}
                  </span>
                  <span className="text-[11px] font-black text-white leading-tight text-center relative z-10 drop-shadow">
                    {game.label}
                  </span>
                  <span className="text-[9px] text-white/80 text-center whitespace-pre-line leading-snug relative z-10">
                    {game.desc}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {/* Bottom row: ranking + stats */}
      <div className="flex gap-2 items-stretch">
        <button
          onClick={onRanking}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-black transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #ffd93d 0%, #ff922b 100%)',
            color: 'white',
            border: '2px solid rgba(255,217,61,0.5)',
            boxShadow: '0 3px 10px rgba(255,217,61,0.3)',
          }}
        >
          🏆 おうちランキング
        </button>

        {stickerCount > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-2xl"
            style={{ background: 'white', border: '2px solid rgba(255,217,61,0.6)' }}
          >
            <span className="text-2xl">🌟</span>
            <div>
              <p className="text-xs font-bold text-gray-400">シールちょう</p>
              <p className="text-lg font-black" style={{ color: 'var(--color-bingo-orange)' }}>
                {stickerCount}まい
              </p>
            </div>
            <div className="flex gap-0.5 ml-1">
              {Array.from({ length: Math.min(stickerCount % 25 || (stickerCount > 0 ? 25 : 0), 5) }).map((_, i) => (
                <span key={i} className="text-base">🌟</span>
              ))}
            </div>
          </div>
        )}

        {stats && stats.gamesPlayed > 0 && (
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-2xl shadow"
            style={{
              background: 'white',
              border: '2px solid rgba(255,217,61,0.6)',
            }}
          >
            <div className="text-center">
              <p className="text-xl font-black text-[var(--color-bingo-green)] leading-none">{stats.wins}</p>
              <p className="text-[10px] text-gray-400">かち</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-[var(--color-bingo-orange)] leading-none">{stats.losses}</p>
              <p className="text-[10px] text-gray-400">まけ</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-[var(--color-bingo-blue)] leading-none">{winRate(stats)}%</p>
              <p className="text-[10px] text-gray-400">しょうりつ</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
