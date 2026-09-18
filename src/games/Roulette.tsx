import './roulette.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChipTray, StackedChips } from '../components/Chips'
import {
  EUROPEAN_ORDER,
  betKey,
  boardWinIds,
  rouletteColor,
  roulettePayoutMult,
  rouletteWins,
  type ChipValue,
  type RouletteBetKind,
} from '../lib/games'
import {
  BALL_R,
  CX,
  CY,
  POCKET_DEG,
  R_POCKET_IN,
  R_POCKET_OUT,
  R_TRACK,
  VIEW,
  annularSector,
  ballStateAt,
  formatSeconds,
  pocketIndexOf,
  polar,
  resultForRound,
  roundStateAt,
  wheelRotationAt,
  type RoundState,
} from '../lib/roulette'
import { useCasino, usePlayTimer } from '../store/CasinoContext'
import { useRoomReport } from '../store/RoomContext'
import { formatMoney, formatSettleLine } from '../lib/format'

type Mode = 'straight' | 'split' | 'street' | 'corner'
type BetEntry = { bet: RouletteBetKind; amount: number }
type BetMap = Record<string, BetEntry>
type Frozen = { id: number; bets: BetMap; stake: number }

const COLOR_FR = { red: 'rouge', black: 'noir', green: 'vert' } as const

/** Géométrie des 37 poches — calculée une seule fois. */
const POCKETS = EUROPEAN_ORDER.map((n, i) => ({
  n,
  color: rouletteColor(n),
  mid: i * POCKET_DEG,
  d: annularSector(R_POCKET_IN, R_POCKET_OUT, (i - 0.5) * POCKET_DEG, (i + 0.5) * POCKET_DEG),
  label: polar(CX, CY, (R_POCKET_IN + R_POCKET_OUT) / 2, i * POCKET_DEG),
  fretIn: polar(CX, CY, R_POCKET_IN, (i + 0.5) * POCKET_DEG),
  fretOut: polar(CX, CY, R_POCKET_OUT, (i + 0.5) * POCKET_DEG),
}))

const sumBets = (map: BetMap): number =>
  Object.values(map).reduce((total, entry) => total + entry.amount, 0)

