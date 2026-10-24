import type { ComponentType } from 'react';

import JankenGameScreen from '@/components/screens/JankenGameScreen';
import TossGameScreen from '@/components/screens/TossGameScreen';
import IqGameScreen from '@/components/screens/IqGameScreen';
import SprintGameScreen from '@/components/screens/SprintGameScreen';
import ShiritoriGameScreen from '@/components/screens/ShiritoriGameScreen';
import MemoryGameScreen from '@/components/screens/MemoryGameScreen';
import MoguraGameScreen from '@/components/screens/MoguraGameScreen';
import RhythmGameScreen from '@/components/screens/RhythmGameScreen';
import SugorokuScreen from '@/components/screens/SugorokuScreen';
import StationQuizScreen from '@/components/screens/StationQuizScreen';

/**
 * ひろばに並ぶ遊びの一覧（ここが唯一の登録場所）。
 *
 * 新しい遊びを足すとき:
 *   1. components/screens/ に `{ playerName, onHome }` を受け取る画面を作る
 *   2. 下の GAMES に `kind: 'standalone'` で1行足す
 * これだけでホームにカードが出て、遊べるようになる。
 *
 * `kind: 'flow'` は設定画面などを PlaygroundApp 側で持つ遊び（ビンゴ・けいさん・もじ）。
 */

export type ShelfId = 'learn' | 'play' | 'think';

export const SHELVES: { id: ShelfId; emoji: string; label: string }[] = [
  { id: 'learn', emoji: '📚', label: 'まなぶ' },
  { id: 'play',  emoji: '🎉', label: 'あそぶ' },
  { id: 'think', emoji: '💡', label: 'ひらめく' },
];

export type FlowStart = 'bingo' | 'practice' | 'easy' | 'char';

export interface StandaloneScreenProps {
  playerName: string;
  onHome: () => void;
}

interface GameBase {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  shelf: ShelfId;
  /** 検索・共有用の紹介文（大人向けの普通の文） */
  about: string;
  gradient: string;
  border: string;
}

export type GameEntry =
  | (GameBase & { kind: 'flow'; start: FlowStart })
  | (GameBase & { kind: 'standalone'; Screen: ComponentType<StandaloneScreenProps> });

