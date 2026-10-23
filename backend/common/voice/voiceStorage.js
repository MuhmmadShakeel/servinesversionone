import { randomUUID } from 'node:crypto'
import { del, get, head, put } from '@vercel/blob'
import { readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ApiError } from '../utils/ApiError.js'

const backendDir = fileURLToPath(new URL('../../', import.meta.url))
const voiceDir = path.resolve(process.env.VOICE_STORAGE_DIR || path.join(backendDir, 'voice'))
const maxBytes = 8 * 1024 * 1024
const formats = {
  'audio/webm': { extension: 'webm', matches: (data) => data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
  'audio/ogg': { extension: 'ogg', matches: (data) => data.toString('ascii', 0, 4) === 'OggS' },
  'audio/wav': { extension: 'wav', matches: (data) => data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WAVE' },
  'audio/mpeg': { extension: 'mp3', matches: (data) => data.toString('ascii', 0, 3) === 'ID3' || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) },
  'audio/mp4': { extension: 'm4a', matches: (data) => data.toString('ascii', 4, 8) === 'ftyp' },
}

export function validateVoice(value) {
  if (value === undefined || value === null) return value
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !['mimeType', 'base64', 'url', 'durationSeconds'].includes(key))) {
    throw new ApiError(400, 'Choose a valid voice recording.')
  }
  const format = formats[value.mimeType]
  const duration = Number(value.durationSeconds)
  if (!format || !Number.isFinite(duration) || duration <= 0 || duration > 60) {
    throw new ApiError(400, 'Voice must be a supported audio file no longer than one minute.')
  }
  if (value.url !== undefined) {
    if (value.base64 !== undefined || !isBlobUrl(value.url)) throw new ApiError(400, 'Choose a valid uploaded voice recording.')
    return { url: value.url, mimeType: value.mimeType, durationSeconds: Math.round(duration * 100) / 100 }
  }
  if (typeof value.base64 !== 'string' || value.base64.length > Math.ceil(maxBytes / 3) * 4 + 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64)) {
    throw new ApiError(400, 'Voice data is invalid or exceeds 8 MB.')
  }
  const content = Buffer.from(value.base64, 'base64')
  if (!content.length || content.length > maxBytes || !format.matches(content)) throw new ApiError(400, 'Voice file does not match its audio format or exceeds 8 MB.')
  if (value.mimeType === 'audio/wav') {
    if (content.length < 44) throw new ApiError(400, 'Voice recording is incomplete.')
    const byteRate = content.readUInt32LE(28)
    const dataOffset = content.indexOf(Buffer.from('data'), 36)
    if (!byteRate || dataOffset < 0 || dataOffset + 8 > content.length || content.readUInt32LE(dataOffset + 4) / byteRate > 60.1) {
      throw new ApiError(400, 'Voice recording must be no longer than one minute.')
    }
  }
  return { mimeType: value.mimeType, durationSeconds: Math.round(duration * 100) / 100, content, extension: format.extension }
}

function isBlobUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && /^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname) && !url.search && !url.hash
  } catch { return false }
}

export function belongsToUser(url, userId) {
  return isBlobUrl(url) && typeof userId === 'string' && new URL(url).pathname.startsWith(`/voices/${userId}/`)
}

export async function saveVoice(voice, userId) {
  if (!voice) return null
  if (voice.url) {
    if (!belongsToUser(voice.url, userId)) throw new ApiError(400, 'This voice recording does not belong to your account.')
    const metadata = await head(voice.url)
    if (!metadata.size || metadata.size > maxBytes || metadata.contentType !== voice.mimeType || metadata.url !== voice.url) throw new ApiError(400, 'The uploaded voice recording is invalid or exceeds 8 MB.')
    return { file: voice.url, mimeType: voice.mimeType, durationSeconds: voice.durationSeconds }
  }
  if (!userId) throw new ApiError(400, 'Voice upload requires an account.')
  const uploaded = await put(`voices/${userId}/${randomUUID()}.${voice.extension}`, voice.content, { access: 'private', contentType: voice.mimeType })
  return { file: uploaded.url, mimeType: voice.mimeType, durationSeconds: voice.durationSeconds }
}

export async function removeVoice(file) {
  if (!file) return
  if (isBlobUrl(file)) return del(file)
  if (!/^[0-9a-f-]{36}\.(webm|ogg|wav|mp3|m4a)$/.test(file)) return
  try { await unlink(path.join(voiceDir, file)) } catch (error) { if (error.code !== 'ENOENT') throw error }
}

export async function readVoice(file) {
  if (isBlobUrl(file)) {
    const result = await get(file, { access: 'private' })
    if (!result?.stream) throw new ApiError(404, 'Voice note not found.')
    return Buffer.from(await new Response(result.stream).arrayBuffer())
  }
  if (!file || !/^[0-9a-f-]{36}\.(webm|ogg|wav|mp3|m4a)$/.test(file)) throw new ApiError(404, 'Voice note not found.')
  try { return await readFile(path.join(voiceDir, file)) }
  catch (error) { if (error.code === 'ENOENT') throw new ApiError(404, 'Voice note not found.'); throw error }
}
