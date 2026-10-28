'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LINES, OPERATOR_LABEL, buildQuestions, stationAt, stationCode,
  type Line, type Operator, type Station, type StationQuestion,
} from '@/lib/stations';
import { playCorrect, playWrong, playMiniGameStart, playNewBest, playGoalReached } from '@/lib/sounds';
import { speakChar } from '@/lib/speech';

interface Props {
  playerName: string;
  onHome: () => void;
}

type Phase = 'select' | 'quiz' | 'done';
type Level = 'normal' | 'hard';
type Mode = 'number' | 'map';

const MODES: Record<Mode, { label: string; icon: string; lead: string }> = {
  number: { label: 'ばんごう', icon: '🔢', lead: 'えきの ばんごうを みて、えきの なまえを あてよう' },
  map:    { label: 'ろせんず', icon: '🗺️', lead: 'ろせんずの ？の ばしょの えきを あてよう' },
};

const LEVELS: Record<Level, { label: string; choices: number }> = {
  normal: { label: 'ふつう', choices: 4 },
  hard:   { label: 'むずかしい', choices: 10 },
};

const QUESTION_COUNT = 10;
const ALL_ID = 'all';
const THEME = 'linear-gradient(135deg, #20c997 0%, #1c7ed6 100%)';

function bestKey(playerName: string, lineId: string, level: Level, mode: Mode) {
  // ばんごうモードは以前からのキーのまま（記録を消さない）。ふつうは level も付けない
  const prefix = mode === 'map' ? 'station_best_map_' : 'station_best_';
  return level === 'normal'
    ? `${prefix}${lineId}_${playerName}`
    : `${prefix}${level}_${lineId}_${playerName}`;
}

function loadBest(playerName: string, lineId: string, level: Level, mode: Mode): number {
  try {
    return parseInt(localStorage.getItem(bestKey(playerName, lineId, level, mode)) ?? '0', 10);
  } catch {
    return 0;
  }
}

function saveBest(playerName: string, lineId: string, level: Level, mode: Mode, score: number) {
  try {
    localStorage.setItem(bestKey(playerName, lineId, level, mode), String(score));
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

/** 路線図の駅名ラベル（漢字＋よみ）。 */
function MapLabel({ x, y, anchor, station }: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; station: Station }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className="fill-gray-700" style={{ fontWeight: 900 }}>
      <tspan fontSize={12}>{station.name}</tspan>
      <tspan x={x} dy={11} fontSize={8} className="fill-gray-400">{station.kana}</tspan>
    </text>
  );
}

/** 「？」の駅。ぴょこぴょこ光らせて目立たせる。 */
function MapTarget({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={11} fill={color} opacity={0.35}>
        <animate attributeName="r" values="11;17;11" dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.35;0;0.35" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r={11} fill="white" stroke={color} strokeWidth={4} />
      <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={900} className="fill-gray-800">？</text>
    </g>
  );
}

/**
 * ろせんず。路線ぜんたいを点で描き、出題の駅だけ「？」にする。
 * 名前を出すのは目印の駅（ふだんは両端）だけで、出題の駅の名前は出さない。
 * 環状線は円で、東京を右にして番号順に反時計回り（だいたいの地図の向き）。
 */
