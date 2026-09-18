/** Catalogue de cosmétiques + coffres LUNA. */

export type CosmeticKind = 'banner' | 'icon' | 'title' | 'card'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface Cosmetic {
  id: string
  kind: CosmeticKind
  rarity: Rarity
  name: string
  /** CSS de bannière, URL d’icône, glyphe emoji, ou classe de dos de carte. */
  value: string
}

export interface Crate {
  id: string
  name: string
  tagline: string
  price: number
  accent: string
  weights: Record<Rarity, number>
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Commun',
  uncommon: 'Peu commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#94a3b8',
  uncommon: '#34d399',
  rare: '#38bdf8',
  epic: '#c084fc',
  legendary: '#fbbf24',
}

const B = (
  id: string,
  rarity: Rarity,
  name: string,
  value: string,
): Cosmetic => ({ id, kind: 'banner', rarity, name, value })

const I = (
  id: string,
  rarity: Rarity,
  name: string,
  seed: string,
  bg: string,
): Cosmetic => ({
  id,
  kind: 'icon',
  rarity,
  name,
  value: `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=${bg}`,
})

const T = (id: string, rarity: Rarity, name: string): Cosmetic => ({
  id,
  kind: 'title',
  rarity,
  name,
  value: name,
})

const C = (id: string, rarity: Rarity, name: string, cls: string): Cosmetic => ({
  id,
  kind: 'card',
  rarity,
  name,
  value: cls,
})

