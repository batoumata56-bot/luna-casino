import type { AvatarPreset, BannerPreset, CryptoRates, GameId, GameMeta, Player } from '../types'
import { ALL_GAME_IDS } from '../types'
import { emptyGameStats, emptyPeriod, emptyPlayerStats, dailyKey, monthlyKey, weeklyKey } from './format'
import { bannerCss, COSMETICS, STARTER_OWNED } from './cosmetics'

const GAME_IDS: GameId[] = ALL_GAME_IDS

export const STARTING_CASH = 10_000

export const BASE_RATES: CryptoRates = {
  LUNA: 42,
  BTC: 68_000,
  ETH: 3_450,
  SOL: 148,
}

export const GAMES: GameMeta[] = [
  { id: 'roulette', name: 'Roulette', tagline: 'Tapis complet & jetons', accent: '#ff4d9a' },
  { id: 'slots', name: 'Machines à sous', tagline: 'Rouleaux animés', accent: '#c026d3' },
  { id: 'blackjack', name: 'Blackjack', tagline: 'Double, split, BJ 3:2', accent: '#8b5cf6' },
  { id: 'dice', name: 'Dés', tagline: 'Odds justes maison', accent: '#e879f9' },
  { id: 'crash', name: 'Crash', tagline: 'Fusée & explosion', accent: '#f472b6' },
  { id: 'wheel', name: 'Roue de fortune', tagline: 'Style Rust Big Wheel', accent: '#a78bfa' },
  { id: 'baccarat', name: 'Baccarat', tagline: 'Player, Banker ou Égalité', accent: '#fb7185' },
  { id: 'plinko', name: 'Plinko', tagline: 'Laisse tomber la bille', accent: '#e879f9' },
  { id: 'mines', name: 'Mines', tagline: 'Évite les bombes, encaisse', accent: '#c084fc' },
  { id: 'poker', name: 'Vidéo Poker', tagline: 'Jacks or Better', accent: '#f472b6' },
  { id: 'holdem', name: "Poker Hold'em", tagline: 'Texas Hold’em contre des bots', accent: '#facc15' },
  { id: 'hilo', name: 'Hi-Lo', tagline: 'Plus haut ou plus bas ?', accent: '#a855f7' },
  { id: 'keno', name: 'Keno', tagline: 'Coche tes numéros chanceux', accent: '#db2777' },
]

export const BANNER_PRESETS: BannerPreset[] = COSMETICS.filter((c) => c.kind === 'banner').map((c) => ({
  id: c.id,
  name: c.name,
  css: c.value,
}))

export const AVATAR_PRESETS: AvatarPreset[] = COSMETICS.filter((c) => c.kind === 'icon').map((c) => ({
  id: c.id,
  name: c.name,
  url: c.value,
}))

const BOT_NAMES = [
  'NovaAce', 'JadeKing', 'OrbitBet', 'SilkRoll', 'MoonChip',
  'VelvetSpin', 'GoldNest', 'EchoDice', 'AstraFlush', 'NightMint',
  'QuartzHit', 'LunarEdge', 'CopperOdds', 'MistDealer', 'CrownReel',
  'Solstice', 'HarborBet', 'IvyStack', 'DriftCash', 'ZenWager',
]

function botWallet(i: number) {
  const cash = 2500 + i * 1800 + ((i * 97) % 5000)
  return {
    cash,
    crypto: {
      LUNA: (i % 5) * 12 + 3,
      BTC: i % 3 === 0 ? 0.02 + i * 0.001 : 0.005,
      ETH: (i % 4) * 0.4,
      SOL: (i % 6) * 2.5,
    },
  }
}

function botStats(i: number) {
  const d = dailyKey()
  const w = weeklyKey()
  const m = monthlyKey()
  const profitDaily = -800 + i * 220
  const wageredDaily = 2000 + i * 900
  return {
    allTime: {
      playTimeMs: (20 + i * 7) * 60_000,
      wagered: 40_000 + i * 12_000,
      profit: -2000 + i * 1500,
    },
    daily: {
      ...emptyPeriod(d),
      playTimeMs: (8 + i * 2) * 60_000,
      wagered: wageredDaily,
      profit: profitDaily,
    },
    weekly: {
      ...emptyPeriod(w),
      playTimeMs: (40 + i * 9) * 60_000,
      wagered: wageredDaily * 4,
      profit: profitDaily * 3,
    },
    monthly: {
      ...emptyPeriod(m),
      playTimeMs: (120 + i * 25) * 60_000,
      wagered: wageredDaily * 14,
      profit: profitDaily * 8,
    },
  }
}

function botGameStats(i: number) {
  const base = emptyGameStats()
  GAME_IDS.forEach((id, gi) => {
    const factor = 0.08 + ((i + gi) % 5) * 0.04
    const s = botStats(i + gi)
    const scale = (v: number) => Math.floor(v * factor)
    base[id] = {
      allTime: {
        playTimeMs: scale(s.allTime.playTimeMs),
        wagered: scale(s.allTime.wagered),
        profit: scale(s.allTime.profit),
      },
      daily: {
        ...s.daily,
        playTimeMs: scale(s.daily.playTimeMs),
        wagered: scale(s.daily.wagered),
        profit: scale(s.daily.profit),
      },
      weekly: {
        ...s.weekly,
        playTimeMs: scale(s.weekly.playTimeMs),
        wagered: scale(s.weekly.wagered),
        profit: scale(s.weekly.profit),
      },
      monthly: {
        ...s.monthly,
        playTimeMs: scale(s.monthly.playTimeMs),
        wagered: scale(s.monthly.wagered),
        profit: scale(s.monthly.profit),
      },
    }
  })
  return base
}

export function createBots(): Player[] {
  return BOT_NAMES.map((username, i) => ({
    profile: {
      id: `bot-${i}`,
      username,
      avatar: AVATAR_PRESETS[i % AVATAR_PRESETS.length]!.url,
      banner: BANNER_PRESETS[i % BANNER_PRESETS.length]!.id,
      title: '',
      cardback: 'card-classic',
      owned: [...STARTER_OWNED],
      bio: [
        'Toujours en chasse du jackpot.',
        'Joue cool, gagne fort.',
        'La chance sourit aux audacieux.',
        'Crypto le jour, roulette la nuit.',
        'Ici pour le thrill, pas pour le sommeil.',
      ][i % 5]!,
    },
    wallet: botWallet(i),
    stats: botStats(i),
    gameStats: botGameStats(i),
    createdAt: Date.now() - i * 86_400_000,
  }))
}

export function createUser(): Player {
  return {
    profile: {
      id: 'user',
      username: 'Joueur',
      avatar: AVATAR_PRESETS[0]!.url,
      banner: BANNER_PRESETS[0]!.id,
      bio: 'Nouveau sur LUNA — argent 100% fictif.',
      isUser: true,
      title: '',
      cardback: 'card-classic',
      owned: [...STARTER_OWNED],
    },
    wallet: {
      cash: STARTING_CASH,
      crypto: { LUNA: 25, BTC: 0, ETH: 0.5, SOL: 10 },
    },
    stats: emptyPlayerStats(),
    gameStats: emptyGameStats(),
    createdAt: Date.now(),
  }
}

export function resolveBanner(banner: string): string {
  return bannerCss(banner)
}
