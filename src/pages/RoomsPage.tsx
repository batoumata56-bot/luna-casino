import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSocial } from '../store/SocialContext'
import { useCasino } from '../store/CasinoContext'
import { GAMES } from '../lib/constants'
import { MULTIPLAYER_GAME_IDS, type GameId } from '../types'

const MP = GAMES.filter((g) => MULTIPLAYER_GAME_IDS.includes(g.id))

export function RoomsPage() {
  const { cloud, me, createRoom, joinRoomByCode, invite, friends, lobbies, refreshLobbies } = useSocial()
  const { pushToast } = useCasino()
  const nav = useNavigate()
  const [gameId, setGameId] = useState<GameId>('blackjack')
  const [seats, setSeats] = useState(4)
  const [code, setCode] = useState('')
  const [inviteId, setInviteId] = useState('')

  useEffect(() => {
    void refreshLobbies()
  }, [refreshLobbies])

  if (!cloud || !me) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Salons</h1>
          <p>Connecte-toi pour créer ou rejoindre une table.</p>
        </header>
        <Link className="btn primary" to="/compte">
          Se connecter
        </Link>
      </div>
    )
  }

  const create = async () => {
    const room = await createRoom(gameId, 0, seats)
    if (!room) {
      pushToast('Impossible de créer le salon — vérifie le schéma SQL')
      return
    }
    if (inviteId) await invite(room.id, inviteId, gameId)
    nav(`/salon/${room.id}`)
  }

  return (
    <div className="page rooms-page">
      <header className="page-head">
        <h1>Salons de jeu</h1>
        <p>Crée une table, partage le code, ou assieds-toi via une invitation.</p>
      </header>

      <section className="social-block">
        <h2>Créer un salon</h2>
        <div className="filter-group">
          {MP.map((g) => (
            <button
              key={g.id}
              type="button"
              className={gameId === g.id ? 'chip active' : 'chip'}
              onClick={() => setGameId(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
        <div className="filter-group">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              className={seats === n ? 'chip active' : 'chip'}
              onClick={() => setSeats(n)}
            >
              {n} places
            </button>
          ))}
        </div>
        {friends.length > 0 && (
          <label>
            Inviter un ami (optionnel)
            <select value={inviteId} onChange={(e) => setInviteId(e.target.value)}>
              <option value="">Personne pour l’instant</option>
              {friends.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.username}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="btn primary" onClick={() => void create()}>
          Ouvrir la table
        </button>
      </section>

      <section className="social-block">
        <h2>Rejoindre par code</h2>
        <div className="social-search">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex. K7P2M"
            maxLength={6}
          />
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              const id = await joinRoomByCode(code)
              if (id) nav(`/salon/${id}`)
              else pushToast('Salon introuvable')
            }}
          >
            Entrer
          </button>
        </div>
      </section>

      <section className="social-block">
        <h2>Tables ouvertes</h2>
        {lobbies.length === 0 && <p className="muted">Aucun salon en lobby pour le moment.</p>}
        <ul className="social-list">
          {lobbies.map((r) => (
            <li key={r.id}>
              <span className="room-name">
                {GAMES.find((g) => g.id === r.gameId)?.name ?? r.gameId}
                <em>
                  Code {r.code} · {r.maxPlayers} places
                </em>
              </span>
              <button type="button" className="btn" onClick={() => nav(`/salon/${r.id}`)}>
                Voir
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
