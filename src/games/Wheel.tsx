import { useMemo, useRef, useState } from 'react'
import { ChipTray, StackedChips } from '../components/Chips'
import {
  RUST_WHEEL,
  WHEEL_COLORS,
  WHEEL_PAYOUT,
  spinRustWheel,
  type ChipValue,
  type WheelSpot,
} from '../lib/games'
import { useCasino, usePlayTimer } from '../store/CasinoContext'
import { useRoomReport } from '../store/RoomContext'
import { formatMoney, formatSettleLine } from '../lib/format'

const SPOTS: WheelSpot[] = [1, 3, 5, 10, 20]
const REVEAL_MS = 2600

export function WheelGame() {
  const { user, settleBet } = useCasino()
  const report = useRoomReport()
  const [chip, setChip] = useState<ChipValue>(100)
  const [bets, setBets] = useState<Partial<Record<WheelSpot, number>>>({})
  const [spinning, setSpinning] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [glowSpot, setGlowSpot] = useState<WheelSpot | null>(null)
  const [rot, setRot] = useState(0)
  const [resultIdx, setResultIdx] = useState(0)
  const [message, setMessage] = useState('Pose des jetons sur 1 / 3 / 5 / 10 / 20')
  const [summary, setSummary] = useState<string | null>(null)
  const pendingIdx = useRef(0)
  usePlayTimer(true, 'wheel')

  const locked = spinning || revealing
  const committed = useMemo(() => Object.values(bets).reduce((a, b) => a + (b ?? 0), 0), [bets])
  const available = user.wallet.cash - (locked ? 0 : committed)
  const n = RUST_WHEEL.length
  const seg = 360 / n

  const place = (spot: WheelSpot) => {
    if (locked) return
    if (available < chip) {
      setMessage('Fonds insuffisants')
      return
    }
    setBets((prev) => ({ ...prev, [spot]: (prev[spot] ?? 0) + chip }))
    setSummary(null)
  }

  const clear = () => {
    if (!locked) {
      setBets({})
      setSummary(null)
    }
  }

  const spin = () => {
    if (locked || committed <= 0) {
      if (committed <= 0) setMessage('Mise au moins un jeton')
      return
    }
    if (user.wallet.cash < committed) {
      setMessage('Fonds insuffisants')
      return
    }
    const idx = spinRustWheel()
    pendingIdx.current = idx
    const stakeSnapshot = committed
    const betsSnapshot = { ...bets }
    setSpinning(true)
    setSummary(null)
    setMessage('La roue tourne…')
    setRot((prev) => {
      const targetMod = (((-idx * seg) % 360) + 360) % 360
      const prevMod = ((prev % 360) + 360) % 360
      let delta = targetMod - prevMod
      if (delta <= 0) delta += 360
      return prev + delta + 5 * 360
    })

    window.setTimeout(() => {
      const settled = pendingIdx.current
      setResultIdx(settled)
      const value = RUST_WHEEL[settled] as WheelSpot
      const stakeOn = betsSnapshot[value] ?? 0
      const payout = stakeOn * WHEEL_PAYOUT[value]
      settleBet(stakeSnapshot, payout, 'wheel')
      report(payout >= stakeSnapshot ? 'win' : 'lose', {
        amount: payout >= stakeSnapshot ? payout : stakeSnapshot,
        detail: `roue → ${value}`,
      })
      setGlowSpot(value)
      setSpinning(false)
      setRevealing(true)
      setMessage(`Résultat ${value}`)
      setSummary(formatSettleLine(stakeSnapshot, payout))

      window.setTimeout(() => {
        setGlowSpot(null)
        setBets({})
        setRevealing(false)
      }, REVEAL_MS)
    }, 4500)
  }

  const conic = useMemo(() => {
    const parts = RUST_WHEEL.map((v, i) => {
      const start = (i / n) * 360
      const end = ((i + 1) / n) * 360
      return `${WHEEL_COLORS[v as WheelSpot]} ${start}deg ${end}deg`
    })
    return `conic-gradient(from -${seg / 2}deg, ${parts.join(',')})`
  }, [n, seg])

  const resultValue = RUST_WHEEL[resultIdx] as WheelSpot

  return (
    <div className="wheel-arena">
      <div className="rust-wheel-wrap">
        <div className="rust-pointer">▼</div>
        <div className="rust-wheel" style={{ transform: `rotate(${rot}deg)`, background: conic }}>
          {RUST_WHEEL.map((v, i) => (
            <span key={i} className="rust-label" style={{ transform: `rotate(${i * seg}deg)` }}>
              <i>{v}</i>
            </span>
          ))}
          <div className="rust-hub" />
        </div>
        <p className="hint">
          Segment : <strong>{resultValue}</strong> · ×{WHEEL_PAYOUT[resultValue]}
        </p>
      </div>

      <div className="wheel-bets">
        <ChipTray selected={chip} onSelect={setChip} disabled={locked} />
        <div className="wheel-spots">
          {SPOTS.map((s) => (
            <button
              key={s}
              type="button"
              className={`wheel-spot ${glowSpot === s ? 'win-glow win-chip' : ''}`}
              style={{
                borderColor: WHEEL_COLORS[s],
                boxShadow: `0 0 20px ${WHEEL_COLORS[s]}44`,
              }}
              onClick={() => place(s)}
            >
              <strong style={{ color: WHEEL_COLORS[s] }}>{s}</strong>
              <span>×{WHEEL_PAYOUT[s]}</span>
              {bets[s] ? <StackedChips amount={bets[s]!} /> : null}
            </button>
          ))}
        </div>
        <p className="hint">
          Engagé {formatMoney(locked ? 0 : committed)} · Cash {formatMoney(user.wallet.cash)}
        </p>
        <div className="btn-row">
          <button type="button" className="btn primary" disabled={locked} onClick={spin}>
            Tourner
          </button>
          <button type="button" className="btn" disabled={locked} onClick={clear}>
            Effacer
          </button>
        </div>
        <p className="game-msg">{message}</p>
        {summary && <p className="settle-summary">{summary}</p>}
      </div>
    </div>
  )
}
