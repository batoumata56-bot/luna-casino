import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GAMES } from '../lib/constants'
import { GAME_COMPONENTS } from '../games/registry'
import { useSocial } from '../store/SocialContext'
import { useCasino } from '../store/CasinoContext'
import { initialsOf, isOnline } from '../lib/social'
import { MULTIPLAYER_GAME_IDS, type GameId } from '../types'

function PlayWithFriends({ gameId }: { gameId: GameId }) {
  const { cloud, me, friends, createRoom, invite } = useSocial()
  const { pushToast } = useCasino()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)

  if (!MULTIPLAYER_GAME_IDS.includes(gameId)) return null
  if (!cloud || !me) {
    return (
      <p className="hint">
        <Link to="/compte">Crée un compte</Link> pour jouer à cette table avec des amis.
      </p>
    )
  }

  const openTable = async (friendId?: string) => {
    const room = await createRoom(gameId, 0)
    if (!room) {
      pushToast('Impossible de créer la table')
      return
    }
    if (friendId) await invite(room.id, friendId, gameId)
    nav(`/salon/${room.id}`)
  }

  return (
    <div className="mp-launch">
      <button type="button" className="btn" onClick={() => setOpen((v) => !v)}>
        Jouer avec des amis
      </button>
      {open && (
        <div className="mp-launch-panel">
          <button type="button" className="chip active" onClick={() => void openTable()}>
            Ouvrir un salon
          </button>
          <Link className="chip" to="/salons">
            Tous les salons
          </Link>
          {friends.map((f) => (
            <button key={f.id} type="button" className="chip" onClick={() => void openTable(f.id)}>
              <span className="room-avatar">{initialsOf(f.username)}</span>
              {f.username}
              {isOnline(f.lastSeen) ? ' ·' : ''}
            </button>
          ))}
          {friends.length === 0 && (
            <span className="muted">
              Pas encore d’amis — <Link to="/amis">en ajouter</Link>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function GamesPage() {
  const { gameId } = useParams()
  const active = GAMES.find((g) => g.id === gameId)

  if (gameId && active && gameId in GAME_COMPONENTS) {
    const Render = GAME_COMPONENTS[gameId as GameId]
    return (
      <div className="page game-page">
        <Link to="/jeux" className="back">
          ← Jeux
        </Link>
        <header className="page-head">
          <h1>{active.name}</h1>
          <p>{active.tagline}</p>
        </header>
        <PlayWithFriends gameId={active.id} />
        <Render />
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Jeux</h1>
        <p>{GAMES.length} tables — classiques casino & hits crypto, argent fictif.</p>
      </header>
      <div className="game-tiles large">
        {GAMES.map((g) => (
          <Link
            key={g.id}
            to={`/jeux/${g.id}`}
            className="game-tile"
            style={{ ['--accent' as string]: g.accent }}
          >
            <h3>{g.name}</h3>
            <p>{g.tagline}</p>
            {MULTIPLAYER_GAME_IDS.includes(g.id) && <span className="tile-mp">Multijoueur</span>}
            <span className="tile-go">Ouvrir →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
