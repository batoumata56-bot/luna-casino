import { useEffect, useRef, useState } from 'react'
import {
  pickSlot,
  slotsMultiplier,
  slotsPayout,
  SLOT_SYMBOLS,
  tripleMult,
  type SlotSymbol,
} from '../lib/games'
import { StakeControls, useGameSettle, useStakeGuard } from '../components/StakeControls'
import { usePlayTimer } from '../store/CasinoContext'

const CELL = 88
const COPIES = 12
const STRIP: SlotSymbol[] = Array.from({ length: COPIES }, () => [...SLOT_SYMBOLS]).flat()

function Reel({
  spinning,
  final,
  delayMs,
  spinId,
}: {
  spinning: boolean
  final: SlotSymbol
  delayMs: number
  spinId: number
}) {
  const [offset, setOffset] = useState(0)
  const offsetRef = useRef(0)
  const [blur, setBlur] = useState(false)

  useEffect(() => {
    if (!spinning || spinId === 0) return

    const startOff = offsetRef.current
    const symIdx = SLOT_SYMBOLS.indexOf(final)
    const period = SLOT_SYMBOLS.length
    // Travel at least ~18–28 cells then land on correct symbol
    const minCells = 18 + Math.floor(delayMs / 40)
    let targetCell = Math.ceil(startOff / CELL) + minCells
    while (targetCell % period !== symIdx) targetCell += 1
    // Prefer a copy near the middle of the strip so we have room
    while (targetCell < period * 3) targetCell += period
    while (targetCell >= STRIP.length - period) targetCell -= period

    const endOff = targetCell * CELL
    const duration = 2200 + delayMs
    const start = performance.now()
    setBlur(true)
    let raf = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const ease = 1 - Math.pow(1 - t, 3)
      const value = startOff + (endOff - startOff) * ease
      offsetRef.current = value
      setOffset(value)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        offsetRef.current = endOff
        setOffset(endOff)
        setBlur(false)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [spinning, final, delayMs, spinId])

  return (
    <div className="slot-reel">
      <div
        className={`slot-strip ${blur ? 'blur' : ''}`}
        style={{ transform: `translateY(${-offset}px)` }}
      >
        {STRIP.map((s, i) => (
          <div key={i} className="slot-symbol">
            {s}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SlotsGame() {
  const { stake, setStake } = useStakeGuard()
  const { trySettle, cash } = useGameSettle('slots')
  const [reels, setReels] = useState<[SlotSymbol, SlotSymbol, SlotSymbol]>(['🌙', '💎', '🍀'])
  const [spinning, setSpinning] = useState(false)
  const [spinId, setSpinId] = useState(0)
  const [message, setMessage] = useState('Tire le levier')
  const [lastMult, setLastMult] = useState(0)
  usePlayTimer(true, 'slots')

  const play = () => {
    if (spinning || cash < stake) {
      if (cash < stake) setMessage('Fonds insuffisants')
      return
    }
    const final: [SlotSymbol, SlotSymbol, SlotSymbol] = [pickSlot(), pickSlot(), pickSlot()]
    setReels(final)
    setSpinning(true)
    setSpinId((id) => id + 1)
    setMessage('…')
    const duration = 2800
    window.setTimeout(() => {
      const mult = slotsMultiplier(final)
      const payout = slotsPayout(stake, final)
      trySettle(stake, payout)
      setLastMult(mult)
      setSpinning(false)
      setMessage(
        payout > 0
          ? `Gain ${payout} LC (×${mult})`
          : `Perdu ${stake} LC`,
      )
    }, duration)
  }

  return (
    <div className="game-panel slots-machine">
      <div className="slots-window">
        <div className="slots-reels-live">
          <Reel spinning={spinning} final={reels[0]} delayMs={0} spinId={spinId} />
          <Reel spinning={spinning} final={reels[1]} delayMs={280} spinId={spinId} />
          <Reel spinning={spinning} final={reels[2]} delayMs={560} spinId={spinId} />
        </div>
        <div className="slots-payline" />
      </div>

      <table className="slots-paytable">
        <thead>
          <tr>
            <th>Combinaison</th>
            <th>Multiplicateur</th>
          </tr>
        </thead>
        <tbody>
          {SLOT_SYMBOLS.map((s) => (
            <tr key={s}>
              <td>
                {s}
                {s}
                {s}
              </td>
              <td>×{tripleMult(s)}</td>
            </tr>
          ))}
          <tr>
            <td>2 identiques</td>
            <td>×2</td>
          </tr>
        </tbody>
      </table>
      {lastMult > 0 && <p className="hint">Dernier spin : ×{lastMult}</p>}

      <StakeControls stake={stake} setStake={setStake} disabled={spinning} />
      <button type="button" className="btn primary lever" disabled={spinning} onClick={play}>
        {spinning ? 'En cours…' : 'Lancer'}
      </button>
      <p className="game-msg">{message}</p>
    </div>
  )
}
