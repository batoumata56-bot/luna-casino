import { Link, useParams } from 'react-router-dom'
import { RoomProvider, useRoom } from '../store/RoomContext'
import { RoomDock } from '../components/RoomDock'
import { GAME_COMPONENTS } from '../games/registry'
import { GAMES } from '../lib/constants'
import { useSocial } from '../store/SocialContext'
import type { GameId } from '../types'

function SeatRail() {
  const room = useRoom()
  if (!room?.room) return null
  const max = room.room.maxPlayers
  const bySeat = new Map(room.players.map((p) => [p.seat, p]))
  return (
    <ol className="seat-rail">
      {Array.from({ length: max }, (_, i) => {
        const p = bySeat.get(i)
        if (p) {
          return (
            <li key={i} className={p.userId === room.me?.userId ? 'is-me' : undefined}>
              <span className="room-avatar">{p.username.slice(0, 2).toUpperCase()}</span>
              <strong>{p.username}</strong>
              <em>Place {i + 1}</em>
            </li>
          )
        }
        return (
          <li key={i} className="seat-empty">
            <button type="button" className="seat-plus" onClick={() => void room.sitAt(i)} aria-label={`S’asseoir place ${i + 1}`}>
              +
            </button>
            <em>Place {i + 1}</em>
          </li>
        )
      })}
    </ol>
  )
}

function RoomBody() {
  const room = useRoom()
  if (!room) return null

  if (room.loading) {
    return <p className="muted">Ouverture de la table…</p>
  }

  if (!room.room) {
    return (
      <div className="page-head">
        <h2>Table introuvable</h2>
        <p>Elle a peut-être été fermée par son hôte.</p>
        <Link className="btn primary" to="/salons">
          Retour aux salons
        </Link>
      </div>
    )
  }

  const gameId = room.room.gameId as GameId
  const meta = GAMES.find((g) => g.id === gameId)
  const Render = GAME_COMPONENTS[gameId]

  return (
    <>
      <header className="page-head">
        <h1>{meta?.name ?? gameId} — salon {room.room.code}</h1>
        <p>
          Clique <strong>+</strong> pour t’asseoir. Code à partager : <strong>{room.room.code}</strong>.
          Les jetons de table sont distincts du portefeuille.
        </p>
      </header>
      <SeatRail />
      <div className="room-layout">
        <div className="room-game">{Render ? <Render /> : <p>Jeu indisponible</p>}</div>
        <RoomDock />
      </div>
    </>
  )
}

export function RoomPage() {
  const { roomId } = useParams()
  const { cloud, me } = useSocial()

  if (!roomId) return null

  if (!cloud || !me) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Table privée</h1>
          <p>Connecte-toi pour rejoindre la table.</p>
        </header>
        <Link className="btn primary" to="/compte">
          Se connecter
        </Link>
      </div>
    )
  }

  return (
    <div className="page room-page">
      <Link to="/salons" className="back">
        ← Salons
      </Link>
      <RoomProvider roomId={roomId}>
        <RoomBody />
      </RoomProvider>
    </div>
  )
}
