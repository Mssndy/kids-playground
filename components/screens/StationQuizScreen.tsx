'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LINES, OPERATOR_LABEL, buildQuestions, stationAt, stationCode,
  type Line, type Operator, type Station, type StationQuestion,
} from '@/lib/stations';
import { STATION_COORDS } from '@/lib/station-coords';
import { ISLANDS, PALACE, RIVERS, SEA } from '@/lib/map-terrain';
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
    <text
      x={x} y={y} textAnchor={anchor} className="fill-gray-700"
      // 線の上に重なっても読めるよう白いふちをつける
      stroke="white" strokeWidth={3} strokeLinejoin="round" style={{ fontWeight: 900, paintOrder: 'stroke' }}
    >
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

/** 地図の色 */
const LAND = '#f6f4ee';
const WATER = '#cfe6fb';
const PARK = '#d3f0d4';
/** 太く描く大きな川 */
const BIG_RIVERS = ['荒川', '江戸川', '多摩川', '入間川'];
/** 「とうきょうわん」の文字を置く位置の候補（沖から順に。地図に入って海の上にあるものを使う） */
const BAY_LABELS: [number, number][] = [
  [35.585, 139.905], [35.6, 139.86], [35.6, 139.83], [35.615, 139.81], [35.6, 139.79], [35.585, 139.77], [35.57, 139.76],
];

function inside([la, lo]: [number, number], poly: [number, number][]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ai, oi] = poly[i], [aj, oj] = poly[j];
    if ((ai > la) !== (aj > la) && lo < ((oj - oi) * (la - ai)) / (aj - ai) + oi) hit = !hit;
  }
  return hit;
}
const isSea = (pt: [number, number]) => inside(pt, SEA) && !ISLANDS.some((isl) => inside(pt, isl));

/** 地図の目印にする大きな駅。出題の路線の両端のつぎに名前を出す。 */
const HUBS = ['東京', '新宿', '渋谷', '池袋', '上野', '品川'];

/**
 * ろせんず。実際の駅の位置で路線の形を描き、出題の駅だけ「？」にする。
 * まわりのほかの路線もうすく描いて地図にする（上が北）。
 * 名前を出すのは出題の路線の両端と大きな駅だけで、出題の駅の名前は出さない。
 */
