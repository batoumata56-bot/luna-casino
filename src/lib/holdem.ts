/**
 * Moteur Texas Hold'em (sit & go) — pur TypeScript, aucune dépendance React.
 * Paquet réel de 52 cartes, pots annexes, évaluation des 7 cartes, bots Monte-Carlo.
 */

import type { Card } from './games'

/* ------------------------------------------------------------------ */
/* Économie du sit & go                                                */
/* ------------------------------------------------------------------ */

export const HOLDEM_RAKE = 0.016667 // ~1,67 % pour la maison

export function holdemMultiplier(players: number): number {
  return Math.round(players * (1 - HOLDEM_RAKE) * 100) / 100
}

/** Nombre de mains avant que les blinds n'augmentent de 50 %. */
export const BLIND_LEVEL_HANDS = 6

export function blindsForHand(buyIn: number, handNo: number): { sb: number; bb: number } {
  const base = Math.max(1, Math.round(buyIn / 100))
  const level = Math.max(0, Math.floor((handNo - 1) / BLIND_LEVEL_HANDS))
  const sb = Math.max(1, Math.round(base * Math.pow(1.5, level)))
  return { sb, bb: sb * 2 }
}

/* ------------------------------------------------------------------ */
/* Paquet                                                              */
/* ------------------------------------------------------------------ */

export const HOLDEM_SUITS = ['♠', '♥', '♦', '♣'] as const

const SUIT_INDEX: Record<string, number> = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 }

function labelOf(rank: number): string {
  if (rank === 1) return 'A'
  if (rank === 11) return 'J'
  if (rank === 12) return 'Q'
  if (rank === 13) return 'K'
  return String(rank)
}

let deckSeq = 0

/** Fabrique une carte isolée (utile pour les illustrations des règles). */
export function makeCard(rank: number, suit: string, tag = 'x'): Card {
  return { id: `hd-${tag}-${rank}${suit}`, rank, suit, label: labelOf(rank) }
}

/** Paquet réel de 52 cartes, identifiants uniques par paquet. */
export function makeDeck(): Card[] {
  deckSeq += 1
  const cards: Card[] = []
  for (const suit of HOLDEM_SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      cards.push({ id: `hd${deckSeq}-${rank}${suit}`, rank, suit, label: labelOf(rank) })
    }
  }
  return cards
}

/** Fisher–Yates — retourne un nouveau tableau. */
export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}

export function isRedSuit(suit: string): boolean {
  return suit === '♥' || suit === '♦'
}

/** Valeur haute d'une carte : l'As vaut 14. */
export function highValue(card: Card): number {
  return card.rank === 1 ? 14 : card.rank
}

function cardInt(c: Card): number {
  return (highValue(c) - 2) * 4 + (SUIT_INDEX[c.suit] ?? 0)
}

/* ------------------------------------------------------------------ */
/* Évaluation des mains                                                */
/* ------------------------------------------------------------------ */

export const CAT_ROYAL = 9
export const CAT_STRAIGHT_FLUSH = 8
export const CAT_QUADS = 7
export const CAT_FULL = 6
export const CAT_FLUSH = 5
export const CAT_STRAIGHT = 4
export const CAT_TRIPS = 3
export const CAT_TWO_PAIR = 2
export const CAT_PAIR = 1
export const CAT_HIGH = 0

export interface HandValue {
  /** 9 = quinte flush royale … 0 = carte haute. */
  category: number
  /** Départage lexicographique (As = 14). */
  ranks: number[]
  label: string
  /** Index de couleur pour les mains « couleur » (sinon -1). */
  suit: number
}

const RANK_FR: Record<number, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'Valet',
  12: 'Dame',
  13: 'Roi',
  14: 'As',
}

const RANK_FR_PLURAL: Record<number, string> = {
  ...RANK_FR,
  11: 'Valets',
  12: 'Dames',
  13: 'Rois',
  14: 'As',
}

function rankName(r: number): string {
  return RANK_FR[r] ?? String(r)
}

function rankPlural(r: number): string {
  return RANK_FR_PLURAL[r] ?? String(r)
}

/** « au 9 » / « à l'As » — petite coquetterie de français. */
function auRang(r: number): string {
  return r === 14 ? "à l'As" : `au ${rankName(r)}`
}

export function handLabel(v: HandValue): string {
  const [a = 0, b = 0] = v.ranks
  switch (v.category) {
    case CAT_ROYAL:
      return 'Quinte flush royale'
    case CAT_STRAIGHT_FLUSH:
      return `Quinte flush ${auRang(a)}`
    case CAT_QUADS:
      return `Carré de ${rankPlural(a)}`
    case CAT_FULL:
      return `Full aux ${rankPlural(a)} par les ${rankPlural(b)}`
    case CAT_FLUSH:
      return `Couleur ${auRang(a)}`
    case CAT_STRAIGHT:
      return `Quinte ${auRang(a)}`
    case CAT_TRIPS:
      return `Brelan de ${rankPlural(a)}`
    case CAT_TWO_PAIR:
      return `Double paire — ${rankPlural(a)} et ${rankPlural(b)}`
    case CAT_PAIR:
      return `Paire de ${rankPlural(a)}`
    default:
      return `Hauteur ${rankName(a)}`
  }
}

