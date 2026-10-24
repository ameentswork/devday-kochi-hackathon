import { Route, Routes } from 'react-router-dom'
import { DraftProvider } from './state/DraftContext'
import { ToastProvider } from './components/Toast'
import TabBar from './components/TabBar'
import Home from './screens/Home'
import Capture from './screens/Capture'
import Review from './screens/Review'
import Memories from './screens/Memories'
import Detail from './screens/Detail'
import Settings from './screens/Settings'

export default function App() {
  return (
    <DraftProvider>
      <ToastProvider>
        <div className="app-shell">
          <TabBar />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/capture" element={<Capture />} />
              <Route path="/review" element={<Review />} />
              <Route path="/memories" element={<Memories />} />
              <Route path="/entry/:id" element={<Detail />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </ToastProvider>
    </DraftProvider>
  )
}
