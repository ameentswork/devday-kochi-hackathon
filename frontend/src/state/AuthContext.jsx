import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUid } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(() => !getToken())

  useEffect(() => {
    if (ready) return // no stored session
    api('/api/auth/me')
      .then((d) => {
        setUser(d.user)
        setUid(d.user.id)
      })
      .catch(() => {
        setToken(null)
        setUid(null)
      })
      .finally(() => setReady(true))
  }, [ready])

  async function login(email, password) {
    const d = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    setToken(d.token)
    setUid(d.user.id)
    setUser(d.user)
    return d.user
  }

  async function signup(name, email, password) {
    const d = await api('/api/auth/signup', {
      method: 'POST',
      body: { name, email, password },
    })
    setToken(d.token)
    setUid(d.user.id)
    setUser(d.user)
    return d.user
  }

  async function demoLogin(role) {
    const d = await api('/api/auth/demo', {
      method: 'POST',
      body: { role },
    })
    setToken(d.token)
    setUid(d.user.id)
    setUser(d.user)
    return d.user
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch {
      // token removal matters, not the server call
    }
    setToken(null)
    setUid(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({ user, ready, login, signup, demoLogin, logout }),
    [user, ready],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