/** Nom court de la catégorie, du plus fort au plus faible. */
export const CATEGORY_NAMES: string[] = [
  'Carte haute',
  'Paire',
  'Double paire',
  'Brelan',
  'Quinte',
  'Couleur',
  'Full',
  'Carré',
  'Quinte flush',
  'Quinte flush royale',
]

// Tampons réutilisés : le moteur est mono-thread et coreEval n'est jamais réentrant.
const rc = new Array<number>(15).fill(0)
const sc = [0, 0, 0, 0]
const sm = [0, 0, 0, 0]

/** Hauteur de la meilleure quinte contenue dans un masque de rangs (0 si aucune). */
function straightHigh(mask: number): number {
  const mm = mask & (1 << 14) ? mask | (1 << 1) : mask
  for (let h = 14; h >= 5; h--) {
    if (((mm >> (h - 4)) & 0b11111) === 0b11111) return h
  }
  return 0
}

function coreEval(ints: number[]): { category: number; ranks: number[]; suit: number } {
  rc.fill(0)
  sc[0] = sc[1] = sc[2] = sc[3] = 0
  sm[0] = sm[1] = sm[2] = sm[3] = 0
  let mask = 0
  for (let i = 0; i < ints.length; i++) {
    const c = ints[i]!
    const r = (c >> 2) + 2
    const s = c & 3
    rc[r] = (rc[r] ?? 0) + 1
    sc[s] = (sc[s] ?? 0) + 1
    sm[s] = (sm[s] ?? 0) | (1 << r)
    mask |= 1 << r
  }

  let fs = -1
  for (let i = 0; i < 4; i++) {
    if ((sc[i] ?? 0) >= 5) {
      fs = i
      break
    }
  }

  if (fs >= 0) {
    const sh = straightHigh(sm[fs] ?? 0)
    if (sh === 14) return { category: CAT_ROYAL, ranks: [14], suit: fs }
    if (sh > 0) return { category: CAT_STRAIGHT_FLUSH, ranks: [sh], suit: fs }
  }

  const quads: number[] = []
  const trips: number[] = []
  const pairs: number[] = []
  const singles: number[] = []
  for (let r = 14; r >= 2; r--) {
    const n = rc[r] ?? 0
    if (n === 4) quads.push(r)
    else if (n === 3) trips.push(r)
    else if (n === 2) pairs.push(r)
    else if (n === 1) singles.push(r)
  }

  if (quads.length > 0) {
    const q = quads[0]!
    let kicker = 0
    for (let r = 14; r >= 2; r--) {
      if (r !== q && (rc[r] ?? 0) > 0) {
        kicker = r
        break
      }
    }
    return { category: CAT_QUADS, ranks: [q, kicker], suit: -1 }
  }

  if (trips.length > 0 && (trips.length > 1 || pairs.length > 0)) {
    const t = trips[0]!
    const pair = Math.max(trips[1] ?? 0, pairs[0] ?? 0)
    return { category: CAT_FULL, ranks: [t, pair], suit: -1 }
  }

  if (fs >= 0) {
    const top: number[] = []
    const fm = sm[fs] ?? 0
    for (let r = 14; r >= 2 && top.length < 5; r--) {
      if (fm & (1 << r)) top.push(r)
    }
    return { category: CAT_FLUSH, ranks: top, suit: fs }
  }

  const sh = straightHigh(mask)
  if (sh > 0) return { category: CAT_STRAIGHT, ranks: [sh], suit: -1 }

  if (trips.length > 0) {
    return {
      category: CAT_TRIPS,
      ranks: [trips[0]!, singles[0] ?? 0, singles[1] ?? 0],
      suit: -1,
    }
  }

  if (pairs.length >= 2) {
    const kicker = Math.max(pairs[2] ?? 0, singles[0] ?? 0)
    return { category: CAT_TWO_PAIR, ranks: [pairs[0]!, pairs[1]!, kicker], suit: -1 }
  }

  if (pairs.length === 1) {
    return {
      category: CAT_PAIR,
      ranks: [pairs[0]!, singles[0] ?? 0, singles[1] ?? 0, singles[2] ?? 0],
      suit: -1,
    }
  }

  return { category: CAT_HIGH, ranks: singles.slice(0, 5), suit: -1 }
}

