'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LINES, OPERATOR_LABEL, buildQuestions, stationCode,
  type Line, type Operator, type Station, type StationQuestion,
} from '@/lib/stations';
import { playCorrect, playWrong, playMiniGameStart, playNewBest, playGoalReached } from '@/lib/sounds';
import { speakChar } from '@/lib/speech';

interface Props {
  playerName: string;
  onHome: () => void;
}

type Phase = 'select' | 'quiz' | 'done';

const QUESTION_COUNT = 10;
const ALL_ID = 'all';
const THEME = 'linear-gradient(135deg, #20c997 0%, #1c7ed6 100%)';

function bestKey(playerName: string, lineId: string) {
  return `station_best_${lineId}_${playerName}`;
}

function loadBest(playerName: string, lineId: string): number {
  try {
    return parseInt(localStorage.getItem(bestKey(playerName, lineId)) ?? '0', 10);
  } catch {
    return 0;
  }
}

function saveBest(playerName: string, lineId: string, score: number) {
  try {
    localStorage.setItem(bestKey(playerName, lineId), String(score));
  } catch {
    // 保存できなくても遊べる
  }
}

/** 駅ナンバリングの看板。JR は角丸の四角、地下鉄は丸。 */
function StationBadge({ line, number, size = 'lg' }: { line: Line; number: number; size?: 'lg' | 'sm' }) {
  const lg = size === 'lg';
  const box = lg ? 'w-28 h-28' : 'w-11 h-11';
  const ring = lg ? 10 : 4;
  return (
    <div
      className={`${box} shrink-0 flex flex-col items-center justify-center bg-white shadow-md`}
      style={{
        border: `${ring}px solid ${line.color}`,
        borderRadius: line.operator === 'jr' ? (lg ? 18 : 8) : '9999px',
      }}
    >
      <span className={`${lg ? 'text-xl' : 'text-[10px]'} font-black text-gray-800 leading-none`}>
        {line.code}
      </span>
      <span className={`${lg ? 'text-4xl' : 'text-sm'} font-black text-gray-800 leading-none`}>
        {String(number).padStart(2, '0')}
      </span>
    </div>
  );
}

function StationName({ station, big = false }: { station: Station; big?: boolean }) {
  return (
    <ruby className={`${big ? 'text-3xl' : 'text-lg'} font-black leading-tight`}>
      {station.name}
      <rt className={`${big ? 'text-xs' : 'text-[10px]'} font-bold opacity-70`}>{station.kana}</rt>
    </ruby>
  );
}

