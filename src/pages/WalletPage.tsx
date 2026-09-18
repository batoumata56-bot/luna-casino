import { useMemo, useState } from 'react'
import { useCasino } from '../store/CasinoContext'
import type { CryptoSymbol } from '../types'
import { formatCrypto, formatMoney, wealthOf } from '../lib/format'
import {
  TIMEFRAMES,
  pctChange,
  sliceHistory,
  type Timeframe,
} from '../lib/prices'

const SYMBOLS: { id: CryptoSymbol; name: string; tint: string }[] = [
  { id: 'BTC', name: 'Bitcoin', tint: '#f7931a' },
  { id: 'ETH', name: 'Ethereum', tint: '#8b5cf6' },
  { id: 'SOL', name: 'Solana', tint: '#14f195' },
  { id: 'LUNA', name: 'Luna Coin', tint: '#ff4d9a' },
]

function Sparkline({
  points,
  positive,
}: {
  points: { t: number; p: number }[]
  positive: boolean
}) {
  const w = 640
  const h = 220
  const path = useMemo(() => {
    if (points.length < 2) return ''
    const min = Math.min(...points.map((p) => p.p))
    const max = Math.max(...points.map((p) => p.p))
    const span = max - min || 1
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w
        const y = h - ((p.p - min) / span) * (h - 24) - 12
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [points])

  const fill = useMemo(() => {
    if (!path) return ''
    return `${path} L${w},${h} L0,${h} Z`
  }, [path])

  const stroke = positive ? '#34d399' : '#fb7185'

  return (
    <svg className="price-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#chartFill)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function WalletPage() {
  const { user, rates, history, buyCrypto, sellCrypto, sendMoney, pushToast } = useCasino()
  const [symbol, setSymbol] = useState<CryptoSymbol>('BTC')
  const [tf, setTf] = useState<Timeframe>('1d')
  const [cashAmount, setCashAmount] = useState(500)
  const [coinAmount, setCoinAmount] = useState(0.01)
  const [toName, setToName] = useState('')
  const [sendAmt, setSendAmt] = useState(500)
  const wealth = wealthOf(user.wallet, rates)
  const meta = SYMBOLS.find((s) => s.id === symbol)!
  const series = sliceHistory(history[symbol] ?? [], tf)
  const change = pctChange(history[symbol] ?? [], tf)
  const positive = change >= 0

  return (
    <div className="page wallet-page">
      <header className="page-head">
        <h1>Portefeuille</h1>
        <p>Marché fictif en temps réel — graphiques & variations.</p>
      </header>

      <div className="wallet-overview">
        <div>
          <span className="muted">Cash</span>
          <strong>{formatMoney(user.wallet.cash)} LC</strong>
        </div>
        <div>
          <span className="muted">Fortune</span>
          <strong>{formatMoney(wealth)} LC</strong>
        </div>
      </div>

      <section className="social-block send-lc">
        <h2>Envoyer des LC</h2>
        <p className="hint">Par pseudo exact, depuis ton cash (pas la crypto).</p>
        <div className="social-search">
          <input
            value={toName}
            onChange={(e) => setToName(e.target.value)}
            placeholder="Pseudo du joueur"
          />
          <input
            type="number"
            min={1}
            max={user.wallet.cash}
            value={sendAmt}
            onChange={(e) => setSendAmt(Number(e.target.value))}
          />
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              const err = await sendMoney(toName, sendAmt)
              if (err) pushToast(err)
              else setToName('')
            }}
          >
            Envoyer
          </button>
        </div>
      </section>

      <div className="crypto-nav">
        {SYMBOLS.map((s) => {
          const ch = pctChange(history[s.id] ?? [], '1d')
          return (
            <button
              key={s.id}
              type="button"
              className={`crypto-nav-item ${symbol === s.id ? 'active' : ''}`}
              onClick={() => setSymbol(s.id)}
              style={{ ['--tint' as string]: s.tint }}
            >
              <span className="sym">{s.id}</span>
              <strong>{formatMoney(rates[s.id])} LC</strong>
              <em className={ch >= 0 ? 'up' : 'down'}>
                {ch >= 0 ? '+' : ''}
                {ch.toFixed(2)}%
              </em>
            </button>
          )
        })}
      </div>

      <section className="chart-card">
        <div className="chart-head">
          <div>
            <h2>
              {meta.name} <span>({symbol})</span>
            </h2>
            <p className="chart-price">
              {formatMoney(rates[symbol])} LC
              <em className={positive ? 'up' : 'down'}>
                {positive ? '+' : ''}
                {change.toFixed(2)}% · {TIMEFRAMES.find((t) => t.id === tf)!.label}
              </em>
            </p>
          </div>
          <div className="tf-row">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tf === t.id ? 'chip active' : 'chip'}
                onClick={() => setTf(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <Sparkline points={series} positive={positive} />
        <div className="pct-grid">
          {TIMEFRAMES.map((t) => {
            const c = pctChange(history[symbol] ?? [], t.id)
            return (
              <div key={t.id}>
                <span>{t.label}</span>
                <strong className={c >= 0 ? 'up' : 'down'}>
                  {c >= 0 ? '+' : ''}
                  {c.toFixed(2)}%
                </strong>
              </div>
            )
          })}
        </div>
        <div className="holdings-line">
          <span>
            Tu détiens <strong>{formatCrypto(user.wallet.crypto[symbol], symbol === 'BTC' ? 6 : 4)}</strong>{' '}
            {symbol}
          </span>
          <span>
            ≈ <strong>{formatMoney(user.wallet.crypto[symbol] * rates[symbol])} LC</strong>
          </span>
        </div>
      </section>

      <div className="trade-panels">
        <div className="trade-box">
          <h3>Acheter {symbol}</h3>
          <label>
            Montant LC
            <input
              type="number"
              min={1}
              max={user.wallet.cash}
              value={cashAmount}
              onChange={(e) => setCashAmount(Number(e.target.value))}
            />
          </label>
          <p className="hint">≈ {formatCrypto(cashAmount / rates[symbol], 6)} {symbol}</p>
          <button type="button" className="btn primary" onClick={() => buyCrypto(symbol, cashAmount)}>
            Acheter
          </button>
        </div>
        <div className="trade-box">
          <h3>Vendre {symbol}</h3>
          <label>
            Quantité
            <input
              type="number"
              min={0}
              step="any"
              max={user.wallet.crypto[symbol]}
              value={coinAmount}
              onChange={(e) => setCoinAmount(Number(e.target.value))}
            />
          </label>
          <p className="hint">≈ {formatMoney(coinAmount * rates[symbol])} LC</p>
          <button type="button" className="btn" onClick={() => sellCrypto(symbol, coinAmount)}>
            Vendre
          </button>
        </div>
      </div>
    </div>
  )
}