/** Score entier comparable (plus grand = meilleur). */
function scoreOf(category: number, ranks: number[]): number {
  let s = category
  for (let i = 0; i < 5; i++) s = s * 15 + (ranks[i] ?? 0)
  return s
}

function evalScoreInts(ints: number[]): number {
  const core = coreEval(ints)
  return scoreOf(core.category, core.ranks)
}

/**
 * Meilleure main de 5 cartes parmi 5, 6 ou 7 cartes.
 * L'évaluation est directe (comptages + masques de rangs), ce qui équivaut à
 * énumérer les C(7,5)=21 combinaisons mais reste assez rapide pour le Monte-Carlo.
 */
export function evaluate7(cards: Card[]): HandValue {
  const core = coreEval(cards.map(cardInt))
  const value: HandValue = {
    category: core.category,
    ranks: core.ranks,
    label: '',
    suit: core.suit,
  }
  value.label = handLabel(value)
  return value
}

export function compareHands(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category
  const len = Math.max(a.ranks.length, b.ranks.length)
  for (let i = 0; i < len; i++) {
    const ra = a.ranks[i] ?? 0
    const rb = b.ranks[i] ?? 0
    if (ra !== rb) return ra - rb
  }
  return 0
}

function straightSequence(high: number): number[] {
  return high === 5 ? [5, 4, 3, 2, 14] : [high, high - 1, high - 2, high - 3, high - 4]
}

/** Sélectionne les 5 cartes qui composent réellement la main (pour la surbrillance). */
export function bestFive(cards: Card[]): { value: HandValue; five: Card[] } {
  const value = evaluate7(cards)
  const pool = cards.slice()
  const five: Card[] = []
  const suitChar = value.suit >= 0 ? HOLDEM_SUITS[value.suit] : undefined

  const take = (pred: (c: Card) => boolean, count: number) => {
    let left = count
    for (let i = 0; i < pool.length && left > 0; i++) {
      const c = pool[i]!
      if (pred(c)) {
        five.push(c)
        pool.splice(i, 1)
        i -= 1
        left -= 1
      }
    }
  }

  const [r0 = 0, r1 = 0, r2 = 0, r3 = 0] = value.ranks

  switch (value.category) {
    case CAT_ROYAL:
    case CAT_STRAIGHT_FLUSH:
      for (const r of straightSequence(r0)) {
        take((c) => highValue(c) === r && c.suit === suitChar, 1)
      }
      break
    case CAT_QUADS:
      take((c) => highValue(c) === r0, 4)
      take((c) => highValue(c) === r1, 1)
      break
    case CAT_FULL:
      take((c) => highValue(c) === r0, 3)
      take((c) => highValue(c) === r1, 2)
      break
    case CAT_FLUSH:
      for (const r of value.ranks) {
        take((c) => highValue(c) === r && c.suit === suitChar, 1)
      }
      break
    case CAT_STRAIGHT:
      for (const r of straightSequence(r0)) {
        take((c) => highValue(c) === r, 1)
      }
      break
    case CAT_TRIPS:
      take((c) => highValue(c) === r0, 3)
      take((c) => highValue(c) === r1, 1)
      take((c) => highValue(c) === r2, 1)
      break
    case CAT_TWO_PAIR:
      take((c) => highValue(c) === r0, 2)
      take((c) => highValue(c) === r1, 2)
      take((c) => highValue(c) === r2, 1)
      break
    case CAT_PAIR:
      take((c) => highValue(c) === r0, 2)
      take((c) => highValue(c) === r1, 1)
      take((c) => highValue(c) === r2, 1)
      take((c) => highValue(c) === r3, 1)
      break
    default:
      for (const r of value.ranks) take((c) => highValue(c) === r, 1)
      break
  }

  // Filet de sécurité : complète si un rang manquait (ne devrait pas arriver).
  for (let i = 0; five.length < 5 && i < pool.length; i++) five.push(pool[i]!)
  return { value, five: five.slice(0, 5) }
}

/* ------------------------------------------------------------------ */
/* Pots annexes                                                        */
/* ------------------------------------------------------------------ */

export interface Pot {
  amount: number
  /** Index des sièges pouvant remporter ce pot. */
  eligible: number[]
}

/**
 * Construit le pot principal et les pots annexes à partir des mises totales.
 * Les paliers sont triés puis découpés ; les pots successifs ayant les mêmes
 * ayants droit sont fusionnés.
 */
