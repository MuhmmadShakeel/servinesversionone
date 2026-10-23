import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'react-toastify'
import { getAccessToken } from '../../redux/Api/auth/AuthApi.js'
import { Icon } from './Icon.jsx'
import { SurfaceModal } from './UiParts.jsx'

async function copyLink(link) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(link)
  const input = document.createElement('textarea')
  input.value = link
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.append(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('Could not copy link')
}

export function ShareButton({ type, id, title, count = 0, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [latestCount, setLatestCount] = useState(null)
  const link = `${window.location.origin}/explore?listing=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`

  async function finishShare(method) {
    if (busy) return
    setBusy(true)
    try {
      if (method === 'device') await navigator.share({ title, url: link })
      else await copyLink(link)
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('Could not share this link. Please try again.')
      setBusy(false)
      return
    }

    try {
      const response = await fetch(`/v1/shares/${type}/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      })
      if (!response.ok) throw new Error('Count unavailable')
      const result = await response.json()
      setLatestCount(result.shareCount)
      toast.success(method === 'device' ? 'Listing shared.' : 'Link copied.')
      setOpen(false)
    } catch {
      toast.error('Link shared, but the share count could not update.')
    } finally { setBusy(false) }
  }

  return <>
    <button className="share-button" type="button" onClick={() => setOpen(true)} disabled={disabled} aria-label={`Share ${title}. ${latestCount ?? count} shares`}>
      <Icon name="share" size={16}/><span>Share</span><strong>{latestCount ?? count}</strong>
    </button>
    {open && createPortal(<SurfaceModal title="Share this listing" onClose={() => { if (!busy) setOpen(false) }}>
      <div className="share-dialog">
        <span className="share-dialog-icon"><Icon name="share" size={23}/></span>
        <h3>{title}</h3>
        <p>Send this link to someone who may be interested. They can open the listing directly after logging in.</p>
        <label htmlFor={`share-link-${id}`}>Listing link</label>
        <div className="share-link-row"><input id={`share-link-${id}`} readOnly value={link} onFocus={(event) => event.target.select()}/><button type="button" onClick={() => finishShare('copy')} disabled={busy}>{busy ? 'Working…' : 'Copy link'}</button></div>
        {typeof navigator.share === 'function' && <button className="share-device-button" type="button" onClick={() => finishShare('device')} disabled={busy}><Icon name="share" size={17}/> Share via device</button>}
        <small><Icon name="share" size={14}/> Shared {latestCount ?? count} {Number(latestCount ?? count) === 1 ? 'time' : 'times'}</small>
      </div>
    </SurfaceModal>, document.body)}
  </>
}
