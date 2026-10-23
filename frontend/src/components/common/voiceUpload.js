import { upload } from '@vercel/blob/client'
import { getAccessToken } from '../../redux/Api/auth/AuthApi.js'

const extensions = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a' }

export async function uploadVoice(voice) {
  if (!voice?.file) return voice
  const token = getAccessToken()
  const response = await fetch('/v1/voice/grant', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error('Could not authorize the voice upload. Please log in and try again.')
  const { grant, userId } = await response.json()
  const uploaded = await upload(`voices/${userId}/${crypto.randomUUID()}.${extensions[voice.mimeType]}`, voice.file, {
    access: 'private', contentType: voice.mimeType, handleUploadUrl: '/v1/voice/upload', clientPayload: grant,
  })
  return { url: uploaded.url, mimeType: voice.mimeType, durationSeconds: voice.durationSeconds }
}

export async function discardVoice(voice) {
  if (!voice?.url) return
  await fetch('/v1/voice/uploaded', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken()}` },
    body: JSON.stringify({ url: voice.url }),
  })
}