export function buildPots(contributions: number[], folded: boolean[]): Pot[] {
  const levels = [...new Set(contributions.filter((c) => c > 0))].sort((a, b) => a - b)
  const pots: Pot[] = []
  let prev = 0
  for (const level of levels) {
    let amount = 0
    const eligible: number[] = []
    for (let i = 0; i < contributions.length; i++) {
      const c = contributions[i] ?? 0
      amount += Math.min(c, level) - Math.min(c, prev)
      if (c >= level && !folded[i]) eligible.push(i)
    }
    prev = level
    if (amount <= 0) continue
    const last = pots[pots.length - 1]
    if (eligible.length === 0 && last) {
      last.amount += amount
      continue
    }
    if (last && sameSeats(last.eligible, eligible)) {
      last.amount += amount
      continue
    }
    pots.push({ amount, eligible })
  }
  return pots
}

function sameSeats(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/* ------------------------------------------------------------------ */
/* État d'une main                                                     */
/* ------------------------------------------------------------------ */

export type BotStyle = 'serré' | 'normal' | 'agressif'
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'

export type PlayerAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; to: number }
  | { type: 'allin' }

export interface HoldemPlayer {
  id: number
  name: string
  avatar: string
  isHuman: boolean
  style: BotStyle
  chips: number
  hole: Card[]
  /** Mise engagée sur la street en cours. */
  bet: number
  /** Mise engagée sur toute la main. */
  committed: number
  folded: boolean
  allIn: boolean
  /** Éliminé du tournoi. */
  out: boolean
  hasActed: boolean
  lastAction: string | null
}

export interface ShowdownResult {
  seat: number
  name: string
  hand: HandValue | null
  five: Card[]
  won: number
  revealed: boolean
}

export interface HandState {
  players: HoldemPlayer[]
  deck: Card[]
  board: Card[]
  street: Street
  pot: number
  currentBet: number
  minRaise: number
  /** Siège devant parler, -1 si le tour d'enchères est clos. */
  toAct: number
  dealer: number
  sb: number
  bb: number
  handNo: number
  log: string[]
  results: ShowdownResult[] | null
  pots: Pot[]
  finished: boolean
}

export const STREET_LABEL: Record<Street, string> = {
  preflop: 'Préflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Abattage',
}

const BOT_NAMES = [
  'Margaux',
  'Étienne',
  'Solène',
  'Bastien',
  'Anaïs',
  'Thibault',
  'Camille',
  'Léandre',
  'Océane',
  'Rémi',
  'Maëlys',
  'Gaspard',
]

const BOT_STYLES: BotStyle[] = ['serré', 'normal', 'agressif']

export function styleLabel(style: BotStyle): string {
  if (style === 'serré') return 'Serré'
  if (style === 'agressif') return 'Agressif'
  return 'Équilibré'
}

/** Crée la table : le héros occupe toujours le siège 0. */
export function createTable(buyIn: number, botCount: number, heroName = 'Toi'): HoldemPlayer[] {
  const n = Math.max(1, Math.min(5, Math.floor(botCount)))
  const names = shuffle(BOT_NAMES).slice(0, n)
  const hero: HoldemPlayer = blankPlayer(0, heroName, buyIn, true, 'normal')
  const bots = names.map((name, i) =>
    blankPlayer(i + 1, name, buyIn, false, BOT_STYLES[Math.floor(Math.random() * 3)] ?? 'normal'),
  )
  return [hero, ...bots]
}

function blankPlayer(
  id: number,
  name: string,
  chips: number,
  isHuman: boolean,
  style: BotStyle,
): HoldemPlayer {
  return {
    id,
    name,
    avatar: name.charAt(0).toUpperCase(),
    isHuman,
    style,
    chips,
    hole: [],
    bet: 0,
    committed: 0,
    folded: false,
    allIn: false,
    out: false,
    hasActed: false,
    lastAction: null,
  }
}

function cloneState(s: HandState): HandState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, hole: p.hole.slice() })),
    deck: s.deck.slice(),
    board: s.board.slice(),
    log: s.log.slice(),
    pots: s.pots.map((p) => ({ amount: p.amount, eligible: p.eligible.slice() })),
    results: s.results ? s.results.map((r) => ({ ...r, five: r.five.slice() })) : null,
  }
}

function pushLog(s: HandState, line: string) {
  s.log = [line, ...s.log].slice(0, 10)
}

function nextOccupied(players: HoldemPlayer[], from: number): number {
  const n = players.length
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n
    if (!players[idx]!.out) return idx
  }
  return from
}

function firstActorFrom(s: HandState, start: number): number {
  const n = s.players.length
  for (let i = 0; i < n; i++) {
    const idx = (start + i) % n
    const p = s.players[idx]!
    if (!p.out && !p.folded && !p.allIn) return idx
  }
  return -1
}

function nextActor(s: HandState, from: number): number {
  const n = s.players.length
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n
    const p = s.players[idx]!
    if (p.out || p.folded || p.allIn) continue
    if (p.hasActed && p.bet === s.currentBet) continue
    return idx
  }
  return -1
}

