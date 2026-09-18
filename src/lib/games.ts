/** Shared game math — house edges intentional. */

export const CHIP_VALUES = [10, 25, 50, 100, 250, 500, 1000, 10_000] as const
export type ChipValue = (typeof CHIP_VALUES)[number]

/** European wheel pocket order (clockwise from 0 under the pointer at rest). */
export const EUROPEAN_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31,
  9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const

export function europeanRoulette(): number {
  return EUROPEAN_ORDER[Math.floor(Math.random() * EUROPEAN_ORDER.length)]!
}

/** Absolute rotation delta so pocket `idx` centers under the top pointer. */
export function spinDeltaToIndex(prevAngle: number, idx: number, count: number, spins = 5): number {
  const seg = 360 / count
  // Numbers sit at segment centers: (idx + 0.5) * seg
  const targetMod = (((-(idx + 0.5) * seg) % 360) + 360) % 360
  const prevMod = ((prevAngle % 360) + 360) % 360
  let delta = targetMod - prevMod
  if (delta <= 0) delta += 360
  return delta + spins * 360
}

export function rouletteColor(n: number): 'green' | 'red' | 'black' {
  if (n === 0) return 'green'
  const reds = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
  return reds.has(n) ? 'red' : 'black'
}

export type RouletteBetKind =
  | { kind: 'straight'; n: number } // 35:1 → payout 36×
  | { kind: 'split'; a: number; b: number } // 17:1 → 18×
  | { kind: 'street'; row: number } // row 0 = 1-2-3 … 11 = 34-35-36 → 11:1 → 12×
  | { kind: 'corner'; nums: [number, number, number, number] } // 8:1 → 9×
  | { kind: 'dozen'; d: 1 | 2 | 3 }
  | { kind: 'column'; c: 1 | 2 | 3 } // c1 = 1,4,7… c2 = 2,5,8… c3 = 3,6,9…
  | { kind: 'lowhigh'; side: 'low' | 'high' }
  | { kind: 'parity'; parity: 'even' | 'odd' }
  | { kind: 'color'; color: 'red' | 'black' }

export function roulettePayoutMult(bet: RouletteBetKind): number {
  switch (bet.kind) {
    case 'straight':
      return 36
    case 'split':
      return 18
    case 'street':
      return 12
    case 'corner':
      return 9
    case 'dozen':
    case 'column':
      return 3
    case 'lowhigh':
    case 'parity':
    case 'color':
      return 2
  }
}

export function rouletteWins(bet: RouletteBetKind, result: number): boolean {
  if (result === 0) {
    return bet.kind === 'straight' && bet.n === 0
  }
  switch (bet.kind) {
    case 'straight':
      return bet.n === result
    case 'split':
      return bet.a === result || bet.b === result
    case 'street': {
      const base = bet.row * 3 + 1
      return result === base || result === base + 1 || result === base + 2
    }
    case 'corner':
      return bet.nums.includes(result)
    case 'dozen':
      return result >= (bet.d - 1) * 12 + 1 && result <= bet.d * 12
    case 'column':
      return result % 3 === (bet.c === 3 ? 0 : bet.c)
    case 'lowhigh':
      return bet.side === 'low' ? result <= 18 : result >= 19
    case 'parity': {
      const even = result % 2 === 0
      return bet.parity === 'even' ? even : !even
    }
    case 'color':
      return rouletteColor(result) === bet.color
  }
}

export function betKey(bet: RouletteBetKind): string {
  switch (bet.kind) {
    case 'straight':
      return `s-${bet.n}`
    case 'split':
      return `sp-${Math.min(bet.a, bet.b)}-${Math.max(bet.a, bet.b)}`
    case 'street':
      return `st-${bet.row}`
    case 'corner':
      return `c-${bet.nums.slice().sort((a, b) => a - b).join('-')}`
    case 'dozen':
      return `d-${bet.d}`
    case 'column':
      return `col-${bet.c}`
    case 'lowhigh':
      return `lh-${bet.side}`
    case 'parity':
      return `p-${bet.parity}`
    case 'color':
      return `cl-${bet.color}`
  }
}

/** Cases du tapis qui gagnent naturellement pour un numéro (plein, ligne, colonne, etc.). */
export function boardWinIds(result: number): string[] {
  const ids = [`s-${result}`]
  if (result === 0) return ids
  const row = Math.floor((result - 1) / 3)
  ids.push(`st-${row}`)
  const col = (result % 3 === 0 ? 3 : result % 3) as 1 | 2 | 3
  ids.push(`col-${col}`)
  ids.push(`d-${result <= 12 ? 1 : result <= 24 ? 2 : 3}`)
  ids.push(result <= 18 ? 'lh-low' : 'lh-high')
  ids.push(result % 2 === 0 ? 'p-even' : 'p-odd')
  ids.push(rouletteColor(result) === 'red' ? 'cl-red' : 'cl-black')
  return ids
}