export function RouletteGame() {
  const { user, settleBet, pushToast } = useCasino()
  const report = useRoomReport()
  usePlayTimer(true, 'roulette')

  const [clock, setClock] = useState<RoundState>(() => roundStateAt(Date.now()))
  const [chip, setChip] = useState<ChipValue>(100)
  const [mode, setMode] = useState<Mode>('straight')
  const [splitFirst, setSplitFirst] = useState<number | null>(null)
  const [bets, setBets] = useState<BetMap>({})
  const [lastBets, setLastBets] = useState<BetMap>({})
  const [glowIds, setGlowIds] = useState<Set<string>>(new Set())
  const [shownResult, setShownResult] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [message, setMessage] = useState('Jeton + case = pari. Plein, cheval, ligne ou carré.')

  const clockRef = useRef(clock)
  const frozenRef = useRef<Frozen | null>(null)
  const settledRef = useRef<Set<number>>(new Set())
  const clearedRef = useRef(-1)
  const glowTimerRef = useRef(0)

  const wheelRef = useRef<SVGGElement | null>(null)
  const ballRef = useRef<SVGCircleElement | null>(null)
  const barRef = useRef<HTMLSpanElement | null>(null)
  const ringRef = useRef<SVGCircleElement | null>(null)

  const open = clock.phase === 'bets'
  const committed = useMemo(() => sumBets(bets), [bets])
  const engaged = clock.phase === 'result' ? 0 : committed
  const available = open ? user.wallet.cash - committed : 0

  /* ----------------------------------------------------------- mouvement */

  useEffect(() => {
    let raf = 0
    let alive = true
    const place = (el: SVGCircleElement | null, x: number, y: number, opacity?: number) => {
      if (!el) return
      el.setAttribute('cx', x.toFixed(2))
      el.setAttribute('cy', y.toFixed(2))
      if (opacity !== undefined) el.style.opacity = String(opacity)
    }
    const loop = () => {
      if (!alive) return
      const t = Date.now()
      const state = roundStateAt(t)

      const wheel = wheelRef.current
      if (wheel) {
        wheel.setAttribute('transform', `rotate(${wheelRotationAt(t).toFixed(3)} ${CX} ${CY})`)
      }

      const ball = ballStateAt(t)
      const pos = polar(CX, CY, ball.radius, ball.angle)
      place(ballRef.current, pos.x, pos.y)

      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${state.phaseProgress.toFixed(4)})`
      }
      ringRef.current?.setAttribute(
        'stroke-dasharray',
        `${(state.phaseProgress * 100).toFixed(2)} 100`,
      )

      const prev = clockRef.current
      if (
        prev.roundId !== state.roundId ||
        prev.phase !== state.phase ||
        formatSeconds(prev.remainingMs) !== formatSeconds(state.remainingMs)
      ) {
        clockRef.current = state
        setClock(state)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => () => window.clearTimeout(glowTimerRef.current), [])

  /* ------------------------------------------------------------- manches */

  // Gel des mises au passage en phase de spin : plus rien ne bouge ensuite.
  useEffect(() => {
    if (clock.phase === 'bets') return
    if (frozenRef.current?.id === clock.roundId) return
    const stake = sumBets(bets)
    frozenRef.current = { id: clock.roundId, bets, stake }
    if (stake > 0) setLastBets(bets)
  }, [clock.phase, clock.roundId, bets])

  const resolveRound = useCallback(
    (id: number, live: boolean) => {
      if (settledRef.current.has(id)) return
      settledRef.current.add(id)
      for (const seen of settledRef.current) {
        if (seen < id - 8) settledRef.current.delete(seen)
      }

      const winning = resultForRound(id)
      const frozen = frozenRef.current?.id === id ? frozenRef.current : null
      const winners = new Set(boardWinIds(winning))
      let payout = 0
      if (frozen && frozen.stake > 0) {
        for (const [key, entry] of Object.entries(frozen.bets)) {
          if (rouletteWins(entry.bet, winning)) {
            payout += entry.amount * roulettePayoutMult(entry.bet)
            winners.add(key)
          }
        }
      }

      if (live) {
        setShownResult(winning)
        setHistory((h) => [winning, ...h].slice(0, 20))
        setGlowIds(winners)
        setMessage(`${winning} ${COLOR_FR[rouletteColor(winning)]}`)
        window.clearTimeout(glowTimerRef.current)
        glowTimerRef.current = window.setTimeout(() => setGlowIds(new Set()), 5200)
      }

      if (!frozen || frozen.stake <= 0) {
        if (live) setSummary(null)
        return
      }
      if (!settleBet(frozen.stake, payout, 'roulette')) {
        setSummary('Manche non réglée — solde insuffisant')
        return
      }
      setSummary(formatSettleLine(frozen.stake, payout))
      const net = payout - frozen.stake
      pushToast(`${winning} ${COLOR_FR[rouletteColor(winning)]} · ${net >= 0 ? '+' : ''}${formatMoney(net)} LC`)
      report(net >= 0 ? 'win' : 'lose', {
        amount: net >= 0 ? payout : frozen.stake,
        detail: `roulette ${winning}`,
      })
    },
    [settleBet, pushToast, report],
  )

  useEffect(() => {
    if (clock.phase === 'result') resolveRound(clock.roundId, true)
    const pending = frozenRef.current
    if (pending && pending.id < clock.roundId) resolveRound(pending.id, false)
  }, [clock.phase, clock.roundId, resolveRound])

  // Nouvelle phase de mises : le tapis est nettoyé.
  useEffect(() => {
    if (clock.phase !== 'bets') return
    if (clearedRef.current === clock.roundId) return
    clearedRef.current = clock.roundId
    setBets({})
    setSplitFirst(null)
    setSummary(null)
  }, [clock.phase, clock.roundId])

  /* --------------------------------------------------------------- mises */

  const addBet = (bet: RouletteBetKind) => {
    if (!open) return
    if (available < chip) {
      setMessage('Fonds insuffisants')
      return
    }
    const id = betKey(bet)
    setBets((prev) => ({ ...prev, [id]: { bet, amount: (prev[id]?.amount ?? 0) + chip } }))
    setMessage(`+${formatMoney(chip)} LC sur ${id}`)
  }

  const onNumber = (n: number) => {
    if (!open) return
    if (mode === 'straight') {
      addBet({ kind: 'straight', n })
      return
    }
    if (mode === 'street') {
      if (n === 0) return
      addBet({ kind: 'street', row: Math.floor((n - 1) / 3) })
      return
    }
    if (mode === 'split') {
      if (splitFirst === null) {
        setSplitFirst(n)
        setMessage(`Cheval : choisis le 2ᵉ numéro (adjacent à ${n})`)
        return
      }
      const a = splitFirst
      const b = n
      const adjacent =
        (a === 0 && b >= 1 && b <= 3) ||
        (b === 0 && a >= 1 && a <= 3) ||
        (a > 0 &&
          b > 0 &&
          ((Math.abs(a - b) === 1 && Math.ceil(a / 3) === Math.ceil(b / 3)) ||
            Math.abs(a - b) === 3))
      if (!adjacent) {
        setMessage('Numéros non adjacents — recommence')
        setSplitFirst(null)
        return
      }
      addBet({ kind: 'split', a, b })
      setSplitFirst(null)
      return
    }
    if (n === 0) return
    const col = ((n - 1) % 3) + 1
    const row = Math.floor((n - 1) / 3)
    if (col < 3 && row < 11) addBet({ kind: 'corner', nums: [n, n + 1, n + 3, n + 4] })
    else setMessage('Carré invalide — ni colonne 3 ni dernière ligne')
  }

  const clearBets = () => {
    if (!open) return
    setBets({})
    setSplitFirst(null)
    setMessage('Paris effacés')
  }

  const replayBets = () => {
    if (!open) return
    const entries = Object.entries(lastBets)
    if (entries.length === 0) {
      setMessage('Aucune mise à rejouer')
      return
    }
    let budget = user.wallet.cash
    const next: BetMap = {}
    let skipped = 0
    for (const [id, entry] of entries) {
      if (entry.amount <= budget) {
        next[id] = entry
        budget -= entry.amount
      } else {
        skipped += 1
      }
    }
    setBets(next)
    setMessage(
      skipped > 0
        ? `Mises rejouées (${skipped} ignorée${skipped > 1 ? 's' : ''} — fonds)`
        : 'Mises rejouées',
    )
  }

  /* -------------------------------------------------------------- rendu */

  const seconds = formatSeconds(clock.remainingMs)
  const stateLabel =
    clock.phase === 'bets'
      ? `Mises ouvertes — ${seconds} s`
      : clock.phase === 'spin'
        ? 'Rien ne va plus'
        : `Le ${clock.result} sort !`

  const winIndex = shownResult === null ? -1 : pocketIndexOf(shownResult)
  const glowClass = (id: string) => {
    if (!glowIds.has(id)) return ''
    return (bets[id]?.amount ?? 0) > 0 ? 'rlt-win rlt-win-chip' : 'rlt-win'
  }
  const straightAmount = (n: number) => bets[`s-${n}`]?.amount ?? 0
  const activeBets = Object.entries(bets)

  return (
    <div className={`rlt-arena ${open ? 'rlt-open' : 'rlt-locked'}`}>
      <section className="rlt-stage">
        <header className="rlt-round">
          <div className="rlt-round-line">
            <span className="rlt-round-id">Manche n° {formatMoney(clock.roundId)}</span>
            <span className="rlt-round-count">{seconds}s</span>
          </div>
          <div className={`rlt-state rlt-state-${clock.phase}`}>{stateLabel}</div>
          <div className="rlt-bar">
            <span ref={barRef} className={`rlt-bar-fill rlt-bar-${clock.phase}`} />
          </div>
        </header>

        <div className="rlt-wheel-wrap">
          <svg
            className="rlt-wheel"
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            role="img"
            aria-label={`Roulette — ${stateLabel}`}
          >
            <defs>
              <radialGradient id="rltHub" cx="38%" cy="30%">
                <stop offset="0%" stopColor="#4b3a63" />
                <stop offset="55%" stopColor="#1b1428" />
                <stop offset="100%" stopColor="#070610" />
              </radialGradient>
              <linearGradient id="rltRim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffb4d6" />
                <stop offset="45%" stopColor="#ff4d9a" />
                <stop offset="100%" stopColor="#5b2247" />
              </linearGradient>
              <linearGradient id="rltTurret" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f9a8d4" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <radialGradient id="rltBall" cx="34%" cy="28%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#f3e7f7" />
                <stop offset="100%" stopColor="#9a8fb0" />
              </radialGradient>
            </defs>

            <circle className="rlt-rim-out" cx={CX} cy={CY} r={196} />
            <circle className="rlt-rim-in" cx={CX} cy={CY} r={186} />
            <circle
              ref={ringRef}
              className={`rlt-ring rlt-ring-${clock.phase}`}
              cx={CX}
              cy={CY}
              r={191}
              pathLength={100}
              strokeDasharray="0 100"
              transform={`rotate(-90 ${CX} ${CY})`}
            />
            <circle className="rlt-track" cx={CX} cy={CY} r={R_TRACK} />

            <g ref={wheelRef}>
              {POCKETS.map((p, i) => (
                <path
                  key={p.n}
                  d={p.d}
                  className={`rlt-pocket rlt-${p.color} ${i === winIndex ? 'rlt-pocket-win' : ''}`}
                />
              ))}
              {POCKETS.map((p) => (
                <line
                  key={`fret-${p.n}`}
                  className="rlt-fret"
                  x1={p.fretIn.x}
                  y1={p.fretIn.y}
                  x2={p.fretOut.x}
                  y2={p.fretOut.y}
                />
              ))}
              {POCKETS.map((p) => (
                <text
                  key={`num-${p.n}`}
                  className="rlt-pocket-num"
                  x={p.label.x}
                  y={p.label.y}
                  transform={`rotate(${p.mid} ${p.label.x} ${p.label.y})`}
                >
                  {p.n}
                </text>
              ))}
              <circle className="rlt-hub" cx={CX} cy={CY} r={R_POCKET_IN} />
              <circle className="rlt-hub-ring" cx={CX} cy={CY} r={R_POCKET_IN - 16} />
              <path
                className="rlt-turret"
                d={`M ${CX - 54} ${CY} L ${CX + 54} ${CY} M ${CX} ${CY - 54} L ${CX} ${CY + 54}`}
              />
              <circle className="rlt-turret-cap" cx={CX} cy={CY} r={17} />
            </g>

            <g className="rlt-ball-layer">
              <circle ref={ballRef} className="rlt-ball" r={BALL_R} />
            </g>
          </svg>

          <div className={`rlt-pill ${shownResult === null ? '' : `rlt-${rouletteColor(shownResult)}`}`}>
            <strong>{shownResult ?? '—'}</strong>
            <em>{shownResult === null ? 'en attente' : COLOR_FR[rouletteColor(shownResult)]}</em>
          </div>
        </div>

        <div className="rlt-history" aria-label="Derniers numéros">
          {history.length === 0 && <span className="rlt-history-empty">Historique vide</span>}
          {history.map((n, i) => (
            <span key={`${n}-${i}`} className={`rlt-hist rlt-${rouletteColor(n)}`}>
              {n}
            </span>
          ))}
        </div>

        <p className="rlt-msg">{message}</p>
        {summary && <p className="rlt-summary">{summary}</p>}
        <p className="rlt-cash">
          Engagé {formatMoney(engaged)} LC · Cash {formatMoney(user.wallet.cash)} LC
        </p>
      </section>

      <section className="rlt-table">
        <ChipTray selected={chip} onSelect={setChip} disabled={!open} />

        <div className="rlt-modes">
          {(
            [
              ['straight', 'Plein ×36'],
              ['split', 'Cheval ×18'],
              ['street', 'Ligne ×12'],
              ['corner', 'Carré ×9'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              className={`rlt-mode ${mode === m ? 'rlt-mode-on' : ''}`}
              onClick={() => {
                setMode(m)
                setSplitFirst(null)
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rlt-felt-wrap">
          <div className="rlt-felt">
            <button
              type="button"
              className={`rlt-zero ${glowClass('s-0')} ${splitFirst === 0 ? 'rlt-picked' : ''}`}
              disabled={!open}
              onClick={() => onNumber(0)}
            >
              <span>0</span>
              {straightAmount(0) > 0 && <StackedChips amount={straightAmount(0)} />}
            </button>

            <div className="rlt-grid">
              {Array.from({ length: 12 }, (_, col) => (
                <div key={col} className="rlt-col">
                  {[3, 2, 1].map((offset) => {
                    const n = col * 3 + offset
                    return (
                      <button
                        key={n}
                        type="button"
                        className={`rlt-num rlt-${rouletteColor(n)} ${glowClass(`s-${n}`)} ${
                          splitFirst === n ? 'rlt-picked' : ''
                        }`}
                        disabled={!open}
                        onClick={() => onNumber(n)}
                      >
                        <span>{n}</span>
                        {straightAmount(n) > 0 && <StackedChips amount={straightAmount(n)} />}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    className={`rlt-street ${glowClass(`st-${col}`)}`}
                    title="Transversale (3 numéros)"
                    disabled={!open}
                    onClick={() => addBet({ kind: 'street', row: col })}
                  >
                    {bets[`st-${col}`] ? (
                      <StackedChips amount={bets[`st-${col}`].amount} size={20} />
                    ) : (
                      '×12'
                    )}
                  </button>
                </div>
              ))}

              <div className="rlt-col rlt-col-end">
                {[3, 2, 1].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`rlt-outside rlt-col-bet ${glowClass(`col-${c}`)}`}
                    disabled={!open}
                    onClick={() => addBet({ kind: 'column', c: c as 1 | 2 | 3 })}
                  >
                    2:1
                    {bets[`col-${c}`] && <StackedChips amount={bets[`col-${c}`].amount} />}
                  </button>
                ))}
                <span className="rlt-spacer" />
              </div>
            </div>

            <div className="rlt-dozens">
              {([1, 2, 3] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`rlt-outside ${glowClass(`d-${d}`)}`}
                  disabled={!open}
                  onClick={() => addBet({ kind: 'dozen', d })}
                >
                  {d === 1 ? '1re douzaine' : d === 2 ? '2e douzaine' : '3e douzaine'}
                  {bets[`d-${d}`] && <StackedChips amount={bets[`d-${d}`].amount} />}
                </button>
              ))}
            </div>

            <div className="rlt-outsides">
              <button
                type="button"
                className={`rlt-outside ${glowClass('lh-low')}`}
                disabled={!open}
                onClick={() => addBet({ kind: 'lowhigh', side: 'low' })}
              >
                Manque 1–18
                {bets['lh-low'] && <StackedChips amount={bets['lh-low'].amount} />}
              </button>
              <button
                type="button"
                className={`rlt-outside ${glowClass('p-even')}`}
                disabled={!open}
                onClick={() => addBet({ kind: 'parity', parity: 'even' })}
              >
                Pair
                {bets['p-even'] && <StackedChips amount={bets['p-even'].amount} />}
              </button>
              <button
                type="button"
                className={`rlt-outside rlt-red ${glowClass('cl-red')}`}
                disabled={!open}
                onClick={() => addBet({ kind: 'color', color: 'red' })}
              >
                Rouge
                {bets['cl-red'] && <StackedChips amount={bets['cl-red'].amount} />}
              </button>
              <button
                type="button"
                className={`rlt-outside rlt-black ${glowClass('cl-black')}`}
                disabled={!open}
                onClick={() => addBet({ kind: 'color', color: 'black' })}
              >
                Noir
                {bets['cl-black'] && <StackedChips amount={bets['cl-black'].amount} />}
              </button>
              <button
                type="button"
                className={`rlt-outside ${glowClass('p-odd')}`}
                disabled={!open}
                onClick={() => addBet({ kind: 'parity', parity: 'odd' })}
              >
                Impair
                {bets['p-odd'] && <StackedChips amount={bets['p-odd'].amount} />}
              </button>
              <button
                type="button"
                className={`rlt-outside ${glowClass('lh-high')}`}
                disabled={!open}
                onClick={() => addBet({ kind: 'lowhigh', side: 'high' })}
              >
                Passe 19–36
                {bets['lh-high'] && <StackedChips amount={bets['lh-high'].amount} />}
              </button>
            </div>
          </div>

          {!open && (
            <div className="rlt-lock" role="status">
              <span>Rien ne va plus</span>
              <em>{clock.phase === 'result' ? `Le ${clock.result} sort !` : 'La bille tourne…'}</em>
            </div>
          )}
        </div>

        <div className="rlt-active">
          {activeBets.length === 0 ? (
            <span className="rlt-active-empty">Aucune mise sur cette manche</span>
          ) : (
            activeBets.map(([id, entry]) => (
              <span key={id} className={`rlt-active-pill ${glowIds.has(id) ? 'rlt-win' : ''}`}>
                {id} · {formatMoney(entry.amount)}
              </span>
            ))
          )}
        </div>

        <div className="rlt-actions">
          <button
            type="button"
            className="rlt-btn rlt-btn-ghost"
            disabled={!open || committed === 0}
            onClick={clearBets}
          >
            Effacer
          </button>
          <button
            type="button"
            className="rlt-btn rlt-btn-primary"
            disabled={!open || Object.keys(lastBets).length === 0}
            onClick={replayBets}
          >
            Rejouer les mêmes mises
          </button>
          <span className="rlt-avail">Dispo {formatMoney(Math.max(0, available))} LC</span>
        </div>
      </section>
    </div>
  )
}
