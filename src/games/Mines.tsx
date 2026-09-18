import { useMemo, useState } from 'react'
import { minesMultiplier } from '../lib/games'
import { StakeControls, useGameSettle, useStakeGuard } from '../components/StakeControls'
import { usePlayTimer } from '../store/CasinoContext'
import { formatMoney } from '../lib/format'

const TOTAL = 25

export function MinesGame() {
  const { stake, setStake } = useStakeGuard()
  const { trySettle, cash } = useGameSettle('mines')
  const [mines, setMines] = useState(5)
  const [mineSet, setMineSet] = useState<Set<number>>(new Set())
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [playing, setPlaying] = useState(false)
  const [boom, setBoom] = useState(false)
  const [message, setMessage] = useState('Choisis le nombre de mines, puis démarre')
  const [lockedStake, setLockedStake] = useState(0)
  usePlayTimer(true, 'mines')

  const mult = useMemo(
    () => minesMultiplier(revealed.size, mines, TOTAL),
    [revealed.size, mines],
  )
  const nextPayout = Math.floor(lockedStake * mult)

  const start = () => {
    if (playing || cash < stake) {
      if (cash < stake) setMessage('Fonds insuffisants')
      return
    }
    const set = new Set<number>()
    while (set.size < mines) set.add(Math.floor(Math.random() * TOTAL))
    setMineSet(set)
    setRevealed(new Set())
    setBoom(false)
    setLockedStake(stake)
    setPlaying(true)
    setMessage('Clique une case safe — ou encaisse')
  }

  const reveal = (i: number) => {
    if (!playing || boom || revealed.has(i)) return
    if (mineSet.has(i)) {
      setRevealed(new Set([...revealed, i, ...mineSet]))
      setBoom(true)
      setPlaying(false)
      trySettle(lockedStake, 0)
      setMessage(`💥 Mine ! Perdu ${formatMoney(lockedStake)} LC`)
      return
    }
    const next = new Set(revealed)
    next.add(i)
    setRevealed(next)
    setMessage(`Safe · ×${minesMultiplier(next.size, mines, TOTAL).toFixed(2)}`)
  }

  const cashout = () => {
    if (!playing || revealed.size === 0) return
    const payout = Math.floor(lockedStake * minesMultiplier(revealed.size, mines, TOTAL))
    trySettle(lockedStake, payout)
    setPlaying(false)
    setRevealed(new Set([...revealed, ...mineSet]))
    setMessage(`Encaissé ×${mult.toFixed(2)} → ${formatMoney(payout)} LC`)
  }

  return (
    <div className="game-panel mines-panel">
      <label className="slider-label">
        Mines : {mines}
        <input
          type="range"
          min={1}
          max={20}
          value={mines}
          disabled={playing}
          onChange={(e) => setMines(Number(e.target.value))}
        />
      </label>
      <div className="mines-grid">
        {Array.from({ length: TOTAL }, (_, i) => {
          const isRevealed = revealed.has(i)
          const isMine = mineSet.has(i)
          return (
            <button
              key={i}
              type="button"
              className={`mine-cell ${isRevealed ? (isMine ? 'bomb' : 'safe') : ''} ${playing ? 'live' : ''}`}
              disabled={!playing || isRevealed || boom}
              onClick={() => reveal(i)}
            >
              {isRevealed ? (isMine ? '💣' : '💎') : ''}
            </button>
          )
        })}
      </div>
      <StakeControls stake={stake} setStake={setStake} disabled={playing} />
      <div className="btn-row">
        {!playing ? (
          <button type="button" className="btn primary" onClick={start}>
            Démarrer
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            disabled={revealed.size === 0}
            onClick={cashout}
          >
            Encaisser {revealed.size > 0 ? `(${formatMoney(nextPayout)} LC)` : ''}
          </button>
        )}
      </div>
      <p className="game-msg">{message}</p>
      <p className="hint">Plus tu révèles, plus le multiplicateur monte</p>
    </div>
  )
}
