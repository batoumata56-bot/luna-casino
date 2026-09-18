import { useEffect, useRef, useState } from 'react'
import { generateCrashPoint } from '../lib/games'
import { StakeControls, useGameSettle, useStakeGuard } from '../components/StakeControls'
import { usePlayTimer } from '../store/CasinoContext'
import { useRoomReport } from '../store/RoomContext'

export function CrashGame() {
  const { stake, setStake } = useStakeGuard()
  const { trySettle, cash } = useGameSettle('crash')
  const report = useRoomReport()
  const [mult, setMult] = useState(1)
  const [running, setRunning] = useState(false)
  const [crashed, setCrashed] = useState(false)
  const [cashed, setCashed] = useState(false)
  const [message, setMessage] = useState('Décollage — encaisse avant l’explosion')
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([])
  const crashAt = useRef(1)
  const locked = useRef(0)
  const cashedRef = useRef(false)
  const cashedAt = useRef(0)
  const settleRef = useRef(trySettle)
  settleRef.current = trySettle
  const reportRef = useRef(report)
  reportRef.current = report
  usePlayTimer(true, 'crash')

  useEffect(() => {
    if (!running) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = (now - start) / 1000
      const m = Math.floor(Math.pow(Math.E, 0.11 * t) * 100) / 100
      if (m >= crashAt.current) {
        setMult(crashAt.current)
        setRunning(false)
        setCrashed(true)
        setParticles(
          Array.from({ length: 18 }, (_, i) => ({
            id: i,
            x: (Math.random() - 0.5) * 160,
            y: (Math.random() - 0.5) * 120,
          })),
        )
        if (cashedRef.current) {
          setMessage(
            `Tu as encaissé @ ${cashedAt.current.toFixed(2)}× · Crash réel @ ${crashAt.current.toFixed(2)}×`,
          )
        } else {
          settleRef.current(locked.current, 0)
          reportRef.current('lose', {
            amount: locked.current,
            detail: `crash @ ${crashAt.current.toFixed(2)}×`,
          })
          setMessage(`💥 Crash @ ${crashAt.current.toFixed(2)}×`)
        }
        return
      }
      setMult(m)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])

  const start = () => {
    if (running || cash < stake) {
      if (cash < stake) setMessage('Fonds insuffisants')
      return
    }
    crashAt.current = generateCrashPoint()
    locked.current = stake
    cashedRef.current = false
    cashedAt.current = 0
    setCashed(false)
    setCrashed(false)
    setParticles([])
    setMult(1)
    setRunning(true)
    setMessage('En vol…')
    report('bet', { amount: stake, detail: 'décolle sur Crash' })
  }

  const cashout = () => {
    if (!running || cashedRef.current || crashed) return
    cashedRef.current = true
    cashedAt.current = mult
    setCashed(true)
    const payout = Math.floor(locked.current * mult)
    trySettle(locked.current, payout)
    report('win', { amount: payout, detail: `encaissé @ ${mult.toFixed(2)}×` })
    setMessage(
      `🚀 Encaissé @ ${mult.toFixed(2)}× → +${payout - locked.current} LC — la fusée continue…`,
    )
    // Keep running until real crash so player sees where it would have exploded
  }

  const rocketY = Math.min(85, (mult - 1) * 55)
  const busy = running || (cashed && !crashed)

  return (
    <div className="game-panel crash-stage">
      <div className={`crash-sky ${crashed ? 'boom' : ''} ${cashed && !crashed ? 'safe' : ''}`}>
        <div className="crash-stars" />
        <div
          className={`crash-rocket ${running ? 'fly' : ''} ${crashed ? 'explode' : ''}`}
          style={{ bottom: `${12 + rocketY}%` }}
        >
          {!crashed && (
            <>
              <span className="rocket-body">🚀</span>
              {running && <span className="rocket-flame" />}
            </>
          )}
        </div>
        {crashed &&
          particles.map((p) => (
            <span
              key={p.id}
              className="crash-particle"
              style={{
                ['--dx' as string]: `${p.x}px`,
                ['--dy' as string]: `${p.y}px`,
              }}
            >
              ✦
            </span>
          ))}
        <div className="crash-mult">{mult.toFixed(2)}×</div>
        {cashed && !crashed && (
          <div className="crash-cashed-tag">Encaissé @ {cashedAt.current.toFixed(2)}×</div>
        )}
      </div>
      <StakeControls stake={stake} setStake={setStake} disabled={busy} />
      <div className="btn-row">
        {!running && !crashed && !cashed && (
          <button type="button" className="btn primary" onClick={start}>
            Décoller
          </button>
        )}
        {running && !cashed && (
          <button type="button" className="btn primary" onClick={cashout}>
            Encaisser
          </button>
        )}
        {crashed && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setCrashed(false)
              setCashed(false)
              start()
            }}
          >
            Relancer
          </button>
        )}
      </div>
      <p className="game-msg">{message}</p>
      <p className="hint">~8% edge · crash instantané possible · plafond 12×</p>
    </div>
  )
}
