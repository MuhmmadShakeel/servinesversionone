import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import app from '../app.js'
import pool from '../common/database/connection.js'
import { migrate } from '../common/database/migrate.js'

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7N2h8AAAAASUVORK5CYII='

test('product bids persist and appear only in the owning seller account', async () => {
  await migrate()
  const emails = ['seller', 'buyer', 'other'].map((role) => `${role}-${randomUUID()}@example.com`)
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  const send = (method, route, token, body) => fetch(`${base}${route}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let productId
  try {
    const tokens = []
    for (const email of emails) {
      assert.equal((await send('POST', '/v1/auth/signup', null, { name: email.split('-')[0], email, password: 'StrongPass123' })).status, 201)
      const login = await send('POST', '/v1/auth/login', null, { email, password: 'StrongPass123' })
      assert.equal(login.status, 200)
      tokens.push((await login.json()).token)
    }
    const [seller, buyer, other] = tokens
    const created = await send('POST', '/v1/products', seller, {
      title: 'Bid test mug', category: 'Home', description: 'A ceramic mug offered for bidding.',
      price: '100.00', quantity: 1, status: 'active',
      image: { fileName: 'mug.png', mimeType: 'image/png', base64: png },
    })
    assert.equal(created.status, 201)
    productId = (await created.json()).product.id
    assert.equal((await (await send('GET', '/v1/products/browse?liveDeals=1', buyer)).json()).products.some((product) => product.id === productId), false)
    assert.equal((await send('POST', `/v1/products/${productId}/bids`, buyer, { amount: '110.00' })).status, 404)
    const details = { title: 'Bid test mug', category: 'Home', description: 'A ceramic mug offered for bidding.', price: '100.00', quantity: 1, status: 'active', biddingEnabled: true, biddingDurationHours: 1 }
    assert.equal((await send('PUT', `/v1/products/${productId}`, seller, details)).status, 200)
    assert.equal((await (await send('GET', '/v1/products/browse?liveDeals=1', buyer)).json()).products.some((product) => product.id === productId), true)
    assert.equal((await send('POST', `/v1/products/${productId}/bids`, null, { amount: '110.00' })).status, 401)
    assert.equal((await send('POST', `/v1/products/${productId}/bids`, seller, { amount: '110.00' })).status, 403)
    assert.equal((await send('POST', `/v1/products/${productId}/bids`, buyer, { amount: '100.00' })).status, 409)
    assert.equal((await send('POST', `/v1/products/${productId}/bids`, buyer, { amount: '110.00', note: 'First offer' })).status, 201)
    assert.equal((await send('POST', `/v1/products/${productId}/bids`, other, { amount: '105.00' })).status, 409)
    assert.equal((await send('POST', `/v1/products/${productId}/bids`, other, { amount: '120.00', note: 'Second offer' })).status, 201)

    const history = await send('GET', `/v1/products/${productId}/bids`, buyer)
    assert.equal(history.status, 200)
    assert.deepEqual((await history.json()).bids.map((bid) => Number(bid.amount)), [120, 110])
    const browse = await send('GET', '/v1/products/browse', buyer)
    assert.equal((await browse.json()).products.find((product) => product.id === productId).bidCount, 2)
    const received = await send('GET', '/v1/products/bids/received', seller)
    assert.equal((await received.json()).bids.filter((bid) => bid.productId === productId).length, 2)
    const unrelated = await send('GET', '/v1/products/bids/received', buyer)
    assert.equal((await unrelated.json()).bids.some((bid) => bid.productId === productId), false)
    await pool.query("UPDATE products SET bidding_ends_at = NOW() - INTERVAL '1 second' WHERE id = $1", [productId])
    assert.equal((await (await send('GET', '/v1/products/browse?liveDeals=1', buyer)).json()).products.some((product) => product.id === productId), false)
    assert.equal((await send('POST', `/v1/products/${productId}/bids`, buyer, { amount: '130.00' })).status, 409)
    assert.equal((await send('PUT', `/v1/products/${productId}`, seller, details)).status, 200)
    assert.equal((await (await send('GET', '/v1/products/browse?liveDeals=1', buyer)).json()).products.some((product) => product.id === productId), true)
    assert.equal((await send('POST', `/v1/products/${productId}/bids`, buyer, { amount: '105.00' })).status, 201)
    assert.deepEqual((await (await send('GET', `/v1/products/${productId}/bids`, buyer)).json()).bids.map((bid) => Number(bid.amount)), [105])
    assert.equal((await send('DELETE', `/v1/products/${productId}`, seller)).status, 409)
  } finally {
    if (productId) {
      await pool.query('DELETE FROM product_bids WHERE product_id = $1', [productId])
      await pool.query('DELETE FROM products WHERE id = $1', [productId])
    }
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [emails])
    await new Promise((resolve) => server.close(resolve))
  }
})