function commit(s: HandState, p: HoldemPlayer, requested: number) {
  const amount = Math.max(0, Math.min(requested, p.chips))
  p.chips -= amount
  p.bet += amount
  p.committed += amount
  s.pot += amount
  if (p.chips === 0) p.allIn = true
}

/** Rend la partie non suivie de la plus grosse mise (règle classique). */
function refundUncalled(s: HandState) {
  const bets = s.players.map((p) => p.bet)
  const sorted = bets.slice().sort((a, b) => b - a)
  const top = sorted[0] ?? 0
  const second = sorted[1] ?? 0
  if (top <= second) return
  const seat = bets.indexOf(top)
  const p = s.players[seat]
  if (!p) return
  const excess = top - second
  p.chips += excess
  p.bet -= excess
  p.committed -= excess
  s.pot -= excess
  if (p.chips > 0) p.allIn = false
}

/** Nouvelle main : blinds postées, cartes distribuées, premier joueur désigné. */
export function startHand(
  players: HoldemPlayer[],
  dealer: number,
  sb: number,
  bb: number,
  handNo: number,
): HandState {
  const fresh: HoldemPlayer[] = players.map((p) => ({
    ...p,
    hole: [] as Card[],
    bet: 0,
    committed: 0,
    folded: false,
    allIn: false,
    out: p.out || p.chips <= 0,
    hasActed: false,
    lastAction: null,
  }))

  const s: HandState = {
    players: fresh,
    deck: shuffle(makeDeck()),
    board: [],
    street: 'preflop',
    pot: 0,
    currentBet: 0,
    minRaise: bb,
    toAct: -1,
    dealer,
    sb,
    bb,
    handNo,
    log: [],
    results: null,
    pots: [],
    finished: false,
  }

  const seats = fresh.map((p, i) => (p.out ? -1 : i)).filter((i) => i >= 0)
  const heads = seats.length === 2

  // Distribution : deux tours, en partant du petit blind.
  const firstDeal = nextOccupied(fresh, dealer)
  for (let round = 0; round < 2; round++) {
    let seat = firstDeal
    for (let k = 0; k < seats.length; k++) {
      fresh[seat]!.hole.push(s.deck.shift()!)
      seat = nextOccupied(fresh, seat)
    }
  }

  const sbSeat = heads ? dealer : nextOccupied(fresh, dealer)
  const bbSeat = nextOccupied(fresh, sbSeat)

  commit(s, fresh[sbSeat]!, sb)
  fresh[sbSeat]!.lastAction = 'Petite blind'
  commit(s, fresh[bbSeat]!, bb)
  fresh[bbSeat]!.lastAction = 'Grosse blind'
  s.currentBet = Math.max(fresh[sbSeat]!.bet, fresh[bbSeat]!.bet)
  s.minRaise = bb

  pushLog(s, `Main ${handNo} — blinds ${sb}/${bb}.`)

  s.toAct = firstActorFrom(s, heads ? sbSeat : nextOccupied(fresh, bbSeat))
  if (s.toAct < 0) return afterAction(s)
  return s
}

export interface LegalActions {
  canFold: boolean
  canCheck: boolean
  canCall: boolean
  /** Jetons à ajouter pour suivre. */
  callAmount: number
  canRaise: boolean
  /** Montant total « relancer à ». */
  minRaiseTo: number
  maxRaiseTo: number
  canAllIn: boolean
}

export function legalActions(s: HandState): LegalActions {
  const empty: LegalActions = {
    canFold: false,
    canCheck: false,
    canCall: false,
    callAmount: 0,
    canRaise: false,
    minRaiseTo: 0,
    maxRaiseTo: 0,
    canAllIn: false,
  }
  if (s.finished || s.toAct < 0) return empty
  const p = s.players[s.toAct]
  if (!p) return empty

  const callAmount = Math.min(Math.max(0, s.currentBet - p.bet), p.chips)
  const maxRaiseTo = p.bet + p.chips
  const minRaiseTo = Math.min(maxRaiseTo, s.currentBet + s.minRaise)
  return {
    canFold: true,
    canCheck: s.currentBet <= p.bet,
    canCall: callAmount > 0,
    callAmount,
    canRaise: maxRaiseTo > s.currentBet,
    minRaiseTo,
    maxRaiseTo,
    canAllIn: p.chips > 0,
  }
}

