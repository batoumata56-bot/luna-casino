import { useEffect, useRef, useState } from 'react'
import { PLINKO_MULTS, type PlinkoRisk } from '../lib/games'
import { StakeControls, useGameSettle, useStakeGuard } from '../components/StakeControls'
import { usePlayTimer } from '../store/CasinoContext'
import { formatMoney } from '../lib/format'

const BALL_COUNTS = [1, 3, 5, 10, 20] as const
type BallCount = (typeof BALL_COUNTS)[number]

/** 8 rangées → 9 cases (binomiale classique casino) */
const W = 440
const H = 560
const ROWS = 8
const SLOT_COUNT = 9
const PEG_R = 5
const BALL_R = 8
const PAD_X = 28
const TOP_Y = 42
const SLOT_Y = H - 56

type Peg = { x: number; y: number; row: number; col: number }
type SimBall = {
  id: number
  x: number
  y: number
  path: { x: number; y: number }[]
  step: number
  t: number
  done: boolean
  slot: number | null
  hue: number
}

function buildPegs(): Peg[] {
  const pegs: Peg[] = []
  const bottom = SLOT_Y - 36
  const usable = bottom - TOP_Y
  for (let row = 0; row < ROWS; row++) {
    const count = row + 3
    const y = TOP_Y + (row / (ROWS - 1)) * usable
    const span = W - PAD_X * 2
    const start = (W - span) / 2
    for (let col = 0; col < count; col++) {
      const x = start + (count === 1 ? span / 2 : (col / (count - 1)) * span)
      pegs.push({ x, y, row, col })
    }
  }
  return pegs
}

const PEGS = buildPegs()

function slotCenter(i: number): number {
  const pad = 18
  const slotW = (W - pad * 2) / SLOT_COUNT
  return pad + i * slotW + slotW / 2
}

