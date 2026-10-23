import { useState } from 'react'
import { CategoryField } from '../common/CategoryField.jsx'
import { toast } from 'react-toastify'
import { SurfaceModal } from '../common/UiParts.jsx'
import { Icon } from '../common/Icon.jsx'
import { authErrorMessage } from '../../redux/Api/auth/AuthApi.js'
import { filesToMedia } from './media.js'
import { VoiceNoteField } from '../common/VoiceNoteField.jsx'
import { discardVoice, uploadVoice } from '../common/voiceUpload.js'

export function RequirementForm({ requirement, onSave, onClose, isSaving }) {
  const [files, setFiles] = useState([])
  const [removeMedia, setRemoveMedia] = useState(false)
  const [reading, setReading] = useState(false)
  const [voice, setVoice] = useState(undefined)

  async function submit(event) {
    event.preventDefault()
    if (reading || isSaving) return
    setReading(true)
    const form = new FormData(event.currentTarget)
    let uploadedVoice
    try {
      const details = {
        title: form.get('title').trim(), category: form.get('category').trim(),
        description: form.get('description').trim(), budgetMin: form.get('budgetMin'),
        budgetMax: form.get('budgetMax'), status: form.get('status'),
      }
      if (files.length) details.media = await filesToMedia(files)
      else if (removeMedia) details.media = []
      if (voice !== undefined) {
        uploadedVoice = await uploadVoice(voice)
        details.voice = uploadedVoice
      }
      await onSave(details)
    } catch (failure) {
      if (uploadedVoice?.url) await discardVoice(uploadedVoice).catch(() => {})
      const message = failure instanceof Error && !failure.status ? failure.message : authErrorMessage(failure)
      toast.error(message)
    }
    finally { setReading(false) }
  }

  return <SurfaceModal title={requirement ? 'Edit requirement' : 'Post a requirement'} onClose={onClose}>
    <form className="hiring-form" onSubmit={submit}>
      <p className="form-intro">Describe the outcome you need so workers can send useful proposals.</p>
      <label>Project title<input name="title" defaultValue={requirement?.title || ''} minLength="5" maxLength="160" placeholder="e.g. Design a brand identity" required /></label>
      <CategoryField kind="hiring" defaultValue={requirement?.category}/>
      <label>What needs to be done?<textarea name="description" defaultValue={requirement?.description || ''} minLength="20" maxLength="5000" rows="5" placeholder="Scope, deliverables, timeline and anything workers should know..." required /></label>
      <VoiceNoteField voice={voice} hasExisting={Boolean(requirement?.hasVoice)} onChange={setVoice}/>
      <div className="hiring-form-row"><label>Minimum budget (Rs.)<input name="budgetMin" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={requirement?.budgetMin ?? ''} required /></label><label>Maximum budget (Rs.)<input name="budgetMax" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={requirement?.budgetMax ?? ''} required /></label></div>
      <label>Status<select name="status" defaultValue={requirement?.status || 'open'}><option value="open">Open to proposals</option><option value="closed">Closed</option></select></label>
      <label className="hiring-upload"><Icon name="image" size={19}/><span><strong>Attach photos or videos</strong><small>Up to 3 files, 8 MB each, 16 MB total. Use the separate voice note field for audio.</small></span><input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={(event) => setFiles(Array.from(event.target.files || []))}/></label>
      {files.length > 0 && <p className="hiring-file-note">Selected: {files.map((file) => file.name).join(', ')}{requirement?.media?.length ? ' — these replace current attachments.' : ''}</p>}
      {requirement?.media?.length > 0 && !files.length && <div className="hiring-existing-media"><strong>Current attachments</strong><span>{requirement.media.map((file) => file.fileName).join(', ')}</span><label><input type="checkbox" checked={removeMedia} onChange={(event) => setRemoveMedia(event.target.checked)}/>Remove all attachments</label></div>}
      <div className="service-form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={isSaving || reading}><Icon name="check" size={17}/>{isSaving || reading ? 'Saving…' : requirement ? 'Save changes' : 'Post requirement'}</button></div>
    </form>
  </SurfaceModal>
}