function doRaise(s: HandState, p: HoldemPlayer, target: number) {
  const prevBet = s.currentBet
  const add = Math.min(Math.max(0, target - p.bet), p.chips)
  commit(s, p, add)
  const raised = p.bet > prevBet
  if (raised) {
    const increment = p.bet - prevBet
    s.currentBet = p.bet
    if (increment >= s.minRaise) {
      s.minRaise = increment
      for (const q of s.players) {
        if (q !== p && !q.folded && !q.out && !q.allIn) q.hasActed = false
      }
    }
  }

  if (p.allIn) {
    p.lastAction = 'Tapis'
    pushLog(s, `${p.name} fait tapis à ${p.bet}.`)
  } else if (raised && prevBet === 0) {
    p.lastAction = `Mise ${p.bet}`
    pushLog(s, `${p.name} mise ${p.bet}.`)
  } else if (raised) {
    p.lastAction = `Relance ${p.bet}`
    pushLog(s, `${p.name} relance à ${p.bet}.`)
  } else {
    p.lastAction = add > 0 ? `Suit ${add}` : 'Check'
    pushLog(s, add > 0 ? `${p.name} suit ${add}.` : `${p.name} checke.`)
  }
}

export function applyAction(state: HandState, action: PlayerAction): HandState {
  const s = cloneState(state)
  if (s.finished || s.toAct < 0) return s
  const p = s.players[s.toAct]
  if (!p) return s
  const toCall = Math.min(Math.max(0, s.currentBet - p.bet), p.chips)

  switch (action.type) {
    case 'fold': {
      if (toCall === 0) {
        p.lastAction = 'Check'
        pushLog(s, `${p.name} checke.`)
      } else {
        p.folded = true
        p.lastAction = 'Couché'
        pushLog(s, `${p.name} se couche.`)
      }
      break
    }
    case 'check': {
      if (toCall > 0) {
        commit(s, p, toCall)
        p.lastAction = p.allIn ? 'Tapis' : `Suit ${toCall}`
        pushLog(s, `${p.name} suit ${toCall}.`)
      } else {
        p.lastAction = 'Check'
        pushLog(s, `${p.name} checke.`)
      }
      break
    }
    case 'call': {
      if (toCall <= 0) {
        p.lastAction = 'Check'
        pushLog(s, `${p.name} checke.`)
      } else {
        commit(s, p, toCall)
        p.lastAction = p.allIn ? 'Tapis' : `Suit ${toCall}`
        pushLog(
          s,
          p.allIn ? `${p.name} suit ${toCall} et fait tapis.` : `${p.name} suit ${toCall}.`,
        )
      }
      break
    }
    case 'allin': {
      doRaise(s, p, p.bet + p.chips)
      break
    }
    case 'raise': {
      const maxTo = p.bet + p.chips
      const target = Math.max(Math.min(Math.floor(action.to), maxTo), s.currentBet + 1)
      doRaise(s, p, target)
      break
    }
  }

  p.hasActed = true
  return afterAction(s)
}

function roundComplete(s: HandState): boolean {
  const live = s.players.filter((p) => !p.folded && !p.out)
  if (live.length <= 1) return true
  const actors = live.filter((p) => !p.allIn)
  if (actors.length === 0) return true
  return actors.every((p) => p.hasActed && p.bet === s.currentBet)
}

function afterAction(s: HandState): HandState {
  const live = s.players.filter((p) => !p.folded && !p.out)
  if (live.length <= 1) {
    refundUncalled(s)
    return finishHand(s)
  }
  if (roundComplete(s)) {
    refundUncalled(s)
    s.toAct = -1
    return s
  }
  const next = nextActor(s, s.toAct)
  if (next < 0) {
    refundUncalled(s)
    s.toAct = -1
    return s
  }
  s.toAct = next
  return s
}

function openStreet(s: HandState): HandState {
  for (const p of s.players) {
    p.bet = 0
    p.hasActed = false
    if (!p.folded && !p.out && !p.allIn) p.lastAction = null
  }
  s.currentBet = 0
  s.minRaise = s.bb
  const live = s.players.filter((p) => !p.folded && !p.out)
  const actors = live.filter((p) => !p.allIn)
  if (live.length <= 1 || actors.length < 2) {
    s.toAct = -1
    return s
  }
  s.toAct = firstActorFrom(s, (s.dealer + 1) % s.players.length)
  return s
}

/**
 * Passe à la street suivante (à appeler quand `toAct === -1` et `!finished`).
 * Permet à l'interface de révéler le board carte par carte.
 */
export function advance(state: HandState): HandState {
  if (state.finished || state.toAct >= 0) return state
  const s = cloneState(state)
  switch (s.street) {
    case 'preflop':
      s.board.push(...s.deck.splice(0, 3))
      s.street = 'flop'
      break
    case 'flop':
      s.board.push(...s.deck.splice(0, 1))
      s.street = 'turn'
      break
    case 'turn':
      s.board.push(...s.deck.splice(0, 1))
      s.street = 'river'
      break
    case 'river':
      s.street = 'showdown'
      return finishHand(s)
    case 'showdown':
      return finishHand(s)
  }
  pushLog(s, `${STREET_LABEL[s.street]} : ${s.board.map((c) => `${c.label}${c.suit}`).join(' ')}`)
  return openStreet(s)
}

