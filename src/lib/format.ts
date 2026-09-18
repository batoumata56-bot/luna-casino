import type {
  CryptoRates,
  CryptoSymbol,
  GameId,
  GameStatsMap,
  Period,
  PeriodStats,
  Player,
  PlayerStats,
  Wallet,
} from '../types'
import { ALL_GAME_IDS } from '../types'
import { STARTER_OWNED } from './cosmetics'

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(Math.floor(n))
}

export function formatCrypto(n: number, digits = 4): string {
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

export function formatSettleLine(stake: number, payout: number): string {
  const net = payout - stake
  const netStr = `${net >= 0 ? '+' : ''}${formatMoney(net)} LC`
  return `Misés ${formatMoney(stake)} LC · Retour ${formatMoney(payout)} LC · Net ${netStr}`
}

export function wealthOf(wallet: Wallet, rates: CryptoRates): number {
  let total = wallet.cash
  ;(Object.keys(wallet.crypto) as CryptoSymbol[]).forEach((sym) => {
    total += wallet.crypto[sym] * rates[sym]
  })
  return total
}

export function dailyKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function weeklyKey(d = new Date()): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${week}`
}

export function monthlyKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

export function emptyPeriod(periodKey: string): PeriodStats {
  return { playTimeMs: 0, wagered: 0, profit: 0, periodKey }
}

export function emptyPlayerStats(): PlayerStats {
  const d = dailyKey()
  const w = weeklyKey()
  const m = monthlyKey()
  return {
    allTime: { playTimeMs: 0, wagered: 0, profit: 0 },
    daily: emptyPeriod(d),
    weekly: emptyPeriod(w),
    monthly: emptyPeriod(m),
  }
}

const GAME_IDS: GameId[] = ALL_GAME_IDS

export function emptyGameStats(): GameStatsMap {
  return Object.fromEntries(GAME_IDS.map((id) => [id, emptyPlayerStats()])) as GameStatsMap
}

function ensureStatsTree(stats: PlayerStats): PlayerStats {
  const d = dailyKey()
  const w = weeklyKey()
  const m = monthlyKey()
  return {
    allTime: stats.allTime ?? { playTimeMs: 0, wagered: 0, profit: 0 },
    daily: stats.daily?.periodKey === d ? stats.daily : emptyPeriod(d),
    weekly: stats.weekly?.periodKey === w ? stats.weekly : emptyPeriod(w),
    monthly: stats.monthly?.periodKey === m ? stats.monthly : emptyPeriod(m),
  }
}

export function ensurePeriods(player: Player): Player {
  const gameStats = { ...(player.gameStats ?? emptyGameStats()) }
  for (const id of GAME_IDS) {
    gameStats[id] = ensureStatsTree(gameStats[id] ?? emptyPlayerStats())
  }
  return {
    ...player,
    profile: {
      ...player.profile,
      title: player.profile.title ?? '',
      cardback: player.profile.cardback ?? 'card-classic',
      owned: player.profile.owned?.length ? player.profile.owned : [...STARTER_OWNED],
    },
    stats: ensureStatsTree(player.stats),
    gameStats,
  }
}

export function periodStats(player: Player, period: Period, game?: GameId | 'all'): PeriodStats {
  const p = ensurePeriods(player)
  if (!game || game === 'all') {
    if (period === 'daily') return p.stats.daily
    if (period === 'weekly') return p.stats.weekly
    return p.stats.monthly
  }
  const gs = p.gameStats[game]
  if (period === 'daily') return gs.daily
  if (period === 'weekly') return gs.weekly
  return gs.monthly
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}