function RouteMap({ line, index }: { line: Line; index: number }) {
  const W = 300, PAD = 30, MAX_H = 260, MIN_H = 150;
  const coords = STATION_COORDS[line.id];
  const lats = coords.map(([la]) => la);
  const lons = coords.map(([, lo]) => lo);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((lat0 * Math.PI) / 180); // 経度1度の東西の長さを緯度に合わせる
  const dx = Math.max((Math.max(...lons) - Math.min(...lons)) * kx, 0.01);
  const dy = Math.max(Math.max(...lats) - Math.min(...lats), 0.01);
  const scale = Math.min((W - PAD * 2) / dx, (MAX_H - PAD * 2) / dy);
  const H = Math.max(MIN_H, dy * scale + PAD * 2);
  const cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const proj = ([la, lo]: [number, number]) => ({
    x: W / 2 + (lo - cLon) * kx * scale,
    y: H / 2 - (la - cLat) * scale,
  });
  const pathOf = (coordList: [number, number][], closed = false) =>
    coordList.map(proj).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('') + (closed ? 'Z' : '');
  const linePath = (l: Line) => pathOf(STATION_COORDS[l.id], l.loop);
  const bay = BAY_LABELS.filter(isSea).map(proj).find((p) => p.x > 40 && p.x < W - 40 && p.y > 20 && p.y < H - 8);

  const pts = coords.map(proj);
  const target = pts[index];
  const answerName = line.stations[index].split('|')[0];

  // 名前を出す駅：両端 → 大きな駅（ほかの路線のものも、地図に入っていれば）。重なるものは出さない
  const n = coords.length;
  const candidates: { st: Station; p: { x: number; y: number } }[] = [];
  for (const i of line.loop ? [] : [0, n - 1]) candidates.push({ st: stationAt(line, i), p: pts[i] });
  for (const hub of HUBS) {
    for (const l of LINES) {
      const i = l.stations.findIndex((s) => s.startsWith(`${hub}|`));
      if (i < 0) continue;
      candidates.push({ st: stationAt(l, i), p: proj(STATION_COORDS[l.id][i]) });
      break;
    }
  }
  // ラベルの置き場所と、文字が占める四角。下にはみ出すときは点の上に出す
  const place = ({ st, p }: (typeof candidates)[number]) => {
    const anchor: 'start' | 'middle' | 'end' = p.x < 60 ? 'start' : p.x > W - 60 ? 'end' : 'middle';
    const y = p.y + 22 > H - 4 ? p.y - 18 : p.y + 16;
    const w = Math.max(st.name.length * 12, st.kana.length * 8);
    const x0 = anchor === 'start' ? p.x : anchor === 'end' ? p.x - w : p.x - w / 2;
    return { anchor, y, box: { x0, x1: x0 + w, y0: y - 11, y1: y + 13 } };
  };
  type Box = { x0: number; x1: number; y0: number; y1: number };
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const targetBox = { x0: target.x - 16, x1: target.x + 16, y0: target.y - 16, y1: target.y + 16 };
  const labels: ((typeof candidates)[number] & ReturnType<typeof place>)[] = [];
  for (const c of candidates) {
    const { x, y } = c.p;
    if (c.st.name === answerName || labels.some((l) => l.st.name === c.st.name)) continue;
    if (x < 4 || x > W - 4 || y < 4 || y > H - 4) continue;
    const pl = place(c);
    if (hit(pl.box, targetBox) || labels.some((l) => hit(l.box, pl.box))) continue;
    labels.push({ ...c, ...pl });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H.toFixed(0)}`} className="w-full rounded-2xl" style={{ background: LAND }} role="img" aria-label={`${line.name}の ろせんず`}>
      {/* 地形：海 → 島 → 皇居 → 川 */}
      <path d={pathOf(SEA, true)} fill={WATER} />
      {ISLANDS.map((isl, i) => <path key={i} d={pathOf(isl, true)} fill={LAND} />)}
      <path d={pathOf(PALACE, true)} fill={PARK} />
      {Object.entries(RIVERS).flatMap(([name, parts]) => parts.map((part, i) => (
        <path
          key={`${name}${i}`} d={pathOf(part)} fill="none" stroke={WATER}
          strokeWidth={BIG_RIVERS.includes(name) ? 4 : 2.5} strokeLinejoin="round" strokeLinecap="round"
        />
      )))}
      {bay && (
        <text x={bay.x} y={bay.y} textAnchor="middle" fontSize={10} fontWeight={900} fill="#74a9d8" letterSpacing={2}>
          とうきょうわん
        </text>
      )}
      {LINES.filter((l) => l.id !== line.id).map((l) => (
        <path key={l.id} d={linePath(l)} fill="none" stroke={l.color} strokeOpacity={0.25} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <path d={linePath(line)} fill="none" stroke={line.color} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="white" stroke={line.color} strokeWidth={2} />
      ))}
      {labels.map(({ st, p, anchor, y }) => (
        <g key={st.name}>
          <circle cx={p.x} cy={p.y} r={2.5} fill="#495057" />
          <MapLabel x={p.x} y={y} anchor={anchor} station={st} />
        </g>
      ))}
      <text x={W - 8} y={16} textAnchor="end" fontSize={10} fontWeight={900} className="fill-gray-400">↑きた</text>
      {/* 地形のデータの出典（OpenStreetMap の利用条件で表示が必要） */}
      <text x={W - 4} y={H - 4} textAnchor="end" fontSize={6} className="fill-gray-400">© OpenStreetMap contributors</text>
      <MapTarget x={target.x} y={target.y} color={line.color} />
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
