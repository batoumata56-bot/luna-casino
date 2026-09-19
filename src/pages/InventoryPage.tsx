import { useMemo, useState } from 'react'
import { useCasino } from '../store/CasinoContext'
import { CrateOpening } from '../components/CrateOpening'
import {
  COSMETICS,
  CRATES,
  RARITY_COLOR,
  RARITY_LABEL,
  cosmeticOf,
  countOwned,
  sellPrice,
  type Cosmetic,
  type CosmeticKind,
  type Crate,
  type CrateDropResult,
  type Rarity,
} from '../lib/cosmetics'
import { formatMoney } from '../lib/format'

const KINDS: { id: CosmeticKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'banner', label: 'Bannières' },
  { id: 'icon', label: 'Icônes' },
  { id: 'title', label: 'Titres' },
  { id: 'card', label: 'Cartes' },
]

function CratePreview({ item }: { item: Cosmetic }) {
  if (item.kind === 'banner') {
    return <div className="inv-banner" style={{ background: item.value }} />
  }
  if (item.kind === 'icon') {
    return <img className="inv-icon" src={item.value} alt="" />
  }
  if (item.kind === 'card') {
    return <div className={`inv-card card-skin ${item.value}`} />
  }
  return (
    <span className="inv-title-chip" style={{ borderColor: RARITY_COLOR[item.rarity] }}>
      {item.value}
    </span>
  )
}

type Opening = CrateDropResult & { crate: Crate; stamp: number }

export function InventoryPage() {
  const { user, openCrate, equipCosmetic, sellCosmetic } = useCasino()
  const [tab, setTab] = useState<CosmeticKind | 'all'>('all')
  const [opening, setOpening] = useState<Opening | null>(null)
  const owned = user.profile.owned ?? []

  const list = useMemo(() => {
    return COSMETICS.filter((c) => owned.includes(c.id))
      .filter((c) => tab === 'all' || c.kind === tab)
      .map((c) => ({ item: c, count: countOwned(owned, c.id) }))
  }, [owned, tab])

  const uniqueCount = new Set(owned).size
  const totalCount = owned.length

  const equipped = (c: Cosmetic) => {
    if (c.kind === 'banner') return user.profile.banner === c.id
    if (c.kind === 'icon') return user.profile.avatar === c.value
    if (c.kind === 'title') return user.profile.title === c.value
    return user.profile.cardback === c.id
  }

  const tryOpen = (crate: Crate) => {
    const got = openCrate(crate.id)
    if (!got) return
    setOpening({ ...got, crate, stamp: Date.now() })
  }

  return (
    <div className="page inv-page">
      <header className="page-head">
        <h1>Inventaire</h1>
        <p>
          Ouvre des caisses, empile les doublons, vends ce dont tu n’as plus besoin. L’aperçu montre
          l’objet équipé sans l’appliquer.
        </p>
      </header>

      <section className="crate-grid">
        {CRATES.map((crate) => (
          <article key={crate.id} className="crate-card" style={{ ['--crate' as string]: crate.accent }}>
            <div className="crate-card-gem" aria-hidden />
            <h2>{crate.name}</h2>
            <p>{crate.tagline}</p>
            <ul className="crate-odds">
              {(Object.keys(crate.weights) as Rarity[]).map((r) =>
                crate.weights[r] > 0 ? (
                  <li key={r} style={{ color: RARITY_COLOR[r] }}>
                    {RARITY_LABEL[r]} {crate.weights[r]}%
                  </li>
                ) : null,
              )}
            </ul>
            <button type="button" className="btn primary" onClick={() => tryOpen(crate)}>
              Ouvrir · {formatMoney(crate.price)} LC
            </button>
          </article>
        ))}
      </section>

      <div className="filter-group">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className={tab === k.id ? 'chip active' : 'chip'}
            onClick={() => setTab(k.id)}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="inv-grid">
        {list.map(({ item: c, count }) => (
          <article
            key={c.id}
            className={`inv-item rarity-${c.rarity} ${equipped(c) ? 'on' : ''}`}
          >
            {count > 1 && <span className="inv-stack">×{count}</span>}
            <button type="button" className="inv-item-main" onClick={() => equipCosmetic(c.id)}>
              <CratePreview item={c} />
              <span>{c.name}</span>
              <em style={{ color: RARITY_COLOR[c.rarity] }}>{RARITY_LABEL[c.rarity]}</em>
            </button>
            <button type="button" className="inv-sell" onClick={() => sellCosmetic(c.id)}>
              Vendre · {formatMoney(sellPrice(c.rarity))} LC
            </button>
          </article>
        ))}
        {list.length === 0 && <p className="muted">Rien dans cette catégorie — ouvre une caisse.</p>}
      </div>

      <p className="hint">
        {uniqueCount} style(s) · {totalCount} exemplaire(s) · titre : {user.profile.title || 'aucun'} ·{' '}
        {cosmeticOf(user.profile.cardback)?.name ?? 'cartes classiques'}
      </p>

      {opening && (
        <CrateOpening
          key={opening.stamp}
          crate={opening.crate}
          item={opening.item}
          duplicate={opening.duplicate}
          count={opening.count}
          user={user}
          onEquip={() => {
            equipCosmetic(opening.item.id)
            setOpening(null)
          }}
          onClose={() => setOpening(null)}
        />
      )}
    </div>
  )
}
