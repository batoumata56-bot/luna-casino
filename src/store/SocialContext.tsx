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
import { supabase, isCloudEnabled } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { GameId } from '../types'
import {
  GENERAL_ROOM,
  dmRoom,
  makeRoomCode,
  rowToFriendship,
  rowToInvite,
  rowToMessage,
  rowToProfile,
  rowToRoom,
  type ChatMessage,
  type Friendship,
  type GameInvite,
  type GameRoom,
  type PublicProfile,
} from '../lib/social'

interface SocialValue {
  cloud: boolean
  me: string | null
  myName: string | null

  /** Tous les comptes inscrits, rafraîchis en continu. */
  directory: PublicProfile[]
  profileOf: (id: string) => PublicProfile | undefined

  friends: PublicProfile[]
  incoming: { friendship: Friendship; profile: PublicProfile }[]
  outgoing: { friendship: Friendship; profile: PublicProfile }[]
  isFriend: (id: string) => boolean
  relationWith: (id: string) => 'none' | 'friend' | 'sent' | 'received'
  addFriend: (id: string) => Promise<string | null>
  acceptFriend: (friendshipId: string) => Promise<void>
  removeFriend: (otherId: string) => Promise<void>

  general: ChatMessage[]
  dmMessages: ChatMessage[]
  activeDm: string | null
  openDm: (friendId: string | null) => void
  sendChat: (body: string, toFriendId?: string | null) => Promise<boolean>
  unreadDm: Record<string, number>
  totalUnread: number

  invites: GameInvite[]
  createRoom: (gameId: GameId, stake: number, maxPlayers?: number) => Promise<GameRoom | null>
  invite: (roomId: string, friendId: string, gameId: GameId) => Promise<void>
  acceptInvite: (inv: GameInvite) => Promise<string | null>
  declineInvite: (id: string) => Promise<void>
  joinRoomByCode: (code: string) => Promise<string | null>
  lobbies: GameRoom[]
  refreshLobbies: () => Promise<void>
}

const SocialContext = createContext<SocialValue | null>(null)

const MSG_LIMIT = 120

function socialError(message: string | undefined): string {
  const m = message ?? ''
  if (
    m.includes('schema cache') ||
    m.includes('Could not find the table') ||
    m.includes('does not exist') ||
    m.includes('PGRST')
  ) {
    return 'Tables sociales absentes. Colle tout supabase/schema.sql dans Supabase → SQL Editor → Run.'
  }
  return m || 'Action impossible'
}

function sortMsgs(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => a.id - b.id).slice(-MSG_LIMIT)
}

