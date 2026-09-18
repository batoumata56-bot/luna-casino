import type { GameId } from '../types'

export interface PublicProfile {
  id: string
  username: string
  avatar: string
  banner: string
  bio: string
  wealth: number
  lastSeen: number
}

export type FriendStatus = 'pending' | 'accepted'

export interface Friendship {
  id: string
  requester: string
  addressee: string
  status: FriendStatus
  createdAt: number
}

export interface ChatMessage {
  id: number
  room: string
  authorId: string
  authorName: string
  body: string
  createdAt: number
}

export type RoomStatus = 'lobby' | 'playing' | 'done'

export interface GameRoom {
  id: string
  code: string
  gameId: GameId
  hostId: string
  stake: number
  maxPlayers: number
  status: RoomStatus
  state: Record<string, unknown>
  createdAt: number
}

export interface RoomPlayer {
  roomId: string
  userId: string
  username: string
  seat: number
  chips: number
  ready: boolean
}

export interface RoomEvent {
  id: number
  roomId: string
  actorId: string | null
  actorName: string | null
  type: string
  payload: Record<string, unknown>
  createdAt: number
}

export interface GameInvite {
  id: string
  roomId: string
  fromId: string
  fromName: string
  toId: string
  gameId: GameId
  status: 'pending' | 'accepted' | 'declined'
  createdAt: number
}

export const GENERAL_ROOM = 'general'

/** Clé de conversation privée, stable quel que soit l'expéditeur. */
export function dmRoom(a: string, b: string): string {
  return `dm:${[a, b].sort().join('_')}`
}

export function otherInDm(room: string, me: string): string | null {
  if (!room.startsWith('dm:')) return null
  const [a, b] = room.slice(3).split('_')
  if (!a || !b) return null
  return a === me ? b : a
}

const ts = (v: unknown) => (v ? new Date(String(v)).getTime() : Date.now())

export function rowToProfile(row: Record<string, unknown>): PublicProfile {
  return {
    id: String(row.id),
    username: String(row.username ?? '???'),
    avatar: String(row.avatar ?? ''),
    banner: String(row.banner ?? 'velvet'),
    bio: String(row.bio ?? ''),
    wealth: Number(row.wealth ?? row.cash ?? 0),
    lastSeen: ts(row.last_seen ?? row.updated_at),
  }
}

export function rowToFriendship(row: Record<string, unknown>): Friendship {
  return {
    id: String(row.id),
    requester: String(row.requester),
    addressee: String(row.addressee),
    status: (String(row.status) as FriendStatus) ?? 'pending',
    createdAt: ts(row.created_at),
  }
}

export function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: Number(row.id),
    room: String(row.room),
    authorId: String(row.author_id),
    authorName: String(row.author_name ?? '???'),
    body: String(row.body ?? ''),
    createdAt: ts(row.created_at),
  }
}

export function rowToRoom(row: Record<string, unknown>): GameRoom {
  return {
    id: String(row.id),
    code: String(row.code),
    gameId: String(row.game_id) as GameId,
    hostId: String(row.host_id),
    stake: Number(row.stake ?? 0),
    maxPlayers: Number(row.max_players ?? 6),
    status: (String(row.status) as RoomStatus) ?? 'lobby',
    state: (row.state as Record<string, unknown>) ?? {},
    createdAt: ts(row.created_at),
  }
}

export function rowToRoomPlayer(row: Record<string, unknown>): RoomPlayer {
  return {
    roomId: String(row.room_id),
    userId: String(row.user_id),
    username: String(row.username ?? '???'),
    seat: Number(row.seat ?? 0),
    chips: Number(row.chips ?? 0),
    ready: Boolean(row.ready),
  }
}

export function rowToRoomEvent(row: Record<string, unknown>): RoomEvent {
  return {
    id: Number(row.id),
    roomId: String(row.room_id),
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorName: row.actor_name ? String(row.actor_name) : null,
    type: String(row.type),
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: ts(row.created_at),
  }
}

export function rowToInvite(row: Record<string, unknown>): GameInvite {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    fromId: String(row.from_id),
    fromName: String(row.from_name ?? '???'),
    toId: String(row.to_id),
    gameId: String(row.game_id) as GameId,
    status: (String(row.status) as GameInvite['status']) ?? 'pending',
    createdAt: ts(row.created_at),
  }
}

/** Code de table court et lisible, à partager entre amis. */
export function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 5; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

/** Couleur de jeton déterministe, pour distinguer les joueurs autour d'une table. */
const CHIP_COLORS = ['#ff4d9a', '#38bdf8', '#facc15', '#4ade80', '#c084fc', '#fb923c']

export function chipColor(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i += 1) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return CHIP_COLORS[h % CHIP_COLORS.length]!
}

export function initialsOf(name: string): string {
  return name.trim().slice(0, 2).toUpperCase()
}

export function relativeTime(t: number): string {
  const diff = Date.now() - t
  if (diff < 60_000) return "à l'instant"
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`
  return `il y a ${Math.floor(diff / 86_400_000)} j`
}

export function isOnline(lastSeen: number): boolean {
  return Date.now() - lastSeen < 2 * 60_000
}
