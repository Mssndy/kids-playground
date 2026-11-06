'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  generateTossGrid, checkTossLines, calcTossScore, getTossLineSegments,
  TOSS_BALLS, BALL_OPTIONS, gridSizeForBalls, GaugeZone, getZoneFromRadius, calcLandingCell,
} from '@/lib/toss';
import { playToss, playLand, playBingo, playCorrect, playWrong, playGaugeStop } from '@/lib/sounds';
import { saveRankEntry } from '@/lib/ranking';

interface Props {
  playerName: string;
  onHome: () => void;
}

interface FlyingBall {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

type Phase     = 'setup' | 'play' | 'aiming' | 'result';
type RingSpeed = 'slow' | 'normal' | 'fast';

const RING_SPEEDS: Record<RingSpeed, number> = {
  slow:   0.8,
  normal: 1.3,
  fast:   2.1,
};

// Ring colour per zone
function zoneColor(nr: number) {
  if (nr < 0.15) return '#22c55e';
  if (nr < 0.45) return '#fbbf24';
  if (nr < 0.75) return '#f97316';
  return '#ef4444';
}
function zoneLabel(nr: number) {
  if (nr < 0.15) return '🎯 PERFECT!';
  if (nr < 0.45) return '✨ GOOD!';
  if (nr < 0.75) return '😅 まあまあ…';
  return '💦 あーあ！';
}
function zoneColorSolid(zone: GaugeZone) {
  return zone === 'perfect' ? '#16a34a' : zone === 'good' ? '#d97706' : zone === 'ok' ? '#ea580c' : '#dc2626';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyMarked(size = 5): boolean[][] {
  return Array.from({ length: size }, () => Array(size).fill(false));
}

/** いちばん大きいカード (いちばん多い球数モード) の一辺。cellRefs はこの大きさで確保しておく。 */
const MAX_GRID_SIZE = gridSizeForBalls(Math.max(...BALL_OPTIONS));

// ── RingOverlay ───────────────────────────────────────────────────────────────
// Full-screen fixed SVG overlay. The ring pulsates from a dot to maxRadius around
// the targeted cell. Tap anywhere to freeze and lock in the current ring size.

function RingOverlay({
  cx, cy, maxR, speed, onStop,
}: {
  cx: number;
  cy: number;
  maxR: number;
  speed: number;  // cycles per second
  onStop: (zone: GaugeZone) => void;
}) {
  const ringRef     = useRef<SVGCircleElement>(null);
  const glowRef     = useRef<SVGCircleElement>(null);
  const dotRef      = useRef<SVGCircleElement>(null);
  const badgeRectRef = useRef<SVGRectElement>(null);
  const badgeTextRef = useRef<SVGTextElement>(null);
  const nrRef       = useRef(0);
  const stoppedRef  = useRef(false);
  const rafRef      = useRef<number>(0);
  const startRef    = useRef<number | null>(null);

  useEffect(() => {
    function tick(t: number) {
      if (stoppedRef.current) return;
      if (startRef.current === null) startRef.current = t;

      // Triangle wave 0 → 1 → 0, period = 1/speed seconds
      const elapsed = (t - startRef.current) / 1000;
      const phase   = (elapsed * speed) % 1;
      const nr      = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      nrRef.current = nr;

      const r     = nr * maxR;
      const col   = zoneColor(nr);
      const sw    = 3.5 + (1 - nr) * 2;          // thicker when tiny
      const dotR  = 5 + (1 - nr) * 7;            // bigger dot when tiny
      const ringOp = r < 8 ? 0 : 0.90;

      ringRef.current?.setAttribute('r',              Math.max(r, 0.1).toFixed(1));
      ringRef.current?.setAttribute('stroke',         col);
      ringRef.current?.setAttribute('stroke-width',   sw.toFixed(1));
      ringRef.current?.setAttribute('stroke-opacity', ringOp.toString());

      glowRef.current?.setAttribute('r',              Math.max(r, 0.1).toFixed(1));
      glowRef.current?.setAttribute('stroke',         col);
      glowRef.current?.setAttribute('stroke-opacity', (r < 8 ? 0 : 0.28).toString());

      dotRef.current?.setAttribute('r',    dotR.toFixed(1));
      dotRef.current?.setAttribute('fill', col);

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cx, cy, maxR, speed]);

  function handleTap() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    playGaugeStop();

    const nr   = nrRef.current;
    const r    = nr * maxR;
    const col  = zoneColorSolid(getZoneFromRadius(nr));
    const lbl  = zoneLabel(nr);
    const bW   = 172;
    const bH   = 44;
    const badgeY = cy - r - 60 > 4 ? cy - r - 60 : cy + r + 16;

    // Freeze ring visuals
    ringRef.current?.setAttribute('r',              Math.max(r, 0.1).toFixed(1));
    ringRef.current?.setAttribute('stroke',         col);
    ringRef.current?.setAttribute('stroke-width',   '4.5');
    ringRef.current?.setAttribute('stroke-opacity', '1');
    glowRef.current?.setAttribute('stroke-opacity', '0');
    dotRef.current?.setAttribute('r',    '7');
    dotRef.current?.setAttribute('fill', col);

    // Show badge — keep within card top/bottom
    if (badgeRectRef.current) {
      badgeRectRef.current.setAttribute('x',    (cx - bW / 2).toFixed(1));
      badgeRectRef.current.setAttribute('y',    badgeY.toFixed(1));
      badgeRectRef.current.setAttribute('fill', col);
      badgeRectRef.current.style.display = '';
    }
    if (badgeTextRef.current) {
      badgeTextRef.current.setAttribute('x', cx.toFixed(1));
      badgeTextRef.current.setAttribute('y', (badgeY + bH / 2).toFixed(1));
      badgeTextRef.current.textContent = lbl;
      badgeTextRef.current.style.display = '';
    }

    onStop(getZoneFromRadius(nr));
  }

  const bW = 172, bH = 44;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 20,
        cursor: 'pointer',
        pointerEvents: 'all',
        touchAction: 'none',
        borderRadius: 'inherit',
      }}
      onClick={handleTap}
    >
      {/* Dim the card while aiming */}
      <rect x={0} y={0} width="100%" height="100%" fill="rgba(0,0,0,0.30)" />

