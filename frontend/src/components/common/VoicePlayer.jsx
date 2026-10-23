import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { getAccessToken } from '../../redux/Api/auth/AuthApi.js'

export function VoicePlayer({ type, id, hasVoice, duration }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  if (!hasVoice) return null

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(`/v1/${type}/${id}/voice`, { headers: { Authorization: `Bearer ${getAccessToken()}` } })
      if (!response.ok) throw new Error('Voice note is unavailable.')
      setUrl(URL.createObjectURL(await response.blob()))
    } catch (failure) { toast.error(failure.message) }
    finally { setLoading(false) }
  }

  return <div className="listing-voice-player"><span>Voice note · {Math.round(Number(duration) || 0)}s</span>{url ? <audio controls src={url}/> : <button type="button" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Listen'}</button>}</div>
}
