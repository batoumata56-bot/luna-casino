import { useState } from 'react'
import {
  baccaratDeal,
  baccaratHandValue,
  type Card,
} from '../lib/games'
import { StakeControls, useGameSettle, useStakeGuard } from '../components/StakeControls'
import { usePlayTimer } from '../store/CasinoContext'
import { formatMoney } from '../lib/format'

type Side = 'player' | 'banker' | 'tie'

function MiniCard({ card }: { card: Card }) {
  const red = card.suit === '♥' || card.suit === '♦'
  return (
    <span className={`mini-card ${red ? 'red' : ''}`}>
      {card.label}
      {card.suit}
    </span>
  )
}

export function BaccaratGame() {
  const { stake, setStake } = useStakeGuard()
  const { trySettle, cash } = useGameSettle('baccarat')
  const [side, setSide] = useState<Side>('player')
  const [player, setPlayer] = useState<Card[]>([])
  const [banker, setBanker] = useState<Card[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Mise sur Player, Banker ou Égalité')
  usePlayTimer(true, 'baccarat')

  const play = () => {
    if (busy || cash < stake) {
      if (cash < stake) setMessage('Fonds insuffisants')
      return
    }
    setBusy(true)
    setMessage('Distribution…')
    window.setTimeout(() => {
      const deal = baccaratDeal()
      setPlayer(deal.player)
      setBanker(deal.banker)
      const pv = baccaratHandValue(deal.player)
      const bv = baccaratHandValue(deal.banker)
      let winner: Side = 'tie'
      if (pv > bv) winner = 'player'
      else if (bv > pv) winner = 'banker'

      let payout = 0
      if (side === winner) {
        if (side === 'tie') payout = stake * 9
        else if (side === 'player') payout = stake * 2
        else payout = Math.floor(stake * 1.95) // banker 5% commission on win → ~1.95× total
      }
      trySettle(stake, payout)
      const label = winner === 'tie' ? 'Égalité' : winner === 'player' ? 'Player' : 'Banker'
      setMessage(
        payout > 0
          ? `${label} (${pv}–${bv}) — retour ${formatMoney(payout)} LC`
          : `${label} (${pv}–${bv}) — misé ${formatMoney(stake)} LC`,
      )
      setBusy(false)
    }, 700)
  }

  return (
    <div className="game-panel baccarat-panel">
      <div className="bacc-hands">
        <div className={`bacc-side ${side === 'player' ? 'picked' : ''}`}>
          <h4>Player · {player.length ? baccaratHandValue(player) : '—'}</h4>
          <div className="bacc-cards">
            {player.map((c) => (
              <MiniCard key={c.id} card={c} />
            ))}
          </div>
        </div>
        <div className={`bacc-side ${side === 'banker' ? 'picked' : ''}`}>
          <h4>Banker · {banker.length ? baccaratHandValue(banker) : '—'}</h4>
          <div className="bacc-cards">
            {banker.map((c) => (
              <MiniCard key={c.id} card={c} />
            ))}
          </div>
        </div>
      </div>
      <div className="btn-row">
        {(
          [
            ['player', 'Player ×2'],
            ['banker', 'Banker ×1.95'],
            ['tie', 'Égalité ×9'],
          ] as const
        ).map(([s, label]) => (
          <button
            key={s}
            type="button"
            className={side === s ? 'btn primary' : 'btn'}
            onClick={() => setSide(s)}
          >
            {label}
          </button>
        ))}
      </div>
      <StakeControls stake={stake} setStake={setStake} disabled={busy} />
      <button type="button" className="btn primary" disabled={busy} onClick={play}>
        Distribuer
      </button>
      <p className="game-msg">{message}</p>
      <p className="hint">Règles classiques · Banker commission 5% · Tie 8:1</p>
    </div>
  )
}
