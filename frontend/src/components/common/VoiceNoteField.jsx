import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'

const maxBytes = 8 * 1024 * 1024
const supported = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/mp4']
const normalizeType = (type) => ({ 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/mp3': 'audio/mpeg', 'audio/x-m4a': 'audio/mp4' })[type?.split(';')[0]] || type?.split(';')[0]

function durationOf(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(audio.duration)
      else reject(new Error('Could not read the recording length. Choose another audio file.'))
    }
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this audio file.')) }
    audio.src = url
  })
}

export function VoiceNoteField({ voice, hasExisting, onChange }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const recorder = useRef(null)
  const started = useRef(0)
  const timer = useRef(null)
  const stream = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const preview = useRef(null)

  useEffect(() => () => {
    clearInterval(timer.current)
    if (recorder.current?.state === 'recording') recorder.current.stop()
    stream.current?.getTracks().forEach((track) => track.stop())
    if (preview.current) URL.revokeObjectURL(preview.current)
  }, [])

  async function setFile(file, measuredDuration) {
    const mimeType = normalizeType(file.type)
    if (!supported.includes(mimeType)) throw new Error('Use WebM, Ogg, WAV, MP3 or M4A audio.')
    if (!file.size || file.size > maxBytes) throw new Error('Voice notes must be 8 MB or less.')
    const durationSeconds = measuredDuration ?? await durationOf(file)
    if (durationSeconds > 60 || durationSeconds <= 0) throw new Error('Voice notes must be one minute or less.')
    if (preview.current) URL.revokeObjectURL(preview.current)
    preview.current = URL.createObjectURL(file)
    setPreviewUrl(preview.current)
    onChange({ mimeType, durationSeconds: Math.min(60, durationSeconds), file })
  }

  function removeSelected() {
    if (preview.current) URL.revokeObjectURL(preview.current)
    preview.current = null
    setPreviewUrl(null)
    onChange(hasExisting ? null : undefined)
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    try { await setFile(file) } catch (failure) { toast.error(failure.message) }
    finally { setBusy(false); event.target.value = '' }
  }

  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Recording is unavailable in this browser. Upload an audio file instead.')
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type))
      if (!mimeType) throw new Error('This browser cannot record a supported audio format.')
      const capture = new MediaRecorder(media, { mimeType })
      recorder.current = capture
      const chunks = []
      capture.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      capture.onstop = async () => {
        clearInterval(timer.current)
        media.getTracks().forEach((track) => track.stop())
        stream.current = null
        setRecording(false)
        setBusy(true)
        try { await setFile(new Blob(chunks, { type: mimeType }), (performance.now() - started.current) / 1000) }
        catch (failure) { toast.error(failure.message) }
        finally { setBusy(false) }
      }
      started.current = performance.now()
      setSeconds(0)
      capture.start()
      setRecording(true)
      timer.current = setInterval(() => {
        const elapsed = Math.floor((performance.now() - started.current) / 1000)
        setSeconds(Math.min(60, elapsed))
        if (elapsed >= 59 && capture.state === 'recording') capture.stop()
      }, 250)
    } catch (failure) {
      stream.current?.getTracks().forEach((track) => track.stop())
      stream.current = null
      toast.error(failure.message)
    }
  }

  return <div className="voice-note-field">
    <div><strong>Voice note <span>(optional)</span></strong><p>Record or upload up to one minute. People can listen alongside your description.</p></div>
    <div className="voice-note-actions"><button type="button" onClick={recording ? () => recorder.current?.stop() : startRecording} disabled={busy}>{recording ? `Stop recording · ${seconds}s / 60s` : 'Record voice'}</button><label>Upload audio<input type="file" accept="audio/webm,audio/ogg,audio/wav,audio/mpeg,audio/mp4,.m4a" onChange={chooseFile} disabled={recording || busy}/></label></div>
    {voice ? <div className="voice-note-preview"><audio controls src={previewUrl || undefined}/><span>{Math.round(voice.durationSeconds)} seconds</span><button type="button" onClick={removeSelected}>Remove</button></div> : hasExisting && voice !== null ? <p className="voice-note-current">Current voice note will stay unless you replace or remove it. <button type="button" onClick={() => onChange(null)}>Remove</button></p> : null}
  </div>
}
