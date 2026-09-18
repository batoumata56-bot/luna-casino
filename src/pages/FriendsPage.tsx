import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSocial } from '../store/SocialContext'
import { useCasino } from '../store/CasinoContext'
import { GAMES } from '../lib/constants'
import { formatMoney } from '../lib/format'
import { chipColor, initialsOf, isOnline, relativeTime } from '../lib/social'
import { MULTIPLAYER_GAME_IDS, type GameId } from '../types'

const MP_GAMES = GAMES.filter((g) => MULTIPLAYER_GAME_IDS.includes(g.id))

export function FriendsPage() {
  const {
    cloud,
    me,
    directory,
    friends,
    incoming,
    outgoing,
    relationWith,
    addFriend,
    acceptFriend,
    removeFriend,
    invites,
    acceptInvite,
    declineInvite,
    createRoom,
    invite,
    openDm,
    unreadDm,
    joinRoomByCode,
  } = useSocial()
  const { pushToast } = useCasino()
  const nav = useNavigate()

  const [query, setQuery] = useState('')
  const [inviteTarget, setInviteTarget] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return directory
      .filter((p) => p.id !== me)
      .filter((p) => (q ? p.username.toLowerCase().includes(q) : true))
      .sort((a, b) => b.wealth - a.wealth)
      .slice(0, q ? 25 : 12)
  }, [directory, query, me])

  const startTable = async (friendId: string, gameId: GameId) => {
    const room = await createRoom(gameId, 0)
    if (!room) {
      pushToast('Impossible de créer la table')
      return
    }
    await invite(room.id, friendId, gameId)
    pushToast('Invitation envoyée — la table est ouverte')
    setInviteTarget(null)
    nav(`/salon/${room.id}`)
  }

  if (!cloud || !me) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Amis</h1>
          <p>Connecte-toi pour ajouter des amis, discuter et jouer ensemble.</p>
        </header>
        <Link className="btn primary" to="/compte">
          Créer un compte / se connecter
        </Link>
      </div>
    )
  }

  return (
    <div className="page social-page">
      <header className="page-head">
        <h1>Amis</h1>
        <p>Ajoute des joueurs, discute et lance des tables privées en temps réel.</p>
      </header>

      {invites.length > 0 && (
        <section className="social-block invites-block">
          <h2>Invitations à jouer</h2>
          <ul className="social-list">
            {invites.map((inv) => (
              <li key={inv.id}>
                <span className="room-dot" style={{ background: chipColor(inv.fromId) }} />
                <span className="room-name">
                  {inv.fromName}
                  <em>{GAMES.find((g) => g.id === inv.gameId)?.name ?? inv.gameId}</em>
                </span>
                <span className="btn-row">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={async () => {
                      const roomId = await acceptInvite(inv)
                      if (roomId) nav(`/salon/${roomId}`)
                    }}
                  >
                    Rejoindre
                  </button>
                  <button type="button" className="btn" onClick={() => void declineInvite(inv.id)}>
                    Refuser
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {incoming.length > 0 && (
        <section className="social-block">
          <h2>Demandes reçues</h2>
          <ul className="social-list">
            {incoming.map(({ friendship, profile }) => (
              <li key={friendship.id}>
                <span className="room-avatar">{initialsOf(profile.username)}</span>
                <span className="room-name">{profile.username}</span>
                <span className="btn-row">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => void acceptFriend(friendship.id)}
                  >
                    Accepter
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void removeFriend(profile.id)}
                  >
                    Ignorer
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="social-block">
        <h2>Mes amis ({friends.length})</h2>
        {friends.length === 0 && (
          <p className="muted">Personne pour l’instant — cherche un pseudo plus bas.</p>
        )}
        <ul className="social-list">
          {friends.map((f) => (
            <li key={f.id}>
              <span className="room-avatar" style={{ borderColor: chipColor(f.id) }}>
                {initialsOf(f.username)}
              </span>
              <span className="room-name">
                <Link to={`/joueur/${f.id}`}>{f.username}</Link>
                <em className={isOnline(f.lastSeen) ? 'on' : 'off'}>
                  {isOnline(f.lastSeen) ? 'en ligne' : relativeTime(f.lastSeen)} ·{' '}
                  {formatMoney(f.wealth)} LC
                </em>
              </span>
              <span className="btn-row">
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    openDm(f.id)
                    nav('/chat')
                  }}
                >
                  Message{unreadDm[f.id] ? ` (${unreadDm[f.id]})` : ''}
                </button>
                <button
                  type="button"
                  className="chip active"
                  onClick={() => setInviteTarget(inviteTarget === f.id ? null : f.id)}
                >
                  Jouer
                </button>
                <button type="button" className="chip" onClick={() => void removeFriend(f.id)}>
                  Retirer
                </button>
              </span>
              {inviteTarget === f.id && (
                <div className="invite-games">
                  {MP_GAMES.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className="chip"
                      style={{ borderColor: g.accent }}
                      onClick={() => void startTable(f.id, g.id)}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="social-block">
        <h2>Trouver des joueurs</h2>
        <div className="social-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un pseudo…"
          />
        </div>
        <ul className="social-list">
          {results.map((p) => {
            const rel = relationWith(p.id)
            return (
              <li key={p.id}>
                <span className="room-avatar">{initialsOf(p.username)}</span>
                <span className="room-name">
                  <Link to={`/joueur/${p.id}`}>{p.username}</Link>
                  <em className={isOnline(p.lastSeen) ? 'on' : 'off'}>
                    {formatMoney(p.wealth)} LC ·{' '}
                    {isOnline(p.lastSeen) ? 'en ligne' : relativeTime(p.lastSeen)}
                  </em>
                </span>
                {rel === 'none' && (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={async () => {
                      const err = await addFriend(p.id)
                      pushToast(err ?? `Demande envoyée à ${p.username}`)
                    }}
                  >
                    Ajouter
                  </button>
                )}
                {rel === 'sent' && <span className="muted">Demande envoyée</span>}
                {rel === 'received' && (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={async () => {
                      await addFriend(p.id)
                      pushToast(`${p.username} est maintenant ton ami`)
                    }}
                  >
                    Accepter
                  </button>
                )}
                {rel === 'friend' && <span className="up">Ami</span>}
              </li>
            )
          })}
          {results.length === 0 && <li className="muted">Aucun joueur trouvé.</li>}
        </ul>
        {outgoing.length > 0 && (
          <p className="hint">
            En attente : {outgoing.map((o) => o.profile.username).join(', ')}
          </p>
        )}
      </section>

      <section className="social-block">
        <h2>Rejoindre une table par code</h2>
        <div className="social-search">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex. K7P2M"
            maxLength={5}
          />
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              const roomId = await joinRoomByCode(code)
              if (roomId) nav(`/salon/${roomId}`)
              else pushToast('Table introuvable')
            }}
          >
            Rejoindre
          </button>
        </div>
      </section>
    </div>
  )
}