function seatOrder(seat: number, dealer: number, n: number): number {
  return (seat - dealer - 1 + n * 2) % n
}

function finishHand(s: HandState): HandState {
  const n = s.players.length
  const contributions = s.players.map((p) => p.committed)
  const foldedFlags = s.players.map((p) => p.folded || p.out)
  const pots = buildPots(contributions, foldedFlags)

  const contenders = s.players.filter((p) => !p.folded && !p.out)
  const showdown = contenders.length > 1
  const evals = new Map<number, { value: HandValue; five: Card[] }>()
  if (showdown) {
    for (const p of contenders) evals.set(p.id, bestFive([...p.hole, ...s.board]))
  }

  const wins = new Map<number, number>()
  for (const pot of pots) {
    if (pot.eligible.length === 0) continue
    let winners: number[]
    if (pot.eligible.length === 1 || !showdown) {
      winners = [pot.eligible[0]!]
    } else {
      let best: HandValue | null = null
      winners = []
      for (const seat of pot.eligible) {
        const ev = evals.get(s.players[seat]!.id)
        if (!ev) continue
        const cmp = best === null ? 1 : compareHands(ev.value, best)
        if (cmp > 0) {
          best = ev.value
          winners = [seat]
        } else if (cmp === 0) {
          winners.push(seat)
        }
      }
      if (winners.length === 0) winners = [pot.eligible[0]!]
    }
    const share = Math.floor(pot.amount / winners.length)
    let odd = pot.amount - share * winners.length
    // Jetons impairs : au premier joueur à gauche du bouton.
    const ordered = winners
      .slice()
      .sort((a, b) => seatOrder(a, s.dealer, n) - seatOrder(b, s.dealer, n))
    for (const seat of ordered) {
      let amount = share
      if (odd > 0) {
        amount += 1
        odd -= 1
      }
      wins.set(seat, (wins.get(seat) ?? 0) + amount)
    }
  }

  const results: ShowdownResult[] = []
  for (let i = 0; i < n; i++) {
    const p = s.players[i]!
    if (p.out && p.committed === 0) continue
    const won = wins.get(i) ?? 0
    p.chips += won
    const alive = !p.folded && !p.out
    if (!alive && won === 0) continue
    const ev = evals.get(p.id)
    results.push({
      seat: i,
      name: p.name,
      hand: ev ? ev.value : null,
      five: ev ? ev.five : [],
      won,
      revealed: showdown && alive,
    })
  }

  for (const r of results) {
    if (r.won > 0) {
      pushLog(
        s,
        r.hand
          ? `${r.name} remporte ${r.won} avec ${r.hand.label}.`
          : `${r.name} remporte ${r.won}.`,
      )
    }
  }

  s.results = results
  s.pots = pots
  s.finished = true
  s.toAct = -1
  for (const p of s.players) {
    if (p.chips <= 0) p.out = true
  }
  return s
}

/* ------------------------------------------------------------------ */
/* IA des bots                                                         */
/* ------------------------------------------------------------------ */

/** Force d'une main de départ, normalisée 0..1 (formule de Chen adaptée). */
export function preflopScore(hole: Card[]): number {
  const a = hole[0]
  const b = hole[1]
  if (!a || !b) return 0
  const r1 = highValue(a)
  const r2 = highValue(b)
  const hi = Math.max(r1, r2)
  const lo = Math.min(r1, r2)
  const suited = a.suit === b.suit
  const pair = r1 === r2

  const points = (r: number): number => {
    if (r === 14) return 10
    if (r === 13) return 8
    if (r === 12) return 7
    if (r === 11) return 6
    return r / 2
  }

  let v = points(hi)
  if (pair) v = Math.max(5, v * 2)
  if (suited) v += 2
  if (!pair) {
    const gap = hi - lo - 1
    if (gap === 1) v -= 1
    else if (gap === 2) v -= 2
    else if (gap === 3) v -= 4
    else if (gap >= 4) v -= 5
    if (gap <= 1 && hi < 12) v += 1
  }
  v = Math.ceil(v)
  return Math.max(0, Math.min(1, (v + 2) / 22))
}

/**
 * Équité estimée par Monte-Carlo : on complète le board et les mains adverses
 * au hasard, puis on compare. ~180 tirages suffisent et tiennent sous 40 ms.
 */
