import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { BASE_RATES, createUser } from '../lib/constants'
import { STARTER_OWNED } from '../lib/cosmetics'
import { ensurePeriods, wealthOf } from '../lib/format'
import { isCloudEnabled, pseudoEmail, supabase } from '../lib/supabase'
import type { Player } from '../types'

type AuthState = {
  ready: boolean
  cloud: boolean
  userId: string | null
  username: string | null
  error: string | null
  register: (username: string, password: string) => Promise<boolean>
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  loadCloudPlayer: () => Promise<Player | null>
  saveCloudPlayer: (player: Player) => Promise<void>
  listCloudPlayers: () => Promise<Player[]>
}

const AuthContext = createContext<AuthState | null>(null)

function rowToPlayer(row: Record<string, unknown>, selfId?: string | null): Player {
  const base = createUser()
  return ensurePeriods({
    ...base,
    profile: {
      id: String(row.id),
      username: String(row.username),
      avatar: String(row.avatar || base.profile.avatar),
      banner: String(row.banner || base.profile.banner),
      bio: String(row.bio || ''),
      isUser: selfId ? String(row.id) === selfId : false,
      title: String(row.title ?? ''),
      cardback: String(row.cardback ?? 'card-classic'),
      owned: Array.isArray(row.owned) ? (row.owned as string[]) : [...STARTER_OWNED],
    },
    wallet: {
      cash: Number(row.cash),
      crypto: (row.crypto as Player['wallet']['crypto']) ?? base.wallet.crypto,
    },
    stats: (row.stats as Player['stats']) ?? base.stats,
    gameStats: (row.game_stats as Player['gameStats']) ?? base.gameStats,
    createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
    cryptoLastBuy: (row.stats as Player['stats'] & { cryptoLastBuy?: Player['cryptoLastBuy'] })
      ?.cryptoLastBuy,
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      setUserId(u?.id ?? null)
      setUsername((u?.user_metadata?.username as string) ?? null)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null)
      setUsername((session?.user?.user_metadata?.username as string) ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const register = useCallback(async (rawUser: string, password: string) => {
    setError(null)
    if (!supabase) {
      setError('Cloud non configuré — ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY')
      return false
    }
    const username = rawUser.trim()
    if (username.length < 3 || username.length > 20) {
      setError('Pseudo : 3 à 20 caractères')
      return false
    }
    if (password.length < 6) {
      setError('Mot de passe : 6 caractères minimum')
      return false
    }
    const email = pseudoEmail(username)
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (err || !data.user) {
      setError(err?.message ?? 'Inscription impossible')
      return false
    }
    const fresh = createUser()
    const baseRow = {
      id: data.user.id,
      username,
      avatar: fresh.profile.avatar,
      banner: fresh.profile.banner,
      bio: fresh.profile.bio,
      title: '',
      cardback: 'card-classic',
      owned: [...STARTER_OWNED],
      cash: fresh.wallet.cash,
      crypto: fresh.wallet.crypto,
      stats: fresh.stats,
      game_stats: fresh.gameStats,
    }
    let { error: pErr } = await supabase
      .from('profiles')
      .insert({ ...baseRow, wealth: wealthOf(fresh.wallet, BASE_RATES) })
    if (pErr) ({ error: pErr } = await supabase.from('profiles').insert(baseRow))
    if (pErr) {
      setError(pErr.message)
      return false
    }
    setUserId(data.user.id)
    setUsername(username)
    return true
  }, [])

  const login = useCallback(async (rawUser: string, password: string) => {
    setError(null)
    if (!supabase) {
      setError('Cloud non configuré')
      return false
    }
    const email = pseudoEmail(rawUser.trim())
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err || !data.user) {
      setError('Pseudo ou mot de passe incorrect')
      return false
    }
    setUserId(data.user.id)
    setUsername((data.user.user_metadata?.username as string) ?? rawUser.trim())
    return true
  }, [])

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setUserId(null)
    setUsername(null)
  }, [])

  const loadCloudPlayer = useCallback(async () => {
    if (!supabase || !userId) return null
    const { data, error: err } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (err || !data) return null
    return rowToPlayer(data as Record<string, unknown>, userId)
  }, [userId])

  const saveCloudPlayer = useCallback(
    async (player: Player) => {
      if (!supabase || !userId) return
      const now = new Date().toISOString()
      const base = {
        username: player.profile.username,
        avatar: player.profile.avatar,
        banner: player.profile.banner,
        bio: player.profile.bio,
        title: player.profile.title ?? '',
        cardback: player.profile.cardback ?? 'card-classic',
        owned: player.profile.owned ?? [...STARTER_OWNED],
        cash: player.wallet.cash,
        crypto: player.wallet.crypto,
        stats: { ...player.stats, cryptoLastBuy: player.cryptoLastBuy ?? null },
        game_stats: player.gameStats,
        updated_at: now,
      }
      const { error: err } = await supabase
        .from('profiles')
        .update({ ...base, wealth: wealthOf(player.wallet, BASE_RATES), last_seen: now })
        .eq('id', userId)
      if (err) {
        const { title: _t, cardback: _c, owned: _o, ...slim } = base
        await supabase.from('profiles').update({ ...slim, wealth: wealthOf(player.wallet, BASE_RATES) }).eq('id', userId)
      }
    },
    [userId],
  )

  const listCloudPlayers = useCallback(async () => {
    if (!supabase) return []
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200)
    if (!data) return []
    return data.map((row) => rowToPlayer(row as Record<string, unknown>, userId))
  }, [userId])

  const value = useMemo(
    () => ({
      ready,
      cloud: isCloudEnabled,
      userId,
      username,
      error,
      register,
      login,
      logout,
      loadCloudPlayer,
      saveCloudPlayer,
      listCloudPlayers,
    }),
    [
      ready,
      userId,
      username,
      error,
      register,
      login,
      logout,
      loadCloudPlayer,
      saveCloudPlayer,
      listCloudPlayers,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth within AuthProvider')
  return ctx
}
