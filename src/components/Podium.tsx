import { Link } from 'react-router-dom'
import type { RankedPlayer } from '../store/CasinoContext'
import { formatMoney } from '../lib/format'
import { resolveBanner } from '../lib/constants'

export function Podium({ top }: { top: RankedPlayer[] }) {
  // Ordre visuel 2 · 1 · 3, en gardant chaque joueur associé à son vrai rang
  const ordered = [1, 0, 2]
    .map((i) => (top[i] ? { row: top[i]!, place: i + 1 } : null))
    .filter((v): v is { row: RankedPlayer; place: number } => v !== null)

  if (ordered.length === 0) {
    return (
      <section className="podium" aria-label="Podium des fortunes">
        <p className="muted">Aucun compte en ligne pour l’instant — sois le premier au sommet.</p>
      </section>
    )
  }

  return (
    <section className="podium" aria-label="Podium des fortunes">
      <div className="podium-stage">
        {ordered.map(({ row, place }) => {
          const height = place === 1 ? 'tall' : place === 2 ? 'mid' : 'short'
          return (
            <Link
              key={row.player.profile.id}
              to={`/joueur/${row.player.profile.id}`}
              className={`podium-card place-${place} ${height}`}
            >
              <div
                className="podium-banner"
                style={{ background: resolveBanner(row.player.profile.banner) }}
              />
              <div className="podium-body">
                <img
                  src={row.player.profile.avatar}
                  alt=""
                  className="podium-avatar"
                />
                <span className="podium-rank">#{place}</span>
                <h3>{row.player.profile.username}</h3>
                {row.player.profile.title ? (
                  <p className="podium-title">{row.player.profile.title}</p>
                ) : null}
                <p className="podium-bio">{row.player.profile.bio}</p>
                <strong className="podium-wealth">{formatMoney(row.wealth)} LC</strong>
              </div>
              <div className={`podium-plinth place-${place}`}>
                <span>{place === 1 ? 'I' : place === 2 ? 'II' : 'III'}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
