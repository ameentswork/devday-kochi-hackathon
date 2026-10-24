import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const DIST = path.join(__dirname, '..', 'frontend', 'dist')
const DATA_FILE =
  process.env.VOICE_DIARY_DATA || path.join(__dirname, 'data.json')
const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000 // 7 days
const STARTED_AT = new Date().toISOString()

// ---------- tiny JSON-file store (no DB server needed) ----------
// Handlers are synchronous between loadData/saveData, so two requests can
// never interleave inside a write — the first-account race is safe by design.

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch {
    return { users: [], sessions: [] }
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

function verifyPassword(password, user) {
  try {
    const a = Buffer.from(hashPassword(password, user.salt), 'hex')
    const b = Buffer.from(user.passHash, 'hex')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function newSession(data, userId) {
  const session = {
    token: crypto.randomBytes(32).toString('hex'),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + TOKEN_TTL_MS,
  }
  data.sessions.push(session)
  return session
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status || 'active',
    demo: Boolean(u.demo),
    createdAt: u.createdAt,
  }
}

// Sessions of deactivated accounts are treated as invalid.
function authedUser(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  const data = loadData()
  const session = data.sessions.find(
    (s) => s.token === token && s.expiresAt > Date.now(),
  )
  if (!session) return null
  const user = data.users.find((u) => u.id === session.userId)
  if (!user || user.status === 'deactivated') return null
  return user
}

function requireAdmin(req, res, next) {
  const user = authedUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' })
  }
  req.user = user
  next()
}

// ---------- app ----------

const app = express()
app.use(express.json({ limit: '16kb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'voice-diary',
    time: new Date().toISOString(),
  })
})

// Signup: creates a member; the FIRST user in the file becomes admin.
// Any role sent by the client is ignored — roles are assigned server-side.
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {}
  if (!name?.trim() || !email?.trim() || !password) {
    return res
      .status(400)
      .json({ error: 'Name, email and password are required' })
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: 'Password must be at least 6 characters' })
  }
  const data = loadData()
  const mail = email.trim().toLowerCase()
  if (data.users.some((u) => u.email === mail)) {
    return res
      .status(409)
      .json({ error: 'An account with that email already exists' })
  }
  const salt = crypto.randomBytes(16).toString('hex')
  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: mail,
    salt,
    passHash: hashPassword(password, salt),
    role: data.users.length === 0 ? 'admin' : 'member',
    status: 'active',
    createdAt: new Date().toISOString(),
  }
  data.users.push(user)
  const session = newSession(data, user.id)
  saveData(data)
  res.status(201).json({ token: session.token, user: publicUser(user) })
})

// Demo one-tap logins (hackathon convenience — remove before real deployment).
const DEMO_ACCOUNTS = {
  admin: {
    name: 'Demo Admin',
    email: 'demo-admin@voicediary.local',
    role: 'admin',
  },
  member: {
    name: 'Demo Member',
    email: 'demo-member@voicediary.local',
    role: 'member',
  },
}

app.post('/api/auth/demo', (req, res) => {
  const role = req.body?.role === 'admin' ? 'admin' : 'member'
  const cfg = DEMO_ACCOUNTS[role]
  const data = loadData()
  let user = data.users.find((u) => u.email === cfg.email)
  if (!user) {
    const salt = crypto.randomBytes(16).toString('hex')
    user = {
      id: crypto.randomUUID(),
      name: cfg.name,
      email: cfg.email,
      salt,
      passHash: hashPassword(crypto.randomBytes(16).toString('hex'), salt),
      role: cfg.role,
      status: 'active',
      demo: true,
      createdAt: new Date().toISOString(),
    }
    data.users.push(user)
  }
  if (user.status === 'deactivated') {
    return res.status(403).json({ error: 'Account is deactivated' })
  }
  const session = newSession(data, user.id)
  saveData(data)
  res.json({ token: session.token, user: publicUser(user) })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  const data = loadData()
  const user = data.users.find(
    (u) => u.email === (email || '').trim().toLowerCase(),
  )
  if (!user || !verifyPassword(password || '', user)) {
    return res.status(401).json({ error: 'Wrong email or password' })
  }
  if (user.status === 'deactivated') {
    return res
      .status(403)
      .json({ error: 'This account has been deactivated. Ask an admin.' })
  }
  const session = newSession(data, user.id)
  saveData(data)
  res.json({ token: session.token, user: publicUser(user) })
})

app.get('/api/auth/me', (req, res) => {
  const user = authedUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  res.json({ user: publicUser(user) })
})

app.post('/api/auth/logout', (req, res) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token) {
    const data = loadData()
    data.sessions = data.sessions.filter((s) => s.token !== token)
    saveData(data)
  }
  res.json({ ok: true })
})

// Members report their entry COUNT only — diary content never leaves the
// browser, so the admin dashboard shows a number, never the data.
app.post('/api/me/stats', (req, res) => {
  const user = authedUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  const count = Math.max(0, Math.floor(Number(req.body?.entryCount) || 0))
  const data = loadData()
  const u = data.users.find((x) => x.id === user.id)
  if (u) {
    u.entryCount = count
    saveData(data)
  }
  res.json({ ok: true })
})

// ---------- admin (server-side role check on every route) ----------

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const data = loadData()
  const members = data.users.filter((u) => u.role === 'member')
  res.json({
    totalUsers: data.users.length,
    admins: data.users.filter((u) => u.role === 'admin').length,
    totalMembers: members.length,
    activeMembers: members.filter((u) => u.status !== 'deactivated').length,
    deactivatedMembers: members.filter((u) => u.status === 'deactivated')
      .length,
    totalEntries: data.users.reduce((n, u) => n + (u.entryCount || 0), 0),
  })
})

app.get('/api/admin/users', requireAdmin, (_req, res) => {
  const data = loadData()
  res.json({ users: data.users.map(publicUser) })
})

app.patch('/api/admin/users/:id/status', requireAdmin, (req, res) => {
  const target = String(req.params.id)
  const status = req.body?.status
  if (!['active', 'deactivated'].includes(status)) {
    return res.status(400).json({ error: 'status must be active|deactivated' })
  }
  const data = loadData()
  const user = data.users.find((u) => u.id === target)
  if (!user) return res.status(404).json({ error: 'User not found' })
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own status' })
  }
  if (user.role === 'admin') {
    return res.status(403).json({ error: 'Admins cannot be deactivated' })
  }
  user.status = status
  if (status === 'deactivated') {
    data.sessions = data.sessions.filter((s) => s.userId !== user.id)
  }
  saveData(data)
  res.json({ user: publicUser(user) })
})

app.get('/api/admin/health', requireAdmin, (_req, res) => {
  const data = loadData()
  res.json({
    status: 'ok',
    startedAt: STARTED_AT,
    uptimeSeconds: Math.floor(process.uptime()),
    node: process.version,
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    users: data.users.length,
    activeSessions: data.sessions.filter((s) => s.expiresAt > Date.now())
      .length,
  })
})

// Serve the built frontend (production). Diary data stays client-side.
if (!fs.existsSync(DIST)) {
  console.warn('frontend/dist not found — run `npm run build` first.')
}
app.use(express.static(DIST))
app.use((_req, res) => res.sendFile(path.join(DIST, 'index.html')))

export default app

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  app.listen(PORT, () => {
    console.log(`Voice Diary backend → http://localhost:${PORT}`)
  })
}
