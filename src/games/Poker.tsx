import { useState } from 'react'
import { drawCard, evaluatePoker, type Card, type PokerHand } from '../lib/games'
import { StakeControls, useGameSettle, useStakeGuard } from '../components/StakeControls'
import { usePlayTimer } from '../store/CasinoContext'
import { formatMoney } from '../lib/format'

/** Return multipliers including stake (jacks = even money → ×2). */
const RETURN: Record<PokerHand, number> = {
  royal: 800,
  straightFlush: 50,
  four: 25,
  fullHouse: 9,
  flush: 6,
  straight: 4,
  three: 3,
  twoPair: 2,
  jacks: 2,
  nothing: 0,
}

const PAY_LABELS: { hand: PokerHand; label: string }[] = [
  { hand: 'royal', label: 'Quinte flush royale' },
  { hand: 'straightFlush', label: 'Quinte flush' },
  { hand: 'four', label: 'Carré' },
  { hand: 'fullHouse', label: 'Full' },
  { hand: 'flush', label: 'Couleur' },
  { hand: 'straight', label: 'Suite' },
  { hand: 'three', label: 'Brelan' },
  { hand: 'twoPair', label: 'Deux paires' },
  { hand: 'jacks', label: 'Paire Valets+' },
]

export function PokerGame() {
  const { stake, setStake } = useStakeGuard()
  const { trySettle, cash } = useGameSettle('poker')
  const [cards, setCards] = useState<Card[]>([])
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false])
  const [phase, setPhase] = useState<'idle' | 'hold' | 'done'>('idle')
  const [hand, setHand] = useState<PokerHand | null>(null)
  const [message, setMessage] = useState('Video Poker — Jacks or Better')
  usePlayTimer(true, 'poker')

  const deal = () => {
    if (phase === 'hold' || cash < stake) {
      if (cash < stake) setMessage('Fonds insuffisants')
      return
    }
    setCards([drawCard(), drawCard(), drawCard(), drawCard(), drawCard()])
    setHeld([false, false, false, false, false])
    setHand(null)
    setPhase('hold')
    setMessage('Garde tes cartes, puis Tire')
  }

  const draw = () => {
    if (phase !== 'hold') return
    const next = cards.map((c, i) => (held[i] ? c : drawCard()))
    setCards(next)
    const result = evaluatePoker(next)
    setHand(result)
    const pay = Math.floor(stake * RETURN[result])
    trySettle(stake, pay)
    setPhase('done')
    setMessage(
      result === 'nothing'
        ? `Rien — misé ${formatMoney(stake)} LC`
        : `${PAY_LABELS.find((p) => p.hand === result)?.label} · ×${RETURN[result]} → ${formatMoney(pay)} LC`,
    )
  }

  return (
    <div className="game-panel poker-panel">
      <div className="poker-paytable">
        {PAY_LABELS.map((p) => (
          <div key={p.hand} className={hand === p.hand ? 'hit' : ''}>
            <span>{p.label}</span>
            <strong>×{RETURN[p.hand]}</strong>
          </div>
        ))}
      </div>
      <div className="poker-hand">
        {cards.length === 0 && <p className="bj-empty">En attente…</p>}
        {cards.map((c, i) => {
          const red = c.suit === '♥' || c.suit === '♦'
          return (
            <button
              key={c.id}
              type="button"
              className={`poker-card ${red ? 'red' : ''} ${held[i] ? 'held' : ''}`}
              onClick={() =>
                phase === 'hold' && setHeld((h) => h.map((v, idx) => (idx === i ? !v : v)))
              }
              disabled={phase !== 'hold'}
            >
              <span>
                {c.label}
                {c.suit}
              </span>
              {held[i] && <em>HOLD</em>}
            </button>
          )
        })}
      </div>
      <StakeControls stake={stake} setStake={setStake} disabled={phase === 'hold'} />
      <div className="btn-row">
        {phase !== 'hold' ? (
          <button type="button" className="btn primary" onClick={deal}>
            Distribuer
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={draw}>
            Tirer
          </button>
        )}
      </div>
      <p className="game-msg">{message}</p>
      <p className="hint">Jacks or Better — paire de Valets minimum pour gagner</p>
    </div>
  )
}