export const COSMETICS: Cosmetic[] = [
  /* ---- bannières ------------------------------------------------------ */
  B('velvet', 'common', 'Nuit rose', 'linear-gradient(135deg, #050508 0%, #1a0a18 40%, #ff4d9a55 70%, #0a0612 100%)'),
  B('champagne', 'common', 'Violet magique', 'linear-gradient(120deg, #050508 0%, #2e1065 40%, #c026d3 70%, #0a0612 100%)'),
  B('obsidian', 'common', 'Obsidienne', 'linear-gradient(90deg, #050508 0%, #1e1033 50%, #050508 100%)'),
  B('mist', 'common', 'Brume orchid', 'radial-gradient(ellipse at 30% 40%, #c026d366, transparent 50%), linear-gradient(180deg, #12081c, #050508)'),
  B('slate', 'common', 'Ardoise', 'linear-gradient(160deg, #0f172a, #1e293b 50%, #0b1220)'),
  B('ember', 'uncommon', 'Braise', 'linear-gradient(135deg, #1c0a08, #7c2d12 45%, #fb7185 80%, #140806)'),
  B('aurora', 'uncommon', 'Aurore fuchsia', 'linear-gradient(160deg, #0a0612 0%, #4c1d95 35%, #ff4d9a 65%, #050508 100%)'),
  B('ruby', 'uncommon', 'Rubis lunaire', 'linear-gradient(135deg, #12010c 0%, #831843 40%, #db2777 70%, #050508 100%)'),
  B('tide', 'uncommon', 'Marée violette', 'linear-gradient(120deg, #082f49, #6d28d9 50%, #f472b6)'),
  B('forest', 'uncommon', 'Forêt noire', 'linear-gradient(180deg, #052e16, #14532d 40%, #86efac55, #022c22)'),
  B('ion', 'rare', 'Ion', 'conic-gradient(from 210deg, #0b1020, #7c3aed, #22d3ee, #f472b6, #0b1020)'),
  B('comet', 'rare', 'Comète', 'radial-gradient(circle at 80% 20%, #fde68a, transparent 28%), linear-gradient(135deg, #0c0a16, #312e81 50%, #db2777)'),
  B('nebula', 'rare', 'Nébuleuse', 'radial-gradient(circle at 20% 80%, #67e8f9aa, transparent 40%), radial-gradient(circle at 80% 30%, #c084fc, transparent 42%), #07060f'),
  B('silk', 'rare', 'Soie noire', 'repeating-linear-gradient(115deg, #1a1024 0 12px, #2a1838 12px 24px), linear-gradient(180deg, #ff4d9a33, transparent)'),
  B('crown', 'epic', 'Couronne', 'linear-gradient(135deg, #1c1408, #b45309 30%, #fbbf24 55%, #7c2d12 80%, #120a04)'),
  B('plasma', 'epic', 'Plasma', 'conic-gradient(from 90deg, #22d3ee, #a855f7, #fb7185, #facc15, #22d3ee)'),
  B('void', 'epic', 'Néant doré', 'radial-gradient(circle at 50% 120%, #fbbf2488, transparent 45%), linear-gradient(180deg, #050508, #1a1030 60%, #050508)'),
  B('opal', 'legendary', 'Opale lunaire', 'conic-gradient(from 40deg, #f9a8d4, #a5f3fc, #fde68a, #c4b5fd, #f9a8d4)'),
  B('sovereign', 'legendary', 'Souverain', 'linear-gradient(160deg, #0a0610 0%, #4c1d95 25%, #fbbf24 48%, #db2777 72%, #050508 100%)'),
  B('eclipse', 'legendary', 'Éclipse totale', 'radial-gradient(circle at 50% 50%, #0a0610 0 28%, #fbbf24 29% 32%, #7c3aed 45%, #050508 70%)'),

  /* ---- icônes --------------------------------------------------------- */
  I('fox', 'common', 'Renard', 'Fox', '12081c'),
  I('wolf', 'common', 'Loup', 'Wolf', '2e1065'),
  I('owl', 'common', 'Hibou', 'Owl', '831843'),
  I('cat', 'common', 'Chat', 'Mystic', '1a0a18'),
  I('panda', 'common', 'Panda', 'Panda', '3b0764'),
  I('lion', 'uncommon', 'Lion', 'Lion', '4c1d95'),
  I('lynx', 'uncommon', 'Lynx', 'LynxNight', '1e1b4b'),
  I('raven', 'uncommon', 'Corbeau', 'Raven', '111827'),
  I('koi', 'uncommon', 'Carpe', 'KoiBloom', '9f1239'),
  I('falcon', 'rare', 'Faucon', 'FalconGold', '78350f'),
  I('orchid', 'rare', 'Orchidée', 'Orchid', '6b21a8'),
  I('jade', 'rare', 'Jade', 'JadeKing', '064e3b'),
  I('nova', 'epic', 'Nova', 'StarNova', '1e3a8a'),
  I('mirage', 'epic', 'Mirage', 'Mirage', '831843'),
  I('oracle', 'legendary', 'Oracle', 'OracleMoon', '422006'),
  I('empress', 'legendary', 'Impératrice', 'Empress', '4a044e'),

  /* ---- titres --------------------------------------------------------- */
  T('title-player', 'common', 'Joueur'),
  T('title-regular', 'common', 'Habitué'),
  T('title-night', 'common', 'Oiseau de nuit'),
  T('title-chip', 'uncommon', 'Compte ses jetons'),
  T('title-felt', 'uncommon', 'Enfant du tapis'),
  T('title-luck', 'uncommon', 'Porte-bonheur'),
  T('title-bluff', 'rare', 'Bluffeur'),
  T('title-shark', 'rare', 'Requin'),
  T('title-croupier', 'rare', 'Croupier fantôme'),
  T('title-high', 'epic', 'High roller'),
  T('title-house', 'epic', 'L’ennemi de la maison'),
  T('title-luna', 'legendary', 'Favori de LUNA'),
  T('title-king', 'legendary', 'Roi du salon'),
  T('title-myth', 'legendary', 'Mythe vivant'),

  /* ---- dos de cartes -------------------------------------------------- */
  C('card-classic', 'common', 'Classique', 'card-classic'),
  C('card-violet', 'common', 'Violet', 'card-violet'),
  C('card-rose', 'uncommon', 'Rose soie', 'card-rose'),
  C('card-mint', 'uncommon', 'Menthe', 'card-mint'),
  C('card-night', 'rare', 'Nuit', 'card-night'),
  C('card-gold', 'rare', 'Or brossé', 'card-gold'),
  C('card-neon', 'epic', 'Néon', 'card-neon'),
  C('card-holo', 'epic', 'Holo', 'card-holo'),
  C('card-obsidian', 'legendary', 'Obsidienne', 'card-obsidian'),
  C('card-sovereign', 'legendary', 'Souverain', 'card-sovereign'),
]