export default function StationQuizScreen({ playerName, onHome }: Props) {
  const [phase, setPhase]         = useState<Phase>('select');
  const [lineId, setLineId]       = useState<string>(ALL_ID);
  const [questions, setQuestions] = useState<StationQuestion[]>([]);
  const [qIndex, setQIndex]       = useState(0);
  const [picked, setPicked]       = useState<string | null>(null);
  const [showHint, setShowHint]   = useState(false);
  const [score, setScore]         = useState(0);
  const [isBest, setIsBest]       = useState(false);
  const [best, setBest]           = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const q = questions[qIndex];
  const answered = picked !== null;
  const correct = answered && picked === q?.answer.name;

  function start(id: string) {
    const lines = id === ALL_ID ? LINES : LINES.filter((l) => l.id === id);
    setLineId(id);
    setQuestions(buildQuestions(lines, QUESTION_COUNT));
    setQIndex(0);
    setPicked(null);
    setShowHint(false);
    setScore(0);
    setPhase('quiz');
    playMiniGameStart();
  }

  function finish(finalScore: number) {
    const prevBest = loadBest(playerName, lineId);
    const newBest = finalScore > prevBest;
    if (newBest) saveBest(playerName, lineId, finalScore);
    setBest(Math.max(prevBest, finalScore));
    setIsBest(newBest);
    if (newBest) playNewBest(); else playGoalReached();
    setPhase('done');
  }

  function goNext(currentScore: number) {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (qIndex + 1 >= questions.length) {
      finish(currentScore);
      return;
    }
    setQIndex(qIndex + 1);
    setPicked(null);
    setShowHint(false);
  }

  function pick(station: Station) {
    if (answered || !q) return;
    setPicked(station.name);
    speakChar(q.answer.kana, 'ja-JP');
    if (station.name === q.answer.name) {
      playCorrect();
      const nextScore = score + 1;
      setScore(nextScore);
      timer.current = setTimeout(() => goNext(nextScore), 1300);
    } else {
      playWrong();
      // まちがえたときは答えをゆっくり見られるよう、自動では進めない
    }
  }

  const operators: Operator[] = ['jr', 'metro', 'toei'];

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
          <h2 className="text-xl font-black text-gray-700">えきめいクイズ</h2>
          <p className="text-xs text-gray-400 font-bold">{playerName} 🚃</p>
        </div>
        <div className="w-10" />
      </div>

      {/* ── SELECT ── */}
      {phase === 'select' && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm px-4 animate-[fade-in_0.25s_ease_both]">
          <button
            onClick={() => start(ALL_ID)}
            className="w-full rounded-3xl px-6 py-5 text-center shadow-lg active:scale-95 transition-all"
            style={{ background: THEME, animation: 'float-bob-1 3s ease-in-out infinite' }}
          >
            <p className="text-4xl mb-1">🚃🚇</p>
            <p className="text-xl font-black text-white drop-shadow">ぜんぶの せんろで スタート！</p>
            <p className="text-xs font-bold text-white/80 mt-1">えきの ばんごうを みて、えきの なまえを あてよう</p>
          </button>

          <p className="text-sm font-black text-gray-400">せんろを えらんでも いいよ 👇</p>

          {operators.map((op) => (
            <section key={op} className="w-full">
              <p className="text-xs font-black text-gray-500 mb-1.5 px-1">{OPERATOR_LABEL[op]}</p>
              <div className="grid grid-cols-2 gap-2">
                {LINES.filter((l) => l.operator === op).map((line) => (
                  <button
                    key={line.id}
                    onClick={() => start(line.id)}
                    className="flex items-center gap-2 rounded-2xl bg-white px-2 py-2 shadow active:scale-95 transition-all text-left"
                    style={{ border: `3px solid ${line.color}` }}
                  >
                    <StationBadge line={line} number={1} size="sm" />
                    <span className="flex flex-col">
                      <span className="text-sm font-black text-gray-700 leading-tight">{line.name}</span>
                      <span className="text-[10px] font-bold text-gray-400">{line.colorName}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── QUIZ ── */}
      {phase === 'quiz' && q && (
        <div key={qIndex} className="flex flex-col items-center gap-4 w-full max-w-sm px-4 animate-[fade-in_0.25s_ease_both]">
          {/* Progress */}
          <div className="w-full flex items-center justify-between text-sm font-black text-gray-500">
            <span>{qIndex + 1} / {questions.length} もんめ</span>
            <span>⭕ {score}</span>
          </div>

          {/* Question */}
          <div
            className="w-full rounded-3xl bg-white px-4 py-5 flex flex-col items-center gap-3 shadow-lg"
            style={{ border: `4px solid ${q.line.color}` }}
          >
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full" style={{ background: q.line.color }} />
              <ruby className="text-lg font-black text-gray-700">
                {q.line.name}
                <rt className="text-[10px] font-bold text-gray-400">{q.line.kana}</rt>
              </ruby>
              <span className="text-xs font-bold text-gray-400">（{q.line.colorName}）</span>
            </div>
            <StationBadge line={q.line} number={q.answer.number} />
            <p className="text-base font-black text-gray-600">
              {stationCode(q.line, q.answer.number)} は なにえき？
            </p>

            {/* Hint */}
            {!answered && !showHint && (
              <button
                onClick={() => setShowHint(true)}
                className="text-xs font-black text-gray-500 px-3 py-1.5 rounded-full bg-gray-100 active:scale-95 transition-all"
              >
                💡 ヒント（となりの えき）
              </button>
            )}
            {(showHint || answered) && (
              <div className="w-full flex items-center justify-center gap-2 text-[11px] font-bold text-gray-500">
                {q.prev && <span>◀ {stationCode(q.line, q.prev.number)} {q.prev.name}</span>}
                <span className="text-gray-300">|</span>
                {q.next && <span>{stationCode(q.line, q.next.number)} {q.next.name} ▶</span>}
              </div>
            )}
          </div>

          {/* Choices */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {q.choices.map((st) => {
              const isAnswer = st.name === q.answer.name;
              const isPicked = st.name === picked;
              let bg = 'white';
              let color = '#374151';
              let opacity = 1;
              if (answered) {
                if (isAnswer) { bg = THEME; color = 'white'; }
                else if (isPicked) { bg = '#f1f3f5'; color = '#868e96'; }
                else opacity = 0.45;
              }
              return (
                <button
                  key={st.name}
                  onClick={() => pick(st)}
                  disabled={answered}
                  className="rounded-2xl px-2 py-4 shadow-md active:scale-95 transition-all"
                  style={{
                    background: bg,
                    color,
                    opacity,
                    border: '3px solid rgba(0,0,0,0.06)',
                    animation: answered && isAnswer ? 'bounce-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both' : undefined,
                  }}
                >
                  <StationName station={st} />
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {answered && (
            <div className="w-full flex flex-col items-center gap-3 animate-[fade-in_0.2s_ease_both]">
              {correct ? (
                <p className="text-2xl font-black" style={{ color: '#12b886' }}>せいかい！🎉</p>
              ) : (
                <>
                  <p className="text-lg font-black text-gray-600 text-center">
                    おしい！ {stationCode(q.line, q.answer.number)} は<br />
                    <span style={{ color: '#1c7ed6' }}><StationName station={q.answer} big /></span> だよ
                  </p>
                  <button
                    onClick={() => goNext(score)}
                    className="w-full py-3 rounded-2xl text-lg font-black text-white shadow-lg active:scale-95 transition-all"
                    style={{ background: THEME }}
                  >
                    つぎへ ▶
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── DONE ── */}
      {phase === 'done' && (
        <div className="flex flex-col items-center gap-5 w-full max-w-sm px-4 animate-[fade-in_0.3s_ease_both]">
          <div className="w-full rounded-3xl px-6 py-7 text-center shadow-xl" style={{ background: THEME }}>
            <p className="text-6xl mb-2" style={{ animation: 'bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              {isBest ? '🌟' : score === questions.length ? '🏆' : '🚃'}
            </p>
            <p className="text-2xl font-black text-white drop-shadow">
              {isBest ? 'あたらしい きろく！' : score === questions.length ? 'ぜんもん せいかい！' : 'おつかれさま！'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-base font-black text-white/80">せいかい</span>
              <span className="text-4xl font-black text-white drop-shadow">{score}</span>
              <span className="text-base font-black text-white/80">/ {questions.length}</span>
            </div>
            <p className="text-xs font-bold text-white/80 mt-2">
              {lineId === ALL_ID ? 'ぜんぶの せんろ' : LINES.find((l) => l.id === lineId)?.name} の さいこう：{best}もん
            </p>
          </div>
          <button
            onClick={() => start(lineId)}
            className="w-full py-4 rounded-3xl text-xl font-black text-white shadow-lg active:scale-95 transition-all"
            style={{ background: THEME }}
          >
            もう一度！🚃
          </button>
          <button
            onClick={() => setPhase('select')}
            className="w-full py-3 rounded-2xl text-base font-black text-gray-600 bg-white shadow active:scale-95 transition-all"
            style={{ border: '2px solid rgba(0,0,0,0.08)' }}
          >
            ほかの せんろに する
          </button>
          <button
            onClick={onHome}
            className="px-6 py-2.5 rounded-2xl text-sm font-black text-gray-500 active:scale-95 transition-all"
            style={{ background: 'white', border: '2px solid rgba(0,0,0,0.08)' }}
          >
            🏠 ひろばに もどる
          </button>
        </div>
      )}
    </div>
  );
}
