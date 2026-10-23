import { useState } from 'react'
import { toast } from 'react-toastify'
import { PageHeader } from '../components/common/PageHeader.jsx'
import { ChatButton, EmptyState, PrimaryButton, SearchBox, SurfaceModal } from '../components/common/UiParts.jsx'
import { RequirementCard } from '../components/hiring/RequirementCard.jsx'
import { RelatedListings } from '../components/common/RelatedListings.jsx'
import { relatedListings } from '../components/common/relatedListingUtils.js'
import { useBoostExpiryRefresh } from '../components/common/useBoostExpiryRefresh.js'
import { RequirementForm } from '../components/hiring/RequirementForm.jsx'
import { ProposalForm } from '../components/hiring/ProposalForm.jsx'
import { RequirementDetail } from '../components/hiring/RequirementDetail.jsx'
import { ListingFilters } from '../components/common/ListingFilters.jsx'
import { emptyListingFilters, matchesListingFilters } from '../components/common/listingFilterUtils.js'
import { getStoredUser, useAuthToken } from '../redux/Api/auth/AuthApi.js'
import {
  useCreateRequirementMutation, useDeleteProposalMutation, useDeleteRequirementMutation,
  useGetMyProposalsQuery, useGetMyRequirementsQuery, useGetOpenRequirementsQuery,
  useSubmitProposalMutation, useUpdateProposalMutation, useUpdateRequirementMutation,
} from '../redux/Api/hiring/HiringApi.js'

const tabs = [
  { id: 'discover', label: 'Find work' },
  { id: 'mine', label: 'My job posts' },
  { id: 'proposals', label: 'My proposals' },
]

