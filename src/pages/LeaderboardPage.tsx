import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCasino } from '../store/CasinoContext'
import { useAuth } from '../store/AuthContext'
import { GAMES } from '../lib/constants'
import type { GameId, LeaderMetric, Period } from '../types'
import { formatDuration, formatMoney } from '../lib/format'
import { Podium } from '../components/Podium'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'daily', label: 'Aujourd’hui' },
  { id: 'weekly', label: 'Cette semaine' },
  { id: 'monthly', label: 'Ce mois' },
]

type Board = 'fortune' | 'activity' | 'game'

export function LeaderboardPage() {
  const { getLeaderboard, user, onlineCount } = useCasino()
  const { userId } = useAuth()
  const [board, setBoard] = useState<Board>('fortune')
  const [period, setPeriod] = useState<Period>('daily')
  const [metric, setMetric] = useState<LeaderMetric>('profit')
  const [scope, setScope] = useState<GameId | 'all'>('all')

  const rows = useMemo(() => {
    if (board === 'fortune') return getLeaderboard('daily', 'wealth', 'all')
    if (board === 'activity') return getLeaderboard(period, metric, 'all')
    return getLeaderboard(period, metric === 'wealth' ? 'profit' : metric, scope)
  }, [getLeaderboard, board, period, metric, scope])

  const podium = rows.slice(0, 3)

  return (
    <div className="page leader-page">
      <header className="page-head">
        <h1>Classement</h1>
        <p>
          {onlineCount} compte(s) réel(s). Fortune, activité, ou un jeu précis — clique un onglet
          pour t’y retrouver.
        </p>
      </header>

      {!userId && (
        <div className="auth-warn">
          Tu n’apparais que localement. <Link to="/compte">Crée un compte</Link> pour entrer au
          classement en ligne.
        </div>
      )}

      <nav className="leader-tabs">
        {(
          [
            ['fortune', 'Fortune'],
            ['activity', 'Activité'],
            ['game', 'Par jeu'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={board === id ? 'leader-tab on' : 'leader-tab'}
            onClick={() => {
              setBoard(id)
              if (id === 'game' && metric === 'wealth') setMetric('profit')
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {board === 'fortune' && (
        <p className="hint">Cash + crypto, toutes périodes. Les titres et bannières s’affichent sur le podium.</p>
      )}

      {board === 'activity' && (
        <div className="filters">
          <div className="filter-group">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={period === p.id ? 'chip active' : 'chip'}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="filter-group">
            {(
              [
                ['profit', 'Bénéfices'],
                ['wagered', 'Misés'],
                ['playTime', 'Temps de jeu'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={metric === id ? 'chip active' : 'chip'}
                onClick={() => setMetric(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {board === 'game' && (
        <div className="filters">
          <div className="filter-group">
            {GAMES.map((g) => (
              <button
                key={g.id}
                type="button"
                className={scope === g.id ? 'chip active' : 'chip'}
                onClick={() => setScope(g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>
          <div className="filter-group">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={period === p.id ? 'chip active' : 'chip'}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="filter-group">
            {(
              [
                ['profit', 'Bénéfices'],
                ['wagered', 'Misés'],
                ['playTime', 'Temps'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={metric === id ? 'chip active' : 'chip'}
                onClick={() => setMetric(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Podium top={podium} />

      <div className="leader-table">
        <div className="leader-head">
          <span>#</span>
          <span>Joueur</span>
          <span>Valeur</span>
          <span>Fortune</span>
        </div>
        {rows.map((row) => {
          const isYou = row.player.profile.id === user.profile.id
          const display =
            board === 'fortune' || metric === 'wealth'
              ? `${formatMoney(row.value)} LC`
              : metric === 'playTime'
                ? formatDuration(row.value)
                : `${formatMoney(row.value)} LC`
          return (
            <Link
              key={row.player.profile.id}
              to={`/joueur/${row.player.profile.id}`}
              className={`leader-row ${isYou ? 'you' : ''}`}
            >
              <span className="rank">{row.rank}</span>
              <span className="who">
                <img src={row.player.profile.avatar} alt="" />
                <span>
                  {row.player.profile.username}
                  {row.player.profile.title ? <em className="leader-title">{row.player.profile.title}</em> : null}
                  {isYou && <em>toi</em>}
                </span>
              </span>
              <span className={metric === 'profit' && board !== 'fortune' ? (row.value >= 0 ? 'up' : 'down') : ''}>
                {metric === 'profit' && board !== 'fortune' && row.value > 0 ? '+' : ''}
                {display}
              </span>
              <span>{formatMoney(row.wealth)} LC</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
