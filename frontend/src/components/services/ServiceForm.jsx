import { useState } from 'react'
import { CategoryField } from '../common/CategoryField.jsx'
import { toast } from 'react-toastify'
import { Icon } from '../common/Icon.jsx'
import { SurfaceModal } from '../common/UiParts.jsx'
import { authErrorMessage } from '../../redux/Api/auth/AuthApi.js'
import { VoiceNoteField } from '../common/VoiceNoteField.jsx'
import { discardVoice, uploadVoice } from '../common/voiceUpload.js'
import { ServiceImage } from './ServiceImage.jsx'

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

export function ServiceForm({ service, onClose, onSave, isSaving }) {
  const [voice, setVoice] = useState(undefined)
  const [image, setImage] = useState(undefined)
  const [removeImage, setRemoveImage] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function chooseImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!allowedTypes.includes(file.type)) return toast.error('Choose a JPEG, PNG, or WebP image.')
    if (file.size > maxImageBytes) return toast.error('Image must be at most 5 MB.')
    try { setImage(await readImage(file)); setRemoveImage(false) }
    catch (failure) { toast.error(failure.message) }
  }

  async function submit(event) {
    event.preventDefault()
    if (uploading || isSaving) return
    const form = new FormData(event.currentTarget)
    if (form.get('status') === 'active' && !image && (!service?.hasImage || removeImage) && !(service?.status === 'active' && !service?.hasImage && !removeImage)) return toast.error('Add a service image before publishing.')
    if (Number(form.get('price')) > Number(form.get('originalPrice'))) {
      const message = 'Discounted price cannot exceed the original price.'
      toast.error(message)
      return
    }
    const details = {
      title: form.get('title').trim(),
      category: form.get('category').trim(),
      city: form.get('city').trim(),
      description: form.get('description').trim(),
      price: form.get('price'),
      originalPrice: form.get('originalPrice'),
      experienceYears: Number(form.get('experienceYears')),
      status: form.get('status'),
    }
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
      toast.error(failure instanceof Error ? failure.message : authErrorMessage(failure))
    } finally { setUploading(false) }
  }

  return <SurfaceModal title={service ? 'Edit service' : 'Add a service'} onClose={onClose}>
    <form className="service-form" onSubmit={submit}>
      <p className="form-intro">Give people a clear picture of what you offer. You can change these details later.</p>
      <label>Service title<input name="title" defaultValue={service?.title || ''} minLength="3" maxLength="120" placeholder="e.g. Brand identity design" required /></label>
      <CategoryField kind="service" defaultValue={service?.category}/>
      <label className="service-city-field"><span><Icon name="pin" size={16}/> City</span><input name="city" type="text" autoComplete="address-level2" defaultValue={service?.city || ''} minLength="2" maxLength="80" placeholder="e.g. Bahawalpur" required/><small>Buyers can use your city to find services nearby.</small></label>
      <label>Description<textarea name="description" defaultValue={service?.description || ''} minLength="10" maxLength="2000" rows="5" placeholder="What will the client receive? What makes your service valuable?" required /></label>
      <div className="service-image-field"><div><strong>Service image</strong><span>Show clients what you offer. JPEG, PNG, or WebP, up to 5 MB.</span></div><div className="service-image-preview">{image ? <img src={`data:${image.mimeType};base64,${image.base64}`} alt="New service preview"/> : service?.hasImage && !removeImage ? <ServiceImage service={service}/> : <div className="service-image-empty"><Icon name="image" size={28}/><span>Your service image will appear here</span></div>}</div><div className="service-image-controls"><label className="service-upload-button"><Icon name="image" size={16}/>{image || (service?.hasImage && !removeImage) ? 'Replace image' : 'Choose image'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage}/></label>{(image || (service?.hasImage && !removeImage)) && <button type="button" onClick={() => { setImage(undefined); setRemoveImage(true) }}>Remove image</button>}</div></div>
      <VoiceNoteField voice={voice} hasExisting={Boolean(service?.hasVoice)} onChange={setVoice}/>
      <div className="service-form-row"><label>Original price (Rs.)<input name="originalPrice" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={service?.originalPrice ?? service?.price ?? ''} placeholder="e.g. 5,000" required /></label><label>Discounted price (Rs.)<input name="price" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={service?.price ?? ''} placeholder="e.g. 4,000" required /></label></div>
      <p className="price-form-hint">The discounted price is what customers pay. Use the same amount in both fields when there is no discount.</p>
      <label>Experience (years)<input name="experienceYears" type="number" min="0" max="60" step="1" defaultValue={service?.experienceYears ?? 0} required /></label>
      <label>Status<select name="status" defaultValue={service?.status || 'draft'}><option value="draft">Draft</option><option value="active">Active</option></select></label>
      <div className="service-form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={isSaving || uploading}><Icon name="check" size={17}/>{isSaving || uploading ? 'Saving…' : service ? 'Save changes' : 'Create service'}</button></div>
    </form>
  </SurfaceModal>
}