export function HiringPage({ mode = 'browse', onNavigate = () => {} }) {
  const token = useAuthToken()
  const currentUser = getStoredUser()
  const [tab, setTab] = useState(mode === 'manage' ? 'mine' : 'discover')
  const [search, setSearch] = useState('')
  const [listingFilters, setListingFilters] = useState(emptyListingFilters)
  const [detailId, setDetailId] = useState(null)
  const [editingRequirement, setEditingRequirement] = useState(null)
  const [showRequirementForm, setShowRequirementForm] = useState(false)
  const [proposalForm, setProposalForm] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const openQuery = useGetOpenRequirementsQuery(token, { skip: !token || mode === 'manage', pollingInterval: 30000, skipPollingIfUnfocused: true })
  useBoostExpiryRefresh(openQuery.data?.requirements, openQuery.refetch, Boolean(token && mode !== 'manage'))
  const mineQuery = useGetMyRequirementsQuery(token, { skip: !token || mode === 'browse' })
  const proposalsQuery = useGetMyProposalsQuery(token, { skip: !token || mode === 'manage' })
  const [createRequirement, { isLoading: creating }] = useCreateRequirementMutation()
  const [updateRequirement, { isLoading: updating }] = useUpdateRequirementMutation()
  const [deleteRequirement, { isLoading: deletingRequirement }] = useDeleteRequirementMutation()
  const [submitProposal, { isLoading: submitting }] = useSubmitProposalMutation()
  const [updateProposal, { isLoading: updatingProposal }] = useUpdateProposalMutation()
  const [deleteProposal, { isLoading: deletingProposal }] = useDeleteProposalMutation()

  const open = openQuery.data?.requirements || []
  const mine = mineQuery.data?.requirements || []
  const proposals = proposalsQuery.data?.proposals || []
  const jobRecommendations = relatedListings(open, proposals, 'requirementId', currentUser?.id)
  const query = tab === 'discover' ? openQuery : tab === 'mine' ? mineQuery : proposalsQuery
  const matches = (item) => `${item.title || item.requirementTitle} ${item.category} ${item.description || item.coverLetter}`.toLowerCase().includes(search.toLowerCase())
  const visible = (tab === 'discover' ? open : tab === 'mine' ? mine : proposals).filter((item) => matches(item) && matchesListingFilters(item, listingFilters, tab === 'proposals' ? ['bidAmount'] : ['budgetMin', 'budgetMax', 'budget']))

  function openCreate() { setEditingRequirement(null); setShowRequirementForm(true) }
  function openEdit(item) { setDetailId(null); setEditingRequirement(item); setShowRequirementForm(true) }
  function openProposal(item, proposal = null) { setDetailId(null); setProposalForm({ requirement: item, proposal }) }

  async function saveRequirement(details) {
    if (editingRequirement) await updateRequirement({ id: editingRequirement.id, ...details }).unwrap()
    else await createRequirement(details).unwrap()
    toast.success(editingRequirement ? 'Requirement updated.' : 'Requirement posted.')
    setShowRequirementForm(false)
    setEditingRequirement(null)
    setTab('mine')
  }

  async function saveProposal(details) {
    if (proposalForm.proposal) await updateProposal({ id: proposalForm.proposal.id, ...details }).unwrap()
    else await submitProposal({ requirementId: proposalForm.requirement.id, ...details }).unwrap()
    toast.success(proposalForm.proposal ? 'Proposal updated.' : 'Proposal sent to the client.')
    setProposalForm(null)
    setTab('proposals')
  }

  async function changeStatus(item, status) {
    try {
      const { id, title, category, description } = item
      const fields = { id, title, category, description, status, budgetMin: item.budgetMin, budgetMax: item.budgetMax }
      await updateRequirement(fields).unwrap()
      toast.success(status === 'active' || status === 'open' ? 'Listing is now live.' : 'Listing is no longer public.')
    } catch (error) { toast.error(error?.data?.message || 'Could not change listing status.') }
  }

  async function confirmDelete() {
    try {
      if (deleting.type === 'requirement') await deleteRequirement(deleting.item.id).unwrap()
      else await deleteProposal(deleting.item.id).unwrap()
      toast.success(deleting.type === 'requirement' ? 'Requirement deleted.' : 'Proposal withdrawn.')
      setDeleting(null)
    } catch { toast.error('Could not complete this action. Please try again.') }
  }

  return <>
    <PageHeader stats={mode === 'manage' ? undefined : 'hiring'} eyebrow={mode === 'manage' ? "YOUR JOB POSTS" : "JOBS & OPPORTUNITIES"} title={mode === 'manage' ? "My job posts" : "Jobs"} description={mode === 'manage' ? "Post jobs and manage the proposals they receive." : "Explore open jobs and keep track of your proposals."} action={mode === 'manage' && token && <PrimaryButton onClick={openCreate}>Post a job</PrimaryButton>} />
    {!token ? <EmptyState label="Log in to explore jobs" detail="Log in from the top bar to post a job or send proposals."/> : <>
      <div className="hiring-tabs" role="tablist" aria-label="Job views">{tabs.filter((item) => mode === 'manage' ? item.id === 'mine' : item.id !== 'mine').map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); setSearch('') }}>{item.label}<span>{item.id === 'discover' ? open.length : item.id === 'mine' ? mine.length : proposals.length}</span></button>)}</div>
      <div className="hiring-toolbar"><SearchBox value={search} onChange={setSearch} placeholder={tab === 'proposals' ? 'Search your proposals...' : 'Search requirements...'}/><span>{visible.length} {tab === 'proposals' ? 'proposals' : 'requirements'}</span></div>
      <ListingFilters items={tab === 'discover' ? open : tab === 'mine' ? mine : proposals} value={listingFilters} onChange={setListingFilters} priceLabel="Budget"/>
      {query.isLoading ? <div className="service-loading" role="status">Loading job activity…</div> : query.isError ? <div className="service-loading" role="alert">Could not load job activity. <button type="button" onClick={query.refetch}>Try again</button></div> : tab === 'proposals' ? (visible.length ? <div className="hiring-proposal-grid">{visible.map((proposal) => <article className="my-proposal-card" key={proposal.id}><div className="hiring-card-top"><span className="hiring-category">{proposal.category}</span><span className={`hiring-status ${proposal.status}`}>{proposal.status}</span></div><h3>{proposal.requirementTitle}</h3><p className="my-proposal-client">Client: {proposal.clientName}</p><p>{proposal.coverLetter}</p><div className="hiring-proposal-facts"><span>Bid: Rs. {Number(proposal.bidAmount).toLocaleString('en-PK')}</span><span>{proposal.deliveryDays} days</span></div><div className="my-proposal-actions"><button type="button" onClick={() => setDetailId(proposal.requirementId)}>View requirement</button><ChatButton onClick={() => onNavigate('chat', { context: 'proposal', id: proposal.id })} label="Chat with client"/>{proposal.status === 'pending' && proposal.requirementStatus === 'open' && <><button type="button" onClick={() => openProposal({ id: proposal.requirementId, title: proposal.requirementTitle }, proposal)}>Edit proposal</button><button type="button" className="danger-action" onClick={() => setDeleting({ type: 'proposal', item: proposal })}>Withdraw</button></>}</div></article>)}</div> : <EmptyState label="No proposals yet" detail="Find an open requirement and send your first proposal."/>) : visible.length ? <div className="hiring-grid">{visible.map((item) => <RequirementCard key={item.id} item={item} mode={tab} onView={(value) => setDetailId(value.id)} onEdit={mode === 'manage' ? openEdit : () => { setDetailId(null); onNavigate('listings', 'hiring') }} onDelete={(value) => setDeleting({ type: 'requirement', item: value })} onStatusChange={tab === 'mine' ? changeStatus : undefined} onChat={item.ownerUserId === currentUser?.id ? undefined : (value) => onNavigate('chat', { context: 'hiring', id: value.id })}/>)}</div> : <EmptyState label={tab === 'mine' ? 'No requirements yet' : 'No open work matches'} detail={tab === 'mine' ? 'Post a requirement to start receiving offers.' : 'Try a different search or check back soon.'}/>}
      {tab === 'proposals' && proposals.length > 0 && <RelatedListings source="the jobs you've applied to" count={jobRecommendations.length}><div className="hiring-grid">{jobRecommendations.map((item) => <RequirementCard key={item.id} item={item} mode="discover" onView={(value) => setDetailId(value.id)} onChat={(value) => onNavigate('chat', { context: 'hiring', id: value.id })}/>)}</div></RelatedListings>}
    </>}
    {detailId && <RequirementDetail id={detailId} currentUserId={currentUser?.id} myProposal={proposals.find((proposal) => proposal.requirementId === detailId)} onClose={() => setDetailId(null)} onPropose={openProposal} onEdit={mode === 'manage' ? openEdit : undefined} onChat={(context, id) => onNavigate('chat', { context, id })}/>}
    {showRequirementForm && <RequirementForm key={editingRequirement?.id || 'new'} requirement={editingRequirement} onClose={() => setShowRequirementForm(false)} onSave={saveRequirement} isSaving={creating || updating}/>}
    {proposalForm && <ProposalForm key={proposalForm.proposal?.id || proposalForm.requirement.id} requirement={proposalForm.requirement} proposal={proposalForm.proposal} onClose={() => setProposalForm(null)} onSave={saveProposal} isSaving={submitting || updatingProposal}/>}
    {deleting && <SurfaceModal title={deleting.type === 'requirement' ? 'Delete requirement?' : 'Withdraw proposal?'} onClose={() => setDeleting(null)}><p className="delete-copy">{deleting.type === 'requirement' ? <>This will permanently remove <strong>{deleting.item.title}</strong> and all its proposals and attachments.</> : <>Your proposal for <strong>{deleting.item.requirementTitle}</strong> will be removed.</>}</p><div className="service-form-actions"><button className="secondary-button" type="button" onClick={() => setDeleting(null)}>Cancel</button><button className="delete-button" type="button" disabled={deletingRequirement || deletingProposal} onClick={confirmDelete}>{deletingRequirement || deletingProposal ? 'Working…' : deleting.type === 'requirement' ? 'Delete requirement' : 'Withdraw proposal'}</button></div></SurfaceModal>}
  </>
}