export function estimateEquity(
  hole: Card[],
  board: Card[],
  opponents: number,
  iterations = 180,
): number {
  if (hole.length < 2) return 0
  const heroInts = hole.map(cardInt)
  const boardInts = board.map(cardInt)
  const used = new Set<number>([...heroInts, ...boardInts])
  const deck: number[] = []
  for (let i = 0; i < 52; i++) if (!used.has(i)) deck.push(i)

  const missing = 5 - boardInts.length
  const need = missing + opponents * 2
  if (need > deck.length) return 0.5

  const hero = [heroInts[0]!, heroInts[1]!, 0, 0, 0, 0, 0]
  const villain = [0, 0, 0, 0, 0, 0, 0]
  let total = 0

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(Math.random() * (deck.length - i))
      const tmp = deck[i]!
      deck[i] = deck[j]!
      deck[j] = tmp
    }
    for (let i = 0; i < boardInts.length; i++) {
      hero[2 + i] = boardInts[i]!
      villain[2 + i] = boardInts[i]!
    }
    for (let i = 0; i < missing; i++) {
      hero[2 + boardInts.length + i] = deck[i]!
      villain[2 + boardInts.length + i] = deck[i]!
    }
    const heroScore = evalScoreInts(hero)
    let best = -1
    let ties = 0
    let offset = missing
    for (let o = 0; o < opponents; o++) {
      villain[0] = deck[offset]!
      villain[1] = deck[offset + 1]!
      offset += 2
      const vs = evalScoreInts(villain)
      if (vs > best) {
        best = vs
        ties = 1
      } else if (vs === best) {
        ties += 1
      }
    }
    if (heroScore > best) total += 1
    else if (heroScore === best) total += 1 / (ties + 1)
  }
  return total / iterations
}

interface StyleProfile {
  margin: number
  aggression: number
  bluff: number
}

const STYLE_PROFILE: Record<BotStyle, StyleProfile> = {
  serré: { margin: 0.07, aggression: 0.55, bluff: 0.03 },
  normal: { margin: 0.02, aggression: 0.85, bluff: 0.08 },
  agressif: { margin: -0.035, aggression: 1.25, bluff: 0.2 },
}

function sizedRaise(s: HandState, la: LegalActions, fraction: number): PlayerAction {
  const potAfterCall = s.pot + la.callAmount
  const target = s.currentBet + Math.round(potAfterCall * fraction)
  const to = Math.max(la.minRaiseTo, Math.min(la.maxRaiseTo, target))
  if (to >= la.maxRaiseTo) return { type: 'allin' }
  return { type: 'raise', to }
}

/** Décision synchrone du bot dont c'est le tour. */
export function botDecide(s: HandState): PlayerAction {
  const p = s.players[s.toAct]
  const la = legalActions(s)
  if (!p) return { type: 'fold' }

  const opponents = Math.max(
    1,
    s.players.filter((q) => !q.folded && !q.out && q.id !== p.id).length,
  )
  const profile = STYLE_PROFILE[p.style] ?? STYLE_PROFILE.normal

  let equity: number
  if (s.street === 'preflop') {
    const score = preflopScore(p.hole)
    equity = Math.max(0.05, Math.min(0.95, (1 / (opponents + 1)) * (0.6 + 1.8 * score)))
  } else {
    const iterations = opponents >= 3 ? 120 : 180
    equity = estimateEquity(p.hole, s.board, opponents, iterations)
  }

  const roll = Math.random()
  const bluffRoll = Math.random()
  const stackInBb = s.bb > 0 ? p.chips / s.bb : 99

  // Tapis désespéré : short stack avec une main correcte.
  if (stackInBb <= 8 && equity > 0.42 && la.canAllIn && roll < 0.65) {
    return { type: 'allin' }
  }

  if (la.callAmount === 0) {
    if (equity > 0.66 && la.canRaise && roll < 0.8 * profile.aggression) {
      return sizedRaise(s, la, equity > 0.85 ? 0.85 : 0.6)
    }
    if (equity > 0.52 && la.canRaise && roll < 0.35 * profile.aggression) {
      return sizedRaise(s, la, 0.5)
    }
    if (la.canRaise && bluffRoll < profile.bluff) {
      return sizedRaise(s, la, 0.5)
    }
    return { type: 'check' }
  }

  const potOdds = la.callAmount / (s.pot + la.callAmount)
  const committedRatio = la.callAmount / Math.max(1, p.chips + la.callAmount)

  if (equity < potOdds + profile.margin) {
    // Semi-bluff occasionnel plutôt que de se coucher systématiquement.
    if (la.canRaise && bluffRoll < profile.bluff * 0.6 && committedRatio < 0.25) {
      return sizedRaise(s, la, 0.7)
    }
    return { type: 'fold' }
  }

  if (equity > 0.8 && la.canRaise && roll < 0.75 * profile.aggression) {
    return sizedRaise(s, la, 0.9)
  }
  if (equity > 0.63 && la.canRaise && roll < 0.35 * profile.aggression) {
    return sizedRaise(s, la, 0.6)
  }
  return { type: 'call' }
}
