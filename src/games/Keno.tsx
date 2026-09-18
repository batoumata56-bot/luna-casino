import { useState } from 'react'
import { kenoPayout } from '../lib/games'
import { StakeControls, useGameSettle, useStakeGuard } from '../components/StakeControls'
import { usePlayTimer } from '../store/CasinoContext'
import { formatMoney } from '../lib/format'

const MAX_PICK = 10
const POOL = 40
const DRAW = 10

export function KenoGame() {
  const { stake, setStake } = useStakeGuard()
  const { trySettle, cash } = useGameSettle('keno')
  const [picks, setPicks] = useState<number[]>([])
  const [drawn, setDrawn] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(`Choisis jusqu’à ${MAX_PICK} numéros`)
  usePlayTimer(true, 'keno')

  const toggle = (n: number) => {
    if (busy) return
    setDrawn([])
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n)
      if (prev.length >= MAX_PICK) return prev
      return [...prev, n].sort((a, b) => a - b)
    })
  }

  const play = () => {
    if (busy || picks.length === 0) {
      setMessage('Sélectionne au moins 1 numéro')
      return
    }
    if (cash < stake) {
      setMessage('Fonds insuffisants')
      return
    }
    setBusy(true)
    setMessage('Tirage…')
    const pool = Array.from({ length: POOL }, (_, i) => i + 1)
    const result: number[] = []
    while (result.length < DRAW) {
      const i = Math.floor(Math.random() * pool.length)
      result.push(pool.splice(i, 1)[0]!)
    }
    result.sort((a, b) => a - b)

    let step = 0
    const anim: number[] = []
    const id = window.setInterval(() => {
      anim.push(result[step]!)
      setDrawn([...anim])
      step += 1
      if (step >= DRAW) {
        clearInterval(id)
        const hits = picks.filter((p) => result.includes(p)).length
        const mult = kenoPayout(picks.length, hits)
        const payout = Math.floor(stake * mult)
        trySettle(stake, payout)
        setMessage(
          mult > 0
            ? `${hits} trouvé(s) · ×${mult} → ${formatMoney(payout)} LC`
            : `${hits} trouvé(s) — misé ${formatMoney(stake)} LC`,
        )
        setBusy(false)
      }
    }, 120)
  }

  return (
    <div className="game-panel keno-panel">
      <div className="keno-grid">
        {Array.from({ length: POOL }, (_, i) => {
          const n = i + 1
          const selected = picks.includes(n)
          const hit = drawn.includes(n) && selected
          const drawnOnly = drawn.includes(n) && !selected
          return (
            <button
              key={n}
              type="button"
              className={`keno-cell ${selected ? 'picked' : ''} ${hit ? 'hit' : ''} ${drawnOnly ? 'drawn' : ''}`}
              onClick={() => toggle(n)}
              disabled={busy}
            >
              {n}
            </button>
          )
        })}
      </div>
      <p className="hint">
        Sélection {picks.length}/{MAX_PICK}
        {picks.length > 0 && ` · ex. ${picks.length} picks / ${picks.length} hits → ×${kenoPayout(picks.length, picks.length)}`}
      </p>
      <StakeControls stake={stake} setStake={setStake} disabled={busy} />
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={busy} onClick={play}>
          Tirer {DRAW} numéros
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => {
            setPicks([])
            setDrawn([])
          }}
        >
          Effacer
        </button>
      </div>
      <p className="game-msg">{message}</p>
    </div>
  )
}
