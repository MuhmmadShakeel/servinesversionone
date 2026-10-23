import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

function wav(seconds) {
  const bytes = seconds * 8000 * 2
  const buffer = Buffer.alloc(44 + bytes)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(8000, 24)
  buffer.writeUInt32LE(16000, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(bytes, 40)
  return buffer
}

test('voice notes are validated and legacy local recordings remain readable', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'servnix-voice-'))
  process.env.VOICE_STORAGE_DIR = directory
  const { validateVoice, saveVoice, readVoice, removeVoice } = await import('./voiceStorage.js')
  try {
    const content = wav(1)
    const voice = validateVoice({ mimeType: 'audio/wav', durationSeconds: 1, base64: content.toString('base64') })
    assert.deepEqual(voice.content, content)
    const file = '12345678-1234-1234-1234-123456789abc.wav'
    await writeFile(path.join(directory, file), content)
    assert.deepEqual(await readVoice(file), content)
    assert.throws(() => validateVoice({ mimeType: 'audio/wav', durationSeconds: 1, base64: wav(61).toString('base64') }), { statusCode: 400 })
    assert.throws(() => validateVoice({ mimeType: 'audio/wav', durationSeconds: 61, base64: content.toString('base64') }), { statusCode: 400 })
    assert.deepEqual(validateVoice({ mimeType: 'audio/wav', durationSeconds: 1, url: 'https://store-id.private.blob.vercel-storage.com/voices/user/file.wav' }).url, 'https://store-id.private.blob.vercel-storage.com/voices/user/file.wav')
    await assert.rejects(saveVoice(validateVoice({ mimeType: 'audio/wav', durationSeconds: 1, url: 'https://store-id.private.blob.vercel-storage.com/voices/other/file.wav' }), 'user'), { statusCode: 400 })
    assert.throws(() => validateVoice({ mimeType: 'audio/wav', durationSeconds: 1, url: 'https://example.com/file.wav' }), { statusCode: 400 })
    await removeVoice(file)
    await assert.rejects(readVoice(file), { statusCode: 404 })
  } finally {
    if (directory.startsWith(os.tmpdir() + path.sep)) await rm(directory, { recursive: true, force: true })
    delete process.env.VOICE_STORAGE_DIR
  }
})
