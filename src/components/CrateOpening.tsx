import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Player } from '../types'
import {
  KIND_LABEL,
  RARITY_COLOR,
  RARITY_LABEL,
  previewEquip,
  type Cosmetic,
  type Crate,
} from '../lib/cosmetics'

type Phase = 'intro' | 'open' | 'reveal'

function EquippedLook({ user, item }: { user: Player; item: Cosmetic }) {
  const look = previewEquip(user.profile, item)

  return (
    <div className="crate-look">
      <p className="crate-look-cap">Aperçu si tu l’équipes — rien n’est changé tant que tu n’appuies pas</p>
      {item.kind === 'card' ? (
        <div className="crate-look-felt" aria-label="Dos de cartes">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`card-skin crate-look-card ${look.cardClass}`}
              style={{ ['--i' as string]: i }}
            />
          ))}
        </div>
      ) : (
        <article className="crate-look-profile">
          <div className="profile-banner" style={{ background: look.banner }} />
          <div className="profile-main">
            <img src={look.avatar} alt="" className="profile-avatar" />
            <div>
              <h2>{user.profile.username}</h2>
              {look.title ? (
                <p className={`profile-title ${item.kind === 'title' ? 'crate-look-title-flash' : ''}`}>
                  {look.title}
                </p>
              ) : (
                <p className="muted">Sans titre</p>
              )}
              <p className="profile-bio">{user.profile.bio || 'Aucune bio.'}</p>
            </div>
          </div>
        </article>
      )}
    </div>
  )
}

function DropThumb({ item }: { item: Cosmetic }) {
  if (item.kind === 'banner') {
    return <div className="crate-drop-banner" style={{ background: item.value }} />
  }
  if (item.kind === 'icon') {
    return <img className="crate-drop-icon" src={item.value} alt="" />
  }
  if (item.kind === 'card') {
    return <div className={`card-skin crate-drop-card ${item.value}`} />
  }
  return (
    <span className="crate-drop-title" style={{ borderColor: RARITY_COLOR[item.rarity] }}>
      {item.value}
    </span>
  )
}

export function CrateOpening({
  crate,
  item,
  duplicate,
  count,
  user,
  onEquip,
  onClose,
}: {
  crate: Crate
  item: Cosmetic
  duplicate: boolean
  count: number
  user: Player
  onEquip: () => void
  onClose: () => void
}) {
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [phase, setPhase] = useState<Phase>(reduced ? 'reveal' : 'intro')

  const sparks = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2
        return {
          i,
          dx: `${Math.cos(a) * (90 + (i % 5) * 18)}px`,
          dy: `${Math.sin(a) * (70 + (i % 4) * 16)}px`,
        }
      }),
    [],
  )

  useEffect(() => {
    document.body.classList.add('crate-lock')
    return () => document.body.classList.remove('crate-lock')
  }, [])

  useEffect(() => {
    if (reduced) return
    const t1 = window.setTimeout(() => setPhase('open'), 720)
    const t2 = window.setTimeout(() => setPhase('reveal'), 2100)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [item.id, reduced])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (phase === 'reveal') onClose()
      else setPhase('reveal')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, onClose])

  const skip = () => {
    if (phase !== 'reveal') setPhase('reveal')
  }

  const rarity = RARITY_COLOR[item.rarity]

  return (
    <div
      className="crate-ov"
      data-phase={phase}
      data-rarity={item.rarity}
      style={{ ['--crate' as string]: crate.accent, ['--rarity' as string]: rarity }}
      role="dialog"
      aria-modal="true"
      aria-label={`Ouverture ${crate.name}`}
      onClick={skip}
    >
      <div className="crate-ov-bg" />
      <div className="crate-ov-rays" aria-hidden />
      <div className="crate-ov-sparks" aria-hidden>
        {sparks.map((s) => (
          <i
            key={s.i}
            className="crate-spark"
            style={{ ['--dx' as string]: s.dx, ['--dy' as string]: s.dy } as CSSProperties}
          />
        ))}
      </div>

      <div className="luna-chest-wrap" aria-hidden>
        <div className="luna-chest">
          <div className="luna-chest-glow" />
          <div className="luna-chest-lid">
            <span>LUNA</span>
          </div>
          <div className="luna-chest-body">
            <div className="luna-chest-well" />
            <div className="luna-chest-gem" />
          </div>
        </div>
      </div>

      {phase !== 'reveal' && (
        <p className="crate-ov-hint">
          {crate.name}
          <em>Clique pour passer</em>
        </p>
      )}

      {phase === 'reveal' && (
        <div className="crate-reveal" onClick={(e) => e.stopPropagation()}>
          <p className="crate-reveal-kind">
            {KIND_LABEL[item.kind]}
            {duplicate ? ' · doublon' : ' · nouveau'}
          </p>
          <DropThumb item={item} />
          <em className="crate-reveal-rarity" style={{ color: rarity }}>
            {RARITY_LABEL[item.rarity]}
          </em>
          <h2>{item.name}</h2>
          {duplicate ? (
            <p className="crate-reveal-dup">Doublon — pile ×{count} dans l’inventaire</p>
          ) : (
            <p className="crate-reveal-dup">Nouveau — 1 exemplaire</p>
          )}
          <EquippedLook user={user} item={item} />
          <div className="crate-reveal-actions">
            <button type="button" className="btn primary" onClick={onEquip}>
              Équiper
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Garder sans équiper
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
