import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { BASE_RATES, createUser } from '../lib/constants'
import { clamp, ensurePeriods, periodStats, wealthOf } from '../lib/format'
import { appendPrices, seedHistory, type PriceHistory } from '../lib/prices'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import {
  CRATES,
  applyStarterFallback,
  cosmeticOf,
  countOwned,
  iconUrl,
  isCosmeticEquipped,
  openCrateDrop,
  removeOneOwned,
  sellPrice,
  type CrateDropResult,
} from '../lib/cosmetics'
import type {
  CryptoRates,
  CryptoSymbol,
  GameId,
  LeaderMetric,
  Period,
  Player,
  PlayerStats,
  Profile,
} from '../types'

const STORAGE_KEY = 'luna-casino-v3'

/** Bonus de secours : uniquement si la fortune TOTALE (cash + crypto) est sous 5000. */
export const BONUS_AMOUNT = 5000
export const BONUS_MAX_CASH = 5000
export const BONUS_COOLDOWN_MS = 30 * 60 * 1000

interface Persisted {
  user: Player
  rates: CryptoRates
  history: PriceHistory
}

interface CasinoContextValue {
  user: Player
  rates: CryptoRates
  history: PriceHistory
  /** Joueurs du classement : uniquement des comptes réels (soi + les autres inscrits). */
  players: Player[]
  onlineCount: number
  refreshOnline: () => Promise<void>
  toast: string | null
  pushToast: (msg: string) => void
  clearToast: () => void
  updateProfile: (patch: Partial<Profile>) => void
  buyCrypto: (symbol: CryptoSymbol, cashAmount: number) => boolean
  sellCrypto: (symbol: CryptoSymbol, coinAmount: number) => boolean
  claimDailyBonus: () => boolean
  lastBonusAt: number
  bonusAvailableIn: number
  bonusEligible: boolean
  openCrate: (crateId: string) => CrateDropResult | null
  equipCosmetic: (id: string) => boolean
  sellCosmetic: (id: string) => boolean
  sendMoney: (username: string, amount: number) => Promise<string | null>
  settleBet: (stake: number, payout: number, gameId?: GameId) => boolean
  /** Transfert direct portefeuille ↔ jetons de table (hors statistiques de mise). */
  adjustCash: (delta: number) => boolean
  addPlayTime: (ms: number, gameId?: GameId) => void
  getLeaderboard: (period: Period, metric: LeaderMetric, game?: GameId | 'all') => RankedPlayer[]
  getTopWealth: (n?: number) => RankedPlayer[]
  getPlayer: (id: string) => Player | undefined
  resetAccount: () => void
}

export interface RankedPlayer {
  player: Player
  rank: number
  value: number
  wealth: number
}

const CasinoContext = createContext<CasinoContextValue | null>(null)

function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('luna-casino-v2')
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted
      const rates = parsed.rates ?? { ...BASE_RATES }
      return {
        user: ensurePeriods(parsed.user),
        rates,
        history: parsed.history?.BTC?.length ? parsed.history : seedHistory(rates),
      }
    }
  } catch {
    /* ignore */
  }
  const rates = { ...BASE_RATES }
  return {
    user: createUser(),
    rates,
    history: seedHistory(rates),
  }
}

function bumpStats(stats: PlayerStats, stake: number, profit: number, playMs = 0): PlayerStats {
  const bump = (s: typeof stats.daily) => ({
    ...s,
    wagered: s.wagered + stake,
    profit: s.profit + profit,
    playTimeMs: s.playTimeMs + playMs,
  })
  return {
    allTime: {
      playTimeMs: stats.allTime.playTimeMs + playMs,
      wagered: stats.allTime.wagered + stake,
      profit: stats.allTime.profit + profit,
    },
    daily: bump(stats.daily),
    weekly: bump(stats.weekly),
    monthly: bump(stats.monthly),
  }
}

function applyBet(player: Player, stake: number, payout: number, gameId?: GameId): Player {
  const p = ensurePeriods(player)
  const profit = payout - stake
  const next: Player = {
    ...p,
    wallet: {
      ...p.wallet,
      cash: p.wallet.cash - stake + payout,
    },
    stats: bumpStats(p.stats, stake, profit),
    gameStats: { ...p.gameStats },
  }
  if (gameId) {
    next.gameStats = {
      ...next.gameStats,
      [gameId]: bumpStats(p.gameStats[gameId], stake, profit),
    }
  }
  return next
}

function metricValue(
  player: Player,
  period: Period,
  metric: LeaderMetric,
  rates: CryptoRates,
  game: GameId | 'all' = 'all',
): number {
  if (metric === 'wealth') return wealthOf(player.wallet, rates)
  const s = periodStats(player, period, game)
  if (metric === 'wagered') return s.wagered
  if (metric === 'profit') return s.profit
  return s.playTimeMs
}

