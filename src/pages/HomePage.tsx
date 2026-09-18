import { Link } from 'react-router-dom'
import { Podium } from '../components/Podium'
import { GAMES } from '../lib/constants'
import {
  BONUS_AMOUNT,
  BONUS_MAX_CASH,
  useCasino,
} from '../store/CasinoContext'
import { formatMoney, wealthOf } from '../lib/format'

function bonusLabel(eligible: boolean, waitMs: number, fortune: number): string {
  if (eligible) return `Bonus +${formatMoney(BONUS_AMOUNT)} LC`
  if (fortune >= BONUS_MAX_CASH) return `Bonus si fortune < ${formatMoney(BONUS_MAX_CASH)} LC`
  const mins = Math.floor(waitMs / 60_000)
  const secs = Math.floor((waitMs % 60_000) / 1000)
  return `Bonus dans ${mins}:${String(secs).padStart(2, '0')}`
}

export function HomePage() {
  const {
    getTopWealth,
    user,
    rates,
    claimDailyBonus,
    bonusEligible,
    bonusAvailableIn,
    onlineCount,
  } = useCasino()
  const top = getTopWealth(3)
  const fortune = wealthOf(user.wallet, rates)

  return (
    <div className="home">
      <section className="hero">
        <p className="hero-kicker">Casino fictif · divertissement</p>
        <h1 className="hero-brand">
          LUNA
          <span>Casino</span>
        </h1>
        <p className="hero-lead">
          Le podium des trois plus grosses fortunes du casino, en direct des comptes en ligne.
          Joue, mise, et grimpe.
        </p>
        <div className="hero-cta">
          <Link className="btn primary" to="/jeux">
            Jouer maintenant
          </Link>
          <button
            type="button"
            className="btn"
            disabled={!bonusEligible}
            onClick={() => claimDailyBonus()}
            title={`Renflouement de ${formatMoney(BONUS_AMOUNT)} LC, toutes les 30 min, seulement si ta fortune totale (cash + crypto) est sous ${formatMoney(BONUS_MAX_CASH)} LC`}
          >
            {bonusLabel(bonusEligible, bonusAvailableIn, fortune)}
          </button>
        </div>
        <p className="hero-note muted">{onlineCount} compte(s) inscrit(s) au classement</p>
      </section>

      <Podium top={top} />

      <section className="home-strip">
        <div>
          <span className="muted">Ton cash</span>
          <strong>{formatMoney(user.wallet.cash)} LC</strong>
        </div>
        <div>
          <span className="muted">Misés aujourd’hui</span>
          <strong>{formatMoney(user.stats.daily.wagered)} LC</strong>
        </div>
        <div>
          <span className="muted">Bénéfice du jour</span>
          <strong className={user.stats.daily.profit >= 0 ? 'up' : 'down'}>
            {user.stats.daily.profit >= 0 ? '+' : ''}
            {formatMoney(user.stats.daily.profit)} LC
          </strong>
        </div>
      </section>

      <section className="games-preview">
        <header className="section-head">
          <h2>Tables ouvertes</h2>
          <Link to="/jeux">Tout voir</Link>
        </header>
        <div className="game-tiles">
          {GAMES.map((g) => (
            <Link key={g.id} to={`/jeux/${g.id}`} className="game-tile" style={{ ['--accent' as string]: g.accent }}>
              <h3>{g.name}</h3>
              <p>{g.tagline}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
