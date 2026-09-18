import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './store/AuthContext'
import { CasinoProvider } from './store/CasinoContext'
import { SocialProvider } from './store/SocialContext'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { GamesPage } from './pages/GamesPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { ProfilePage } from './pages/ProfilePage'
import { WalletPage } from './pages/WalletPage'
import { PlayerPage } from './pages/PlayerPage'
import { AuthPage } from './pages/AuthPage'
import { FriendsPage } from './pages/FriendsPage'
import { ChatPage } from './pages/ChatPage'
import { RoomPage } from './pages/RoomPage'
import { InventoryPage } from './pages/InventoryPage'
import { RoomsPage } from './pages/RoomsPage'
import './social.css'

export default function App() {
  return (
    <AuthProvider>
      <CasinoProvider>
        <SocialProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="jeux" element={<GamesPage />} />
                <Route path="jeux/:gameId" element={<GamesPage />} />
                <Route path="classement" element={<LeaderboardPage />} />
                <Route path="portefeuille" element={<WalletPage />} />
                <Route path="profil" element={<ProfilePage />} />
                <Route path="compte" element={<AuthPage />} />
                <Route path="amis" element={<FriendsPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="salons" element={<RoomsPage />} />
                <Route path="salon/:roomId" element={<RoomPage />} />
                <Route path="inventaire" element={<InventoryPage />} />
                <Route path="joueur/:id" element={<PlayerPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SocialProvider>
      </CasinoProvider>
    </AuthProvider>
  )
}
