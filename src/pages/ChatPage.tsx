import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSocial } from '../store/SocialContext'
import { useCasino } from '../store/CasinoContext'
import { chipColor, initialsOf, isOnline } from '../lib/social'

function timeLabel(t: number): string {
  return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function ChatPage() {
  const {
    cloud,
    me,
    friends,
    general,
    dmMessages,
    activeDm,
    openDm,
    sendChat,
    unreadDm,
  } = useSocial()
  const { pushToast } = useCasino()
  const [text, setText] = useState('')
  const logRef = useRef<HTMLDivElement | null>(null)

  const messages = activeDm ? dmMessages : general
  const peer = friends.find((f) => f.id === activeDm)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, activeDm])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    const ok = await sendChat(body, activeDm)
    if (!ok) {
      setText(body)
      pushToast('Message non envoyé — relance supabase/schema.sql si le chat est vide.')
    }
  }

  if (!cloud || !me) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Chat</h1>
          <p>Connecte-toi pour discuter avec les autres joueurs.</p>
        </header>
        <Link className="btn primary" to="/compte">
          Créer un compte / se connecter
        </Link>
      </div>
    )
  }

  return (
    <div className="page chat-page">
      <header className="page-head">
        <h1>Chat</h1>
        <p>Salon général ouvert à tous, et conversations privées avec tes amis.</p>
      </header>

      <div className="chat-layout">
        <nav className="chat-rooms">
          <button
            type="button"
            className={!activeDm ? 'chat-room active' : 'chat-room'}
            onClick={() => openDm(null)}
          >
            <span className="room-avatar">#</span>
            <span className="room-name">
              Général
              <em>Tout le casino</em>
            </span>
          </button>

          <h3>Amis</h3>
          {friends.length === 0 && (
            <p className="muted">
              Aucun ami — <Link to="/amis">en ajouter</Link>
            </p>
          )}
          {friends.map((f) => (
            <button
              key={f.id}
              type="button"
              className={activeDm === f.id ? 'chat-room active' : 'chat-room'}
              onClick={() => openDm(f.id)}
            >
              <span className="room-avatar" style={{ borderColor: chipColor(f.id) }}>
                {initialsOf(f.username)}
              </span>
              <span className="room-name">
                {f.username}
                <em className={isOnline(f.lastSeen) ? 'on' : 'off'}>
                  {isOnline(f.lastSeen) ? 'en ligne' : 'hors ligne'}
                </em>
              </span>
              {unreadDm[f.id] ? <span className="chat-badge">{unreadDm[f.id]}</span> : null}
            </button>
          ))}
        </nav>

        <section className="chat-main">
          <header className="chat-main-head">
            <strong>{activeDm ? peer?.username ?? 'Conversation' : 'Salon général'}</strong>
            <span className="muted">
              {activeDm ? 'Privé — visible par vous deux' : 'Visible par tous les joueurs'}
            </span>
          </header>

          <div className="chat-log" ref={logRef}>
            {messages.length === 0 && (
              <p className="muted chat-empty">Aucun message. Lance la conversation !</p>
            )}
            {messages.map((m) => (
              <article key={m.id} className={m.authorId === me ? 'chat-msg mine' : 'chat-msg'}>
                <span className="chat-msg-avatar" style={{ background: chipColor(m.authorId) }}>
                  {initialsOf(m.authorName)}
                </span>
                <div>
                  <header>
                    <strong>{m.authorName}</strong>
                    <span className="muted">{timeLabel(m.createdAt)}</span>
                  </header>
                  <p>{m.body}</p>
                </div>
              </article>
            ))}
          </div>

          <form className="chat-form" onSubmit={submit}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={activeDm ? `Message à ${peer?.username ?? '…'}` : 'Écrire au salon…'}
              maxLength={400}
            />
            <button type="submit" className="btn primary" disabled={!text.trim()}>
              Envoyer
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
