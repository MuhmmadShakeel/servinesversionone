import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { Icon } from '../common/Icon.jsx'
import { ChatButton, SurfaceModal } from '../common/UiParts.jsx'
import { getAccessToken } from '../../redux/Api/auth/AuthApi.js'
import { useAcceptProposalMutation, useGetProposalsQuery, useGetRequirementQuery, useRejectProposalMutation } from '../../redux/Api/hiring/HiringApi.js'
import { formatBudget } from './formatBudget.js'
import { VoicePlayer } from '../common/VoicePlayer.jsx'

function MediaList({ media }) {
  const [preview, setPreview] = useState(null)
  const [loadingId, setLoadingId] = useState(null)
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])

  async function openMedia(file) {
    setLoadingId(file.id)
    try {
      const response = await fetch(`/v1/hiring/media/${file.id}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } })
      if (!response.ok) throw new Error('Could not open this attachment.')
      setPreview({ url: URL.createObjectURL(await response.blob()), kind: file.kind, fileName: file.fileName })
    } catch (error) { toast.error(error.message) }
    finally { setLoadingId(null) }
  }

  if (!media?.length) return null
  return <div className="hiring-detail-section"><h3>Attachments</h3><div className="hiring-media-list">{media.map((file) => <button key={file.id} type="button" onClick={() => openMedia(file)} disabled={loadingId === file.id}><Icon name={file.kind === 'photo' ? 'image' : file.kind === 'video' ? 'video' : 'mic'} size={18}/><span>{file.fileName}</span><small>{(file.sizeBytes / 1024 / 1024).toFixed(1)} MB</small></button>)}</div>{preview && <div className="hiring-preview"><div><strong>{preview.fileName}</strong><button type="button" onClick={() => setPreview(null)} aria-label="Close preview"><Icon name="close" size={17}/></button></div>{preview.kind === 'photo' ? <img src={preview.url} alt={preview.fileName}/> : preview.kind === 'video' ? <video src={preview.url} controls/> : <audio src={preview.url} controls/>}</div>}</div>
}

function ProposalComparison({ requirementId, isOpen, onChat }) {
  const { data, isLoading, isError } = useGetProposalsQuery(requirementId)
  const [accept, { isLoading: accepting }] = useAcceptProposalMutation()
  const [reject, { isLoading: rejecting }] = useRejectProposalMutation()
  const [decision, setDecision] = useState(null)
  const [sort, setSort] = useState('recent')
  const proposals = [...(data?.proposals || [])].sort((a, b) => sort === 'lowest' ? Number(a.bidAmount) - Number(b.bidAmount) : new Date(b.createdAt) - new Date(a.createdAt))

  async function confirmDecision() {
    if (!decision) return
    try {
      const action = decision.type === 'accept' ? accept : reject
      await action({ requirementId, proposalId: decision.proposalId }).unwrap()
      toast.success(decision.type === 'accept' ? 'Proposal accepted. Other pending offers were declined.' : 'Proposal rejected.')
      setDecision(null)
    } catch (error) { toast.error(error?.data?.message || 'Could not update this proposal.') }
  }

  return <div className="hiring-detail-section"><div className="hiring-section-heading"><h3>Proposals ({proposals.length})</h3><select aria-label="Sort proposals" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Most recent</option><option value="lowest">Lowest bid</option></select></div>
    {isLoading ? <p>Loading proposals…</p> : isError ? <p>Could not load proposals.</p> : !proposals.length ? <p>No proposals yet. Workers can apply while this requirement is open.</p> : <div className="hiring-proposal-list">{proposals.map((proposal) => <article key={proposal.id} className="hiring-proposal">
      <div><strong>{proposal.workerName}</strong><span className={`hiring-status ${proposal.status}`}>{proposal.status}</span></div>
      <p>{proposal.coverLetter}</p>
      <div className="hiring-proposal-facts"><span>Rs. {Number(proposal.bidAmount).toLocaleString('en-PK')}</span><span>{proposal.deliveryDays} days delivery</span></div>
      <div className="hiring-proposal-actions"><ChatButton onClick={() => onChat(proposal)} label="Chat with applicant"/>{isOpen && proposal.status === 'pending' && <><button className="hiring-accept" type="button" onClick={() => setDecision({ proposalId: proposal.id, type: 'accept' })}>Accept proposal</button><button className="hiring-reject" type="button" onClick={() => setDecision({ proposalId: proposal.id, type: 'reject' })}>Reject proposal</button></>}</div>
      {decision?.proposalId === proposal.id && <div className="hiring-accept-confirm"><span>{decision.type === 'accept' ? 'Accept this proposal? The other pending offers will be declined.' : 'Reject this proposal? The job will remain open for other offers.'}</span><div><button type="button" disabled={accepting || rejecting} onClick={confirmDecision}>{accepting || rejecting ? 'Working…' : decision.type === 'accept' ? 'Confirm accept' : 'Confirm reject'}</button><button type="button" disabled={accepting || rejecting} onClick={() => setDecision(null)}>Cancel</button></div></div>}
    </article>)}</div>}
  </div>
}

export function RequirementDetail({ id, currentUserId, myProposal, onClose, onPropose, onEdit, onChat }) {
  const { data, isLoading, isError } = useGetRequirementQuery(id)
  const item = data?.requirement
  const isOwner = item?.ownerUserId === currentUserId
  return <SurfaceModal title="Requirement details" onClose={onClose}>
    {isLoading ? <p className="hiring-detail-loading">Loading requirement…</p> : isError || !item ? <p className="hiring-detail-loading">This requirement is unavailable.</p> : <div className="hiring-detail">
      <div className="hiring-card-top"><span className="hiring-category">{item.category}</span><span className={`hiring-status ${item.status}`}>{item.status}</span></div>
      <h2>{item.title}</h2><p className="hiring-detail-client">Posted by {item.ownerName}</p>
      <div className="hiring-detail-budget"><strong>{formatBudget(item)}</strong><span>{item.proposalCount} proposals</span></div>

      <VoicePlayer key={item.id} type="hiring" id={item.id} hasVoice={item.hasVoice} duration={item.voiceDurationSeconds}/>
      <MediaList media={item.media}/>
      {isOwner ? <><ProposalComparison requirementId={item.id} isOpen={item.status === 'open'} onChat={(proposal) => onChat('proposal', proposal.id)}/>{item.status !== 'awarded' && onEdit && <button className="secondary-button" type="button" onClick={() => onEdit(item)}>Edit requirement</button>}</> : <div className="hiring-detail-actions">{myProposal ? <div className="hiring-proposal-notice"><strong>Your proposal: {myProposal.status}</strong><p>Rs. {Number(myProposal.bidAmount).toLocaleString('en-PK')} · {myProposal.deliveryDays} days</p></div> : item.status === 'open' ? <button className="primary-button" type="button" onClick={() => onPropose(item)}>Send a proposal <Icon name="arrow" size={16}/></button> : null}{(myProposal || item.status === 'open') && <ChatButton onClick={() => onChat(myProposal ? 'proposal' : 'hiring', myProposal?.id || item.id)} label="Chat with client"/>}</div>}
    </div>}
  </SurfaceModal>
}
