import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AVATAR_PRESETS, BANNER_PRESETS, resolveBanner } from '../lib/constants'
import { useCasino } from '../store/CasinoContext'
import { formatDuration, formatMoney, wealthOf } from '../lib/format'

export function ProfilePage() {
  const { user, rates, updateProfile, resetAccount } = useCasino()
  const [username, setUsername] = useState(user.profile.username)
  const [bio, setBio] = useState(user.profile.bio)
  const [banner, setBanner] = useState(user.profile.banner)
  const [avatar, setAvatar] = useState(user.profile.avatar)
  const [customBanner, setCustomBanner] = useState('')
  const [customAvatar, setCustomAvatar] = useState('')

  const save = () => {
    updateProfile({
      username: username.trim().slice(0, 20) || 'Joueur',
      bio: bio.trim().slice(0, 140),
      banner: customBanner.trim() || banner,
      avatar: customAvatar.trim() || avatar,
    })
    if (customBanner.trim()) setBanner(customBanner.trim())
    if (customAvatar.trim()) setAvatar(customAvatar.trim())
  }

  const wealth = wealthOf(user.wallet, rates)

  return (
    <div className="page profile-edit">
      <header className="page-head">
        <h1>Ton profil</h1>
        <p>Bannière, avatar, bio — ou ouvre des caisses dans l’inventaire.</p>
      </header>
      <p>
        <Link className="btn" to="/inventaire">
          Ouvrir l’inventaire
        </Link>
      </p>

      <div className="preview-frame">
        <div className="profile-banner" style={{ background: resolveBanner(customBanner || banner) }} />
        <div className="profile-main">
          <img src={customAvatar || avatar} alt="" className="profile-avatar" />
          <div>
            <h2>{username || 'Joueur'}</h2>
            {user.profile.title ? <p className="profile-title">{user.profile.title}</p> : null}
            <p className="profile-bio">{bio || 'Aucune bio.'}</p>
            <p className="profile-wealth">
              Fortune · <strong>{formatMoney(wealth)} LC</strong>
            </p>
          </div>
        </div>
      </div>

      <form
        className="edit-form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <label>
          Pseudo
          <input value={username} maxLength={20} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          Mini bio
          <textarea value={bio} maxLength={140} rows={3} onChange={(e) => setBio(e.target.value)} />
        </label>

        <fieldset>
          <legend>Bannières proposées</legend>
          <div className="banner-picks">
            {BANNER_PRESETS.filter((b) => user.profile.owned?.includes(b.id)).map((b) => (
              <button
                key={b.id}
                type="button"
                className={`banner-pick ${banner === b.id && !customBanner ? 'active' : ''}`}
                style={{ background: b.css }}
                onClick={() => {
                  setBanner(b.id)
                  setCustomBanner('')
                }}
                title={b.name}
              >
                <span>{b.name}</span>
              </button>
            ))}
          </div>
          <label>
            Ou image personnalisée (URL)
            <input
              placeholder="https://…"
              value={customBanner}
              onChange={(e) => setCustomBanner(e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Avatars proposés</legend>
          <div className="avatar-picks">
            {AVATAR_PRESETS.filter((a) => user.profile.owned?.includes(a.id)).map((a) => (
              <button
                key={a.id}
                type="button"
                className={`avatar-pick ${avatar === a.url && !customAvatar ? 'active' : ''}`}
                onClick={() => {
                  setAvatar(a.url)
                  setCustomAvatar('')
                }}
              >
                <img src={a.url} alt={a.name} />
              </button>
            ))}
          </div>
          <label>
            Ou image de profil (URL)
            <input
              placeholder="https://…"
              value={customAvatar}
              onChange={(e) => setCustomAvatar(e.target.value)}
            />
          </label>
        </fieldset>

        <div className="stats-readout">
          <div>
            <span>Temps (jour)</span>
            <strong>{formatDuration(user.stats.daily.playTimeMs)}</strong>
          </div>
          <div>
            <span>Pariés (jour)</span>
            <strong>{formatMoney(user.stats.daily.wagered)} LC</strong>
          </div>
          <div>
            <span>Bénéfice (jour)</span>
            <strong>{formatMoney(user.stats.daily.profit)} LC</strong>
          </div>
        </div>

        <div className="btn-row">
          <button type="submit" className="btn primary">
            Enregistrer
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (confirm('Réinitialiser compte et stats ?')) resetAccount()
            }}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  )
}
