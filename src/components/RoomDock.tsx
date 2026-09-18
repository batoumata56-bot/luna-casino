import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoom } from '../store/RoomContext'
import { useSocial } from '../store/SocialContext'
import { useCasino } from '../store/CasinoContext'
import { GAMES } from '../lib/constants'
import { formatMoney } from '../lib/format'
import { chipColor, initialsOf, isOnline, relativeTime } from '../lib/social'

const FEED_LABELS: Record<string, string> = {
  buyin: 'prend une cave de',
  cashout: 'récupère',
  bet: 'mise',
  win: 'encaisse',
  lose: 'perd',
  join: 'rejoint la table',
  action: '',
}

function feedLine(type: string, actor: string, payload: Record<string, unknown>): string {
  const amount = Number(payload.amount ?? 0)
  const detail = typeof payload.detail === 'string' ? payload.detail : ''
  const verb = FEED_LABELS[type] ?? type
  if (type === 'join') return `${actor} rejoint la table`
  if (type === 'action') return `${actor} ${detail}`
  if (amount) return `${actor} ${verb} ${formatMoney(amount)} jetons${detail ? ` · ${detail}` : ''}`
  return `${actor} ${verb} ${detail}`.trim()
}

export function RoomDock() {
  const room = useRoom()
  const { friends, invite, me } = useSocial()
  const { user, pushToast } = useCasino()
  const nav = useNavigate()
  const [amount, setAmount] = useState(500)
  const [chatText, setChatText] = useState('')
  const [copied, setCopied] = useState(false)

  const seatedIds = useMemo(
    () => new Set((room?.players ?? []).map((p) => p.userId)),
    [room?.players],
  )

  if (!room) return null
  const { room: table, players, events, me: seat, buyIn, cashOut, push, leave, sitAt } = room

  const meta = GAMES.find((g) => g.id === table?.gameId)
  const chatMessages = events.filter((e) => e.type === 'chat').slice(0, 30)
  const feed = events.filter((e) => e.type !== 'chat').slice(0, 14)

  const sendTableChat = async (e: FormEvent) => {
    e.preventDefault()
    const text = chatText.trim().slice(0, 240)
    if (!text) return
    setChatText('')
    await push('chat', { detail: text })
  }

  const copyCode = async () => {
    if (!table) return
    try {
      await navigator.clipboard.writeText(table.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      pushToast(`Code de la table : ${table.code}`)
    }
  }

  const quit = async () => {
    await leave()
    nav('/salons')
  }

  return (
    <aside className="room-dock">
      <header className="room-dock-head">
        <div>
          <span className="muted">Salon privé</span>
          <strong>{meta?.name ?? table?.gameId}</strong>
        </div>
        <button type="button" className="chip" onClick={copyCode}>
          {copied ? 'Copié ✓' : `Code ${table?.code}`}
        </button>
      </header>

      <div className="room-chips-panel">
        <div className="room-chips-mine">
          <span className="muted">Tes jetons</span>
          <strong style={{ color: me ? chipColor(me) : undefined }}>
            {formatMoney(seat?.chips ?? 0)}
          </strong>
        </div>
        <div className="room-chips-wallet">
          <span className="muted">Portefeuille</span>
          <strong>{formatMoney(user.wallet.cash)} LC</strong>
        </div>
        <div className="room-buyin">
          <input
            type="number"
            min={10}
            step={10}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          />
          <button type="button" className="btn primary" onClick={() => void buyIn(amount)}>
            Caver
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void cashOut()}
            disabled={(seat?.chips ?? 0) <= 0}
          >
            Reprendre
          </button>
        </div>
        <p className="hint">
          Les jetons de table sont séparés de ton portefeuille : cave pour jouer, reprends pour
          reconvertir en LC.
        </p>
      </div>

      <section className="room-roster">
        <h3>Places ({players.length}/{table?.maxPlayers ?? 0})</h3>
        <ul>
          {Array.from({ length: table?.maxPlayers ?? 0 }, (_, i) => {
            const p = players.find((x) => x.seat === i)
            if (p) {
              return (
                <li key={p.userId} className={p.userId === me ? 'is-me' : undefined}>
                  <span className="room-dot" style={{ background: chipColor(p.userId) }} />
                  <span className="room-name">
                    {p.username}
                    {p.userId === table?.hostId && <em className="room-host">hôte</em>}
                  </span>
                  <span className="room-stack">{formatMoney(p.chips)}</span>
                </li>
              )
            }
            return (
              <li key={`empty-${i}`} className="seat-empty">
                <button type="button" className="seat-plus" onClick={() => void sitAt(i)}>
                  +
                </button>
                <span className="muted">Place {i + 1} libre</span>
              </li>
            )
          })}
        </ul>
      </section>

      {friends.length > 0 && (
        <section className="room-invite">
          <h3>Inviter un ami</h3>
          <ul>
            {friends
              .filter((f) => !seatedIds.has(f.id))
              .map((f) => (
                <li key={f.id}>
                  <span className="room-avatar">{initialsOf(f.username)}</span>
                  <span className="room-name">
                    {f.username}
                    <em className={isOnline(f.lastSeen) ? 'on' : 'off'}>
                      {isOnline(f.lastSeen) ? 'en ligne' : relativeTime(f.lastSeen)}
                    </em>
                  </span>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      if (!table) return
                      void invite(table.id, f.id, table.gameId)
                      pushToast(`Invitation envoyée à ${f.username}`)
                    }}
                  >
                    Inviter
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="room-feed">
        <h3>En direct</h3>
        {feed.length === 0 && <p className="muted">Les actions de la table s’afficheront ici.</p>}
        <ul>
          {feed.map((e) => (
            <li key={e.id}>
              <span className="room-dot" style={{ background: chipColor(e.actorId ?? '') }} />
              {feedLine(e.type, e.actorName ?? 'Joueur', e.payload)}
            </li>
          ))}
        </ul>
      </section>

      <section className="room-chat">
        <h3>Chat de table</h3>
        <div className="room-chat-log">
          {[...chatMessages].reverse().map((m) => (
            <p key={m.id}>
              <strong style={{ color: chipColor(m.actorId ?? '') }}>{m.actorName}</strong>{' '}
              {String(m.payload.detail ?? '')}
            </p>
          ))}
        </div>
        <form onSubmit={sendTableChat}>
          <input
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="Parler à la table…"
            maxLength={240}
          />
          <button type="submit" className="btn">
            Envoyer
          </button>
        </form>
      </section>

      <button type="button" className="btn danger" onClick={() => void quit()}>
        Quitter la table
      </button>
    </aside>
  )
}
