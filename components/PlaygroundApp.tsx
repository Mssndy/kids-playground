'use client';

import { useState, useEffect, useRef } from 'react';
import type { AppScreen, GameSettings, GameState, PlayerStats, PracticeSettings, EasySettings, CharGameSettings, CharPracticeSettings } from '@/lib/types';
import { loadStatsForPlayer, saveStats, createEmptyStats, getStickerCount, addSticker, syncRecordsFromServer } from '@/lib/storage';
import {
  createInitialGameState,
  drawNextNumber,
  generateBingoCard,
  markNumber,
  checkBingo,
  shuffle,
} from '@/lib/bingo';
import { generateProblem } from '@/lib/math-problems';
import { playCorrect, playWrong, playDraw, playBingo } from '@/lib/sounds';

import HomeScreen from '@/components/screens/HomeScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';
import GameScreen from '@/components/screens/GameScreen';
import ResultScreen from '@/components/screens/ResultScreen';
import PracticeSettingsScreen from '@/components/screens/PracticeSettingsScreen';
import PracticeGameScreen from '@/components/screens/PracticeGameScreen';
import EasySettingsScreen from '@/components/screens/EasySettingsScreen';
import EasyGameScreen from '@/components/screens/EasyGameScreen';
import CharSettingsScreen from '@/components/screens/CharSettingsScreen';
import CharGameScreen from '@/components/screens/CharGameScreen';
import CharPracticeSettingsScreen from '@/components/screens/CharPracticeSettingsScreen';
import CharPracticeGameScreen from '@/components/screens/CharPracticeGameScreen';
import RankingScreen from '@/components/screens/RankingScreen';
import SessionCompleteScreen from '@/components/screens/SessionCompleteScreen';
import { findGame, type FlowStart, type GameEntry } from '@/components/games';
import {
  generateCharBingoCard,
  createInitialCharGameState,
  drawNextChar,
  markChar,
  checkCharBingo,
  getCharSet,
} from '@/lib/characters';
import type { CharGameState } from '@/lib/characters';

const DEFAULT_SETTINGS: GameSettings = {
  mode: 'calculation',
  answerMode: 'input',
  operators: ['+', '-'],
  maxNumber: 30,
  cardMode: 'web',
};

/** flow 型の遊びの入口画面 */
const FLOW_SCREENS: Record<FlowStart, AppScreen> = {
  bingo: 'settings',
  practice: 'practice-settings',
  easy: 'easy-settings',
  char: 'char-settings',
};