function RouteMap({ line, index }: { line: Line; index: number }) {
  const n = line.stations.length;
  const marks = (line.landmarks ?? [0, n - 1]).filter((i) => i !== index);

  if (line.loop) {
    const cx = 150, cy = 118, r = 78;
    const pos = (i: number) => {
      const t = (2 * Math.PI * i) / n;
      return { x: cx + r * Math.cos(t), y: cy - r * Math.sin(t), cos: Math.cos(t), sin: Math.sin(t) };
    };
    const target = pos(index);
    return (
      <svg viewBox="0 0 300 236" className="w-full" role="img" aria-label={`${line.name}の ろせんず`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={line.color} strokeWidth={7} />
        {line.stations.map((_, i) => {
          const p = pos(i);
          return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="white" stroke={line.color} strokeWidth={2} />;
        })}
        {marks.map((i) => {
          const p = pos(i);
          const lr = r + 16;
          const anchor = p.cos > 0.3 ? 'start' : p.cos < -0.3 ? 'end' : 'middle';
          // 上半分はラベルを点の上に、下半分は下に出す（よみの2行目ぶんずらす）
          const y = cy - lr * p.sin + (p.sin > 0.3 ? -8 : p.sin < -0.3 ? 6 : 0);
          return <MapLabel key={i} x={cx + lr * p.cos} y={y} anchor={anchor} station={stationAt(line, i)} />;
        })}
        <MapTarget x={target.x} y={target.y} color={line.color} />
      </svg>
    );
  }

  const left = 16, right = 284, y = 34;
  const xAt = (i: number) => left + ((right - left) * i) / (n - 1);
  return (
    <svg viewBox="0 0 300 80" className="w-full" role="img" aria-label={`${line.name}の ろせんず`}>
      <line x1={left} y1={y} x2={right} y2={y} stroke={line.color} strokeWidth={7} strokeLinecap="round" />
      {line.stations.map((_, i) => (
        <circle key={i} cx={xAt(i)} cy={y} r={3.5} fill="white" stroke={line.color} strokeWidth={2} />
      ))}
      {marks.map((i) => (
        <MapLabel
          key={i}
          x={i === 0 ? left - 6 : i === n - 1 ? right + 6 : xAt(i)}
          y={y + 30}
          anchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
          station={stationAt(line, i)}
        />
      ))}
      <MapTarget x={xAt(index)} y={y} color={line.color} />
    </svg>
  );
}

function StationName({ station, size = 'md' }: { station: Station; size?: 'sm' | 'md' | 'lg' }) {
  const text = { sm: 'text-sm', md: 'text-lg', lg: 'text-3xl' }[size];
  const rt = { sm: 'text-[9px]', md: 'text-[10px]', lg: 'text-xs' }[size];
  return (
    <ruby className={`${text} font-black leading-tight`}>
      {station.name}
      <rt className={`${rt} font-bold opacity-70`}>{station.kana}</rt>
    </ruby>
  );
}

export default function StationQuizScreen({ playerName, onHome }: Props) {
  const [phase, setPhase]         = useState<Phase>('select');
  const [lineId, setLineId]       = useState<string>(ALL_ID);
  const [level, setLevel]         = useState<Level>('normal');
  const [mode, setMode]           = useState<Mode>('number');
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
    // ろせんずのふつうは路線ぜんたいから選択肢を出す（となりの駅ばかりだと位置だけでは決めきれない）
    const near = mode === 'number' || level === 'hard';
    setQuestions(buildQuestions(lines, QUESTION_COUNT, LEVELS[level].choices, near));
    setQIndex(0);
    setPicked(null);
    setShowHint(false);
    setScore(0);
    setPhase('quiz');
    playMiniGameStart();
  }

  function finish(finalScore: number) {
    const prevBest = loadBest(playerName, lineId, level, mode);
    const newBest = finalScore > prevBest;
    if (newBest) saveBest(playerName, lineId, level, mode, finalScore);
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

  const operators: Operator[] = ['jr', 'metro', 'toei', 'seibu'];

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
          <div className="w-full grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white shadow-inner" role="radiogroup" aria-label="あそびかた">
            {(Object.keys(MODES) as Mode[]).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className="py-2 rounded-xl text-sm font-black transition-all active:scale-95"
                style={mode === m
                  ? { background: THEME, color: 'white' }
                  : { background: 'transparent', color: '#868e96' }}
              >
                {MODES[m].icon} {MODES[m].label}
              </button>
            ))}
          </div>

          <div className="w-full grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white shadow-inner" role="radiogroup" aria-label="むずかしさ">
            {(Object.keys(LEVELS) as Level[]).map((lv) => (
              <button
                key={lv}
                role="radio"
                aria-checked={level === lv}
                onClick={() => setLevel(lv)}
                className="py-2 rounded-xl text-sm font-black transition-all active:scale-95"
                style={level === lv
                  ? { background: THEME, color: 'white' }
                  : { background: 'transparent', color: '#868e96' }}
              >
                {lv === 'hard' ? '🔥 ' : '🙂 '}{LEVELS[lv].label}（{LEVELS[lv].choices}たく）
              </button>
            ))}
          </div>

          <button
            onClick={() => start(ALL_ID)}
            className="w-full rounded-3xl px-6 py-5 text-center shadow-lg active:scale-95 transition-all"
            style={{ background: THEME, animation: 'float-bob-1 3s ease-in-out infinite' }}
          >
            <p className="text-4xl mb-1">🚃🚇</p>
            <p className="text-xl font-black text-white drop-shadow">ぜんぶの せんろで スタート！</p>
            <p className="text-xs font-bold text-white/80 mt-1">{MODES[mode].lead}</p>
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
            <span>{qIndex + 1} / {questions.length} もんめ{mode === 'map' && ' 🗺️'}{level === 'hard' && ' 🔥'}</span>
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
            {mode === 'map' ? (
              <>
                <RouteMap line={q.line} index={q.answer.number - 1} />
                <p className="text-base font-black text-gray-600">？の えきは なにえき？</p>
              </>
            ) : (
              <>
                <StationBadge line={q.line} number={q.answer.number} />
                <p className="text-base font-black text-gray-600">
                  {stationCode(q.line, q.answer.number)} は なにえき？
                </p>
              </>
            )}

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
                {q.prev && <span>◀ {mode === 'number' && stationCode(q.line, q.prev.number)} {q.prev.name}</span>}
                <span className="text-gray-300">|</span>
                {q.next && <span>{mode === 'number' && stationCode(q.line, q.next.number)} {q.next.name} ▶</span>}
              </div>
            )}
          </div>

          {/* Choices */}
          <div className={`grid grid-cols-2 w-full ${level === 'hard' ? 'gap-2' : 'gap-3'}`}>
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
                  className={`rounded-2xl px-2 shadow-md active:scale-95 transition-all ${level === 'hard' ? 'py-1.5' : 'py-4'}`}
                  style={{
                    background: bg,
                    color,
                    opacity,
                    border: '3px solid rgba(0,0,0,0.06)',
                    animation: answered && isAnswer ? 'bounce-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both' : undefined,
                  }}
                >
                  <StationName station={st} size={level === 'hard' ? 'sm' : 'md'} />
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
                    おしい！ {mode === 'map' ? '？の えき' : stationCode(q.line, q.answer.number)} は<br />
                    <span style={{ color: '#1c7ed6' }}><StationName station={q.answer} size="lg" /></span> だよ
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
              {lineId === ALL_ID ? 'ぜんぶの せんろ' : LINES.find((l) => l.id === lineId)?.name}（{MODES[mode].label}・{LEVELS[level].label}）の さいこう：{best}もん
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