export const GAMES: GameEntry[] = [
  // ── まなぶ ────────────────────────────────────────────────────────────────
  {
    id: 'bingo', kind: 'flow', start: 'bingo', shelf: 'learn',
    emoji: '🎯', label: 'ビンゴ', desc: 'ビンゴカードで\nあそぼう！',
    about: '数字や計算式のビンゴ抽選。紙のビンゴカードでも、画面のカードでも遊べます。足し算・引き算・かけ算・わり算に対応。',
    gradient: 'linear-gradient(135deg, #ff6b9d 0%, #ff922b 100%)',
    border: 'rgba(255,107,157,0.5)',
  },
  {
    id: 'practice', kind: 'flow', start: 'practice', shelf: 'learn',
    emoji: '🧮', label: 'けいさん', desc: 'れんぞく正解を\nめざそう！',
    about: '足し算・引き算・かけ算・わり算の計算練習。れんぞく正解の記録で、上達が見えます。',
    gradient: 'linear-gradient(135deg, #cc5de8 0%, #4d96ff 100%)',
    border: 'rgba(204,93,232,0.5)',
  },
  {
    id: 'easy', kind: 'flow', start: 'easy', shelf: 'learn',
    emoji: '🍎', label: 'えらんでまなぼう', desc: '絵でわかる\nたのしいけいさん！',
    about: '絵を見ながら答えを選ぶ、小さな子向けのやさしい計算あそび。',
    gradient: 'linear-gradient(135deg, #40c057 0%, #74c0fc 100%)',
    border: 'rgba(64,192,87,0.5)',
  },
  {
    id: 'char', kind: 'flow', start: 'char', shelf: 'learn',
    emoji: '🔤', label: 'もじ', desc: 'おとで\nもじをおぼえよう！',
    about: 'ひらがな・カタカナ・アルファベットを、音を聞いて覚えるもじあそび。もじビンゴもできます。',
    gradient: 'linear-gradient(135deg, #f06595 0%, #ffd43b 100%)',
    border: 'rgba(240,101,149,0.5)',
  },
  {
    id: 'mogura', kind: 'standalone', Screen: MoguraGameScreen, shelf: 'learn',
    emoji: '🐹', label: 'こたえモグラ', desc: 'けいさんして\nたたこう！',
    about: '計算の答えが書かれたモグラをたたく、45秒勝負の計算ゲーム。',
    gradient: 'linear-gradient(135deg, #f59f00 0%, #b45309 100%)',
    border: 'rgba(245,159,0,0.6)',
  },
  {
    id: 'shiritori', kind: 'standalone', Screen: ShiritoriGameScreen, shelf: 'learn',
    emoji: '🦒', label: 'しりとり', desc: 'ことばを\nつなげよう！',
    about: '絵カードから言葉を選んでつなぐ、コンピュータとのしりとり。',
    gradient: 'linear-gradient(135deg, #38d9a9 0%, #1098ad 100%)',
    border: 'rgba(16,152,173,0.6)',
  },

  {
    id: 'station', kind: 'standalone', Screen: StationQuizScreen, shelf: 'learn',
    emoji: '🚃', label: 'えきめいクイズ', desc: 'えきの ばんごうで\nなにえき？',
    about: '駅ナンバリング（山手線 JY01 など）と路線の色から駅名を当てるクイズ。山手線・東京メトロ・都営地下鉄・西武池袋線に対応。',
    gradient: 'linear-gradient(135deg, #20c997 0%, #1c7ed6 100%)',
    border: 'rgba(28,126,214,0.6)',
  },

  // ── あそぶ ────────────────────────────────────────────────────────────────
  {
    id: 'sugoroku', kind: 'standalone', Screen: SugorokuScreen, shelf: 'play',
    emoji: '🎲', label: 'すごろく', desc: 'さいころをふって\nゴールをめざせ！',
    about: 'さいころをふってゴールを目指すすごろく。とちゅうでミニゲームも。',
    gradient: 'linear-gradient(135deg, #f03e3e 0%, #ff922b 100%)',
    border: 'rgba(240,62,62,0.5)',
  },
  {
    id: 'janken', kind: 'standalone', Screen: JankenGameScreen, shelf: 'play',
    emoji: '✊', label: 'じゃんけん', desc: '石・はさみ・紙で\nあそぼう！',
    about: 'コンピュータとじゃんけん勝負。勝つと手が変身します。',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'rgba(102,126,234,0.6)',
  },
  {
    id: 'toss', kind: 'standalone', Screen: TossGameScreen, shelf: 'play',
    emoji: '⚾', label: 'たまなげビンゴ', desc: 'ボールをなげて\nビンゴをねらえ！',
    about: 'ボールを投げてビンゴのマスをねらう玉なげゲーム。',
    gradient: 'linear-gradient(135deg, #ff922b 0%, #e03131 100%)',
    border: 'rgba(224,49,49,0.6)',
  },
  {
    id: 'sprint', kind: 'standalone', Screen: SprintGameScreen, shelf: 'play',
    emoji: '🏃‍♂️', label: '100m走', desc: 'れんだで\nゴールせよ！',
    about: '画面を連打して100mを走りきるかけっこゲーム。',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
    border: 'rgba(239,68,68,0.6)',
  },
  {
    id: 'rhythm', kind: 'standalone', Screen: RhythmGameScreen, shelf: 'play',
    emoji: '🎵', label: 'リズムタップ', desc: 'タイミングよく\nタッチ！',
    about: '流れてくるリズムに合わせてタッチする音楽ゲーム。',
    gradient: 'linear-gradient(135deg, #f06595 0%, #845ef7 100%)',
    border: 'rgba(240,101,149,0.6)',
  },

  // ── ひらめく ──────────────────────────────────────────────────────────────
  {
    id: 'iq', kind: 'standalone', Screen: IqGameScreen, shelf: 'think',
    emoji: '🧠', label: 'ひらめき診断', desc: 'なんさい？\nIQをしらべよう！',
    about: '年齢と難しさを選んで挑戦する、ひらめき問題の診断ゲーム。',
    gradient: 'linear-gradient(135deg, #cc5de8 0%, #ff6b9d 100%)',
    border: 'rgba(204,93,232,0.6)',
  },
  {
    id: 'memory', kind: 'standalone', Screen: MemoryGameScreen, shelf: 'think',
    emoji: '🃏', label: 'しんけいすいじゃく', desc: 'CPUたいせん\nできるよ！🤖',
    about: 'トランプのしんけいすいじゃく。コンピュータとの対戦もできます。',
    gradient: 'linear-gradient(135deg, #5f3dc4 0%, #9c36b5 100%)',
    border: 'rgba(95,61,196,0.6)',
  },
];

export function findGame(id: string | null): GameEntry | undefined {
  return id ? GAMES.find((g) => g.id === id) : undefined;
}
