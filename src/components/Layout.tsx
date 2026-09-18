import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useCasino } from '../store/CasinoContext'
import { useAuth } from '../store/AuthContext'
import { useSocial } from '../store/SocialContext'
import { formatMoney, wealthOf } from '../lib/format'
import { GAMES } from '../lib/constants'
import { useEffect } from 'react'

function InviteToasts() {
  const { invites, acceptInvite, declineInvite } = useSocial()
  const nav = useNavigate()
  if (invites.length === 0) return null

  return (
    <div className="invite-stack">
      {invites.slice(0, 3).map((inv) => (
        <div className="invite-card" key={inv.id}>
          <div>
            <strong>{inv.fromName}</strong> t’invite à jouer
            <em> {GAMES.find((g) => g.id === inv.gameId)?.name ?? inv.gameId}</em>
          </div>
          <div className="btn-row">
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
              Plus tard
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function Layout() {
  const { user, rates, toast, clearToast } = useCasino()
  const { username, userId, cloud } = useAuth()
  const { totalUnread, incoming } = useSocial()
  const wealth = wealthOf(user.wallet, rates)
  const friendBadge = incoming.length

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(clearToast, 2800)
    return () => clearTimeout(t)
  }, [toast, clearToast])

  return (
    <div className="app-shell">
      <div className="bg-glow" aria-hidden />
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden />
          <span className="brand-text">
            <strong>LUNA</strong>
            <em>Casino</em>
          </span>
        </NavLink>

        <nav className="nav">
          <NavLink to="/" end>
            Accueil
          </NavLink>
          <NavLink to="/jeux">Jeux</NavLink>
          <NavLink to="/classement">Classement</NavLink>
          <NavLink to="/salons">Salons</NavLink>
          <NavLink to="/inventaire">Inventaire</NavLink>
          <NavLink to="/amis">
            Amis
            {friendBadge > 0 && <span className="nav-badge">{friendBadge}</span>}
          </NavLink>
          <NavLink to="/chat">
            Chat
            {totalUnread > 0 && <span className="nav-badge">{totalUnread}</span>}
          </NavLink>
          <NavLink to="/portefeuille">Portefeuille</NavLink>
          <NavLink to="/profil">Profil</NavLink>
          <NavLink to="/compte">{userId ? username ?? 'Compte' : 'Compte'}</NavLink>
        </nav>

        <div className="wallet-chip">
          <div>
            <span className="muted">Cash</span>
            <strong>{formatMoney(user.wallet.cash)} LC</strong>
          </div>
          <div>
            <span className="muted">Fortune</span>
            <strong>{formatMoney(wealth)} LC</strong>
          </div>
          {cloud && userId && (
            <div>
              <span className="muted">Cloud</span>
              <strong>ON</strong>
            </div>
          )}
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <p>Argent et crypto 100% fictifs — divertissement uniquement. Aucun dépôt réel.</p>
      </footer>

      <InviteToasts />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
