import { Link, useParams } from 'react-router-dom'
import { ProfileCard } from '../components/ProfileCard'
import { useCasino } from '../store/CasinoContext'
import { formatDuration, formatMoney } from '../lib/format'

export function PlayerPage() {
  const { id } = useParams()
  const { getPlayer } = useCasino()
  const player = id ? getPlayer(id) : undefined

  if (!player) {
    return (
      <div className="page">
        <p>Joueur introuvable.</p>
        <Link to="/">Retour</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <Link to="/" className="back">
        ← Accueil
      </Link>
      <ProfileCard player={player} />
      <div className="stats-readout triple">
        {(['daily', 'weekly', 'monthly'] as const).map((period) => {
          const s = player.stats[period]
          const label = period === 'daily' ? 'Jour' : period === 'weekly' ? 'Semaine' : 'Mois'
          return (
            <div key={period} className="period-block">
              <h3>{label}</h3>
              <p>
                Temps <strong>{formatDuration(s.playTimeMs)}</strong>
              </p>
              <p>
                Parié <strong>{formatMoney(s.wagered)} LC</strong>
              </p>
              <p>
                Bénéfice{' '}
                <strong className={s.profit >= 0 ? 'up' : 'down'}>
                  {s.profit >= 0 ? '+' : ''}
                  {formatMoney(s.profit)} LC
                </strong>
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
