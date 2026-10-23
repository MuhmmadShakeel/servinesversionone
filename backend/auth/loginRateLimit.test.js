import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import authRouter from './AuthRouter.js'
import { errorHandler } from '../common/middleware/error.middleware.js'

test('repeated failed login attempts receive a retry response', async () => {
  const app = express()
  app.use(express.json(), authRouter)
  app.use(errorHandler)
  const server = app.listen(0)
  const url = `http://127.0.0.1:${server.address().port}/login`
  try {
    const attempt = () => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid', password: 'wrong' }),
    })
    for (let count = 0; count < 5; count += 1) assert.equal((await attempt()).status, 400)
    const blocked = await attempt()
    assert.equal(blocked.status, 429)
    assert.ok(blocked.headers.get('retry-after'))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
