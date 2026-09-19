export type Period = 'daily' | 'weekly' | 'monthly'
export type LeaderMetric = 'wealth' | 'wagered' | 'profit' | 'playTime'

export interface PeriodStats {
  playTimeMs: number
  wagered: number
  profit: number
  periodKey: string
}

export interface PlayerStats {
  allTime: Omit<PeriodStats, 'periodKey'>
  daily: PeriodStats
  weekly: PeriodStats
  monthly: PeriodStats
}

export interface CryptoBalances {
  LUNA: number
  BTC: number
  ETH: number
  SOL: number
}

export type CryptoSymbol = keyof CryptoBalances

export interface Wallet {
  cash: number
  crypto: CryptoBalances
}

/** Snapshot des cours au dernier achat — sert au P&L « depuis le dernier dépôt ». */
export interface CryptoLastBuy {
  at: number
  symbol: CryptoSymbol
  spentLc: number
  rates: CryptoRates
}

export interface Profile {
  id: string
  username: string
  avatar: string
  banner: string
  bio: string
  isUser?: boolean
  title: string
  cardback: string
  owned: string[]
}

export type GameStatsMap = Record<GameId, PlayerStats>

export interface Player {
  profile: Profile
  wallet: Wallet
  stats: PlayerStats
  /** Stats séparées par jeu (même structure que le général). */
  gameStats: GameStatsMap
  createdAt: number
  /** Dernière fois où le joueur a mis du cash en crypto. */
  cryptoLastBuy?: CryptoLastBuy
}

export interface CryptoRates {
  LUNA: number
  BTC: number
  ETH: number
  SOL: number
}

export interface BannerPreset {
  id: string
  name: string
  css: string
}

export interface AvatarPreset {
  id: string
  name: string
  url: string
}

export interface BetResult {
  won: boolean
  payout: number
  stake: number
  message: string
}

export type GameId =
  | 'roulette'
  | 'slots'
  | 'blackjack'
  | 'dice'
  | 'crash'
  | 'wheel'
  | 'baccarat'
  | 'plinko'
  | 'mines'
  | 'poker'
  | 'holdem'
  | 'hilo'
  | 'keno'

export const ALL_GAME_IDS: GameId[] = [
  'roulette',
  'slots',
  'blackjack',
  'dice',
  'crash',
  'wheel',
  'baccarat',
  'plinko',
  'mines',
  'poker',
  'holdem',
  'hilo',
  'keno',
]

/** Jeux jouables à plusieurs (amis / invitations). */
export const MULTIPLAYER_GAME_IDS: GameId[] = [
  'blackjack',
  'holdem',
  'crash',
  'roulette',
  'wheel',
]

export interface GameMeta {
  id: GameId
  name: string
  tagline: string
  accent: string
}
