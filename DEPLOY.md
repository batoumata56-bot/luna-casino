# LUNA Casino — déploiement

## 1) Comptes, amis, chat (Supabase gratuit)

1. Crée un projet sur https://supabase.com (free)
2. SQL Editor → colle **tout** `supabase/schema.sql` → Run
3. Authentication → Sign In / Providers → Email → **désactive Confirm email**
4. Project Settings → API → copie URL + `anon` key
5. Crée `.env.local` :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> **À rejouer après chaque mise à jour du schéma.** Le fichier est idempotent : tu peux
> le relancer autant de fois que tu veux sans casser les comptes existants. Il crée les
> tables `profiles`, `friendships`, `chat_messages`, `game_rooms`, `room_players`,
> `room_events`, `game_invites`, et active Realtime dessus.

### Temps réel

Le script ajoute les tables à la publication `supabase_realtime`. Vérifie dans
Database → Replication que la publication contient bien les 7 tables. Si le temps réel
n'est pas disponible sur ton plan, le site continue de fonctionner : il repasse
automatiquement sur un rafraîchissement périodique (toutes les 6 à 20 s).

## 2) Mise en ligne (Vercel gratuit)

```
npm run build
npx vercel --prod --yes
```

Ajoute les mêmes variables d’environnement dans Vercel → Project → Settings → Environment Variables.

Après chaque correction : rebuild + `npx vercel --prod`.

## 3) Ce qui est en ligne vs local

| Donnée | Stockage |
| --- | --- |
| Compte, portefeuille, statistiques | Supabase (`profiles`) + cache local |
| Classement et podium | Supabase — **uniquement des comptes réels**, aucun bot |
| Amis, demandes, invitations | Supabase (`friendships`, `game_invites`) |
| Chat général et messages privés | Supabase (`chat_messages`) |
| Tables privées et jetons de table | Supabase (`game_rooms`, `room_players`, `room_events`) |
| Virements par pseudo | Supabase (`transfer_lc` + `transfers`) |
| Cosmétiques (caisses) | `profiles.owned` / `title` / `cardback` |
| Cooldown du bonus | Local (`localStorage`) — **fortune totale** < 5000 LC |
| Cours crypto | Local, simulés |
