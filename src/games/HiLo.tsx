import { useState } from 'react'
import { drawCard, type Card } from '../lib/games'
import { StakeControls, useGameSettle, useStakeGuard } from '../components/StakeControls'
import { usePlayTimer } from '../store/CasinoContext'
import { formatMoney } from '../lib/format'

function rankValue(card: Card): number {
  return card.rank === 1 ? 14 : card.rank
}

/** 13 rangs (2..A). L’égalité est un push (mise rendue). Edge maison ~6 %. */
function odds(card: Card, dir: 'hi' | 'lo'): { p: number; mult: number; count: number } {
  const r = rankValue(card)
  const count = dir === 'hi' ? 14 - r : r - 2
  const p = count / 13
  if (p <= 0) return { p: 0, mult: 0, count: 0 }
  const mult = Math.max(1.08, Math.round(((0.94 / p) * 100)) / 100)
  return { p, mult, count }
}

export function HiLoGame() {
  const { stake, setStake } = useStakeGuard()
  const { trySettle, cash } = useGameSettle('hilo')
  const [current, setCurrent] = useState<Card | null>(null)
  const [flash, setFlash] = useState<Card | null>(null)
  const [streak, setStreak] = useState(0)
  const [pot, setPot] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [message, setMessage] = useState('Plus haut ou plus bas — cotes selon la carte.')
  usePlayTimer(true, 'hilo')

  const hi = current ? odds(current, 'hi') : null
  const lo = current ? odds(current, 'lo') : null

  const begin = () => {
    if (playing || cash < stake) {
      if (cash < stake) setMessage('Fonds insuffisants')
      return
    }
    setPot(stake)
    setCurrent(drawCard())
    setFlash(null)
    setStreak(0)
    setPlaying(true)
    setMessage('Higher ou Lower ? Les cotes suivent la carte.')
  }

  const guess = (dir: 'hi' | 'lo') => {
    if (!playing || !current) return
    const side = odds(current, dir)
    if (side.mult <= 0) {
      setMessage(dir === 'hi' ? 'Rien au-dessus de l’As' : 'Rien en-dessous du 2')
      return
    }
    const n = drawCard()
    setFlash(n)
    const a = rankValue(current)
    const b = rankValue(n)
    if (b === a) {
      trySettle(stake, stake)
      setPlaying(false)
      setMessage(`${n.label}${n.suit} — égalité, mise rendue`)
      setStreak(0)
      setPot(0)
      return
    }
    const win = dir === 'hi' ? b > a : b < a
    if (!win) {
      trySettle(stake, 0)
      setPlaying(false)
      setMessage(`${n.label}${n.suit} — perdu ${formatMoney(stake)} LC`)
      setStreak(0)
      setPot(0)
      return
    }
    const newPot = Math.floor(pot * side.mult)
    setPot(newPot)
    setStreak((s) => s + 1)
    setCurrent(n)
    window.setTimeout(() => setFlash(null), 500)
    setMessage(`Bon · ×${side.mult.toFixed(2)} · pot ${formatMoney(newPot)} LC`)
  }

  const cashout = () => {
    if (!playing || streak === 0) return
    trySettle(stake, pot)
    setPlaying(false)
    setMessage(`Encaissé ${formatMoney(pot)} LC (série ${streak})`)
    setStreak(0)
    setPot(0)
  }

  return (
    <div className="game-panel hilo-panel">
      <div className="hilo-stage">
        <div className="hilo-card-wrap">
          <span className="muted">Carte</span>
          {current ? (
            <div className={`hilo-card ${current.suit === '♥' || current.suit === '♦' ? 'red' : ''}`}>
              {current.label}
              {current.suit}
            </div>
          ) : (
            <div className="hilo-card empty">?</div>
          )}
        </div>
        {flash && (
          <div className="hilo-card-wrap">
            <span className="muted">Tirage</span>
            <div className={`hilo-card flash ${flash.suit === '♥' || flash.suit === '♦' ? 'red' : ''}`}>
              {flash.label}
              {flash.suit}
            </div>
          </div>
        )}
      </div>
      <p className="hint">
        Série {streak} · Pot {formatMoney(playing ? pot : stake)} LC
        {hi && lo ? ` · Haut ×${hi.mult.toFixed(2)} · Bas ×${lo.mult.toFixed(2)}` : ''}
      </p>
      <StakeControls stake={stake} setStake={setStake} disabled={playing} />
      <div className="btn-row">
        {!playing ? (
          <button type="button" className="btn primary" onClick={begin}>
            Nouvelle manche
          </button>
        ) : (
          <>
            <button type="button" className="btn primary" disabled={!hi || hi.mult <= 0} onClick={() => guess('hi')}>
              Higher{hi && hi.mult > 0 ? ` ×${hi.mult.toFixed(2)}` : ''}
            </button>
            <button type="button" className="btn primary" disabled={!lo || lo.mult <= 0} onClick={() => guess('lo')}>
              Lower{lo && lo.mult > 0 ? ` ×${lo.mult.toFixed(2)}` : ''}
            </button>
            <button type="button" className="btn" disabled={streak === 0} onClick={cashout}>
              Encaisser
            </button>
          </>
        )}
      </div>
      <p className="game-msg">{message}</p>
      <p className="hint">Cotes justes selon la carte (~6 % maison). Égalité = mise rendue.</p>
    </div>
  )
}