export const SLOT_SYMBOLS = ['🌙', '💎', '7️⃣', '🍀', '⭐', '🔔', '🍒', '🍇'] as const
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number]

export function pickSlot(): SlotSymbol {
  return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]!
}

export function tripleMult(sym: SlotSymbol): number {
  if (sym === '7️⃣') return 25
  if (sym === '💎') return 15
  if (sym === '🌙') return 12
  return 8
}

export function slotsMultiplier(reels: [SlotSymbol, SlotSymbol, SlotSymbol]): number {
  const [a, b, c] = reels
  if (a === b && b === c) return tripleMult(a)
  if (a === b || b === c || a === c) return 2
  return 0
}

export function slotsPayout(stake: number, reels: [SlotSymbol, SlotSymbol, SlotSymbol]): number {
  return Math.floor(stake * slotsMultiplier(reels))
}

export type Card = { id: string; rank: number; suit: string; label: string }

const SUITS = ['♠', '♥', '♦', '♣']
let cardSeq = 0

export function drawCard(): Card {
  const rank = Math.floor(Math.random() * 13) + 1
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)]!
  const label =
    rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank)
  cardSeq += 1
  return { id: `c${cardSeq}-${rank}${suit}`, rank, suit, label }
}

export function cardPoints(rank: number): number {
  if (rank === 1) return 11
  if (rank >= 10) return 10
  return rank
}

export function handValue(cards: Card[]): number {
  let total = 0
  let aces = 0
  for (const c of cards) {
    if (c.rank === 1) {
      aces += 1
      total += 11
    } else if (c.rank >= 10) {
      total += 10
    } else {
      total += c.rank
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }
  return total
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards) === 21
}

export function canSplit(cards: Card[]): boolean {
  return cards.length === 2 && cardPoints(cards[0]!.rank) === cardPoints(cards[1]!.rank)
}

export function rollDice(): number {
  return Math.floor(Math.random() * 100) + 1
}

/** House edge ~7%: 75% chance → ~1.24× */
export function diceMultiplier(winChance: number): number {
  const p = Math.max(0.01, Math.min(0.95, winChance))
  return Math.floor((0.93 / p) * 100) / 100
}

/**
 * Crash house edge ~8%. Instant bust ~8%. Cap 12×.
 */
export function generateCrashPoint(): number {
  const e = Math.random()
  if (e < 0.08) return 1
  const crash = Math.floor((100 * 0.92) / (1 - e)) / 100
  return Math.max(1.01, Math.min(12, crash))
}

/** Rust Big Wheel — 25 segments. Payouts include stake. */
export const RUST_WHEEL = [
  20, 1, 3, 1, 5, 1, 3, 1, 10, 1, 3, 1, 5, 1, 3, 1, 10, 1, 3, 1, 5, 1, 3, 1, 5,
] as const

export type WheelSpot = 1 | 3 | 5 | 10 | 20

export const WHEEL_PAYOUT: Record<WheelSpot, number> = {
  1: 2,
  3: 4,
  5: 6,
  10: 11,
  20: 21,
}

export const WHEEL_COLORS: Record<WheelSpot, string> = {
  1: '#e8c84a',
  3: '#3ecf6e',
  5: '#4aa3ff',
  10: '#c44dff',
  20: '#ff6a3d',
}

export function spinRustWheel(): number {
  return Math.floor(Math.random() * RUST_WHEEL.length)
}

/** Baccarat: face cards / 10 = 0. */
export function baccaratCardPoints(rank: number): number {
  if (rank >= 10) return 0
  return rank
}

export function baccaratHandValue(cards: Card[]): number {
  return cards.reduce((s, c) => s + baccaratCardPoints(c.rank), 0) % 10
}

/** Simplified third-card rules (standard). */
export function baccaratDeal(): { player: Card[]; banker: Card[] } {
  const player = [drawCard(), drawCard()]
  const banker = [drawCard(), drawCard()]
  let p = baccaratHandValue(player)
  let b = baccaratHandValue(banker)
  if (p >= 8 || b >= 8) return { player, banker } // natural

  let playerThird: Card | null = null
  if (p <= 5) {
    playerThird = drawCard()
    player.push(playerThird)
    p = baccaratHandValue(player)
  }

  if (playerThird === null) {
    if (b <= 5) banker.push(drawCard())
  } else {
    const pt = baccaratCardPoints(playerThird.rank)
    if (b <= 2) banker.push(drawCard())
    else if (b === 3 && pt !== 8) banker.push(drawCard())
    else if (b === 4 && pt >= 2 && pt <= 7) banker.push(drawCard())
    else if (b === 5 && pt >= 4 && pt <= 7) banker.push(drawCard())
    else if (b === 6 && (pt === 6 || pt === 7)) banker.push(drawCard())
  }
  return { player, banker }
}