/** Chemin juste : à chaque rangée L/R à 50 %, case = nombre de droites (0..8). */
function fairPath(): { points: { x: number; y: number }[]; slot: number } {
  let rights = 0
  const points: { x: number; y: number }[] = [{ x: W / 2, y: 14 }]

  for (let row = 0; row < ROWS; row++) {
    if (Math.random() < 0.5) rights++
    const pegsInRow = PEGS.filter((p) => p.row === row)
    const maxRightsAtRow = row + 1
    const idx = Math.round((rights / maxRightsAtRow) * (pegsInRow.length - 1))
    const peg = pegsInRow[Math.min(pegsInRow.length - 1, Math.max(0, idx))]!
    points.push({ x: peg.x, y: peg.y - BALL_R - 2 })
  }

  const slot = Math.min(SLOT_COUNT - 1, Math.max(0, rights))
  points.push({ x: slotCenter(slot), y: SLOT_Y - BALL_R })
  return { points, slot }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** Interpolation avec petit arc de rebond entre pegs */
function samplePath(points: { x: number; y: number }[], step: number, t: number) {
  const a = points[step]!
  const b = points[Math.min(step + 1, points.length - 1)]!
  const ease = t * t * (3 - 2 * t)
  const x = lerp(a.x, b.x, ease)
  const y = lerp(a.y, b.y, ease) - Math.sin(t * Math.PI) * 6
  return { x, y }
}

export function PlinkoGame() {
  const { stake, setStake } = useStakeGuard()
  const { trySettle, cash } = useGameSettle('plinko')
  const [risk, setRisk] = useState<PlinkoRisk>('medium')
  const [ballCount, setBallCount] = useState<BallCount>(1)
  const [dropping, setDropping] = useState(false)
  const [hitSlots, setHitSlots] = useState<number[]>([])
  const [message, setMessage] = useState('Plinko équilibré — ~96 % de retour long terme')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ballsRef = useRef<SimBall[]>([])
  const rafRef = useRef(0)
  const stakeTotalRef = useRef(0)
  const perBallStakeRef = useRef(0)
  const riskRef = useRef(risk)
  const hitSlotsRef = useRef<number[]>([])
  const lastTsRef = useRef(0)
  riskRef.current = risk
  usePlayTimer(true, 'plinko')

  const totalStake = stake * ballCount
  const mults = PLINKO_MULTS[risk]

  const drawFrame = (balls: SimBall[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, W, H)

    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#14081f')
    bg.addColorStop(1, '#08050e')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = 'rgba(192,38,211,0.08)'
    ctx.beginPath()
    ctx.ellipse(W / 2, 70, 150, 55, 0, 0, Math.PI * 2)
    ctx.fill()

    for (const peg of PEGS) {
      ctx.beginPath()
      ctx.arc(peg.x, peg.y, PEG_R, 0, Math.PI * 2)
      const g = ctx.createRadialGradient(peg.x - 1, peg.y - 1, 1, peg.x, peg.y, PEG_R)
      g.addColorStop(0, '#fce7f3')
      g.addColorStop(1, '#c026d3')
      ctx.fillStyle = g
      ctx.shadowColor = 'rgba(244,114,182,0.45)'
      ctx.shadowBlur = 6
      ctx.fill()
      ctx.shadowBlur = 0
    }

    const pad = 18
    const slotW = (W - pad * 2) / SLOT_COUNT
    const m = PLINKO_MULTS[riskRef.current]
    const hits = hitSlotsRef.current
    for (let i = 0; i < SLOT_COUNT; i++) {
      const x = pad + i * slotW
      const hit = hits.includes(i)
      const edge = i === 0 || i === SLOT_COUNT - 1
      ctx.fillStyle = hit
        ? '#ff4d9a'
        : edge
          ? 'rgba(244,114,182,0.45)'
          : i % 2 === 0
            ? 'rgba(139,92,246,0.35)'
            : 'rgba(192,38,211,0.28)'
      const rx = x + 2
      const ry = H - 52
      const rw = slotW - 4
      const rh = 40
      const r = 8
      ctx.beginPath()
      ctx.moveTo(rx + r, ry)
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r)
      ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r)
      ctx.arcTo(rx, ry + rh, rx, ry, r)
      ctx.arcTo(rx, ry, rx + rw, ry, r)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#fce7f3'
      ctx.font = '700 11px Outfit, sans-serif'
      ctx.textAlign = 'center'
      const label = m[i]!
      ctx.fillText(`×${label % 1 === 0 ? label.toFixed(0) : label}`, x + slotW / 2, H - 28)
    }

    ctx.strokeStyle = 'rgba(244,114,182,0.22)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(14, 24)
    ctx.lineTo(14, H - 56)
    ctx.moveTo(W - 14, 24)
    ctx.lineTo(W - 14, H - 56)
    ctx.stroke()

    for (const b of balls) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
      const g = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BALL_R)
      g.addColorStop(0, '#fff')
      g.addColorStop(0.35, `hsl(${b.hue} 90% 70%)`)
      g.addColorStop(1, `hsl(${b.hue} 80% 45%)`)
      ctx.fillStyle = g
      ctx.shadowColor = `hsl(${b.hue} 90% 60%)`
      ctx.shadowBlur = 12
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  useEffect(() => {
    hitSlotsRef.current = hitSlots
    drawFrame(ballsRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk, hitSlots])

  const finishRound = (balls: SimBall[]) => {
    cancelAnimationFrame(rafRef.current)
    let payout = 0
    const per = perBallStakeRef.current
    for (const b of balls) {
      if (b.slot !== null) {
        payout += Math.floor(per * PLINKO_MULTS[riskRef.current][b.slot]!)
      }
    }
    const totalIn = stakeTotalRef.current
    trySettle(totalIn, payout)
    const net = payout - totalIn
    setMessage(
      `${balls.length} bille(s) · Misés ${formatMoney(totalIn)} · Retour ${formatMoney(payout)} · Net ${net >= 0 ? '+' : ''}${formatMoney(net)} LC`,
    )
    setDropping(false)
  }

  const tick = (ts: number) => {
    if (!lastTsRef.current) lastTsRef.current = ts
    const dt = Math.min(32, ts - lastTsRef.current) / 1000
    lastTsRef.current = ts

    const balls = ballsRef.current
    const speed = 7.2 // segments / seconde

    for (const ball of balls) {
      if (ball.done) continue
      ball.t += dt * speed
      if (ball.t < 0) {
        ball.x = ball.path[0]!.x
        ball.y = ball.path[0]!.y
        continue
      }
      while (ball.t >= 1 && !ball.done) {
        ball.t -= 1
        ball.step += 1
        if (ball.step >= ball.path.length - 1) {
          ball.done = true
          ball.t = 1
          ball.step = ball.path.length - 2
          const end = ball.path[ball.path.length - 1]!
          ball.x = end.x
          ball.y = end.y
          hitSlotsRef.current = [...hitSlotsRef.current, ball.slot!]
          setHitSlots(hitSlotsRef.current)
          break
        }
      }
      if (!ball.done) {
        const p = samplePath(ball.path, ball.step, Math.min(1, ball.t))
        ball.x = p.x
        ball.y = p.y
      }
    }

    drawFrame(balls)

    if (balls.length > 0 && balls.every((b) => b.done)) {
      finishRound(balls)
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  const drop = () => {
    if (dropping) return
    if (cash < totalStake) {
      setMessage(`Il faut ${formatMoney(totalStake)} LC (${ballCount}×${formatMoney(stake)})`)
      return
    }

    cancelAnimationFrame(rafRef.current)
    hitSlotsRef.current = []
    setHitSlots([])
    setDropping(true)
    setMessage(`${ballCount} bille(s) en chute…`)
    stakeTotalRef.current = totalStake
    perBallStakeRef.current = stake
    lastTsRef.current = 0

    const balls: SimBall[] = []
    for (let i = 0; i < ballCount; i++) {
      const { points, slot } = fairPath()
      // décale le départ pour multi-billes (léger stagger vertical uniquement)
      const path = points.map((p, idx) =>
        idx === 0 ? { x: p.x, y: p.y - i * 10 } : p,
      )
      balls.push({
        id: i,
        x: path[0]!.x,
        y: path[0]!.y,
        path,
        step: 0,
        t: -i * 0.12,
        done: false,
        slot,
        hue: 300 + ((i * 19) % 70),
      })
    }
    ballsRef.current = balls
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    drawFrame([])
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="game-panel plinko-panel wide">
      <div className="btn-row">
        {(['low', 'medium', 'high'] as PlinkoRisk[]).map((r) => (
          <button
            key={r}
            type="button"
            className={risk === r ? 'btn primary' : 'btn'}
            disabled={dropping}
            onClick={() => setRisk(r)}
          >
            {r === 'low' ? 'Safe' : r === 'medium' ? 'Médium' : 'Risqué'}
          </button>
        ))}
      </div>

      <div className="mult-preview" aria-hidden>
        {mults.map((m, i) => (
          <span key={i} className={i === 0 || i === mults.length - 1 ? 'edge' : undefined}>
            ×{m % 1 === 0 ? m.toFixed(0) : m}
          </span>
        ))}
      </div>

      <div className="btn-row">
        <span className="muted" style={{ alignSelf: 'center' }}>
          Billes
        </span>
        {BALL_COUNTS.map((n) => (
          <button
            key={n}
            type="button"
            className={ballCount === n ? 'chip active' : 'chip'}
            disabled={dropping}
            onClick={() => setBallCount(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="plinko-canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H} className="plinko-canvas" />
      </div>

      <p className="hint">
        Mise / bille {formatMoney(stake)} LC · Total {formatMoney(totalStake)} LC (
        {ballCount} bille{ballCount > 1 ? 's' : ''}) · RTP ~96 %
      </p>
      <StakeControls stake={stake} setStake={setStake} disabled={dropping} />
      <button type="button" className="btn primary" disabled={dropping} onClick={drop}>
        {dropping ? 'En cours…' : `Lâcher ${ballCount} bille${ballCount > 1 ? 's' : ''}`}
      </button>
      <p className="game-msg">{message}</p>
    </div>
  )
}
