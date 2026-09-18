import { useState } from 'react'
import { diceMultiplier, rollDice } from '../lib/games'
import { StakeControls, useGameSettle, useStakeGuard } from '../components/StakeControls'
import { usePlayTimer } from '../store/CasinoContext'

export function DiceGame() {
  const { stake, setStake } = useStakeGuard()
  const { trySettle, cash } = useGameSettle('dice')
  const [target, setTarget] = useState(50)
  const [mode, setMode] = useState<'over' | 'under'>('over')
  const [roll, setRoll] = useState<number | null>(null)
  const [message, setMessage] = useState('Choisis over / under')
  const [busy, setBusy] = useState(false)
  const [rolling, setRolling] = useState(false)
  usePlayTimer(true, 'dice')

  // under target: win if roll < target → chance = (target-1)/100
  // over target: win if roll > target → chance = (100-target)/100
  const winChance = mode === 'over' ? (100 - target) / 100 : (target - 1) / 100
  const multiplier = diceMultiplier(winChance)

  const play = () => {
    if (busy || cash < stake) {
      if (cash < stake) setMessage('Fonds insuffisants')
      return
    }
    setBusy(true)
    setRolling(true)
    let ticks = 0
    const id = window.setInterval(() => {
      setRoll(rollDice())
      ticks += 1
      if (ticks > 12) {
        clearInterval(id)
        const r = rollDice()
        setRoll(r)
        const won = mode === 'over' ? r > target : r < target
        const payout = won ? Math.floor(stake * multiplier) : 0
        trySettle(stake, payout)
        setMessage(
          won
            ? `${r} — gagné +${payout - stake} LC (×${multiplier})`
            : `${r} — perdu ${stake} LC`,
        )
        setRolling(false)
        setBusy(false)
      }
    }, 50)
  }

  return (
    <div className="game-panel">
      <div className={`dice-display ${rolling ? 'rolling' : ''}`}>{roll ?? '?'}</div>
      <div className="btn-row">
        <button
          type="button"
          className={mode === 'under' ? 'btn primary' : 'btn'}
          onClick={() => setMode('under')}
        >
          Sous {target}
        </button>
        <button
          type="button"
          className={mode === 'over' ? 'btn primary' : 'btn'}
          onClick={() => setMode('over')}
        >
          Sur {target}
        </button>
      </div>
      <label className="slider-label">
        Cible {target} · ×{multiplier.toFixed(2)} · {Math.round(winChance * 100)}% de chance
        <input
          type="range"
          min={5}
          max={95}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
        />
      </label>
      <StakeControls stake={stake} setStake={setStake} disabled={busy} />
      <button type="button" className="btn primary" disabled={busy} onClick={play}>
        Lancer
      </button>
      <p className="game-msg">{message}</p>
      <p className="hint">Edge maison ~7% — ex. 75% → ×1.24</p>
    </div>
  )
}
