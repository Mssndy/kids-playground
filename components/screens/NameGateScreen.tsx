'use client';

import { useState } from 'react';
import type { GameEntry } from '@/components/games';

interface Props {
  game: GameEntry;
  onStart: (name: string) => void;
  onHome: () => void;
}

/** 遊びの URL に直接来て、まだ名前が無いときだけ出す画面 */
export default function NameGateScreen({ game, onStart, onHome }: Props) {
  const [name, setName] = useState('');
  const trimmed = name.trim();

  return (
    <div className="flex flex-col items-center gap-5 px-4 py-5 animate-[fade-in_0.3s_ease_both]">
      <div className="w-full max-w-sm flex items-center justify-between">
        <button
          onClick={onHome}
          className="text-2xl p-2 rounded-full hover:bg-black/5 active:scale-90 transition-all"
          aria-label="ひろばに いく"
        >
          🏠
        </button>
        <div className="w-10" />
      </div>

      <div
        className="w-full max-w-sm rounded-3xl px-6 py-6 text-center shadow-lg"
        style={{ background: game.gradient, border: `3px solid ${game.border}` }}
      >
        <p className="text-6xl mb-2">{game.emoji}</p>
        <h1 className="text-2xl font-black text-white drop-shadow">{game.label}</h1>
        <p className="text-sm font-bold text-white/85 whitespace-pre-line mt-1">{game.desc}</p>
      </div>

      <form
        className="w-full max-w-sm flex flex-col gap-3"
        onSubmit={(e) => { e.preventDefault(); if (trimmed) onStart(trimmed); }}
      >
        <p className="text-center text-sm font-bold text-gray-400">なまえ（ニックネーム）を いれてね</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="なまえ"
          maxLength={10}
          autoFocus
          className="w-full text-2xl font-bold text-center rounded-2xl border-4 border-[var(--color-bingo-blue)] px-4 py-2 outline-none focus:border-[var(--color-bingo-purple)] transition-colors bg-white shadow-md"
        />
        <button
          type="submit"
          disabled={!trimmed}
          className="w-full py-4 rounded-3xl text-xl font-black text-white shadow-lg active:scale-95 transition-all disabled:opacity-40"
          style={{ background: game.gradient }}
        >
          あそぶ！
        </button>
      </form>
    </div>
  );
}
