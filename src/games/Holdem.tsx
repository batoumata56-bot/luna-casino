import './holdem.css'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { StakeControls, useGameSettle, useStakeGuard } from '../components/StakeControls'
import { usePlayTimer } from '../store/CasinoContext'
import { useRoomReport } from '../store/RoomContext'
import { formatMoney } from '../lib/format'
import type { Card } from '../lib/games'
import {
  CATEGORY_NAMES,
  HOLDEM_RAKE,
  STREET_LABEL,
  applyAction,
  advance,
  blindsForHand,
  botDecide,
  createTable,
  holdemMultiplier,
  isRedSuit,
  legalActions,
  makeCard,
  startHand,
  styleLabel,
  type HandState,
  type HoldemPlayer,
  type PlayerAction,
} from '../lib/holdem'

type Screen = 'setup' | 'play' | 'over'

const MIN_SEATS = 2
const MAX_SEATS = 6
const HERO_TURN_MS = 45_000
const BOT_THINK_MIN = 1_600
const BOT_THINK_MAX = 2_800
const STREET_PAUSE_MS = 1_400

const CHIP_LOOK: Record<number, { bg: string; edge: string }> = {
  1: { bg: '#64748b', edge: '#cbd5e1' },
  5: { bg: '#ef4444', edge: '#fecaca' },
  10: { bg: '#3b82f6', edge: '#93c5fd' },
  25: { bg: '#22c55e', edge: '#86efac' },
  50: { bg: '#ef4444', edge: '#fca5a5' },
  100: { bg: '#111827', edge: '#f9a8d4' },
  250: { bg: '#a855f7', edge: '#e9d5ff' },
  500: { bg: '#ec4899', edge: '#fbcfe8' },
  1000: { bg: '#f59e0b', edge: '#fde68a' },
  10000: { bg: '#f0abfc', edge: '#ffffff' },
}

function breakChips(amount: number, max = 8): number[] {
  const out: number[] = []
  let left = Math.max(0, Math.floor(amount))
  const values = [10_000, 1000, 500, 250, 100, 50, 25, 10, 5, 1]
  for (const v of values) {
    while (left >= v && out.length < max) {
      out.push(v)
      left -= v
    }
  }
  if (out.length === 0 && amount > 0) out.push(1)
  return out
}

function HdChipPile({ amount, size = 28, flying }: { amount: number; size?: number; flying?: boolean }) {
  if (amount <= 0) return null
  const chips = breakChips(amount)
  return (
    <div className={`hd-pile ${flying ? 'hd-pile-in' : ''}`} aria-hidden>
      {chips.map((v, i) => {
        const look = CHIP_LOOK[v] ?? CHIP_LOOK[100]!
        return (
          <span
            key={`${v}-${i}`}
            className="hd-disc"
            style={{
              width: size,
              height: size,
              bottom: i * 4,
              left: `calc(50% + ${(i % 2 === 0 ? -2 : 2)}px)`,
              zIndex: i + 1,
              background: `radial-gradient(circle at 32% 28%, ${look.edge}, ${look.bg} 52%, #0a0a0c 125%)`,
              boxShadow: `0 2px 6px rgba(0,0,0,.5), inset 0 0 0 2px ${look.edge}aa`,
            }}
          >
            {v >= 1000 ? `${v / 1000}k` : v}
          </span>
        )
      })}
      {!flying && <em>{formatMoney(amount)}</em>}
    </div>
  )
}

function HdCard({ card, hidden, highlight }: { card?: Card; hidden?: boolean; highlight?: boolean }) {
  if (!card || hidden) {
    return <span className={`hd-card hd-back ${highlight ? 'hd-card-win' : ''}`} aria-hidden />
  }
  return (
    <span className={`hd-card ${isRedSuit(card.suit) ? 'hd-red' : 'hd-black'} ${highlight ? 'hd-card-win' : ''}`}>
      <strong>{card.label}</strong>
      <em>{card.suit}</em>
    </span>
  )
}