export const STARTER_OWNED = ['velvet', 'fox', 'card-classic']

export const CRATES: Crate[] = [
  {
    id: 'luna',
    name: 'Caisse Lune',
    tagline: 'Entrée de gamme — beaucoup de communs',
    price: 2_500,
    accent: '#94a3b8',
    weights: { common: 70, uncommon: 22, rare: 7, epic: 1, legendary: 0 },
  },
  {
    id: 'eclipse',
    name: 'Caisse Éclipse',
    tagline: 'Un peu plus de rares',
    price: 5_000,
    accent: '#34d399',
    weights: { common: 50, uncommon: 32, rare: 14, epic: 3.5, legendary: 0.5 },
  },
  {
    id: 'nova',
    name: 'Caisse Nova',
    tagline: 'Épiques en vue',
    price: 10_000,
    accent: '#38bdf8',
    weights: { common: 30, uncommon: 35, rare: 25, epic: 8, legendary: 2 },
  },
  {
    id: 'crown',
    name: 'Caisse Couronne',
    tagline: 'Chasse aux légendaires',
    price: 25_000,
    accent: '#c084fc',
    weights: { common: 15, uncommon: 28, rare: 32, epic: 18, legendary: 7 },
  },
  {
    id: 'astral',
    name: 'Caisse Astrale',
    tagline: 'Le haut du panier',
    price: 50_000,
    accent: '#fbbf24',
    weights: { common: 5, uncommon: 15, rare: 33, epic: 32, legendary: 15 },
  },
]

const byId = new Map(COSMETICS.map((c) => [c.id, c]))

export function cosmeticOf(id: string | undefined | null): Cosmetic | undefined {
  if (!id) return undefined
  return byId.get(id)
}

export function cosmeticsOfKind(kind: CosmeticKind, owned: string[]): Cosmetic[] {
  const set = new Set(owned)
  return COSMETICS.filter((c) => c.kind === kind && set.has(c.id))
}

export function bannerCss(id: string): string {
  const c = byId.get(id)
  if (c?.kind === 'banner') return c.value
  if (id.startsWith('http') || id.startsWith('data:') || id.startsWith('url(')) {
    if (id.startsWith('url(')) return id
    return `url(${id}) center/cover no-repeat`
  }
  return byId.get('velvet')?.value ?? '#12081c'
}

export function iconUrl(id: string, fallback: string): string {
  const c = byId.get(id)
  if (c?.kind === 'icon') return c.value
  if (id.startsWith('http') || id.startsWith('data:')) return id
  return fallback
}

function rollRarity(weights: Record<Rarity, number>): Rarity {
  const order: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
  const total = order.reduce((s, r) => s + weights[r], 0)
  let n = Math.random() * total
  for (const r of order) {
    n -= weights[r]
    if (n <= 0) return r
  }
  return 'common'
}

export function openCrateDrop(crate: Crate, owned: string[]): Cosmetic {
  const rarity = rollRarity(crate.weights)
  const pool = COSMETICS.filter((c) => c.rarity === rarity)
  const fresh = pool.filter((c) => !owned.includes(c.id))
  const pickFrom = fresh.length > 0 ? fresh : pool
  return pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? COSMETICS[0]!
}

export function emptyEquip() {
  return { banner: 'velvet', icon: 'fox', title: '', card: 'card-classic' }
}

export type EquipSlots = { banner: string; icon: string; title: string; card: string }
