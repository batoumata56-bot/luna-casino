import { useMemo, useState } from 'react'
import { useCasino } from '../store/CasinoContext'
import {
  COSMETICS,
  CRATES,
  RARITY_COLOR,
  RARITY_LABEL,
  cosmeticOf,
  type Cosmetic,
  type CosmeticKind,
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
    return <div className={`inv-card ${item.value}`} />
  }
  return (
    <span className="inv-title-chip" style={{ borderColor: RARITY_COLOR[item.rarity] }}>
      {item.value}
    </span>
  )
}

export function InventoryPage() {
  const { user, openCrate, equipCosmetic } = useCasino()
  const [tab, setTab] = useState<CosmeticKind | 'all'>('all')
  const [drop, setDrop] = useState<Cosmetic | null>(null)
  const owned = user.profile.owned ?? []

  const list = useMemo(() => {
    return COSMETICS.filter((c) => owned.includes(c.id)).filter((c) => tab === 'all' || c.kind === tab)
  }, [owned, tab])

  const equipped = (c: Cosmetic) => {
    if (c.kind === 'banner') return user.profile.banner === c.id
    if (c.kind === 'icon') return user.profile.avatar === c.value
    if (c.kind === 'title') return user.profile.title === c.value
    return user.profile.cardback === c.id
  }

  return (
    <div className="page inv-page">
      <header className="page-head">
        <h1>Inventaire</h1>
        <p>Ouvre des caisses pour des bannières, icônes, titres et dos de cartes. Ça se voit sur le podium.</p>
      </header>

      <section className="crate-grid">
        {CRATES.map((crate) => (
          <article key={crate.id} className="crate-card" style={{ ['--crate' as string]: crate.accent }}>
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
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                const got = openCrate(crate.id)
                if (got) setDrop(got)
              }}
            >
              Ouvrir · {formatMoney(crate.price)} LC
            </button>
          </article>
        ))}
      </section>

      {drop && (
        <div className="crate-drop" role="status">
          <CratePreview item={drop} />
          <div>
            <em style={{ color: RARITY_COLOR[drop.rarity] }}>{RARITY_LABEL[drop.rarity]}</em>
            <strong>{drop.name}</strong>
          </div>
          <button type="button" className="btn" onClick={() => equipCosmetic(drop.id)}>
            Équiper
          </button>
          <button type="button" className="chip" onClick={() => setDrop(null)}>
            Ranger
          </button>
        </div>
      )}

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
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`inv-item rarity-${c.rarity} ${equipped(c) ? 'on' : ''}`}
            onClick={() => equipCosmetic(c.id)}
          >
            <CratePreview item={c} />
            <span>{c.name}</span>
            <em style={{ color: RARITY_COLOR[c.rarity] }}>{RARITY_LABEL[c.rarity]}</em>
          </button>
        ))}
        {list.length === 0 && <p className="muted">Rien dans cette catégorie — ouvre une caisse.</p>}
      </div>

      <p className="hint">
        {owned.length} objet(s) · titre actuel : {user.profile.title || 'aucun'} ·{' '}
        {cosmeticOf(user.profile.cardback)?.name ?? 'cartes classiques'}
      </p>
    </div>
  )
}
