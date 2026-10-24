import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './state/AuthContext'
import { DraftProvider } from './state/DraftContext'
import { ToastProvider } from './components/Toast'
import TabBar from './components/TabBar'
import Auth from './screens/Auth'
import Home from './screens/Home'
import AdminHome from './screens/AdminHome'
import AdminMembers from './screens/AdminMembers'
import Capture from './screens/Capture'
import Review from './screens/Review'
import Memories from './screens/Memories'
import Detail from './screens/Detail'
import Settings from './screens/Settings'

function Shell() {
  const { user, ready } = useAuth()

  if (!ready) {
    return (
      <div className="auth-wrap">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!user) return <Auth />

  return (
    <div className="app-shell">
      <TabBar />
      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={user.role === 'admin' ? <AdminHome /> : <Home />}
          />
          <Route path="/capture" element={<Capture />} />
          <Route path="/review" element={<Review />} />
          <Route path="/memories" element={<Memories />} />
          <Route path="/entry/:id" element={<Detail />} />
          <Route path="/settings" element={<Settings />} />
          <Route
            path="/admin/members"
            element={
              user.role === 'admin' ? (
                <AdminMembers />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <DraftProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </DraftProvider>
    </AuthProvider>
  )
}
