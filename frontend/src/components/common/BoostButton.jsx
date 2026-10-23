import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'react-toastify'
import { useDispatch } from 'react-redux'
import { getAccessToken, getStoredUser } from '../../redux/Api/auth/AuthApi.js'
import { serviceApi } from '../../redux/Api/service/ServiceApi.js'
import { productApi } from '../../redux/Api/product/ProductApi.js'
import { hiringApi } from '../../redux/Api/hiring/HiringApi.js'
import { Icon } from './Icon.jsx'
import { SurfaceModal } from './UiParts.jsx'

const units = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'year', label: 'Years' },
]

export function BoostButton({ type, id, title, ownerUserId, active = true }) {
  const subject = type === 'product' ? 'product' : type === 'service' ? 'service' : 'job'
  const dispatch = useDispatch()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exists, setExists] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [budget, setBudget] = useState('')
  const [durationCount, setDurationCount] = useState('1')
  const [durationUnit, setDurationUnit] = useState('week')
  const [loadError, setLoadError] = useState(false)
  const [benchmark, setBenchmark] = useState(null)
  if (!active || !ownerUserId || ownerUserId !== getStoredUser()?.id) return null

  const url = `/v1/boosts/${type}/${id}`
  const headers = () => ({ Authorization: `Bearer ${getAccessToken()}` })
  function refreshListings() {
    if (type === 'service') dispatch(serviceApi.util.invalidateTags(['BrowseServices']))
    if (type === 'product') dispatch(productApi.util.invalidateTags(['BrowseProducts']))
    if (type === 'hiring') dispatch(hiringApi.util.invalidateTags(['OpenRequirements']))
  }

  async function openForm() {
    setOpen(true)
    setLoading(true)
    setLoadError(false)
    setConfirmDelete(false)
    setBenchmark(null)
    try {
      const [response, benchmarkResult] = await Promise.all([
        fetch(url, { headers: headers() }),
        fetch(`/v1/boosts/benchmark/${type}`, { headers: headers() }).catch(() => null),
      ])
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Could not load boost settings.')
      if (benchmarkResult?.ok) setBenchmark((await benchmarkResult.json().catch(() => ({}))).benchmark || null)
      const boost = result.boost
      setExists(Boolean(boost))
      setBudget(boost?.budget ?? '')
      setDurationCount(String(boost?.durationCount ?? 1))
      setDurationUnit(boost?.durationUnit ?? 'week')
    } catch (failure) { setLoadError(true); toast.error(failure.message || 'Could not load boost settings.') }
    finally { setLoading(false) }
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(url, { method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ budget, durationCount: Number(durationCount), durationUnit }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Could not save boost settings.')
      setExists(true)
      setOpen(false)
      refreshListings()
      toast.success('Boost settings saved.')
    } catch (failure) { toast.error(failure.message || 'Could not save boost settings.') }
    finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true)
    try {
      const response = await fetch(url, { method: 'DELETE', headers: headers() })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Could not delete boost settings.')
      }
      setExists(false)
      setOpen(false)
      refreshListings()
      toast.success('Boost settings deleted.')
    } catch (failure) { toast.error(failure.message || 'Could not delete boost settings.') }
    finally { setBusy(false); setConfirmDelete(false) }
  }

  return <>
    <button type="button" className="boost-button" onClick={openForm}><Icon name="spark" size={16}/> {exists ? 'Edit promotion' : `Promote ${subject}`}</button>
    {open && createPortal(<SurfaceModal title={exists ? 'Manage promotion' : `Promote this ${subject}`} onClose={() => { if (!busy) setOpen(false) }}>
      <div className="boost-form-heading"><span><Icon name="spark" size={23}/></span><div><strong>{title}</strong><p>Listings rank by budget per day. The highest active score leads at 100%; equal scores show newest first.</p></div></div>
      {loading ? <p className="boost-form-status" role="status">Loading boost settings…</p> : loadError ? <div className="boost-form-status"><button type="button" className="secondary-button" onClick={openForm}>Try loading settings again</button></div> : <form className="boost-form" onSubmit={save}>
        {benchmark && <div className="boost-benchmark"><span>HIGHEST BOOST ON RECENT {subject.toUpperCase()} POSTS</span><strong>Rs. {Number(benchmark.dailyBudget).toLocaleString('en-PK', { maximumFractionDigits: 4 })} <small>/ day</small></strong><p>Another member’s active promotion. Total budget: Rs. {Number(benchmark.budget).toLocaleString('en-PK')}.</p></div>}
        <label>Budget (Rs.)<input type="number" min="0.01" max="9999999999.99" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Enter your budget" required/></label>
        <div className="boost-duration-fields"><label>Duration<input type="number" min="1" max="365" step="1" value={durationCount} onChange={(event) => setDurationCount(event.target.value)} required/></label><label>Period<select value={durationUnit} onChange={(event) => setDurationUnit(event.target.value)}>{units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select></label></div>
        <p className="boost-form-note">The boost runs for the selected duration from the time you save it. No payment is collected here.</p>
        {confirmDelete && <div className="boost-delete-confirm"><p>Delete the saved promotion settings for this {subject}?</p><button type="button" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep promotion</button><button type="button" className="delete-button" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete promotion'}</button></div>}
        <div className="boost-form-actions">{exists && !confirmDelete && <button type="button" className="boost-remove-button" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete boost</button>}<button type="button" className="secondary-button" onClick={() => setOpen(false)} disabled={busy}>Cancel</button><button type="submit" className="primary-button" disabled={busy || confirmDelete}>{busy ? 'Saving…' : exists ? 'Save changes' : 'Save boost'}</button></div>
      </form>}
    </SurfaceModal>, document.body)}
  </>
}
