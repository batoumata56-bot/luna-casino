import type { CryptoRates, CryptoSymbol } from '../types'
import { BASE_RATES } from './constants'

export type PricePoint = { t: number; p: number }
export type PriceHistory = Record<CryptoSymbol, PricePoint[]>

export type Timeframe = '1h' | '12h' | '1d' | '3d' | '1w' | '1m'

export const TIMEFRAMES: { id: Timeframe; label: string; ms: number }[] = [
  { id: '1h', label: '1h', ms: 3_600_000 },
  { id: '12h', label: '12h', ms: 43_200_000 },
  { id: '1d', label: '1j', ms: 86_400_000 },
  { id: '3d', label: '3j', ms: 259_200_000 },
  { id: '1w', label: '1 sem.', ms: 604_800_000 },
  { id: '1m', label: '1 mois', ms: 2_592_000_000 },
]

const SYMBOLS: CryptoSymbol[] = ['LUNA', 'BTC', 'ETH', 'SOL']

export function seedHistory(rates: CryptoRates = BASE_RATES): PriceHistory {
  const now = Date.now()
  const out = {} as PriceHistory
  for (const sym of SYMBOLS) {
    const points: PricePoint[] = []
    let price = rates[sym]
    // 30 days, 1 point / hour ≈ 720 points
    const steps = 720
    const stepMs = 3_600_000
    for (let i = steps; i >= 0; i--) {
      const drift = 1 + (Math.sin(i / 17 + sym.length) * 0.004) + (Math.random() - 0.5) * 0.01
      price = Math.max(0.01, price * drift)
      points.push({ t: now - i * stepMs, p: Math.round(price * 100) / 100 })
    }
    // Align last to current rate
    points[points.length - 1] = { t: now, p: rates[sym] }
    out[sym] = points
  }
  return out
}

export function appendPrices(history: PriceHistory, rates: CryptoRates): PriceHistory {
  const now = Date.now()
  const next = { ...history }
  for (const sym of SYMBOLS) {
    const arr = [...(next[sym] ?? [])]
    arr.push({ t: now, p: rates[sym] })
    // keep ~35 days
    const cutoff = now - 35 * 86_400_000
    next[sym] = arr.filter((p) => p.t >= cutoff)
  }
  return next
}

export function sliceHistory(history: PricePoint[], tf: Timeframe): PricePoint[] {
  const ms = TIMEFRAMES.find((t) => t.id === tf)!.ms
  const from = Date.now() - ms
  const sliced = history.filter((p) => p.t >= from)
  return sliced.length >= 2 ? sliced : history.slice(-24)
}

export function pctChange(history: PricePoint[], tf: Timeframe): number {
  const sliced = sliceHistory(history, tf)
  if (sliced.length < 2) return 0
  const first = sliced[0]!.p
  const last = sliced[sliced.length - 1]!.p
  if (first === 0) return 0
  return ((last - first) / first) * 100
}