export default function PlaygroundApp() {
  const [screen, setScreen]       = useState<AppScreen>('home');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [stats, setStats]         = useState<PlayerStats | null>(null);
  const [settings, setSettings]   = useState<GameSettings>(DEFAULT_SETTINGS);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({
    operators: ['+', '-'],
    maxNumber: 30,
  });
  const [easySettings, setEasySettings] = useState<EasySettings>({
    operators: ['+', '-'],
  });
  const [charSettings, setCharSettings] = useState<CharGameSettings>({
    contentType: 'hiragana',
    bingoSubMode: 'char-show',
    cardMode: 'web',
  });
  const [charGameState, setCharGameState] = useState<CharGameState | null>(null);
  const [charPracticeSettings, setCharPracticeSettings] = useState<CharPracticeSettings>({
    contentType: 'hiragana',
  });
  // Tracks whether the result screen should show the auto-bingo celebration
  const [resultIsAutoBingo, setResultIsAutoBingo] = useState(false);

  const [sessionResult, setSessionResult] = useState<{
    correctCount: number;
    stickerCount: number;
    mode: 'easy' | 'char-practice';
  } | null>(null);

  const [stickerCount, setStickerCount] = useState(0);

  // Always-fresh refs to avoid stale closures in auto-draw timers
  const gameStateRef = useRef<GameState | null>(null);
  const settingsRef  = useRef<GameSettings>(settings);
  gameStateRef.current = gameState;
  settingsRef.current  = settings;

  // Single timer slot for pending auto-draw
  const autoDrawTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearAutoDraw() {
    if (autoDrawTimer.current) {
      clearTimeout(autoDrawTimer.current);
      autoDrawTimer.current = null;
    }
  }

  /** Core draw logic extracted so it can be called from both user gestures and timers */
  function performDraw(gs: GameState, cfg: GameSettings) {
    playDraw();
    const next = drawNextNumber(gs);

    if (cfg.mode === 'calculation' && next.currentNumber !== null) {
      next.currentProblem = generateProblem(next.currentNumber, cfg.operators);
    }

    if (cfg.mode === 'calculation' && cfg.answerMode === 'input') {
      setGameState({ ...next, awaitingAnswer: true, lastMatchFound: null, lastAnswerWrong: false });
      return;
    }

    setGameState({ ...next, lastMatchFound: null, lastAnswerWrong: false });
  }

  /** Schedule an automatic draw after `delayMs`.  Cancels any pending timer first. */
  function scheduleAutoDraw(delayMs: number) {
    clearAutoDraw();
    autoDrawTimer.current = setTimeout(() => {
      autoDrawTimer.current = null;
      const gs  = gameStateRef.current;
      const cfg = settingsRef.current;
      if (!gs || gs.isGameOver || gs.remainingNumbers.length === 0) return;
      performDraw(gs, cfg);
    }, delayMs);
  }

  useEffect(() => {
    if (!playerName) return;
    setStats(loadStatsForPlayer(playerName));
    setStickerCount(getStickerCount(playerName));
  }, [playerName]);

  // Clean up timer on unmount
  useEffect(() => () => clearAutoDraw(), []);

  function handleStartGame() {
    clearAutoDraw();
    const card = settings.cardMode === 'web' ? generateBingoCard(settings.maxNumber) : null;
    setGameState(createInitialGameState(settings.maxNumber, card));
    setScreen('game');
  }

  /** Manual draw (draw-button press) */
  function handleDraw() {
    clearAutoDraw();
    if (!gameState) return;
    performDraw(gameState, settings);
  }

  /** Called when the player submits a typed answer in calculation+input mode */
  function handleAnswerSubmit(submitted: number) {
    if (!gameState?.currentProblem || !gameState.currentNumber) return;

    const correct = submitted === gameState.currentProblem.answer;

    if (!correct) {
      playWrong();
      setGameState({
        ...gameState,
        remainingNumbers: shuffle([...gameState.remainingNumbers, gameState.currentNumber]),
        drawnNumbers: gameState.drawnNumbers.slice(0, -1),
        currentNumber: null,
        currentProblem: null,
        awaitingAnswer: false,
        lastMatchFound: null,
        lastAnswerWrong: true,
      });
      // Seamlessly advance to next question after showing "おしい！"
      scheduleAutoDraw(1200);
      return;
    }

    // Correct answer
    playCorrect();
    setGameState({ ...gameState, awaitingAnswer: false, lastAnswerWrong: false });

    // Web card + number not on card → no cell to tap, auto-advance
    const numberOnCard =
      settings.cardMode === 'web' && gameState.bingoCard
        ? gameState.bingoCard.cells.flat().some((c) => c === gameState.currentNumber)
        : true; // paper card: child marks manually, no auto-advance needed

    if (settings.cardMode === 'web' && !numberOnCard) {
      scheduleAutoDraw(1000);
    }
  }

  /** Called when the player taps a cell on their web card */
  function handleCellTap(row: number, col: number) {
    if (!gameState?.bingoCard) return;
    const cell = gameState.bingoCard.cells[row][col];
    if (cell === 'FREE' || gameState.bingoCard.marked[row][col]) return;
    if (!gameState.drawnNumbers.includes(cell as number)) return;

    const updatedCard = markNumber(gameState.bingoCard, cell as number);
    const bingo = checkBingo(updatedCard);
    const next: GameState = { ...gameState, bingoCard: updatedCard, isGameOver: bingo };

    if (bingo) {
      playBingo();
      const base = stats ?? createEmptyStats(playerName);
      const updated: PlayerStats = {
        ...base,
        wins: base.wins + 1,
        gamesPlayed: base.gamesPlayed + 1,
      };
      saveStats(updated);
      setStats(updated);
      setGameState(next);
      setResultIsAutoBingo(true);
      setScreen('result');
      return;
    }

    setGameState(next);

    // In calculation+input mode: after stamping, auto-draw next question
    if (settings.mode === 'calculation' && settings.answerMode === 'input') {
      scheduleAutoDraw(700);
    }
  }

  function handleFinish() {
    clearAutoDraw();
    setResultIsAutoBingo(false);
    setScreen('result');
  }

  function handleRecordResult(won: boolean) {
    const base = stats ?? createEmptyStats(playerName);
    const updated: PlayerStats = {
      ...base,
      wins: base.wins + (won ? 1 : 0),
      losses: base.losses + (won ? 0 : 1),
      gamesPlayed: base.gamesPlayed + 1,
    };
    saveStats(updated);
    setStats(updated);
  }

  function handlePlayAgain() {
    clearAutoDraw();
    setScreen('settings');
    setGameState(null);
  }

  function handleBackToName() {
    clearAutoDraw();
    setScreen('home');
    setGameState(null);
    setActiveGameId(null);
  }

  function handleSelectGame(game: GameEntry, name: string) {
    if (name !== playerName) {
      setPlayerName(name);
      setStats(loadStatsForPlayer(name));
      syncRecordsFromServer(name)
        .then(() => setStickerCount(getStickerCount(name)))
        .catch(() => {});
    }
    if (game.kind === 'flow') {
      setScreen(FLOW_SCREENS[game.start]);
    } else {
      setActiveGameId(game.id);
      setScreen('play');
    }
  }

  function handleSessionComplete(correctCount: number, mode: 'easy' | 'char-practice') {
    const newCount = addSticker(playerName);
    setStickerCount(newCount);
    setSessionResult({ correctCount, stickerCount: newCount, mode });
    setScreen('session-complete');
  }

  function handleStartCharGame() {
    const chars = getCharSet(charSettings.contentType);
    const card = charSettings.cardMode === 'web' ? generateCharBingoCard(chars) : null;
    setCharGameState(createInitialCharGameState(chars, card));
    setScreen('char-game');
  }

  function handleCharDraw() {
    if (!charGameState) return;
    playDraw();
    setCharGameState(drawNextChar(charGameState));
  }

  function handleCharCellTap(row: number, col: number) {
    if (!charGameState?.bingoCard) return;
    const cell = charGameState.bingoCard.cells[row][col];
    if (cell === 'FREE' || charGameState.bingoCard.marked[row][col]) return;
    if (!charGameState.drawnChars.includes(cell as string)) return;

    const updatedCard = markChar(charGameState.bingoCard, cell as string);
    const bingo = checkCharBingo(updatedCard);
    const next: CharGameState = { ...charGameState, bingoCard: updatedCard, isGameOver: bingo };

    if (bingo) {
      playBingo();
      const base = stats ?? createEmptyStats(playerName);
      const updated: PlayerStats = { ...base, wins: base.wins + 1, gamesPlayed: base.gamesPlayed + 1 };
      saveStats(updated);
      setStats(updated);
      setCharGameState(next);
      setResultIsAutoBingo(true);
      setScreen('result');
      return;
    }

    setCharGameState(next);
  }

  function handleCharFinish() {
    setResultIsAutoBingo(false);
    setScreen('result');
  }

  const activeGame = findGame(activeGameId);

  return (
    <main className="max-w-lg mx-auto w-full h-full">
      {screen === 'home' && (
        <HomeScreen
          onSelectGame={handleSelectGame}
          onRanking={() => setScreen('ranking')}
          stats={stats}
          stickerCount={stickerCount}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          playerName={playerName}
          settings={settings}
          onSettingsChange={setSettings}
          onStartGame={handleStartGame}
          onBack={handleBackToName}
        />
      )}
      {screen === 'game' && gameState && (
        <GameScreen
          playerName={playerName}
          gameState={gameState}
          settings={settings}
          onDraw={handleDraw}
          onAnswerSubmit={handleAnswerSubmit}
          onCellTap={handleCellTap}
          onFinish={handleFinish}
          onHome={handleBackToName}
        />
      )}
      {screen === 'result' && (
        <ResultScreen
          playerName={playerName}
          stats={stats ?? createEmptyStats(playerName)}
          isBingoAuto={resultIsAutoBingo}
          onRecordWin={() => handleRecordResult(true)}
          onRecordLoss={() => handleRecordResult(false)}
          onPlayAgain={handlePlayAgain}
        />
      )}
      {screen === 'practice-settings' && (
        <PracticeSettingsScreen
          playerName={playerName}
          settings={practiceSettings}
          onSettingsChange={setPracticeSettings}
          onStart={() => setScreen('practice')}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'practice' && (
        <PracticeGameScreen
          playerName={playerName}
          settings={practiceSettings}
          onHome={handleBackToName}
        />
      )}
      {screen === 'easy-settings' && (
        <EasySettingsScreen
          playerName={playerName}
          settings={easySettings}
          onSettingsChange={setEasySettings}
          onStart={() => setScreen('easy')}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'easy' && (
        <EasyGameScreen
          playerName={playerName}
          settings={easySettings}
          onHome={handleBackToName}
          onSessionComplete={(n) => handleSessionComplete(n, 'easy')}
        />
      )}
      {screen === 'char-settings' && (
        <CharSettingsScreen
          playerName={playerName}
          settings={charSettings}
          onSettingsChange={setCharSettings}
          onStartGame={handleStartCharGame}
          onGoToPractice={() => setScreen('char-practice-settings')}
          onBack={handleBackToName}
        />
      )}
      {screen === 'char-game' && charGameState && (
        <CharGameScreen
          playerName={playerName}
          gameState={charGameState}
          settings={charSettings}
          onDraw={handleCharDraw}
          onCellTap={handleCharCellTap}
          onFinish={handleCharFinish}
          onHome={handleBackToName}
        />
      )}
      {screen === 'char-practice-settings' && (
        <CharPracticeSettingsScreen
          playerName={playerName}
          settings={charPracticeSettings}
          onSettingsChange={setCharPracticeSettings}
          onStart={() => setScreen('char-practice')}
          onBack={() => setScreen('char-settings')}
        />
      )}
      {screen === 'char-practice' && (
        <CharPracticeGameScreen
          playerName={playerName}
          settings={charPracticeSettings}
          onHome={handleBackToName}
          onSessionComplete={(n) => handleSessionComplete(n, 'char-practice')}
        />
      )}
      {screen === 'play' && activeGame?.kind === 'standalone' && (
        <activeGame.Screen
          key={activeGame.id}
          playerName={playerName}
          onHome={handleBackToName}
        />
      )}
      {screen === 'ranking' && (
        <RankingScreen onHome={handleBackToName} />
      )}
      {screen === 'session-complete' && sessionResult && (
        <SessionCompleteScreen
          playerName={playerName}
          correctCount={sessionResult.correctCount}
          stickerCount={sessionResult.stickerCount}
          mode={sessionResult.mode}
          onPlayAgain={() => setScreen(sessionResult.mode === 'easy' ? 'easy' : 'char-practice')}
          onHome={() => { setSessionResult(null); setScreen('home'); }}
        />
      )}
    </main>
  );
}
