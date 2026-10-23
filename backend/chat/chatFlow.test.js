import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import app from '../Server.js'
import pool from '../common/database/connection.js'
import { migrate } from '../common/database/migrate.js'

const image = { fileName: 'item.png', mimeType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7N2h8AAAAASUVORK5CYII=' }

test('chat stays between the listing owner and the correct buyer or applicant', async () => {
  await migrate()
  const emails = ['provider', 'buyer', 'outsider'].map((name) => `${name}-${randomUUID()}@example.com`)
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  const send = (method, url, token, body) => fetch(`${base}${url}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  try {
    const tokens = []
    for (const [index, email] of emails.entries()) {
      assert.equal((await send('POST', '/v1/auth/signup', null, { name: ['Provider', 'Buyer', 'Outsider'][index], email, password: 'StrongPass123' })).status, 201)
      const login = await send('POST', '/v1/auth/login', null, { email, password: 'StrongPass123' })
      assert.equal(login.status, 200)
      tokens.push((await login.json()).token)
    }
    const [provider, buyer, outsider] = tokens
    const serviceResponse = await send('POST', '/v1/services', provider, {
      title: 'Home cleaning', category: 'Home Services', description: 'Complete home cleaning service',
      price: '2500.00', experienceYears: 3, status: 'active',
    })
    const serviceBody = await serviceResponse.json()
    assert.equal(serviceResponse.status, 201, JSON.stringify(serviceBody))
    const service = serviceBody.service
    const startService = () => send('POST', '/v1/chat/conversations', buyer, { context: 'service', id: service.id })
    assert.equal((await send('POST', '/v1/chat/conversations', null, { context: 'service', id: service.id })).status, 401)
    assert.equal((await send('POST', '/v1/chat/conversations', provider, { context: 'service', id: service.id })).status, 403)
    const serviceChat = (await (await startService()).json()).conversation
    assert.equal(serviceChat.otherUserName, 'Provider')
    assert.equal((await (await startService()).json()).conversation.id, serviceChat.id)
    assert.equal((await (await send('GET', '/v1/chat/conversations', outsider)).json()).conversations.length, 0)
    assert.equal((await send('GET', `/v1/chat/conversations/${serviceChat.id}/messages`, outsider)).status, 404)
    assert.equal((await send('POST', `/v1/chat/conversations/${serviceChat.id}/messages`, outsider, { body: 'Not allowed' })).status, 404)
    assert.equal((await send('POST', `/v1/chat/conversations/${serviceChat.id}/messages`, buyer, { body: '   ' })).status, 400)
    const sent = await send('POST', `/v1/chat/conversations/${serviceChat.id}/messages`, buyer, { body: 'Is Saturday available?' })
    assert.equal(sent.status, 201)
    const buyerMessage = (await sent.json()).message
    assert.equal(buyerMessage.senderName, 'Buyer')
    assert.equal((await (await send('GET', '/v1/chat/conversations', provider)).json()).conversations.find((item) => item.id === serviceChat.id).unreadCount, 1)
    assert.equal((await (await send('GET', '/v1/chat/conversations', buyer)).json()).conversations.find((item) => item.id === serviceChat.id).unreadCount, 0)
    const ownerMessages = await send('GET', `/v1/chat/conversations/${serviceChat.id}/messages`, provider)
    assert.equal(ownerMessages.status, 200)
    assert.equal((await ownerMessages.json()).messages[0].body, 'Is Saturday available?')
    assert.equal((await send('POST', `/v1/chat/conversations/${serviceChat.id}/read`, outsider, { messageId: buyerMessage.id })).status, 404)
    assert.equal((await send('POST', `/v1/chat/conversations/${serviceChat.id}/read`, provider, { messageId: randomUUID() })).status, 404)
    assert.equal((await send('POST', `/v1/chat/conversations/${serviceChat.id}/read`, provider, { messageId: buyerMessage.id })).status, 204)
    assert.equal((await (await send('GET', '/v1/chat/conversations', provider)).json()).conversations.find((item) => item.id === serviceChat.id).unreadCount, 0)
    assert.ok((await (await send('GET', `/v1/chat/conversations/${serviceChat.id}/messages`, buyer)).json()).messages[0].seenAt)
    assert.equal((await send('POST', `/v1/chat/conversations/${serviceChat.id}/messages`, provider, { body: 'Yes, Saturday works.' })).status, 201)
    assert.equal((await (await send('GET', '/v1/chat/conversations', buyer)).json()).conversations.find((item) => item.id === serviceChat.id).unreadCount, 1)
    const messagePath = `/v1/chat/conversations/${serviceChat.id}/messages/${buyerMessage.id}`
    assert.equal((await send('PATCH', messagePath, provider, { body: 'Not my message' })).status, 404)
    assert.equal((await send('DELETE', messagePath, outsider)).status, 404)
    const edited = await send('PATCH', messagePath, buyer, { body: 'Is Sunday available?' })
    assert.equal(edited.status, 200)
    assert.equal((await edited.json()).message.body, 'Is Sunday available?')
    assert.equal((await (await send('GET', `/v1/chat/conversations/${serviceChat.id}/messages`, provider)).json()).messages[0].editedAt !== null, true)
    assert.equal((await send('DELETE', `/v1/chat/conversations/${serviceChat.id}/messages`, outsider)).status, 404)
    assert.equal((await send('DELETE', `/v1/chat/conversations/${serviceChat.id}/messages`, buyer)).status, 204)
    assert.equal((await (await send('GET', `/v1/chat/conversations/${serviceChat.id}/messages`, buyer)).json()).messages.length, 0)
    assert.equal((await (await send('GET', `/v1/chat/conversations/${serviceChat.id}/messages`, provider)).json()).messages.length, 2)
    assert.equal((await send('DELETE', messagePath, buyer)).status, 404)
    const fresh = await send('POST', `/v1/chat/conversations/${serviceChat.id}/messages`, provider, { body: 'Sunday also works.' })
    assert.equal(fresh.status, 201)
    const freshId = (await fresh.json()).message.id
    assert.equal((await (await send('GET', `/v1/chat/conversations/${serviceChat.id}/messages`, buyer)).json()).messages.length, 1)
    assert.equal((await send('DELETE', `/v1/chat/conversations/${serviceChat.id}/messages/${freshId}`, provider)).status, 204)
    assert.equal((await (await send('GET', `/v1/chat/conversations/${serviceChat.id}/messages`, buyer)).json()).messages.length, 0)

    const booking = (await (await send('POST', `/v1/services/${service.id}/bookings`, buyer, {
      contactPhone: '+92 300 1234567', serviceAddress: '12 Main Street, Lahore',
      requestDetails: 'Please clean the house on the weekend.', preferredDate: '2026-12-12',
    })).json()).booking
    const fromBooking = await send('POST', '/v1/chat/conversations', provider, { context: 'booking', id: booking.id })
    assert.equal(fromBooking.status, 200)
    assert.equal((await fromBooking.json()).conversation.id, serviceChat.id)

    const requirement = (await (await send('POST', '/v1/hiring', provider, {
      title: 'Create a new brand identity', category: 'Design',
      description: 'We need a thoughtful visual identity and brand guidelines.',
      budgetMin: '1000', budgetMax: '2500', status: 'open', media: [],
    })).json()).requirement
    const proposalResponse = await send('POST', `/v1/hiring/${requirement.id}/proposals`, buyer, {
      coverLetter: 'I can deliver the identity and guidelines with careful research.',
      bidAmount: '1800', deliveryDays: 10,
    })
    assert.equal(proposalResponse.status, 201)
    const proposalId = (await proposalResponse.json()).id
    const proposalChat = await send('POST', '/v1/chat/conversations', provider, { context: 'proposal', id: proposalId })
    assert.equal(proposalChat.status, 200)
    const proposalChatId = (await proposalChat.json()).conversation.id
    assert.equal((await (await send('POST', '/v1/chat/conversations', buyer, { context: 'hiring', id: requirement.id })).json()).conversation.id, proposalChatId)

    const product = (await (await send('POST', '/v1/products', provider, {
      title: 'Handmade mug', category: 'Home', description: 'A handmade ceramic mug with a smooth glaze.',
      price: '1250.00', quantity: 4, status: 'active', image,
    })).json()).product
    assert.equal((await send('POST', `/v1/products/cart/${product.id}`, buyer, { quantity: 1 })).status, 200)
    const cartChat = await send('POST', '/v1/chat/conversations', buyer, { context: 'cart', id: product.id })
    assert.equal(cartChat.status, 200)
    const cartChatId = (await cartChat.json()).conversation.id
    assert.equal((await (await send('POST', '/v1/chat/conversations', buyer, { context: 'product', id: product.id })).json()).conversation.id, cartChatId)
    const checkout = await send('POST', '/v1/products/checkout', buyer, { contactPhone: '+92 300 1234567', deliveryAddress: '12 Main Street, Lahore' })
    assert.equal(checkout.status, 201)
    const order = (await (await send('GET', '/v1/products/orders/sales', provider)).json()).orders.find((item) => item.productId === product.id)
    const orderChat = await send('POST', '/v1/chat/conversations', provider, { context: 'order', id: order.id })
    assert.equal(orderChat.status, 200)
    assert.equal((await orderChat.json()).conversation.id, cartChatId)
  } finally {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [emails])
    await new Promise((resolve) => server.close(resolve))
  }
})
