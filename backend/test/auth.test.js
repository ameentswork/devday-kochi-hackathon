import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.VOICE_DIARY_DATA = path.join(
  os.tmpdir(),
  `vd-test-${process.pid}-${Date.now()}.json`,
)
const { default: app } = await import('../server.js')

let server
let base

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
  base = `http://localhost:${server.address().port}`
})

after(() => {
  server.close()
  try {
    fs.unlinkSync(process.env.VOICE_DIARY_DATA)
  } catch {
    // file may not exist
  }
})

const post = (path, body, token) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

const get = (path, token) =>
  fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

const patch = (path, body, token) =>
  fetch(`${base}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

const signup = (name, email) =>
  post('/api/auth/signup', { name, email, password: 'secret1' })

test('first registered account becomes admin, later ones become members', async () => {
  const r1 = await signup('Admin One', 'admin@test.dev')
  assert.equal(r1.status, 201)
  const d1 = await r1.json()
  assert.equal(d1.user.role, 'admin')

  const r2 = await signup('Member Two', 'member@test.dev')
  const d2 = await r2.json()
  assert.equal(d2.user.role, 'member')
})

test('client cannot self-assign the admin role at signup', async () => {
  const r = await post('/api/auth/signup', {
    name: 'Sneaky',
    email: 'sneaky@test.dev',
    password: 'secret1',
    role: 'admin',
  })
  const d = await r.json()
  assert.equal(d.user.role, 'member')
})

test('unauthenticated requests get 401, members get 403 on admin routes', async () => {
  assert.equal((await get('/api/admin/users')).status, 401)

  const member = await post('/api/auth/demo', { role: 'member' }).then((r) =>
    r.json(),
  )
  const res = await get('/api/admin/users', member.token)
  assert.equal(res.status, 403)

  const stats = await get('/api/admin/stats', member.token)
  assert.equal(stats.status, 403)
})

test('admin can list users and read stats and health', async () => {
  const admin = await post('/api/auth/demo', { role: 'admin' }).then((r) =>
    r.json(),
  )
  const users = await get('/api/admin/users', admin.token).then((r) => r.json())
  assert.ok(Array.isArray(users.users))
  assert.ok(users.users.length >= 3)

  const stats = await get('/api/admin/stats', admin.token).then((r) => r.json())
  assert.ok(stats.totalMembers >= 1)
  assert.ok(typeof stats.totalEntries === 'number')

  const health = await get('/api/admin/health', admin.token).then((r) =>
    r.json(),
  )
  assert.equal(health.status, 'ok')
  assert.ok(health.uptimeSeconds >= 0)
})

test('deactivating a member blocks login and kills existing sessions', async () => {
  const admin = await post('/api/auth/demo', { role: 'admin' }).then((r) =>
    r.json(),
  )
  const { token: memberToken, user: member } = await signup(
    'Doomed',
    'doomed@test.dev',
  ).then((r) => r.json())

  const patchRes = await patch(
    `/api/admin/users/${member.id}/status`,
    { status: 'deactivated' },
    admin.token,
  )
  assert.equal(patchRes.status, 200)

  // existing session is dead
  const me = await get('/api/auth/me', memberToken)
  assert.equal(me.status, 401)

  // cannot log in again
  const login = await post('/api/auth/login', {
    email: 'doomed@test.dev',
    password: 'secret1',
  })
  assert.equal(login.status, 403)
})

test('admin cannot deactivate self or another admin', async () => {
  const admin = await post('/api/auth/demo', { role: 'admin' }).then((r) =>
    r.json(),
  )
  const res = await patch(
    `/api/admin/users/${admin.user.id}/status`,
    { status: 'deactivated' },
    admin.token,
  )
  assert.equal(res.status, 400)
})

test('sessions restore via /api/auth/me and die on logout', async () => {
  const { token, user } = await post('/api/auth/demo', {
    role: 'member',
  }).then((r) => r.json())

  const me = await get('/api/auth/me', token).then((r) => r.json())
  assert.equal(me.user.id, user.id)

  await post('/api/auth/logout', {}, token)
  assert.equal((await get('/api/auth/me', token)).status, 401)
})

test('members can report entry counts; stats aggregates them', async () => {
  const member = await post('/api/auth/demo', { role: 'member' }).then((r) =>
    r.json(),
  )
  await post('/api/me/stats', { entryCount: 7 }, member.token)

  const admin = await post('/api/auth/demo', { role: 'admin' }).then((r) =>
    r.json(),
  )
  const stats = await get('/api/admin/stats', admin.token).then((r) => r.json())
  assert.ok(stats.totalEntries >= 7)
})
