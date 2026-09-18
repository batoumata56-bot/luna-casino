import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'

export function AuthPage() {
  const { cloud, register, login, error, username, userId, logout } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [localMsg, setLocalMsg] = useState<string | null>(null)
  const nav = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setLocalMsg(null)
    const ok = mode === 'register' ? await register(pseudo, password) : await login(pseudo, password)
    setBusy(false)
    if (ok) {
      setLocalMsg(mode === 'register' ? 'Compte créé — bienvenue !' : 'Connecté')
      window.setTimeout(() => nav('/'), 600)
    }
  }

  if (userId && username) {
    return (
      <div className="page auth-page">
        <header className="page-head">
          <h1>Compte</h1>
          <p>
            Connecté en tant que <strong>{username}</strong>
          </p>
        </header>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => logout()}>
            Se déconnecter
          </button>
          <Link className="btn primary" to="/">
            Jouer
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page auth-page">
      <header className="page-head">
        <h1>{mode === 'register' ? 'Créer un compte' : 'Connexion'}</h1>
        <p>Pseudo + mot de passe — progression sauvegardée dans le cloud.</p>
      </header>

      {!cloud && (
        <div className="auth-warn">
          Cloud non branché pour l’instant. Le site peut être en ligne, mais les comptes
          nécessitent Supabase (gratuit). Dis-moi quand tu as créé le projet et je branche les
          clés.
        </div>
      )}

      <div className="btn-row" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={mode === 'register' ? 'chip active' : 'chip'}
          onClick={() => setMode('register')}
        >
          Inscription
        </button>
        <button
          type="button"
          className={mode === 'login' ? 'chip active' : 'chip'}
          onClick={() => setMode('login')}
        >
          Connexion
        </button>
      </div>

      <form className="edit-form auth-form" onSubmit={submit}>
        <label>
          Pseudo
          <input
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={20}
            required
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={6}
            required
          />
        </label>
        {(error || localMsg) && (
          <p className={error ? 'down' : 'up'}>{error || localMsg}</p>
        )}
        <button type="submit" className="btn primary" disabled={busy || !cloud}>
          {busy ? '…' : mode === 'register' ? 'Créer mon compte' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