      {/* Glow ring (wider, more transparent) */}
      <circle
        ref={glowRef}
        cx={cx} cy={cy} r={0.1}
        stroke="#22c55e" strokeWidth={12}
        fill="none" strokeOpacity={0}
      />

      {/* Main ring */}
      <circle
        ref={ringRef}
        cx={cx} cy={cy} r={0.1}
        stroke="#22c55e" strokeWidth={4}
        fill="none" strokeOpacity={0}
      />

      {/* Center dot */}
      <circle
        ref={dotRef}
        cx={cx} cy={cy} r={12}
        fill="#22c55e"
      />

      {/* Badge (hidden until stopped) */}
      <rect
        ref={badgeRectRef}
        x={cx - bW / 2} y={cy - 80}
        width={bW} height={bH} rx={bH / 2}
        fill="#16a34a"
        style={{ display: 'none' }}
      />
      <text
        ref={badgeTextRef}
        x={cx} y={cy - 58}
        textAnchor="middle" dominantBaseline="central"
        fontSize={17} fontWeight={900} fill="white"
        style={{ display: 'none' }}
      >
        🎯 PERFECT!
      </text>
    </svg>
  );
}

// ── Cell ──────────────────────────────────────────────────────────────────────

function Cell({
  number, marked, inLine, justLanded, isTarget, disabled, onClick, cellRef, compact,
}: {
  number: number;
  /** 'normal' = 6×6 まで / 'compact' = 7×7・8×8 / 'tiny' = 9×9 以上。マスが小さいほど字とたまを小さくする */
  compact: 'normal' | 'compact' | 'tiny';
  marked: boolean;
  inLine: boolean;
  justLanded: boolean;
  isTarget: boolean;
  disabled: boolean;
  onClick: () => void;
  cellRef: (el: HTMLDivElement | null) => void;
}) {
  const bg = inLine
    ? 'linear-gradient(160deg, #FEF08A, #FCD34D)'
    : marked   ? 'linear-gradient(160deg, #92400E, #78350F)'
    : isTarget ? 'linear-gradient(160deg, #DBEAFE, #BFDBFE)'
    : 'linear-gradient(160deg, #FFFBEB, #FEF3C7)';

  const borderColor = isTarget ? '#3b82f6'
    : inLine ? '#B45309'
    : marked  ? '#451A03'
    : '#92400E';

  const animation = justLanded ? 'cell-catch 0.38s cubic-bezier(0.34,1.56,0.64,1) both'
    : isTarget ? 'target-pulse 1s ease-in-out infinite'
    : undefined;

  return (
    <div
      ref={cellRef}
      onClick={disabled ? undefined : onClick}
      className="relative flex items-center justify-center overflow-hidden select-none"
      style={{
        aspectRatio: '1',
        border: `${compact === 'tiny' ? 2 : 3}px solid ${borderColor}`,
        borderRadius: 5,
        background: bg,
        boxShadow: marked
          ? 'inset 0 2px 6px rgba(0,0,0,0.35)'
          : 'inset 0 -2px 3px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.18)',
        cursor: disabled || marked ? 'default' : 'pointer',
        animation,
        transition: 'background 0.25s, border-color 0.25s',
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(135deg,rgba(255,255,255,0.28) 0%,transparent 55%)',
        borderRadius: 3,
      }} />

      {marked ? (
        <>
          <span className={`${compact === 'tiny' ? 'text-xs' : compact === 'compact' ? 'text-base' : 'text-xl'} leading-none relative z-10`}
            style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))' }}>⚾</span>
          <span className="absolute bottom-0.5 right-1 leading-none relative z-10 font-black"
            style={{ fontSize: compact === 'tiny' ? 7 : 9, color: inLine ? '#78350F' : 'rgba(255,255,255,0.55)' }}>
            {number}
          </span>
        </>
      ) : (
        <span className={`${compact === 'tiny' ? 'text-xs' : compact === 'compact' ? 'text-sm' : 'text-base'} font-black relative z-10 leading-none`}
          style={{ color: isTarget ? '#1d4ed8' : '#78350F' }}>
          {number}
        </span>
      )}

      {inLine && (
        <div className="absolute inset-0 rounded pointer-events-none"
          style={{ animation: 'toss-bingo-line 1.4s ease-in-out infinite' }} />
      )}
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function TossGameScreen({ playerName, onHome }: Props) {
  const [totalBalls, setTotalBalls] = useState(TOSS_BALLS);
  const [grid, setGrid]           = useState<number[][]>(() => generateTossGrid());
  const [marked, setMarked]       = useState<boolean[][]>(emptyMarked);
  const [ballsLeft, setBallsLeft] = useState(TOSS_BALLS);
  const [flyingBall, setFlyingBall] = useState<FlyingBall | null>(null);
  const [justLanded, setJustLanded] = useState<string | null>(null);
  const [lineCells, setLineCells] = useState<Set<string>>(new Set());
  const [lineCount, setLineCount] = useState(0);
  const [phase, setPhase]         = useState<Phase>('setup');
  const [score, setScore]         = useState(0);
  const [aimTarget, setAimTarget] = useState<{ row: number; col: number } | null>(null);
  // Position/size of the target cell for the ring overlay
  const [ringPos, setRingPos]     = useState<{ cx: number; cy: number; maxR: number } | null>(null);
  const [ringSpeed, setRingSpeed] = useState<RingSpeed>('normal');
  const gridSize = grid.length;

  const markedRef    = useRef(marked);
  const ballsLeftRef = useRef(ballsLeft);
  const lineCellsRef = useRef(lineCells);
  const lineCountRef = useRef(lineCount);
  markedRef.current    = marked;
  ballsLeftRef.current = ballsLeft;
  lineCellsRef.current = lineCells;
  lineCountRef.current = lineCount;

  const throwTargetRef = useRef<[number, number] | null>(null);
  const ballIdRef      = useRef(0);

  const cellRefs    = useRef<(HTMLDivElement | null)[][]>(
    Array.from({ length: MAX_GRID_SIZE }, () => Array(MAX_GRID_SIZE).fill(null)),
  );
  const launcherRef = useRef<HTMLDivElement>(null);
  const cardRef     = useRef<HTMLDivElement>(null);

  // ── Step 1: tap a cell → enter aiming, show ring around that cell ────────────

  const handleCellTap = useCallback((row: number, col: number) => {
    if (flyingBall || ballsLeftRef.current === 0 || markedRef.current[row][col] || phase !== 'play') return;

    const cellEl = cellRefs.current[row][col];
    const cardEl = cardRef.current;
    if (cellEl && cardEl) {
      const cellRect = cellEl.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();
      setRingPos({
        cx:   cellRect.left - cardRect.left + cellRect.width  / 2,
        cy:   cellRect.top  - cardRect.top  + cellRect.height / 2,
        maxR: cardRect.width * 0.44,
      });
    }
    setAimTarget({ row, col });
    setPhase('aiming');
  }, [flyingBall, phase]);

  // ── Step 2: ring tapped → zone determined, brief freeze, then throw ──────────

  const handleRingStop = useCallback((zone: GaugeZone) => {
    if (!aimTarget) return;

    if (zone === 'perfect') setTimeout(playCorrect, 60);
    if (zone === 'miss')    setTimeout(playWrong,   60);

    const [ar, ac] = calcLandingCell(aimTarget.row, aimTarget.col, zone, markedRef.current);

    // Brief pause so the freeze badge is visible, then launch the ball
    setTimeout(() => {
      const cellEl   = cellRefs.current[ar][ac];
      const launchEl = launcherRef.current;
      if (!cellEl || !launchEl || ballsLeftRef.current === 0) return;

      const cRect = cellEl.getBoundingClientRect();
      const lRect = launchEl.getBoundingClientRect();

      throwTargetRef.current = [ar, ac];
      setFlyingBall({
        id:    ++ballIdRef.current,
        fromX: lRect.left + lRect.width  / 2,
        fromY: lRect.top  + lRect.height / 2,
        toX:   cRect.left + cRect.width  / 2,
        toY:   cRect.top  + cRect.height / 2,
      });
      setPhase('play');
      setAimTarget(null);
      setRingPos(null);
      playToss();

      // Ball lands
      setTimeout(() => {
        const [r, c] = throwTargetRef.current!;
        const newMarked     = markedRef.current.map(row => [...row]);
        newMarked[r][c]     = true;
        const { cells: newCells, count: newCount } = checkTossLines(newMarked);
        const newBallsLeft  = ballsLeftRef.current - 1;
        const gotNewBingo   = newCount > lineCountRef.current;

        setMarked(newMarked);
        setLineCells(newCells);
        setLineCount(newCount);
        setBallsLeft(newBallsLeft);
        setFlyingBall(null);
        setJustLanded(`${r},${c}`);

        playLand();
        if (gotNewBingo) setTimeout(playBingo, 80);
        setTimeout(() => setJustLanded(null), 420);

        if (newBallsLeft === 0) {
          const finalScore = calcTossScore(grid, newCells);
          setScore(finalScore);
          saveRankEntry({ playerName, score: finalScore, mode: 'toss' });
          setTimeout(() => setPhase('result'), 700);
        }
      }, 520);
    }, 440);
  }, [aimTarget, grid]);

  // ── Reset ─────────────────────────────────────────────────────────────────────

  function handleReset() {
    setGrid(generateTossGrid(gridSize));
    setMarked(emptyMarked(gridSize));
    setFlyingBall(null);
    setJustLanded(null);
    setLineCells(new Set());
    setLineCount(0);
    setPhase('setup');
    setScore(0);
    setAimTarget(null);
    setRingPos(null);
  }

  function handleStart(balls: number) {
    const size = gridSizeForBalls(balls);
    setTotalBalls(balls);
    setBallsLeft(balls);
    setGrid(generateTossGrid(size));
    setMarked(emptyMarked(size));
    setLineCells(new Set());
    setLineCount(0);
    setScore(0);
    setPhase('play');
  }

  // ── Setup screen ─────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 px-4 animate-[fade-in_0.3s_ease_both]">
        <div className="w-full max-w-sm flex items-center justify-between">
          <button
            onClick={onHome}
            className="text-2xl p-2 rounded-full hover:bg-black/5 active:scale-90 transition-all"
            aria-label="ホームにもどる"
          >
            🏠
          </button>
          <h2 className="text-lg font-black text-gray-700">たまなげビンゴ</h2>
          <div className="w-10" />
        </div>

        <div
          className="w-full max-w-sm rounded-3xl p-4 flex flex-col items-center gap-3 shadow-xl"
          style={{ background: 'linear-gradient(160deg, #3B1A08, #6B2D0D)' }}
        >
          <p className="text-white font-black text-lg">⚾ たまの かず</p>
          <div className="grid grid-cols-4 gap-2 w-full">
            {BALL_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => handleStart(n)}
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-black text-lg transition-all active:scale-90"
                style={{
                  background: n === totalBalls
                    ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                    : 'rgba(255,255,255,0.12)',
                  color: n === totalBalls ? '#78350F' : 'white',
                  border: `2px solid ${n === totalBalls ? '#f59e0b' : 'transparent'}`,
                  boxShadow: n === totalBalls ? '0 4px 12px rgba(251,191,36,0.4)' : 'none',
                }}
              >
                {n}
                {gridSizeForBalls(n) > 5 && (
                  <span className="text-[10px] font-bold leading-none opacity-75">
                    {gridSizeForBalls(n)}×{gridSizeForBalls(n)}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-amber-200 text-xs font-bold opacity-75">タップしてスタート！</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-3 animate-[fade-in_0.3s_ease_both]">

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
          <h2 className="text-lg font-black text-gray-700">たまなげビンゴ</h2>
          <p className="text-xs text-gray-400 font-bold">{playerName} ⚾</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 font-bold">スコア</p>
          <p
            key={lineCount}
            className="text-2xl font-black animate-[number-pop_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]"
            style={{ color: 'var(--color-bingo-yellow)' }}
          >
            {calcTossScore(grid, lineCells)}
          </p>
        </div>
      </div>

      {/* Instruction */}
      <p className="text-sm font-bold text-gray-500 text-center px-4 min-h-[1.25rem]">
        {phase === 'play' && !flyingBall && ballsLeft > 0 && 'ねらうマスを タップしよう！'}
        {phase === 'aiming' && aimTarget && (
          <span>
            マス <span className="font-black text-blue-600">{grid[aimTarget.row][aimTarget.col]}</span>
            {' '}— 輪が ちいさいとき タップ！⚾
          </span>
        )}
        {lineCount > 0 && phase === 'play' && !flyingBall && (
          <span className="ml-1 font-black" style={{ color: 'var(--color-bingo-green)' }}>
            ✨ ビンゴ {lineCount} ライン！
          </span>
        )}
      </p>

      {/* Grid */}
      <div className="w-full max-w-sm px-3">
        <div
          ref={cardRef}
          className="rounded-2xl p-2 shadow-xl"
          style={{
            position: 'relative',
            background: 'linear-gradient(160deg, #3B1A08, #6B2D0D)',
            border: '3px solid #2D1206',
            boxShadow: '0 8px 28px rgba(59,26,8,0.5)',
          }}
        >
          <div className={`grid ${gridSize >= 9 ? 'gap-1' : 'gap-1.5'}`} style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
            {grid.map((row, r) =>
              row.map((num, c) => {
                const key      = `${r},${c}`;
                const isTarget = aimTarget?.row === r && aimTarget?.col === c;
                return (
                  <Cell
                    key={key}
                    number={num}
                    marked={marked[r][c]}
                    inLine={lineCells.has(key)}
                    justLanded={justLanded === key}
                    isTarget={!!isTarget}
                    disabled={!!flyingBall || phase !== 'play'}
                    compact={gridSize >= 9 ? 'tiny' : gridSize >= 7 ? 'compact' : 'normal'}
                    onClick={() => handleCellTap(r, c)}
                    cellRef={(el) => { cellRefs.current[r][c] = el; }}
                  />
                );
              })
            )}
          </div>

          {/* SVG bingo line overlay */}
          {lineCount > 0 && (
            <svg
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none', zIndex: 15,
              }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {getTossLineSegments(marked).map(({ r1, c1, r2, c2 }, i) => (
                <g key={i}>
                  <line
                    x1={c1 * (100 / gridSize) + 50 / gridSize} y1={r1 * (100 / gridSize) + 50 / gridSize}
                    x2={c2 * (100 / gridSize) + 50 / gridSize} y2={r2 * (100 / gridSize) + 50 / gridSize}
                    stroke="rgba(251,191,36,0.45)" strokeWidth={14} strokeLinecap="round"
                  />
                  <line
                    x1={c1 * (100 / gridSize) + 50 / gridSize} y1={r1 * (100 / gridSize) + 50 / gridSize}
                    x2={c2 * (100 / gridSize) + 50 / gridSize} y2={r2 * (100 / gridSize) + 50 / gridSize}
                    stroke="rgba(255,255,255,0.92)" strokeWidth={5} strokeLinecap="round"
                  />
                </g>
              ))}
            </svg>
          )}

          {/* Ring overlay — absolute within the card while aiming */}
          {phase === 'aiming' && ringPos && (
            <RingOverlay
              cx={ringPos.cx}
              cy={ringPos.cy}
              maxR={ringPos.maxR}
              speed={RING_SPEEDS[ringSpeed]}
              onStop={handleRingStop}
            />
          )}
        </div>
      </div>

      {/* Balls (launcher origin — always mounted for BoundingClientRect) */}
      {phase !== 'result' && (
        <div className="flex flex-col items-center gap-2">
          <div
            ref={launcherRef}
            className="flex items-center justify-center gap-1 flex-wrap px-4 py-2 rounded-2xl"
            style={{ background: 'white', border: '2px solid rgba(0,0,0,0.07)', maxWidth: 300 }}
          >
            {Array.from({ length: totalBalls }).map((_, i) => (
              <span
                key={i}
                className={`${totalBalls > 50 ? 'text-xs' : totalBalls > 20 ? 'text-base' : 'text-2xl'} leading-none transition-opacity duration-300`}
                style={{ opacity: i < ballsLeft ? 1 : 0.15 }}
              >
                ⚾
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 font-bold">
            あと <span className="text-lg font-black text-gray-600">{ballsLeft}</span> 球
          </p>
        </div>
      )}
      {/* Hidden launcher ref mount point for result phase (BoundingClientRect) */}
      {phase === 'result' && <div ref={launcherRef} style={{ display: 'none' }} />}

      {/* Speed selector */}
      {phase !== 'result' && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">スピード</span>
          {(['slow', 'normal', 'fast'] as RingSpeed[]).map((s) => (
            <button
              key={s}
              onClick={() => setRingSpeed(s)}
              className="px-3 py-1 rounded-full text-xs font-black transition-all active:scale-90"
              style={{
                background: ringSpeed === s
                  ? 'linear-gradient(135deg, #667eea, #764ba2)'
                  : 'rgba(0,0,0,0.06)',
                color: ringSpeed === s ? 'white' : '#9ca3af',
                border: `2px solid ${ringSpeed === s ? 'transparent' : 'rgba(0,0,0,0.08)'}`,
              }}
            >
              {s === 'slow' ? '🐢 おそい' : s === 'normal' ? '🐇 ふつう' : '⚡ はやい'}
            </button>
          ))}
        </div>
      )}

      {/* Flying ball */}
      {flyingBall && (
        <div
          key={flyingBall.id}
          style={{
            position: 'fixed',
            left: flyingBall.fromX,
            top:  flyingBall.fromY,
            zIndex: 200,
            pointerEvents: 'none',
            fontSize: 28,
            lineHeight: 1,
            ['--dx' as string]: `${flyingBall.toX - flyingBall.fromX}px`,
            ['--dy' as string]: `${flyingBall.toY - flyingBall.fromY}px`,
            animation: 'ball-toss 0.52s cubic-bezier(0.4,0.0,0.55,1) forwards',
          }}
        >
          ⚾
        </div>
      )}

      {/* Result card (shown inline below grid when game ends) */}
      {phase === 'result' && (
        <div
          className="w-full max-w-sm rounded-3xl p-7 shadow-2xl flex flex-col items-center gap-4 animate-[bounce-in_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both]"
          style={{ background: 'white' }}
        >
          <p className="text-2xl font-black text-gray-700">ゲームしゅうりょう！🎉</p>

          {lineCount > 0 ? (
            <>
              <div className="text-center">
                <p className="text-6xl font-black" style={{ color: 'var(--color-bingo-yellow)' }}>
                  {score}
                </p>
                <p className="text-sm text-gray-400 font-bold">てん</p>
              </div>
              <div
                className="rounded-2xl px-6 py-2 text-center"
                style={{ background: 'var(--color-bingo-green)', color: 'white' }}
              >
                <p className="text-lg font-black">ビンゴ {lineCount} ライン！</p>
              </div>
              <p className="text-sm text-gray-500 text-center font-bold">
                ビンゴラインの数字を合わせると<br />{score}てんだよ！
              </p>
            </>
          ) : (
            <div className="text-center">
              <p className="text-5xl">😢</p>
              <p className="text-base font-black text-gray-500 mt-2">ビンゴ ならなかった…</p>
              <p className="text-sm text-gray-400 mt-1">もう一度 チャレンジしよう！</p>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <button
              onClick={handleReset}
              className="flex-1 py-4 rounded-2xl text-lg font-black text-white shadow-md active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #ff922b 0%, #e03131 100%)' }}
            >
              もう一度！⚾
            </button>
            <button
              onClick={onHome}
              className="py-4 px-4 rounded-2xl text-lg font-black text-gray-500 shadow-md active:scale-95 transition-all bg-gray-100"
            >
              🏠
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
