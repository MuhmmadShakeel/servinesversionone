import test from 'node:test'
import assert from 'node:assert/strict'
import { errorHandler } from './error.middleware.js'
import { ApiError } from '../utils/ApiError.js'

function response() {
  return {
    headers: {},
    set(name, value) { this.headers[name] = value; return this },
    status(value) { this.statusCode = value; return this },
    json(value) { this.body = value; return this },
  }
}

test('unexpected errors have a matching server log and safe response reference', (context) => {
  const logged = context.mock.method(console, 'error', () => {})
  const failure = Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' })
  const request = { method: 'GET', path: '/v1/chat/conversations', headers: { authorization: 'secret' }, body: { password: 'secret' } }
  const reply = response()

  errorHandler(failure, request, reply, () => assert.fail('Unexpected next call'))

  assert.equal(reply.statusCode, 500)
  assert.equal(reply.body.message, `Internal server error. Reference: ${reply.body.requestId}`)
  assert.equal(reply.body.requestId, reply.headers['X-Request-ID'])
  assert.match(reply.body.requestId, /^[0-9a-f-]{36}$/)
  const log = JSON.parse(logged.mock.calls[0].arguments[0])
  assert.equal(log.requestId, reply.body.requestId)
  assert.equal(log.path, request.path)
  assert.equal(log.error.code, 'ETIMEDOUT')
  assert.equal(log.error.message, 'Connection timed out')
  assert.equal(log.body, undefined)
  assert.equal(log.headers, undefined)
})

test('expected client errors keep their message without server error logs', (context) => {
  const logged = context.mock.method(console, 'error', () => {})
  const reply = response()
  errorHandler(new ApiError(404, 'Service not found.'), { method: 'GET', path: '/v1/services/id' }, reply, () => assert.fail('Unexpected next call'))
  assert.equal(reply.statusCode, 404)
  assert.deepEqual(reply.body, { message: 'Service not found.' })
  assert.equal(logged.mock.callCount(), 0)
})
