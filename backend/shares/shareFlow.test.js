import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import app from '../Server.js'
import pool from '../common/database/connection.js'
import { migrate } from '../common/database/migrate.js'

const image = { fileName: 'item.png', mimeType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7N2h8AAAAASUVORK5CYII=' }

test('share counts persist for active services, open hiring and active products', async () => {
  await migrate()
  const email = `share-test-${randomUUID()}@example.com`
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  let token
  const send = (method, path, body) => fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  try {
    assert.equal((await send('POST', '/v1/auth/signup', { name: 'Share Tester', email, password: 'StrongPass123' })).status, 201)
    const login = await send('POST', '/v1/auth/login', { email, password: 'StrongPass123' })
    assert.equal(login.status, 200)
    token = (await login.json()).token

    const service = (await (await send('POST', '/v1/services', { title: 'Home cleaning', category: 'Home Services', description: 'Complete home cleaning service', price: '2500', experienceYears: 3, status: 'active' })).json()).service
    const hiring = (await (await send('POST', '/v1/hiring', { title: 'Create a brand identity', category: 'Design', description: 'We need a visual identity and brand guidelines.', budgetMin: '1000', budgetMax: '2500', status: 'open', media: [] })).json()).requirement
    const product = (await (await send('POST', '/v1/products', { title: 'Handmade mug', category: 'Home', description: 'A handmade ceramic mug with a smooth glaze.', price: '1250', quantity: 4, status: 'active', image })).json()).product

    for (const [type, id] of [['service', service.id], ['hiring', hiring.id], ['product', product.id]]) {
      const shared = await send('POST', `/v1/shares/${type}/${id}`)
      assert.equal(shared.status, 200)
      assert.equal((await shared.json()).shareCount, 1)
    }
    assert.equal((await (await send('POST', `/v1/shares/service/${service.id}`)).json()).shareCount, 2)
    assert.equal((await (await send('GET', '/v1/services/browse')).json()).services.find((item) => item.id === service.id).shareCount, 2)
    assert.equal((await (await send('GET', '/v1/hiring/open')).json()).requirements.find((item) => item.id === hiring.id).shareCount, 1)
    assert.equal((await (await send('GET', '/v1/products/browse')).json()).products.find((item) => item.id === product.id).shareCount, 1)
    assert.equal((await send('POST', `/v1/shares/unknown/${service.id}`)).status, 400)
    assert.equal((await send('POST', `/v1/shares/service/${randomUUID()}`)).status, 404)
    token = null
    assert.equal((await send('POST', `/v1/shares/service/${service.id}`)).status, 401)
  } finally {
    await pool.query('DELETE FROM users WHERE email = $1', [email])
    await new Promise((resolve) => server.close(resolve))
  }
})
