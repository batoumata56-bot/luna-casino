/**
 * Roulette « live » — manches globales de 30 s dérivées de l'horloge murale.
 * Tout est déterministe : deux navigateurs quelconques voient la même manche,
 * le même numéro et la même position de bille, sans réseau ni base de données.
 */

import { EUROPEAN_ORDER } from './games'

export const ROUND_MS = 30_000
export const SPIN_MS = 9_000
export const BETTING_MS = ROUND_MS - SPIN_MS

export const POCKET_COUNT = EUROPEAN_ORDER.length
export const POCKET_DEG = 360 / POCKET_COUNT

/** Le plateau ne s'arrête jamais : un tour complet toutes les 7 s, sens horaire. */
export const WHEEL_PERIOD_MS = 7_000

/** Fraction du spin où la bille est verrouillée dans sa poche (et le résultat révélé). */
export const LOCK_P = 0.88
/** Fraction du spin où la bille quitte la piste et plonge vers les poches. */
export const DROP_P = 0.58
/** Tours de piste pendant le lancer (sens inverse de la roue). */
const FREE_TURNS = 8
/** Tours lents de la bille sur la piste pendant les mises. */
const IDLE_PERIOD_MS = 2_400
/** Amplitude des rebonds dans la couronne des numéros. */
const BOUNCE_AMP = 5

/* ---------------------------------------------------------------- géométrie */

export const VIEW = 400
export const CX = VIEW / 2
export const CY = VIEW / 2
export const R_RIM = 196
export const R_TRACK = 174
export const R_POCKET_OUT = 158
export const R_POCKET_IN = 114
/** Rayon de repos de la bille : milieu de la couronne des poches / numéros. */
export const R_POCKET = (R_POCKET_OUT + R_POCKET_IN) / 2 + 4
export const BALL_R = 9.4

export type Point = { x: number; y: number }

