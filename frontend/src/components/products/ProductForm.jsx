import { useState } from 'react'
import { CategoryField } from '../common/CategoryField.jsx'
import { toast } from 'react-toastify'
import { SurfaceModal } from '../common/UiParts.jsx'
import { Icon } from '../common/Icon.jsx'
import { authErrorMessage } from '../../redux/Api/auth/AuthApi.js'
import { ProductImage } from './ProductImage.jsx'
import { VoiceNoteField } from '../common/VoiceNoteField.jsx'
import { discardVoice, uploadVoice } from '../common/voiceUpload.js'

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
const maxImageBytes = 5 * 1024 * 1024

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ fileName: file.name, mimeType: file.type, base64: String(reader.result).split(',')[1] })
    reader.onerror = () => reject(new Error('Could not read the image. Please try another file.'))
    reader.readAsDataURL(file)
  })
}

export function ProductForm({ product, onClose, onSave, isSaving }) {
  const [image, setImage] = useState(undefined)
  const [removeImage, setRemoveImage] = useState(false)
  const [status, setStatus] = useState(product?.status || 'draft')
  const [biddingEnabled, setBiddingEnabled] = useState(Boolean(product?.biddingEnabled))
  const [biddingDurationHours, setBiddingDurationHours] = useState(product?.biddingEnabled && !product?.biddingExpired ? '' : '24')
  const [voice, setVoice] = useState(undefined)
  const [uploading, setUploading] = useState(false)

  function reportError(message) { toast.error(message) }

  async function chooseImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!allowedTypes.includes(file.type)) return reportError('Choose a JPEG, PNG, or WebP image.')
    if (file.size > maxImageBytes) return reportError('Image must be at most 5 MB.')
    try { setImage(await readImage(file)); setRemoveImage(false) }
    catch (failure) { reportError(failure.message) }
  }

  async function submit(event) {
    event.preventDefault()
    if (uploading || isSaving) return
    const form = new FormData(event.currentTarget)
    if (Number(form.get('price')) > Number(form.get('originalPrice'))) return reportError('Discounted price cannot exceed the original price.')
    const quantity = Number(form.get('quantity'))
    const hasImage = Boolean(image || (product?.hasImage && !removeImage))
    if (status === 'active' && (!hasImage || quantity === 0)) return reportError('Add a product image and at least one item in stock before publishing.')
    const details = {
      title: form.get('title').trim(),
      category: form.get('category').trim(),
      description: form.get('description').trim(),
      price: form.get('price'),
      originalPrice: form.get('originalPrice'),
      quantity,
      status,
      biddingEnabled,
    }
    if (biddingEnabled && biddingDurationHours) details.biddingDurationHours = Number(biddingDurationHours)
    if (image) details.image = image
    else if (removeImage) details.image = null
    let uploadedVoice
    setUploading(true)
    try {
      if (voice !== undefined) {
        uploadedVoice = await uploadVoice(voice)
        details.voice = uploadedVoice
      }
      await onSave(details)
    } catch (failure) {
      if (uploadedVoice?.url) await discardVoice(uploadedVoice).catch(() => {})
      reportError(failure instanceof Error ? failure.message : authErrorMessage(failure))
    } finally { setUploading(false) }
  }

  return <SurfaceModal title={product ? 'Edit product' : 'Add a product'} onClose={onClose}>
    <form className="product-form" onSubmit={submit}>
      <div className="product-form-intro"><span className="product-form-step">01 / PRODUCT DETAILS</span><p>Show buyers exactly what they will receive. Save a draft while you prepare your listing.</p></div>
      <div className="product-bidding-option"><label><input type="checkbox" checked={biddingEnabled} onChange={(event) => { setBiddingEnabled(event.target.checked); if (event.target.checked && !biddingDurationHours && product?.biddingExpired) setBiddingDurationHours('24') }}/><span><strong>Accept bids in Live Deals</strong><small>Your product stays in Mart. Buyers can also make offers while bidding is open.</small></span></label><label className="product-bidding-duration">Bidding period<select value={biddingDurationHours} onChange={(event) => setBiddingDurationHours(event.target.value)} disabled={!biddingEnabled}>{product?.biddingEnabled && !product?.biddingExpired && <option value="">Keep current end time</option>}<option value="1">1 hour</option><option value="6">6 hours</option><option value="12">12 hours</option><option value="24">1 day</option><option value="72">3 days</option><option value="168">1 week</option><option value="336">2 weeks</option><option value="720">1 month (30 days)</option></select></label>{product?.biddingEndsAt && biddingEnabled && <small>{product.biddingExpired ? 'Bidding expired. Choose a new period to start again.' : `Current bidding ends ${new Date(product.biddingEndsAt).toLocaleString()}.`}</small>}</div>
      <label>Product name<input name="title" defaultValue={product?.title || ''} minLength="3" maxLength="160" placeholder="e.g. Handcrafted ceramic mug" required /></label>
      <CategoryField kind="product" defaultValue={product?.category}/>
      <label>Description<textarea name="description" defaultValue={product?.description || ''} minLength="10" maxLength="3000" rows="5" placeholder="Materials, size, condition, and what makes this product special" required /></label>
      <VoiceNoteField voice={voice} hasExisting={Boolean(product?.hasVoice)} onChange={setVoice}/>
      <div className="product-form-row"><label>Original price (Rs.)<input name="originalPrice" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={product?.originalPrice ?? product?.price ?? ''} placeholder="e.g. 5,000" required /></label><label>Discounted price (Rs.)<input name="price" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={product?.price ?? ''} placeholder="e.g. 4,000" required /></label></div>
      <p className="price-form-hint">Buyers pay the discounted price. Enter the same amount twice when there is no discount.</p>
      <label>Items in stock<input name="quantity" type="number" min="0" max="999999" step="1" defaultValue={product?.quantity ?? 1} required /></label>
      <div className="product-image-field"><div><span className="product-form-step">02 / PRODUCT IMAGE</span><p>Use a clear JPEG, PNG, or WebP image, up to 5 MB.</p></div><div className="product-image-preview">{image ? <img src={`data:${image.mimeType};base64,${image.base64}`} alt="New product preview"/> : product?.hasImage && !removeImage ? <ProductImage product={product}/> : <div className="product-image-empty"><Icon name="image" size={30}/><span>Your product image will appear here</span></div>}</div><div className="product-image-controls"><label className="product-upload-button"><Icon name="image" size={16}/>{product?.hasImage || image ? 'Replace image' : 'Choose image'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage}/></label>{(image || (product?.hasImage && !removeImage)) && <button type="button" onClick={() => { setImage(undefined); setRemoveImage(true) }}>Remove image</button>}</div></div>
      <label>Listing status<select name="status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">Draft — only you can see it</option><option value="active">Active — ready for the marketplace</option></select></label>
      <div className="product-form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={isSaving || uploading}><Icon name="check" size={17}/>{isSaving || uploading ? 'Saving...' : product ? 'Save changes' : 'Create product'}</button></div>
    </form>
  </SurfaceModal>
}
