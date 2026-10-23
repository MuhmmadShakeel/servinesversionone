import { useState } from 'react'
import { getStoredUser } from '../../redux/Api/auth/AuthApi.js'

export function OwnerStatusButton({ item, kind, onChange }) {
  const [busy, setBusy] = useState(false)
  if (!onChange || item.ownerUserId !== getStoredUser()?.id || item.status === 'awarded') return null
  const live = item.status === 'active' || item.status === 'open'
  const next = kind === 'hiring' ? (live ? 'closed' : 'open') : (live ? 'draft' : 'active')
  async function toggle() {
    setBusy(true)
    try { await onChange(item, next) } finally { setBusy(false) }
  }
  return <button type="button" className={`owner-status-button ${live ? 'is-live' : ''}`} onClick={toggle} disabled={busy}
    title={live ? 'Hide this listing from public results' : 'Publish this listing'}>
    <span className="owner-status-dot" aria-hidden="true"/>{busy ? 'Updating…' : live ? 'Set inactive' : 'Publish now'}
  </button>
}