export function CasinoProvider({ children }: { children: ReactNode }) {
  const initial = useRef(loadState())
  const [user, setUser] = useState<Player>(initial.current.user)
  const [cloudOthers, setCloudOthers] = useState<Player[]>([])
  const [rates, setRates] = useState<CryptoRates>(initial.current.rates)
  const [history, setHistory] = useState<PriceHistory>(initial.current.history)
  const [toast, setToast] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [lastBonusAt, setLastBonusAt] = useState(() => {
    const v = localStorage.getItem('luna-bonus-at')
    return v ? Number(v) : 0
  })
  const { userId, ready, loadCloudPlayer, saveCloudPlayer, listCloudPlayers, username } = useAuth()
  const cloudHydrated = useRef(false)

  // Classement 100 % en ligne : plus aucun bot ne figure dans les tableaux.
  const players = useMemo(
    () => [user, ...cloudOthers.filter((p) => p.profile.id !== user.profile.id)],
    [user, cloudOthers],
  )

  // Local cache always
  useEffect(() => {
    const payload: Persisted = { user, rates, history }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [user, rates, history])

  // Horloge basse fréquence pour les compteurs de cooldown
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Load cloud account when logged in
  useEffect(() => {
    if (!ready) return
    if (!userId) {
      cloudHydrated.current = false
      setCloudOthers([])
      return
    }
    let cancelled = false
    ;(async () => {
      const remote = await loadCloudPlayer()
      if (cancelled) return
      if (remote) {
        const withName = username
          ? {
              ...remote,
              profile: { ...remote.profile, username, isUser: true },
            }
          : remote
        setUser(withName)
        setToast(`Connecté — ${withName.profile.username}`)
      }
      cloudHydrated.current = true
      const all = await listCloudPlayers()
      if (!cancelled) {
        setCloudOthers(all.filter((p) => p.profile.id !== userId))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ready, userId, loadCloudPlayer, listCloudPlayers, username])

  // Debounced cloud save
  useEffect(() => {
    if (!userId || !cloudHydrated.current) return
    const t = window.setTimeout(() => {
      void saveCloudPlayer(user)
    }, 800)
    return () => clearTimeout(t)
  }, [user, userId, saveCloudPlayer])

  useEffect(() => {
    const id = window.setInterval(() => {
      setRates((prev) => {
        const next = { ...prev }
        ;(Object.keys(next) as CryptoSymbol[]).forEach((sym) => {
          const drift = 1 + (Math.random() - 0.5) * 0.01
          next[sym] = Math.max(0.01, Math.round(next[sym] * drift * 100) / 100)
        })
        setHistory((h) => appendPrices(h, next))
        return next
      })
    }, 4000)
    return () => clearInterval(id)
  }, [])

  const refreshOnline = useCallback(async () => {
    if (!userId) return
    const all = await listCloudPlayers()
    setCloudOthers(all.filter((p) => p.profile.id !== userId))
  }, [userId, listCloudPlayers])

  // Rafraîchit la liste des comptes en ligne pour garder le classement à jour
  useEffect(() => {
    if (!userId) return
    const id = window.setInterval(() => {
      void refreshOnline()
    }, 20_000)
    return () => clearInterval(id)
  }, [userId, refreshOnline])

  const clearToast = useCallback(() => setToast(null), [])
  const pushToast = useCallback((msg: string) => setToast(msg), [])

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setUser((u) => ({
      ...u,
      profile: {
        ...u.profile,
        ...patch,
        id: u.profile.id,
        isUser: true,
      },
    }))
    setToast('Profil mis à jour')
  }, [])

  const settleBet = useCallback((stake: number, payout: number, gameId?: GameId) => {
    let ok = false
    setUser((u) => {
      const p = ensurePeriods(u)
      if (stake <= 0 || p.wallet.cash < stake) {
        ok = false
        return p
      }
      ok = true
      return applyBet(p, stake, payout, gameId)
    })
    return ok
  }, [])

  const adjustCash = useCallback((delta: number) => {
    let ok = false
    setUser((u) => {
      if (delta < 0 && u.wallet.cash + delta < 0) return u
      ok = true
      return { ...u, wallet: { ...u.wallet, cash: u.wallet.cash + delta } }
    })
    return ok
  }, [])

  const addPlayTime = useCallback((ms: number, gameId?: GameId) => {
    if (ms <= 0) return
    setUser((u) => {
      const p = ensurePeriods(u)
      let next: Player = {
        ...p,
        stats: bumpStats(p.stats, 0, 0, ms),
        gameStats: { ...p.gameStats },
      }
      if (gameId) {
        next = {
          ...next,
          gameStats: {
            ...next.gameStats,
            [gameId]: bumpStats(p.gameStats[gameId], 0, 0, ms),
          },
        }
      }
      return next
    })
  }, [])

  const buyCrypto = useCallback(
    (symbol: CryptoSymbol, cashAmount: number) => {
      let ok = false
      setUser((u) => {
        const amount = Math.floor(cashAmount)
        if (amount <= 0 || u.wallet.cash < amount) return u
        const coins = amount / rates[symbol]
        ok = true
        return {
          ...u,
          wallet: {
            cash: u.wallet.cash - amount,
            crypto: {
              ...u.wallet.crypto,
              [symbol]: u.wallet.crypto[symbol] + coins,
            },
          },
          cryptoLastBuy: {
            at: Date.now(),
            symbol,
            spentLc: amount,
            rates: { ...rates },
          },
        }
      })
      if (ok) setToast(`Achat ${symbol} effectué`)
      else setToast('Pas assez de LC pour cet achat')
      return ok
    },
    [rates],
  )

  const sellCrypto = useCallback(
    (symbol: CryptoSymbol, coinAmount: number) => {
      let ok = false
      setUser((u) => {
        if (coinAmount <= 0 || u.wallet.crypto[symbol] < coinAmount) return u
        const cash = Math.floor(coinAmount * rates[symbol])
        ok = true
        return {
          ...u,
          wallet: {
            cash: u.wallet.cash + cash,
            crypto: {
              ...u.wallet.crypto,
              [symbol]: u.wallet.crypto[symbol] - coinAmount,
            },
          },
        }
      })
      if (ok) setToast(`Vente ${symbol} effectuée`)
      return ok
    },
    [rates],
  )

  const fortune = wealthOf(user.wallet, rates)
  const bonusAvailableIn = Math.max(0, lastBonusAt + BONUS_COOLDOWN_MS - now)
  const bonusEligible = fortune < BONUS_MAX_CASH && bonusAvailableIn === 0

  const claimDailyBonus = useCallback(() => {
    const ts = Date.now()
    const total = wealthOf(user.wallet, rates)
    if (total >= BONUS_MAX_CASH) {
      setToast(`Bonus réservé aux fortunes sous ${BONUS_MAX_CASH} LC (cash + crypto)`)
      return false
    }
    if (ts - lastBonusAt < BONUS_COOLDOWN_MS) {
      const left = Math.ceil((lastBonusAt + BONUS_COOLDOWN_MS - ts) / 60_000)
      setToast(`Bonus déjà pris — encore ${left} min`)
      return false
    }
    setLastBonusAt(ts)
    localStorage.setItem('luna-bonus-at', String(ts))
    setUser((u) => ({
      ...u,
      wallet: { ...u.wallet, cash: u.wallet.cash + BONUS_AMOUNT },
    }))
    setToast(`+${BONUS_AMOUNT} LC de renflouement`)
    return true
  }, [lastBonusAt, user.wallet, rates])

  const openCrate = useCallback(
    (crateId: string): CrateDropResult | null => {
      const crate = CRATES.find((c) => c.id === crateId)
      if (!crate) return null
      if (user.wallet.cash < crate.price) {
        setToast('Pas assez de LC pour cette caisse')
        return null
      }
      const owned = user.profile.owned ?? []
      const drop = openCrateDrop(crate, owned)
      const duplicate = owned.includes(drop.id)
      const count = countOwned(owned, drop.id) + 1
      setUser((u) => ({
        ...u,
        wallet: { ...u.wallet, cash: u.wallet.cash - crate.price },
        profile: {
          ...u.profile,
          owned: [...(u.profile.owned ?? []), drop.id],
        },
      }))
      setToast(duplicate ? `${drop.name} · pile ×${count}` : `${drop.name} (${drop.rarity})`)
      return { item: drop, duplicate, count }
    },
    [user.wallet.cash, user.profile.owned],
  )

  const equipCosmetic = useCallback((id: string) => {
    const item = cosmeticOf(id)
    if (!item) return false
    setUser((u) => {
      if (!(u.profile.owned ?? []).includes(id) && !['velvet', 'fox', 'card-classic'].includes(id)) {
        return u
      }
      const profile = { ...u.profile }
      if (item.kind === 'banner') profile.banner = item.id
      if (item.kind === 'icon') {
        profile.avatar = iconUrl(item.id, u.profile.avatar)
      }
      if (item.kind === 'title') profile.title = item.value
      if (item.kind === 'card') profile.cardback = item.id
      return { ...u, profile }
    })
    setToast(`${item.name} équipé`)
    return true
  }, [])

  const sellCosmetic = useCallback(
    (id: string) => {
      const item = cosmeticOf(id)
      if (!item) return false
      const owned = user.profile.owned ?? []
      if (!owned.includes(id)) return false
      const price = sellPrice(item.rarity)
      setUser((u) => {
        const have = u.profile.owned ?? []
        if (!have.includes(id)) return u
        const nextOwned = removeOneOwned(have, id)
        let profile = { ...u.profile, owned: nextOwned }
        if (!nextOwned.includes(id) && isCosmeticEquipped(profile, item)) {
          profile = applyStarterFallback(profile, item)
        }
        return {
          ...u,
          wallet: { ...u.wallet, cash: u.wallet.cash + price },
          profile,
        }
      })
      setToast(`+${price} LC · ${item.name} vendu`)
      return true
    },
    [user.profile.owned],
  )

  const sendMoney = useCallback(
    async (rawName: string, amount: number) => {
      const dest = rawName.trim()
      const amt = Math.floor(amount)
      if (!dest) return 'Indique un pseudo'
      if (amt < 1) return 'Montant invalide'
      if (user.wallet.cash < amt) return 'Fonds insuffisants'
      if (!supabase || !userId) return 'Connecte-toi pour envoyer de l’argent'
      if (username && dest.toLowerCase() === username.toLowerCase()) {
        return 'Tu ne peux pas t’envoyer de l’argent'
      }
      const { error } = await supabase.rpc('transfer_lc', { dest_username: dest, amt })
      if (error) {
        const m = error.message ?? ''
        if (m.includes('schema cache') || m.includes('function') || m.includes('does not exist')) {
          return 'Virement indisponible — relance supabase/schema.sql dans l’éditeur SQL.'
        }
        return m
      }
      setUser((u) => ({
        ...u,
        wallet: { ...u.wallet, cash: u.wallet.cash - amt },
      }))
      setToast(`Envoyé ${amt} LC à ${dest}`)
      return null
    },
    [user.wallet.cash, userId, username],
  )

  const getLeaderboard = useCallback(
    (period: Period, metric: LeaderMetric, game: GameId | 'all' = 'all'): RankedPlayer[] => {
      return players
        .map((player) => {
          const p = ensurePeriods(player)
          return {
            player: p,
            value: metricValue(p, period, metric, rates, game),
            wealth: wealthOf(p.wallet, rates),
          }
        })
        .sort((a, b) => b.value - a.value)
        .map((row, i) => ({ ...row, rank: i + 1 }))
    },
    [players, rates],
  )

  const getTopWealth = useCallback(
    (n = 3) => getLeaderboard('daily', 'wealth', 'all').slice(0, n),
    [getLeaderboard],
  )

  const getPlayer = useCallback(
    (id: string) => players.find((p) => p.profile.id === id),
    [players],
  )

  const resetAccount = useCallback(() => {
    setUser(createUser())
    setRates({ ...BASE_RATES })
    setHistory(seedHistory(BASE_RATES))
    setLastBonusAt(0)
    localStorage.removeItem('luna-bonus-at')
    setToast('Compte réinitialisé')
  }, [])

  const value: CasinoContextValue = {
    user,
    rates,
    history,
    players,
    onlineCount: players.length,
    refreshOnline,
    toast,
    pushToast,
    clearToast,
    updateProfile,
    buyCrypto,
    sellCrypto,
    claimDailyBonus,
    lastBonusAt,
    bonusAvailableIn,
    bonusEligible,
    openCrate,
    equipCosmetic,
    sellCosmetic,
    sendMoney,
    settleBet,
    adjustCash,
    addPlayTime,
    getLeaderboard,
    getTopWealth,
    getPlayer,
    resetAccount,
  }

  return <CasinoContext.Provider value={value}>{children}</CasinoContext.Provider>
}

export function useCasino() {
  const ctx = useContext(CasinoContext)
  if (!ctx) throw new Error('useCasino must be used within CasinoProvider')
  return ctx
}

export function usePlayTimer(active: boolean, gameId?: GameId) {
  const { addPlayTime } = useCasino()
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => addPlayTime(1000, gameId), 1000)
    return () => clearInterval(id)
  }, [active, addPlayTime, gameId])
}

export function useStakeGuard() {
  const { user } = useCasino()
  const [stake, setStake] = useState(100)
  const setSafeStake = useCallback(
    (n: number) => setStake(clamp(Math.floor(n), 1, Math.max(1, user.wallet.cash))),
    [user.wallet.cash],
  )
  return { stake, setStake: setSafeStake, cash: user.wallet.cash }
}
