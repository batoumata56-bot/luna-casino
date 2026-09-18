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
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useCasino } from './CasinoContext'
import {
  rowToRoom,
  rowToRoomEvent,
  rowToRoomPlayer,
  type GameRoom,
  type RoomEvent,
  type RoomPlayer,
} from '../lib/social'

export interface RoomValue {
  room: GameRoom | null
  players: RoomPlayer[]
  events: RoomEvent[]
  me: RoomPlayer | null
  isHost: boolean
  loading: boolean
  /** Convertit des LC du portefeuille en jetons de table. */
  buyIn: (amount: number) => Promise<boolean>
  /** Reprend ses jetons et les remet au portefeuille. */
  cashOut: () => Promise<boolean>
  addChips: (delta: number) => Promise<void>
  sitAt: (seat: number) => Promise<boolean>
  leaveSeat: () => Promise<void>
  push: (type: string, payload?: Record<string, unknown>) => Promise<void>
  patchState: (patch: Record<string, unknown>) => Promise<void>
  leave: () => Promise<void>
}

const RoomContext = createContext<RoomValue | null>(null)

const EVENT_LIMIT = 40

export function RoomProvider({ roomId, children }: { roomId: string; children: ReactNode }) {
  const { userId, username } = useAuth()
  const { adjustCash, pushToast } = useCasino()
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [events, setEvents] = useState<RoomEvent[]>([])
  const [loading, setLoading] = useState(true)
  const chipsRef = useRef(0)

  const me = useMemo(
    () => players.find((p) => p.userId === userId) ?? null,
    [players, userId],
  )

  useEffect(() => {
    chipsRef.current = me?.chips ?? 0
  }, [me])

  const loadRoom = useCallback(async () => {
    if (!supabase) return
    const [{ data: r }, { data: ps }, { data: evs }] = await Promise.all([
      supabase.from('game_rooms').select('*').eq('id', roomId).maybeSingle(),
      supabase.from('room_players').select('*').eq('room_id', roomId).order('seat'),
      supabase
        .from('room_events')
        .select('*')
        .eq('room_id', roomId)
        .order('id', { ascending: false })
        .limit(EVENT_LIMIT),
    ])
    setRoom(r ? rowToRoom(r as Record<string, unknown>) : null)
    setPlayers((ps ?? []).map((p) => rowToRoomPlayer(p as Record<string, unknown>)))
    setEvents(
      (evs ?? [])
        .map((e) => rowToRoomEvent(e as Record<string, unknown>))
        .sort((a, b) => b.id - a.id),
    )
    setLoading(false)
  }, [roomId])

  // Arrivée : on charge la table. L'assise se fait via le bouton +.
  useEffect(() => {
    if (!supabase || !userId) return
    void loadRoom()
  }, [roomId, userId, loadRoom])

  // Temps réel : table, joueurs assis, actions
  useEffect(() => {
    if (!supabase) return
    const ch = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') setRoom(null)
          else setRoom(rowToRoom(payload.new as Record<string, unknown>))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        () => {
          void supabase!
            .from('room_players')
            .select('*')
            .eq('room_id', roomId)
            .order('seat')
            .then(({ data }) =>
              setPlayers((data ?? []).map((p) => rowToRoomPlayer(p as Record<string, unknown>))),
            )
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_events', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const ev = rowToRoomEvent(payload.new as Record<string, unknown>)
          setEvents((prev) => [ev, ...prev.filter((e) => e.id !== ev.id)].slice(0, EVENT_LIMIT))
        },
      )
      .subscribe()
    return () => {
      void supabase!.removeChannel(ch)
    }
  }, [roomId])

  // Repli si le realtime n'est pas actif côté projet
  useEffect(() => {
    const id = window.setInterval(() => void loadRoom(), 6000)
    return () => clearInterval(id)
  }, [loadRoom])

  const push = useCallback(
    async (type: string, payload: Record<string, unknown> = {}) => {
      if (!supabase || !userId) return
      await supabase.from('room_events').insert({
        room_id: roomId,
        actor_id: userId,
        actor_name: username ?? 'Joueur',
        type,
        payload,
      })
    },
    [roomId, userId, username],
  )

  const addChips = useCallback(
    async (delta: number) => {
      if (!supabase || !userId) return
      const next = Math.max(0, Math.round(chipsRef.current + delta))
      chipsRef.current = next
      setPlayers((prev) =>
        prev.map((p) => (p.userId === userId ? { ...p, chips: next } : p)),
      )
      await supabase
        .from('room_players')
        .update({ chips: next })
        .eq('room_id', roomId)
        .eq('user_id', userId)
    },
    [roomId, userId],
  )

  const buyIn = useCallback(
    async (amount: number) => {
      const amt = Math.floor(amount)
      if (amt <= 0) return false
      if (!adjustCash(-amt)) {
        pushToast('Pas assez de LC pour cette cave')
        return false
      }
      await addChips(amt)
      await push('buyin', { amount: amt })
      pushToast(`Cave de ${amt} jetons`)
      return true
    },
    [adjustCash, addChips, push, pushToast],
  )

  const cashOut = useCallback(async () => {
    const chips = chipsRef.current
    if (chips <= 0) return false
    adjustCash(chips)
    await addChips(-chips)
    await push('cashout', { amount: chips })
    pushToast(`${chips} jetons récupérés`)
    return true
  }, [adjustCash, addChips, push, pushToast])

  const patchState = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!supabase) return
      const next = { ...(room?.state ?? {}), ...patch }
      setRoom((prev) => (prev ? { ...prev, state: next } : prev))
      await supabase
        .from('game_rooms')
        .update({ state: next, updated_at: new Date().toISOString() })
        .eq('id', roomId)
    },
    [room?.state, roomId],
  )

  const sitAt = useCallback(
    async (seat: number) => {
      if (!supabase || !userId || !room) return false
      if (seat < 0 || seat >= room.maxPlayers) return false
      if (players.some((p) => p.seat === seat && p.userId !== userId)) {
        pushToast('Cette place est prise')
        return false
      }
      const { error } = await supabase.from('room_players').upsert({
        room_id: roomId,
        user_id: userId,
        username: username ?? 'Joueur',
        seat,
        chips: me?.chips ?? 0,
      })
      if (error) {
        pushToast('Impossible de s’asseoir')
        return false
      }
      await push('join', { detail: `s’assoit à la place ${seat + 1}` })
      await loadRoom()
      return true
    },
    [room, roomId, userId, username, players, me?.chips, pushToast, push, loadRoom],
  )

  const leaveSeat = useCallback(async () => {
    if (!supabase || !userId) return
    if (chipsRef.current > 0) {
      adjustCash(chipsRef.current)
      chipsRef.current = 0
    }
    await supabase.from('room_players').delete().eq('room_id', roomId).eq('user_id', userId)
    await loadRoom()
  }, [roomId, userId, adjustCash, loadRoom])

  const leave = useCallback(async () => {
    await leaveSeat()
  }, [leaveSeat])

  const value: RoomValue = {
    room,
    players,
    events,
    me,
    isHost: Boolean(room && userId && room.hostId === userId),
    loading,
    buyIn,
    cashOut,
    addChips,
    sitAt,
    leaveSeat,
    push,
    patchState,
    leave,
  }

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

/** Renvoie `null` quand le jeu tourne en solo, hors d'un salon. */
export function useRoom(): RoomValue | null {
  return useContext(RoomContext)
}

/**
 * Diffuse une action de jeu aux autres joueurs de la table.
 * Ne fait rien en solo, ce qui permet de l'appeler sans condition depuis un jeu.
 */
export function useRoomReport() {
  const room = useContext(RoomContext)
  const push = room?.push
  return useCallback(
    (type: string, payload: Record<string, unknown> = {}) => {
      if (push) void push(type, payload)
    },
    [push],
  )
}