export type PokerHand =
  | 'royal'
  | 'straightFlush'
  | 'four'
  | 'fullHouse'
  | 'flush'
  | 'straight'
  | 'three'
  | 'twoPair'
  | 'jacks'
  | 'nothing'

export const POKER_PAY: Record<PokerHand, number> = {
  royal: 800,
  straightFlush: 50,
  four: 25,
  fullHouse: 9,
  flush: 6,
  straight: 4,
  three: 3,
  twoPair: 2,
  jacks: 1,
  nothing: 0,
}

export function evaluatePoker(cards: Card[]): PokerHand {
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b)
  const suits = cards.map((c) => c.suit)
  const flush = suits.every((s) => s === suits[0])
  const counts = new Map<number, number>()
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1)
  const vals = [...counts.values()].sort((a, b) => b - a)
  const uniq = [...counts.keys()].sort((a, b) => a - b)

  const isStraight = (() => {
    if (uniq.length !== 5) return false
    if (uniq[4]! - uniq[0]! === 4) return true
    // A-2-3-4-5
    if (uniq.join() === '1,2,3,4,5') return true
    // 10-J-Q-K-A
    if (uniq.join() === '1,10,11,12,13') return true
    return false
  })()

  const royal =
    flush &&
    uniq.includes(1) &&
    uniq.includes(10) &&
    uniq.includes(11) &&
    uniq.includes(12) &&
    uniq.includes(13)

  if (royal) return 'royal'
  if (flush && isStraight) return 'straightFlush'
  if (vals[0] === 4) return 'four'
  if (vals[0] === 3 && vals[1] === 2) return 'fullHouse'
  if (flush) return 'flush'
  if (isStraight) return 'straight'
  if (vals[0] === 3) return 'three'
  if (vals[0] === 2 && vals[1] === 2) return 'twoPair'
  if (vals[0] === 2) {
    for (const [r, c] of counts) {
      if (c === 2 && (r >= 11 || r === 1)) return 'jacks'
    }
  }
  return 'nothing'
}

export const PLINKO_MULTS = {
  // 9 cases, binomiale n=8 — RTP ~98–99 % (un peu généreux, edge légère)
  // probs ≈ [1,8,28,56,70,56,28,8,1]/256
  low: [3.2, 1.5, 1.2, 1.08, 0.58, 1.08, 1.2, 1.5, 3.2],
  medium: [9.5, 2.9, 1.3, 0.72, 0.48, 0.72, 1.3, 2.9, 9.5],
  high: [22, 4, 1.4, 0.4, 0.25, 0.4, 1.4, 4, 22],
} as const

export type PlinkoRisk = keyof typeof PLINKO_MULTS

/** Simulate Plinko path: rows of pegs, return final slot index. */
export function plinkoDrop(rows: number, slots: number): { path: number[]; slot: number } {
  let pos = (slots - 1) / 2
  const path = [pos]
  for (let r = 0; r < rows; r++) {
    pos += Math.random() < 0.5 ? -0.5 : 0.5
    pos = Math.max(0, Math.min(slots - 1, pos))
    path.push(pos)
  }
  const slot = Math.min(slots - 1, Math.max(0, Math.round(pos)))
  return { path, slot }
}

export function minesMultiplier(revealed: number, mines: number, total = 25): number {
  if (revealed <= 0) return 1
  let mult = 1
  for (let i = 0; i < revealed; i++) {
    const safeLeft = total - mines - i
    const tilesLeft = total - i
    mult *= (tilesLeft / safeLeft) * 0.97
  }
  return Math.floor(mult * 100) / 100
}

export function kenoPayout(picks: number, hits: number): number {
  // Simplified keno table (includes stake)
  const table: Record<number, Record<number, number>> = {
    1: { 1: 3 },
    2: { 2: 10 },
    3: { 2: 2, 3: 40 },
    4: { 2: 1, 3: 5, 4: 80 },
    5: { 3: 3, 4: 15, 5: 150 },
    6: { 3: 2, 4: 8, 5: 50, 6: 400 },
    7: { 4: 4, 5: 20, 6: 80, 7: 800 },
    8: { 4: 3, 5: 10, 6: 40, 7: 200, 8: 1500 },
    9: { 5: 5, 6: 20, 7: 80, 8: 400, 9: 2500 },
    10: { 5: 3, 6: 10, 7: 40, 8: 150, 9: 800, 10: 5000 },
  }
  return table[picks]?.[hits] ?? 0
}

