import { Link } from 'react-router-dom'
import type { Player } from '../types'
import { resolveBanner } from '../lib/constants'
import { formatMoney, wealthOf } from '../lib/format'
import { useCasino } from '../store/CasinoContext'

export function ProfileCard({ player, compact }: { player: Player; compact?: boolean }) {
  const { rates } = useCasino()
  const wealth = wealthOf(player.wallet, rates)

  return (
    <article className={`profile-card ${compact ? 'compact' : ''}`}>
      <div
        className="profile-banner"
        style={{ background: resolveBanner(player.profile.banner) }}
      />
      <div className="profile-main">
        <img src={player.profile.avatar} alt="" className="profile-avatar" />
        <div>
          <h2>
            {player.profile.username}
            {player.profile.isUser && <span className="you-badge">Toi</span>}
          </h2>
          {player.profile.title ? <p className="profile-title">{player.profile.title}</p> : null}
          <p className="profile-bio">{player.profile.bio || 'Aucune bio.'}</p>
          {!compact && (
            <p className="profile-wealth">
              Fortune totale · <strong>{formatMoney(wealth)} LC</strong>
            </p>
          )}
        </div>
      </div>
      {!compact && (
        <div className="profile-stats-grid">
          <div>
            <span>Cash</span>
            <strong>{formatMoney(player.wallet.cash)} LC</strong>
          </div>
          <div>
            <span>Misés (jour)</span>
            <strong>{formatMoney(player.stats.daily.wagered)} LC</strong>
          </div>
          <div>
            <span>Bénéfice (jour)</span>
            <strong className={player.stats.daily.profit >= 0 ? 'up' : 'down'}>
              {player.stats.daily.profit >= 0 ? '+' : ''}
              {formatMoney(player.stats.daily.profit)} LC
            </strong>
          </div>
        </div>
      )}
      {compact && (
        <Link className="btn ghost" to={`/joueur/${player.profile.id}`}>
          Voir le profil
        </Link>
      )}
    </article>
  )
}