/** 0° = midi, angles croissants dans le sens horaire (repère SVG y vers le bas). */
export function polar(cx: number, cy: number, r: number, deg: number): Point {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

/** Secteur de couronne (une poche) sous forme de path SVG. */
export function annularSector(
  rIn: number,
  rOut: number,
  from: number,
  to: number,
  cx = CX,
  cy = CY,
): string {
  const o0 = polar(cx, cy, rOut, from)
  const o1 = polar(cx, cy, rOut, to)
  const i1 = polar(cx, cy, rIn, to)
  const i0 = polar(cx, cy, rIn, from)
  const large = Math.abs(to - from) > 180 ? 1 : 0
  return [
    `M ${o0.x.toFixed(3)} ${o0.y.toFixed(3)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${o1.x.toFixed(3)} ${o1.y.toFixed(3)}`,
    `L ${i1.x.toFixed(3)} ${i1.y.toFixed(3)}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${i0.x.toFixed(3)} ${i0.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}

/** Plus court chemin angulaire de `a` vers `b`, dans [-180, 180). */
export function shortestAngleDelta(a: number, b: number): number {
  return ((((b - a + 540) % 360) + 360) % 360) - 180
}

/* ------------------------------------------------------------------ manches */

export type RoundPhase = 'bets' | 'spin' | 'result'

export type RoundState = {
  roundId: number
  phase: RoundPhase
  /** ms écoulées depuis le début de la manche. */
  elapsed: number
  /** ms restantes avant la fin de la phase courante. */
  remainingMs: number
  /** Avancement 0→1 de la phase courante. */
  phaseProgress: number
  /** Avancement 0→1 de l'animation de bille (0 pendant les mises). */
  spinProgress: number
  /** Numéro sortant de cette manche. */
  result: number
}

export function roundIdAt(t: number): number {
  return Math.floor(t / ROUND_MS)
}

export function roundStartAt(roundId: number): number {
  return roundId * ROUND_MS
}

/**
 * splitmix32 : avalanche complète, de sorte que deux manches consécutives
 * (donc deux entiers voisins) donnent des résultats totalement décorrélés.
 */
export function hashRound(roundId: number): number {
  let a = (roundId + 0x9e3779b9) | 0
  a = Math.imul(a ^ (a >>> 16), 0x21f0aaad)
  a = Math.imul(a ^ (a >>> 15), 0x735a2d97)
  a = a ^ (a >>> 15)
  return a >>> 0
}

const POCKET_INDEX = new Map<number, number>(
  EUROPEAN_ORDER.map((n, i): [number, number] => [n, i]),
)

export function pocketIndexOf(n: number): number {
  return POCKET_INDEX.get(n) ?? 0
}

export function resultForRound(roundId: number): number {
  return EUROPEAN_ORDER[hashRound(roundId) % POCKET_COUNT]
}

export function roundStateAt(t: number): RoundState {
  const roundId = roundIdAt(t)
  const elapsed = t - roundStartAt(roundId)
  const result = resultForRound(roundId)
  if (elapsed < BETTING_MS) {
    return {
      roundId,
      phase: 'bets',
      elapsed,
      remainingMs: BETTING_MS - elapsed,
      phaseProgress: elapsed / BETTING_MS,
      spinProgress: 0,
      result,
    }
  }
  const spinProgress = (elapsed - BETTING_MS) / SPIN_MS
  return {
    roundId,
    phase: spinProgress >= LOCK_P ? 'result' : 'spin',
    elapsed,
    remainingMs: ROUND_MS - elapsed,
    phaseProgress: Math.min(1, spinProgress),
    spinProgress: Math.min(1, spinProgress),
    result,
  }
}

/* -------------------------------------------------------------------- bille */

export type BallState = {
  /** Angle absolu de la bille (degrés, 0 = midi, sens horaire). */
  angle: number
  radius: number
  /** Numéro visé par cette trajectoire. */
  result: number
  /** true dès que la bille est solidaire du plateau. */
  landed: boolean
  /** Vitesse normalisée 0→1, pour le filé de mouvement. */
  intensity: number
}

export function wheelRotationAt(t: number): number {
  return ((t / WHEEL_PERIOD_MS) * 360) % 360
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3)
}

function smoothstep(x: number): number {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

/** Angle de la poche gagnante dans le repère tournant du plateau. */
export function pocketAngleOf(result: number): number {
  return pocketIndexOf(result) * POCKET_DEG
}

/** Position verrouillée : la bille est dans sa poche et tourne avec le plateau. */
function lockedAngle(t: number, result: number): number {
  return wheelRotationAt(t) + pocketAngleOf(result)
}

/** Bille qui roule lentement sur la piste pendant les mises. */
function idleAngle(t: number): number {
  return -((t / IDLE_PERIOD_MS) * 360)
}

/**
 * Pendant le lancer la bille part à l'opposé de la roue, fait FREE_TURNS tours
 * en décélérant, puis s'aligne pile sur la poche gagnante (aucun saut).
 */
function spinningAngle(t: number, result: number, p: number): number {
  const locked = lockedAngle(t, result)
  if (p >= LOCK_P) return locked
  const u = easeOutCubic(clamp01(p / LOCK_P))
  const leftover = (1 - u) * FREE_TURNS * 360
  return locked - leftover
}

/** La bille reste sur la couronne des numéros, avec un léger rebond en fin de lancer. */
function ballRadius(p: number): number {
  if (p <= 0) return R_POCKET
  const q = smoothstep((p - DROP_P) / (LOCK_P - DROP_P))
  if (q <= 0) return R_POCKET
  const bounce = BOUNCE_AMP * Math.exp(-3.4 * q) * Math.sin(q * Math.PI * 3.4)
  return R_POCKET + bounce
}

/**
 * État complet de la bille pour un instant donné — fonction pure de `t`.
 * La bille bouge toujours : lentement sur la piste pendant les mises,
 * puis elle sprint, décélère et tombe dans la poche du numéro.
 */
export function ballStateAt(t: number): BallState {
  const s = roundStateAt(t)
  if (s.phase === 'bets') {
    return {
      angle: idleAngle(t),
      radius: R_POCKET,
      result: resultForRound(s.roundId - 1),
      landed: false,
      intensity: 0.35,
    }
  }
  const p = s.spinProgress
  return {
    angle: spinningAngle(t, s.result, p),
    radius: ballRadius(p),
    result: s.result,
    landed: p >= LOCK_P,
    intensity: p >= LOCK_P ? 0 : 1 - easeOutCubic(clamp01(p / LOCK_P)) * 0.35,
  }
}

/* --------------------------------------------------------------- affichages */

export function formatSeconds(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000))
}