function mergeMsg(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  if (list.some((m) => m.id === msg.id)) return list
  return sortMsgs([...list, msg])
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const { userId, username, ready } = useAuth()
  const [directory, setDirectory] = useState<PublicProfile[]>([])
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [general, setGeneral] = useState<ChatMessage[]>([])
  const [dmMessages, setDmMessages] = useState<ChatMessage[]>([])
  const [activeDm, setActiveDm] = useState<string | null>(null)
  const [invites, setInvites] = useState<GameInvite[]>([])
  const [unreadDm, setUnreadDm] = useState<Record<string, number>>({})
  const [lobbies, setLobbies] = useState<GameRoom[]>([])
  const activeDmRef = useRef<string | null>(null)

  useEffect(() => {
    activeDmRef.current = activeDm
  }, [activeDm])

  // ---------------------------------------------------------------- annuaire
  const loadDirectory = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(300)
    if (data) setDirectory(data.map((r) => rowToProfile(r as Record<string, unknown>)))
  }, [])

  useEffect(() => {
    if (!ready || !userId) return
    void loadDirectory()
    const id = window.setInterval(() => void loadDirectory(), 25_000)
    return () => clearInterval(id)
  }, [ready, userId, loadDirectory])

  // Battement de présence pour savoir qui est en ligne
  useEffect(() => {
    if (!supabase || !userId) return
    const beat = () => {
      void supabase!.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId)
    }
    beat()
    const id = window.setInterval(beat, 60_000)
    return () => clearInterval(id)
  }, [userId])

  // ------------------------------------------------------------------- amis
  const loadFriendships = useCallback(async () => {
    if (!supabase || !userId) return
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester.eq.${userId},addressee.eq.${userId}`)
    if (data) setFriendships(data.map((r) => rowToFriendship(r as Record<string, unknown>)))
  }, [userId])

  const loadInvites = useCallback(async () => {
    if (!supabase || !userId) return
    const { data } = await supabase
      .from('game_invites')
      .select('*')
      .eq('to_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setInvites(data.map((r) => rowToInvite(r as Record<string, unknown>)))
  }, [userId])

  const refreshLobbies = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('status', 'lobby')
      .order('created_at', { ascending: false })
      .limit(40)
    if (data) setLobbies(data.map((r) => rowToRoom(r as Record<string, unknown>)))
  }, [])

  useEffect(() => {
    if (!ready || !userId) {
      setFriendships([])
      setInvites([])
      return
    }
    void loadFriendships()
    void loadInvites()
    void refreshLobbies()
  }, [ready, userId, loadFriendships, loadInvites, refreshLobbies])

  // Temps réel : relations + invitations
  useEffect(() => {
    if (!supabase || !userId) return
    const ch = supabase
      .channel(`social-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        void loadFriendships()
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_invites', filter: `to_id=eq.${userId}` },
        () => {
          void loadInvites()
        },
      )
      .subscribe()
    return () => {
      void supabase!.removeChannel(ch)
    }
  }, [userId, loadFriendships, loadInvites])

  // Filet de sécurité si le realtime n'est pas activé sur le projet
  useEffect(() => {
    if (!userId) return
    const id = window.setInterval(() => {
      void loadFriendships()
      void loadInvites()
      void refreshLobbies()
    }, 15_000)
    return () => clearInterval(id)
  }, [userId, loadFriendships, loadInvites, refreshLobbies])

  // --------------------------------------------------------- chat général
  useEffect(() => {
    if (!supabase || !userId) {
      setGeneral([])
      return
    }
    let cancelled = false
    const loadGeneral = async () => {
      const { data } = await supabase!
        .from('chat_messages')
        .select('*')
        .eq('room', GENERAL_ROOM)
        .order('id', { ascending: false })
        .limit(MSG_LIMIT)
      if (!cancelled && data) {
        setGeneral(sortMsgs(data.map((r) => rowToMessage(r as Record<string, unknown>))))
      }
    }
    void loadGeneral()
    const poll = window.setInterval(() => void loadGeneral(), 4000)

    const ch = supabase
      .channel('chat-general')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room=eq.${GENERAL_ROOM}` },
        (payload) => {
          setGeneral((prev) => mergeMsg(prev, rowToMessage(payload.new as Record<string, unknown>)))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      window.clearInterval(poll)
      void supabase!.removeChannel(ch)
    }
  }, [userId])

  // ------------------------------------------------------------ chat privé
  useEffect(() => {
    if (!supabase || !userId || !activeDm) {
      setDmMessages([])
      return
    }
    const room = dmRoom(userId, activeDm)
    let cancelled = false
    void (async () => {
      const { data } = await supabase!
        .from('chat_messages')
        .select('*')
        .eq('room', room)
        .order('id', { ascending: false })
        .limit(MSG_LIMIT)
      if (!cancelled && data) {
        setDmMessages(sortMsgs(data.map((r) => rowToMessage(r as Record<string, unknown>))))
      }
    })()

    const ch = supabase
      .channel(`chat-${room}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room=eq.${room}` },
        (payload) => {
          setDmMessages((prev) => mergeMsg(prev, rowToMessage(payload.new as Record<string, unknown>)))
        },
      )
      .subscribe()

    setUnreadDm((prev) => ({ ...prev, [activeDm]: 0 }))

    return () => {
      cancelled = true
      void supabase!.removeChannel(ch)
    }
  }, [userId, activeDm])

  // Notifications de DM reçus hors conversation ouverte
  useEffect(() => {
    if (!supabase || !userId) return
    const ch = supabase
      .channel(`dm-watch-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = rowToMessage(payload.new as Record<string, unknown>)
          if (!msg.room.startsWith('dm:')) return
          if (!msg.room.includes(userId)) return
          if (msg.authorId === userId) return
          if (activeDmRef.current === msg.authorId) return
          setUnreadDm((prev) => ({ ...prev, [msg.authorId]: (prev[msg.authorId] ?? 0) + 1 }))
        },
      )
      .subscribe()
    return () => {
      void supabase!.removeChannel(ch)
    }
  }, [userId])

  // ------------------------------------------------------------- dérivés
  const profileMap = useMemo(() => {
    const m = new Map<string, PublicProfile>()
    directory.forEach((p) => m.set(p.id, p))
    return m
  }, [directory])

  const profileOf = useCallback((id: string) => profileMap.get(id), [profileMap])

  const fallbackProfile = useCallback(
    (id: string): PublicProfile =>
      profileMap.get(id) ?? {
        id,
        username: 'Joueur',
        avatar: '',
        banner: 'velvet',
        bio: '',
        wealth: 0,
        lastSeen: 0,
      },
    [profileMap],
  )

  const friends = useMemo(() => {
    if (!userId) return []
    return friendships
      .filter((f) => f.status === 'accepted')
      .map((f) => fallbackProfile(f.requester === userId ? f.addressee : f.requester))
      .sort((a, b) => a.username.localeCompare(b.username))
  }, [friendships, userId, fallbackProfile])

  const incoming = useMemo(() => {
    if (!userId) return []
    return friendships
      .filter((f) => f.status === 'pending' && f.addressee === userId)
      .map((f) => ({ friendship: f, profile: fallbackProfile(f.requester) }))
  }, [friendships, userId, fallbackProfile])

  const outgoing = useMemo(() => {
    if (!userId) return []
    return friendships
      .filter((f) => f.status === 'pending' && f.requester === userId)
      .map((f) => ({ friendship: f, profile: fallbackProfile(f.addressee) }))
  }, [friendships, userId, fallbackProfile])

  const relationWith = useCallback(
    (id: string): 'none' | 'friend' | 'sent' | 'received' => {
      if (!userId) return 'none'
      const f = friendships.find(
        (r) =>
          (r.requester === userId && r.addressee === id) ||
          (r.addressee === userId && r.requester === id),
      )
      if (!f) return 'none'
      if (f.status === 'accepted') return 'friend'
      return f.requester === userId ? 'sent' : 'received'
    },
    [friendships, userId],
  )

  const isFriend = useCallback((id: string) => relationWith(id) === 'friend', [relationWith])

  // ------------------------------------------------------------- actions
  const addFriend = useCallback(
    async (id: string) => {
      if (!supabase || !userId) return 'Connecte-toi pour ajouter des amis'
      if (id === userId) return 'Tu ne peux pas t’ajouter toi-même'
      const existing = relationWith(id)
      if (existing === 'friend') return 'Vous êtes déjà amis'
      if (existing === 'sent') return 'Demande déjà envoyée'
      if (existing === 'received') {
        const f = friendships.find((r) => r.requester === id && r.addressee === userId)
        if (f) {
          await supabase.from('friendships').update({ status: 'accepted' }).eq('id', f.id)
          await loadFriendships()
          return null
        }
      }
      const { error } = await supabase
        .from('friendships')
        .insert({ requester: userId, addressee: id, status: 'pending' })
      await loadFriendships()
      return error ? socialError(error.message) : null
    },
    [userId, relationWith, friendships, loadFriendships],
  )

  const acceptFriend = useCallback(
    async (friendshipId: string) => {
      if (!supabase) return
      await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
      await loadFriendships()
    },
    [loadFriendships],
  )

  const removeFriend = useCallback(
    async (otherId: string) => {
      if (!supabase || !userId) return
      const f = friendships.find(
        (r) =>
          (r.requester === userId && r.addressee === otherId) ||
          (r.addressee === userId && r.requester === otherId),
      )
      if (!f) return
      await supabase.from('friendships').delete().eq('id', f.id)
      await loadFriendships()
    },
    [userId, friendships, loadFriendships],
  )

  const openDm = useCallback((friendId: string | null) => {
    setActiveDm(friendId)
    if (friendId) setUnreadDm((prev) => ({ ...prev, [friendId]: 0 }))
  }, [])

  const sendChat = useCallback(
    async (body: string, toFriendId?: string | null) => {
      const text = body.trim().slice(0, 400)
      if (!supabase || !userId || !text) return false
      const room = toFriendId ? dmRoom(userId, toFriendId) : GENERAL_ROOM
      const { data, error } = await supabase.from('chat_messages').insert({
        room,
        author_id: userId,
        author_name: username ?? 'Joueur',
        body: text,
      }).select().single()
      if (error || !data) {
        return false
      }
      const msg = rowToMessage(data as Record<string, unknown>)
      if (toFriendId) setDmMessages((prev) => mergeMsg(prev, msg))
      else setGeneral((prev) => mergeMsg(prev, msg))
      return true
    },
    [userId, username],
  )

  const createRoom = useCallback(
    async (gameId: GameId, stake: number, maxPlayers = 6) => {
      if (!supabase || !userId) return null
      const seats = Math.max(2, Math.min(6, Math.floor(maxPlayers)))
      const { data, error } = await supabase
        .from('game_rooms')
        .insert({
          code: makeRoomCode(),
          game_id: gameId,
          host_id: userId,
          stake,
          max_players: seats,
          status: 'lobby',
        })
        .select()
        .single()
      if (error || !data) return null
      const room = rowToRoom(data as Record<string, unknown>)
      await supabase.from('room_players').insert({
        room_id: room.id,
        user_id: userId,
        username: username ?? 'Joueur',
        seat: 0,
        chips: 0,
      })
      await refreshLobbies()
      return room
    },
    [userId, username, refreshLobbies],
  )

  const invite = useCallback(
    async (roomId: string, friendId: string, gameId: GameId) => {
      if (!supabase || !userId) return
      await supabase.from('game_invites').insert({
        room_id: roomId,
        from_id: userId,
        from_name: username ?? 'Joueur',
        to_id: friendId,
        game_id: gameId,
        status: 'pending',
      })
    },
    [userId, username],
  )

  const joinRoom = useCallback(async (roomId: string) => {
    return roomId
  }, [])

  const acceptInvite = useCallback(
    async (inv: GameInvite) => {
      if (!supabase) return null
      await supabase.from('game_invites').update({ status: 'accepted' }).eq('id', inv.id)
      setInvites((prev) => prev.filter((i) => i.id !== inv.id))
      return joinRoom(inv.roomId)
    },
    [joinRoom],
  )

  const declineInvite = useCallback(async (id: string) => {
    if (!supabase) return
    await supabase.from('game_invites').update({ status: 'declined' }).eq('id', id)
    setInvites((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const joinRoomByCode = useCallback(
    async (code: string) => {
      if (!supabase) return null
      const { data } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .maybeSingle()
      if (!data) return null
      return joinRoom(String((data as { id: string }).id))
    },
    [joinRoom],
  )

  const totalUnread = useMemo(
    () => Object.values(unreadDm).reduce((a, b) => a + b, 0),
    [unreadDm],
  )

  const value: SocialValue = {
    cloud: isCloudEnabled,
    me: userId,
    myName: username,
    directory,
    profileOf,
    friends,
    incoming,
    outgoing,
    isFriend,
    relationWith,
    addFriend,
    acceptFriend,
    removeFriend,
    general,
    dmMessages,
    activeDm,
    openDm,
    sendChat,
    unreadDm,
    totalUnread,
    invites,
    createRoom,
    invite,
    acceptInvite,
    declineInvite,
    joinRoomByCode,
    lobbies,
    refreshLobbies,
  }

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}

export function useSocial() {
  const ctx = useContext(SocialContext)
  if (!ctx) throw new Error('useSocial must be used within SocialProvider')
  return ctx
}
