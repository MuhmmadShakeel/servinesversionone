import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'react-toastify'
import { useDispatch } from 'react-redux'
import { getAccessToken, getStoredUser, useAuthToken } from '../../redux/Api/auth/AuthApi.js'
import { serviceApi } from '../../redux/Api/service/ServiceApi.js'
import { productApi } from '../../redux/Api/product/ProductApi.js'
import { hiringApi } from '../../redux/Api/hiring/HiringApi.js'
import { SurfaceModal } from './UiParts.jsx'

export function ReviewsButton({ type, id, title, average, count = 0, ownerUserId, onImage = false }) {
  const dispatch = useDispatch()
  const token = useAuthToken()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reviews, setReviews] = useState([])
  const [summary, setSummary] = useState({ average, count })
  const [canReview, setCanReview] = useState(false)
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const url = `/v1/reviews/${type}/${id}`
  const headers = () => ({ Authorization: `Bearer ${getAccessToken()}` })

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(url, { headers: headers() })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not load reviews.')
      setReviews(data.reviews)
      setSummary(data.rating)
      setCanReview(data.canReview)
      const mine = data.reviews.find((review) => review.reviewerUserId === getStoredUser()?.id)
      setRating(mine?.rating || 0)
      setBody(mine?.body || '')
      setEditing(false)
      setConfirmDelete(false)
    } catch (failure) { const message = failure.message || 'Could not load reviews.'; setError(message); setCanReview(false); setReviews([]); toast.error(message) }
    finally { setLoading(false) }
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const response = await fetch(url, { method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ rating, body }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not save your review.')
      toast.success('Review saved.')
      refreshListings()
      await load()
    } catch (failure) { toast.error(failure.message || 'Could not save your review.') }
    finally { setSaving(false) }
  }

  function refreshListings() {
    if (type === 'service') dispatch(serviceApi.util.invalidateTags(['BrowseServices', 'MyServices']))
    if (type === 'product') dispatch(productApi.util.invalidateTags(['BrowseProducts', 'MyProducts']))
    if (type === 'job') dispatch(hiringApi.util.invalidateTags(['OpenRequirements', 'MyRequirements', { type: 'Requirement', id }]))
  }

  async function remove() {
    setSaving(true)
    try {
      const response = await fetch(url, { method: 'DELETE', headers: headers() })
      if (!response.ok) throw new Error((await response.json()).message || 'Could not delete your review.')
      toast.success('Review deleted.')
      refreshListings()
      await load()
    } catch (failure) { toast.error(failure.message || 'Could not delete your review.') }
    finally { setSaving(false) }
  }

  if (!token) return null

  const mine = reviews.find((review) => review.reviewerUserId === getStoredUser()?.id)
  const isOwner = ownerUserId === getStoredUser()?.id

  return <>
    <div className={`review-entry${onImage ? ' review-entry-image' : ''}`}><button type="button" aria-label={`Open reviews for ${title}`} onClick={() => { setOpen(true); load() }}><span className="review-entry-star" aria-hidden="true">★</span><strong>{Number(summary.count) ? Number(summary.average).toFixed(1) : 'New'}</strong><span>{Number(summary.count) ? `(${summary.count}) · ` : ''}{isOwner ? 'Reviews' : mine ? 'Your review' : 'Add review'}</span></button></div>
    {open && createPortal(<SurfaceModal title={`Reviews for ${title}`} onClose={() => { if (!saving) setOpen(false) }}>
      <div className="reviews-panel">
        {loading ? <p role="status">Loading reviews...</p> : error ? <p role="alert">{error}</p> : <>
          <div className="reviews-summary"><span>★</span><strong>{summary.count ? Number(summary.average).toFixed(1) : 'New'}</strong><small>{summary.count} {summary.count === 1 ? 'review' : 'reviews'}</small></div>
          {canReview && (!mine || editing) && <form className="review-form" onSubmit={submit}><strong>{mine ? 'Edit your review' : 'Add your review'}</strong><div className="review-picker" role="group" aria-label="Choose a rating">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" className={star <= rating ? 'selected' : ''} onClick={() => setRating(star)} aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`} aria-pressed={star === rating}>★</button>)}</div><textarea value={body} onChange={(event) => setBody(event.target.value)} minLength="10" maxLength="1000" rows="3" placeholder="Share what others should know about this listing" required/><div className="review-form-actions">{mine && <button className="secondary-button" type="button" onClick={() => { setEditing(false); setRating(mine.rating); setBody(mine.body) }}>Cancel</button>}<button className="primary-button" type="submit" disabled={saving || !rating || body.trim().length < 10}>{saving ? 'Saving...' : mine ? 'Save changes' : 'Post review'}</button></div></form>}
          {!canReview && !mine && <p className="review-eligibility">You can review active listings from other members.</p>}
          {mine && <div className="review-owner-actions">{canReview && !editing && <button type="button" onClick={() => setEditing(true)}>Edit your review</button>}<button type="button" className="review-delete-action" onClick={() => setConfirmDelete(true)}>Delete your review</button></div>}
          {confirmDelete && <div className="review-delete-confirm"><p>Delete your review? This cannot be undone.</p><div><button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)} disabled={saving}>Keep review</button><button type="button" className="danger-action" onClick={remove} disabled={saving}>{saving ? 'Deleting...' : 'Delete review'}</button></div></div>}
          <div className="review-list">{reviews.length ? reviews.map((review) => <article key={review.reviewerUserId}><div><strong>{review.reviewerName}</strong><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div><small>{new Date(review.updatedAt).toLocaleDateString()}</small><p>{review.body}</p></article>) : <p>Be the first to review this listing.</p>}</div>
        </>}
        {error && <button type="button" className="secondary-button" onClick={load}>Try loading reviews again</button>}
      </div>
    </SurfaceModal>, document.body)}
  </>
}