function nextDealer(players: HoldemPlayer[], dealer: number): number {
  const n = players.length
  for (let i = 1; i <= n; i += 1) {
    const idx = (dealer + i) % n
    const p = players[idx]
    if (p && !p.out && p.chips > 0) return idx
  }
  return dealer
}

function alive(players: HoldemPlayer[]): HoldemPlayer[] {
  return players.filter((p) => !p.out && p.chips > 0)
}

function seatPos(i: number, n: number): { left: string; top: string } {
  const angle = (Math.PI * 2 * i) / n + Math.PI / 2
  return {
    left: `${50 + Math.cos(angle) * 42}%`,
    top: `${52 + Math.sin(angle) * 36}%`,
  }
}

/** Pile de jetons un peu plus près du centre que le siège. */
function betPilePos(i: number, n: number): { left: string; top: string } {
  const angle = (Math.PI * 2 * i) / n + Math.PI / 2
  return {
    left: `${50 + Math.cos(angle) * 22}%`,
    top: `${50 + Math.sin(angle) * 18}%`,
  }
}

const RULE_EXAMPLES: { name: string; cards: Card[]; text: string }[] = [
  {
    name: CATEGORY_NAMES[9]!,
    cards: [makeCard(1, '♠', 'r'), makeCard(13, '♠', 'r'), makeCard(12, '♠', 'r'), makeCard(11, '♠', 'r'), makeCard(10, '♠', 'r')],
    text: 'As à 10 de la même couleur — la plus forte main.',
  },
  {
    name: CATEGORY_NAMES[8]!,
    cards: [makeCard(9, '♥', 's'), makeCard(8, '♥', 's'), makeCard(7, '♥', 's'), makeCard(6, '♥', 's'), makeCard(5, '♥', 's')],
    text: 'Cinq cartes consécutives de la même couleur.',
  },
  {
    name: CATEGORY_NAMES[7]!,
    cards: [makeCard(7, '♠', 'q'), makeCard(7, '♥', 'q'), makeCard(7, '♦', 'q'), makeCard(7, '♣', 'q'), makeCard(2, '♠', 'q')],
    text: 'Quatre cartes du même rang.',
  },
  {
    name: CATEGORY_NAMES[6]!,
    cards: [makeCard(10, '♠', 'f'), makeCard(10, '♥', 'f'), makeCard(10, '♦', 'f'), makeCard(4, '♣', 'f'), makeCard(4, '♥', 'f')],
    text: 'Un brelan plus une paire.',
  },
  {
    name: CATEGORY_NAMES[5]!,
    cards: [makeCard(13, '♦', 'c'), makeCard(10, '♦', 'c'), makeCard(8, '♦', 'c'), makeCard(4, '♦', 'c'), makeCard(2, '♦', 'c')],
    text: 'Cinq cartes de la même couleur, pas forcément consécutives.',
  },
  {
    name: CATEGORY_NAMES[4]!,
    cards: [makeCard(1, '♠', 'q2'), makeCard(2, '♥', 'q2'), makeCard(3, '♦', 'q2'), makeCard(4, '♣', 'q2'), makeCard(5, '♠', 'q2')],
    text: 'Cinq cartes qui se suivent. L’As peut être haut (A-K-Q-J-10) ou bas (A-2-3-4-5).',
  },
  {
    name: CATEGORY_NAMES[3]!,
    cards: [makeCard(8, '♠', 't'), makeCard(8, '♥', 't'), makeCard(8, '♦', 't'), makeCard(13, '♣', 't'), makeCard(2, '♠', 't')],
    text: 'Trois cartes du même rang.',
  },
  {
    name: CATEGORY_NAMES[2]!,
    cards: [makeCard(12, '♠', 'd'), makeCard(12, '♥', 'd'), makeCard(5, '♦', 'd'), makeCard(5, '♣', 'd'), makeCard(9, '♠', 'd')],
    text: 'Deux paires distinctes.',
  },
  {
    name: CATEGORY_NAMES[1]!,
    cards: [makeCard(11, '♠', 'p'), makeCard(11, '♥', 'p'), makeCard(9, '♦', 'p'), makeCard(4, '♣', 'p'), makeCard(2, '♠', 'p')],
    text: 'Deux cartes du même rang.',
  },
  {
    name: CATEGORY_NAMES[0]!,
    cards: [makeCard(1, '♠', 'h'), makeCard(13, '♥', 'h'), makeCard(9, '♦', 'h'), makeCard(6, '♣', 'h'), makeCard(3, '♠', 'h')],
    text: 'Rien de tout ça — la carte la plus haute départage.',
  },
]

function RulesModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="hd-modal-bg" onClick={onClose} role="presentation">
      <div
        className="hd-modal"
        role="dialog"
        aria-labelledby="hd-rules-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 id="hd-rules-title">Règles & combinaisons</h2>
          <button type="button" className="hd-x" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>
        <div className="hd-modal-body">
          <h3>Comment se joue une main</h3>
          <ol>
            <li>
              Chacun reçoit <strong>2 cartes privées</strong>. Le joueur à gauche du bouton paie la
              petite blind, le suivant la grosse.
            </li>
            <li>
              <strong>Préflop</strong> : enchères (se coucher, suivre, relancer).
            </li>
            <li>
              <strong>Flop</strong> : 3 cartes communes, puis enchères.
            </li>
            <li>
              <strong>Turn</strong> puis <strong>River</strong> : une carte de plus à chaque fois.
            </li>
            <li>
              <strong>Abattage</strong> : la meilleure combinaison de 5 cartes parmi tes 2 + les 5
              du board remporte le pot.
            </li>
          </ol>

          <h3>Actions</h3>
          <ul>
            <li>
              <strong>Se coucher</strong> — tu abandonnes la main.
            </li>
            <li>
              <strong>Checker</strong> — passer si personne n’a misé.
            </li>
            <li>
              <strong>Suivre</strong> — égaler la mise en cours.
            </li>
            <li>
              <strong>Relancer</strong> — augmenter, au minimum d’une grosse blind.
            </li>
            <li>
              <strong>Tapis</strong> — miser tout son stack.
            </li>
          </ul>

          <h3>Combinaisons (du plus fort au plus faible)</h3>
          <ul className="hd-combos">
            {RULE_EXAMPLES.map((ex) => (
              <li key={ex.name}>
                <div className="hd-combo-cards">
                  {ex.cards.map((c) => (
                    <HdCard key={c.id} card={c} />
                  ))}
                </div>
                <div>
                  <strong>{ex.name}</strong>
                  <p>{ex.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <h3>Gains de cette table</h3>
          <p>
            Tout le monde paie le même buy-in. Le gagnant du sit &amp; go empoche le prize pool
            moins une commission d’environ {(HOLDEM_RAKE * 100).toFixed(2)}&nbsp;% — d’où{' '}
            <strong>×2,95 pour 3 joueurs</strong> (toi + 2 bots), et non ×3. Tu peux quitter entre
            deux mains : tes jetons restants sont reconvertis avec la même commission.
          </p>
        </div>
      </div>
    </div>
  )
}

export function HoldemGame() {
  const { stake, setStake } = useStakeGuard()
  const { trySettle, cash } = useGameSettle('holdem')
  const report = useRoomReport()
  usePlayTimer(true, 'holdem')

  const [screen, setScreen] = useState<Screen>('setup')
  const [seats, setSeats] = useState(3)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [buyIn, setBuyIn] = useState(100)
  const [hand, setHand] = useState<HandState | null>(null)
  const [raiseTo, setRaiseTo] = useState(0)
  const [resultMsg, setResultMsg] = useState('')
  const [payout, setPayout] = useState(0)
  const [setupMsg, setSetupMsg] = useState('Choisis ton buy-in et le nombre de joueurs.')
  const [turnLeft, setTurnLeft] = useState(HERO_TURN_MS)

  const settled = useRef(false)
  const timer = useRef(0)
  const prevBets = useRef<number[]>([])
  const flightSeq = useRef(0)
  const [flights, setFlights] = useState<{ id: number; from: number; kind: 'bet' | 'pot'; amount: number }[]>([])

  const bots = seats - 1
  const totalPlayers = seats
  const mult = holdemMultiplier(totalPlayers)
  const prize = Math.floor(stake * mult)

  const legal = hand ? legalActions(hand) : null
  const hero = hand?.players[0]
  const acting = hand && hand.toAct >= 0 ? hand.players[hand.toAct] : null
  const betweenHands = Boolean(hand && hand.finished && screen === 'play')
  const showdown = Boolean(hand?.results)

  const closeRules = useCallback(() => setRulesOpen(false), [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!hand || screen !== 'play') return
    if (hand.finished) return

    if (hand.toAct < 0) {
      timer.current = window.setTimeout(() => {
        setHand((prev) => (prev ? advance(prev) : prev))
      }, STREET_PAUSE_MS)
      return () => window.clearTimeout(timer.current)
    }

    const actor = hand.players[hand.toAct]
    if (!actor || actor.isHuman) return
    const delay = BOT_THINK_MIN + Math.floor(Math.random() * (BOT_THINK_MAX - BOT_THINK_MIN))
    timer.current = window.setTimeout(() => {
      setHand((prev) => {
        if (!prev || prev.toAct < 0) return prev
        const who = prev.players[prev.toAct]
        if (!who || who.isHuman) return prev
        return applyAction(prev, botDecide(prev))
      })
    }, delay)
    return () => window.clearTimeout(timer.current)
  }, [hand, screen])

  useEffect(() => {
    if (!hand || screen !== 'play' || hand.finished) return
    if (hand.toAct !== 0) {
      setTurnLeft(HERO_TURN_MS)
      return
    }
    const started = Date.now()
    setTurnLeft(HERO_TURN_MS)
    const id = window.setInterval(() => {
      const left = Math.max(0, HERO_TURN_MS - (Date.now() - started))
      setTurnLeft(left)
      if (left > 0) return
      window.clearInterval(id)
      setHand((prev) => {
        if (!prev || prev.toAct !== 0) return prev
        const la = legalActions(prev)
        return applyAction(prev, la.canCheck ? { type: 'check' } : { type: 'fold' })
      })
    }, 200)
    return () => window.clearInterval(id)
  }, [hand?.toAct, hand?.street, hand?.handNo, screen, hand?.finished])

  useEffect(() => {
    if (!hand) {
      prevBets.current = []
      return
    }
    const next = hand.players.map((p) => p.bet)
    const prev = prevBets.current
    const spawned: { id: number; from: number; kind: 'bet' | 'pot'; amount: number }[] = []
    if (prev.length === next.length) {
      next.forEach((bet, i) => {
        const before = prev[i] ?? 0
        if (bet > before) {
          spawned.push({ id: ++flightSeq.current, from: i, kind: 'bet', amount: bet - before })
        }
      })
      const hadBets = prev.some((b) => b > 0)
      const cleared = next.every((b) => b === 0)
      if (hadBets && cleared) {
        prev.forEach((b, i) => {
          if (b > 0) spawned.push({ id: ++flightSeq.current, from: i, kind: 'pot', amount: b })
        })
      }
    }
    prevBets.current = next
    if (spawned.length === 0) return
    setFlights((f) => [...f, ...spawned])
    window.setTimeout(() => {
      const ids = new Set(spawned.map((s) => s.id))
      setFlights((f) => f.filter((x) => !ids.has(x.id)))
    }, 720)
  }, [hand])

  useEffect(() => {
    if (!hand || !legal?.canRaise) return
    setRaiseTo(legal.minRaiseTo)
  }, [hand?.toAct, hand?.street, legal?.minRaiseTo, legal?.canRaise])

  const settleOnce = useCallback(
    (finalPayout: number, label: string) => {
      if (settled.current) return
      settled.current = true
      trySettle(buyIn, finalPayout)
      setPayout(finalPayout)
      setResultMsg(label)
      setScreen('over')
      report(finalPayout >= buyIn ? 'win' : 'lose', {
        amount: finalPayout >= buyIn ? finalPayout : buyIn,
        detail: label,
      })
    },
    [buyIn, trySettle, report],
  )

  const startTournament = () => {
    if (cash < stake) {
      setSetupMsg('Fonds insuffisants pour ce buy-in')
      return
    }
    settled.current = false
    setBuyIn(stake)
    const table = createTable(stake, bots)
    const blinds = blindsForHand(stake, 1)
    const first = startHand(table, 0, blinds.sb, blinds.bb, 1)
    setHand(first)
    setScreen('play')
    setResultMsg('')
    report('bet', { amount: stake, detail: `sit & go ×${mult} vs ${bots} bot${bots > 1 ? 's' : ''}` })
  }

  const play = (action: PlayerAction) => {
    if (!hand || hand.toAct !== 0) return
    window.clearTimeout(timer.current)
    setHand(applyAction(hand, action))
  }

  const nextHand = () => {
    if (!hand) return
    const remaining = alive(hand.players)
    if (remaining.length <= 1) {
      const heroAlive = remaining.some((p) => p.isHuman)
      if (heroAlive) {
        const won = Math.floor(buyIn * holdemMultiplier(hand.players.length))
        settleOnce(won, `Tu remportes ${formatMoney(won)} LC (×${holdemMultiplier(hand.players.length)})`)
      } else {
        settleOnce(0, 'Éliminé — plus de jetons')
      }
      return
    }
    if ((hero?.chips ?? 0) <= 0) {
      settleOnce(0, 'Éliminé — plus de jetons')
      return
    }
    const blinds = blindsForHand(buyIn, hand.handNo + 1)
    setHand(startHand(hand.players, nextDealer(hand.players, hand.dealer), blinds.sb, blinds.bb, hand.handNo + 1))
  }

  const cashOut = () => {
    if (!hand || !hand.finished) return
    const chips = hero?.chips ?? 0
    const take = Math.floor(chips * (1 - HOLDEM_RAKE))
    settleOnce(take, `Tu quittes la table avec ${formatMoney(take)} LC`)
  }

  const replay = () => {
    setScreen('setup')
    setHand(null)
    setSetupMsg('Choisis ton buy-in et le nombre de joueurs.')
  }

  const winningIds = useMemo(() => {
    const ids = new Set<string>()
    hand?.results?.forEach((r) => {
      if (r.won > 0) r.five.forEach((c) => ids.add(c.id))
    })
    return ids
  }, [hand?.results])

  if (screen === 'setup') {
    return (
      <div className="hd-wrap">
        <div className="hd-setup">
          <header className="hd-setup-head">
            <h2>Texas Hold’em</h2>
            <p>Sit &amp; go — toi plus des bots fictifs autour de la table (2 à 6 joueurs).</p>
          </header>
          <StakeControls stake={stake} setStake={setStake} />
          <div className="hd-bots">
            <span>Joueurs autour de la table</span>
            <div>
              {Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => MIN_SEATS + i).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={seats === n ? 'chip active' : 'chip'}
                  onClick={() => setSeats(n)}
                >
                  {n} joueurs
                </button>
              ))}
            </div>
            <p className="hint">
              Toi + {bots} bot{bots > 1 ? 's' : ''} · minimum {MIN_SEATS}, maximum {MAX_SEATS}
            </p>
          </div>
          <p className="hd-prize">
            {totalPlayers} joueurs · multiplicateur <strong>×{mult.toFixed(2)}</strong>
            <br />
            Gain si tu gagnes : <strong>{formatMoney(prize)} LC</strong>
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setRulesOpen(true)}>
              Règles & combinaisons
            </button>
            <button type="button" className="btn primary" onClick={startTournament}>
              Lancer la partie
            </button>
          </div>
          <p className="game-msg">{setupMsg}</p>
        </div>
        {rulesOpen && <RulesModal onClose={closeRules} />}
      </div>
    )
  }

  if (screen === 'over' || !hand || !hero) {
    return (
      <div className="hd-wrap">
        <div className="hd-over">
          <h2>{payout > 0 ? 'Victoire' : 'Fin de table'}</h2>
          <p>{resultMsg}</p>
          <p className="muted">
            Buy-in {formatMoney(buyIn)} LC · Retour {formatMoney(payout)} LC
          </p>
          <button type="button" className="btn primary" onClick={replay}>
            Rejouer
          </button>
        </div>
        {rulesOpen && <RulesModal onClose={closeRules} />}
      </div>
    )
  }

  return (
    <div className="hd-wrap">
      <div className="hd-hud">
        <span>
          Main {hand.handNo} · {STREET_LABEL[hand.street]} · blinds {hand.sb}/{hand.bb}
        </span>
        <span>
          Prize pool {formatMoney(Math.floor(buyIn * hand.players.length * (1 - HOLDEM_RAKE)))} LC
          · ×{holdemMultiplier(hand.players.length).toFixed(2)}
        </span>
        {hand.toAct === 0 && !hand.finished && (
          <strong className="hd-turn-clock">À toi — {Math.ceil(turnLeft / 1000)} s</strong>
        )}
        <button type="button" className="chip" onClick={() => setRulesOpen(true)}>
          Règles
        </button>
      </div>

      <div className="hd-table">
        {hand.players.map((p, i) => {
          const pos = seatPos(i, hand.players.length)
          const isTurn = hand.toAct === i
          const reveal = p.isHuman || (showdown && !p.folded)
          const heroTurn = isTurn && p.isHuman
          return (
            <article
              key={p.id}
              className={`hd-seat ${p.isHuman ? 'hd-hero' : ''} ${p.folded ? 'hd-folded' : ''} ${
                p.out ? 'hd-out' : ''
              } ${isTurn ? 'hd-turn' : ''}`}
              style={pos}
            >
              {hand.dealer === i && <span className="hd-btn">D</span>}
              <div className="hd-seat-head">
                <span className="hd-avatar">{p.avatar}</span>
                <div>
                  <strong>{p.name}</strong>
                  <em>{p.isHuman ? 'Toi' : styleLabel(p.style)}</em>
                </div>
              </div>
              <div className="hd-hole">
                {p.hole.map((c) => (
                  <HdCard
                    key={c.id}
                    card={c}
                    hidden={!reveal}
                    highlight={winningIds.has(c.id)}
                  />
                ))}
              </div>
              <div className="hd-stack">{formatMoney(p.chips)}</div>
              {p.lastAction && <span className="hd-act">{p.lastAction}</span>}
              {isTurn && (
                <span
                  className="hd-timer"
                  style={
                    heroTurn
                      ? { transform: `scaleX(${Math.max(0.04, turnLeft / HERO_TURN_MS)})` }
                      : undefined
                  }
                />
              )}
            </article>
          )
        })}

        {hand.players.map((p, i) =>
          p.bet > 0 ? (
            <div key={`pile-${p.id}`} className="hd-bet-spot" style={betPilePos(i, hand.players.length)}>
              <HdChipPile amount={p.bet} />
            </div>
          ) : null,
        )}

        {flights.map((f) => {
          const from = f.kind === 'bet' ? seatPos(f.from, hand.players.length) : betPilePos(f.from, hand.players.length)
          const to = f.kind === 'bet' ? betPilePos(f.from, hand.players.length) : { left: '50%', top: '48%' }
          return (
            <div
              key={f.id}
              className="hd-flight"
              style={
                {
                  '--from-x': from.left,
                  '--from-y': from.top,
                  '--to-x': to.left,
                  '--to-y': to.top,
                } as CSSProperties
              }
            >
              <HdChipPile amount={f.amount} size={22} flying />
            </div>
          )
        })}

        <div className="hd-center">
          <HdChipPile amount={Math.max(0, hand.pot - hand.players.reduce((s, p) => s + p.bet, 0))} size={30} />
          <div className="hd-pot">Pot {formatMoney(hand.pot)}</div>
          <div className="hd-board">
            {Array.from({ length: 5 }, (_, i) => (
              <HdCard
                key={hand.board[i]?.id ?? `empty-${i}`}
                card={hand.board[i]}
                highlight={hand.board[i] ? winningIds.has(hand.board[i]!.id) : false}
              />
            ))}
          </div>
        </div>
      </div>

      {showdown && hand.results && (
        <ul className="hd-showdown">
          {hand.results
            .filter((r) => r.revealed || r.won > 0)
            .map((r) => (
              <li key={r.seat}>
                <strong>{r.name}</strong>
                {r.hand ? ` — ${r.hand.label}` : ' — couché'}
                {r.won > 0 && <em> +{formatMoney(r.won)}</em>}
              </li>
            ))}
        </ul>
      )}

      <ul className="hd-log">
        {hand.log.slice(0, 8).map((line, i) => (
          <li key={`${hand.handNo}-${i}`}>{line}</li>
        ))}
      </ul>

      {betweenHands ? (
        <div className="hd-bar btn-row">
          <button type="button" className="btn primary" onClick={nextHand}>
            Main suivante
          </button>
          <button type="button" className="btn" onClick={cashOut}>
            Quitter la table
          </button>
        </div>
      ) : (
        <div className="hd-bar">
          <div className="btn-row">
            <button
              type="button"
              className="btn danger"
              disabled={!legal?.canFold || acting?.isHuman === false}
              onClick={() => play({ type: 'fold' })}
            >
              Se coucher
            </button>
            <button
              type="button"
              className="btn"
              disabled={!legal?.canCheck || acting?.isHuman === false}
              onClick={() => play({ type: 'check' })}
            >
              Checker
            </button>
            <button
              type="button"
              className="btn"
              disabled={!legal?.canCall || acting?.isHuman === false}
              onClick={() => play({ type: 'call' })}
            >
              Suivre {legal?.callAmount ? formatMoney(legal.callAmount) : ''}
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!legal?.canRaise || acting?.isHuman === false}
              onClick={() => play({ type: 'raise', to: raiseTo })}
            >
              Relancer à {formatMoney(raiseTo)}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!legal?.canAllIn || acting?.isHuman === false}
              onClick={() => play({ type: 'allin' })}
            >
              Tapis
            </button>
          </div>
          {legal?.canRaise && acting?.isHuman && (
            <div className="hd-raise">
              <input
                type="range"
                min={legal.minRaiseTo}
                max={legal.maxRaiseTo}
                value={Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, raiseTo))}
                onChange={(e) => setRaiseTo(Number(e.target.value))}
              />
              <button type="button" className="chip" onClick={() => setRaiseTo(Math.min(legal.maxRaiseTo, hand.pot + legal.callAmount))}>
                Pot
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => setRaiseTo(Math.min(legal.maxRaiseTo, Math.floor((hand.pot + legal.callAmount) / 2) + hand.currentBet))}
              >
                ½ pot
              </button>
            </div>
          )}
          {acting && !acting.isHuman && <p className="muted">{acting.name} réfléchit…</p>}
          {acting?.isHuman && (
            <p className="hint">Tu as {Math.ceil(turnLeft / 1000)} s pour jouer — les jetons partent tout seuls sur le tapis.</p>
          )}
        </div>
      )}

      {rulesOpen && <RulesModal onClose={closeRules} />}
    </div>
  )
}
