import { OwnerStatusButton } from '../common/OwnerStatusButton.jsx'
import { Icon } from '../common/Icon.jsx'
import { formatBudget } from './formatBudget.js'
import { ChatButton } from '../common/UiParts.jsx'
import { ShareButton } from '../common/ShareButton.jsx'
import { VoicePlayer } from '../common/VoicePlayer.jsx'
import { BoostButton } from '../common/BoostButton.jsx'
import { ReviewsButton } from '../common/ReviewsButton.jsx'

export function RequirementCard({ item, mode, onView, onEdit, onDelete, onChat, onStatusChange }) {
  return <article className="hiring-card">
    <div className="hiring-card-top"><span className="hiring-category">{item.category}</span><span className={`hiring-status ${item.status}`}>{item.status}</span></div>
    <ReviewsButton type="job" id={item.id} title={item.title} average={item.ratingAverage} count={item.ratingCount} ownerUserId={item.ownerUserId}/>
    <h3>{item.title}</h3>

    <VoicePlayer type="hiring" id={item.id} hasVoice={item.hasVoice} duration={item.voiceDurationSeconds}/>
    <div className="hiring-card-facts"><span><Icon name="bag" size={15}/>{formatBudget(item)}</span><span><Icon name="users" size={15}/>{item.proposalCount} {item.proposalCount === 1 ? 'proposal' : 'proposals'}</span></div>
    <div className="hiring-card-bottom"><span>Posted by {item.ownerName}{item.media?.length ? ` · ${item.media.length} attachment${item.media.length > 1 ? 's' : ''}` : ''}</span><button type="button" onClick={() => onView(item)}>View details <Icon name="arrow" size={15}/></button></div>
    <div className="listing-action-row"><ShareButton type="hiring" id={item.id} title={item.title} count={item.shareCount} disabled={item.status !== 'open'}/><OwnerStatusButton item={item} onChange={onStatusChange} kind="hiring"/><BoostButton type="hiring" id={item.id} title={item.title} ownerUserId={item.ownerUserId} active={item.status === 'open'}/>{mode === 'discover' && onChat && <ChatButton onClick={() => onChat(item)} label="Chat"/>}</div>
    {mode === 'mine' && <div className="hiring-owner-actions"><button type="button" onClick={() => onView(item)}>Review {item.proposalCount || 0} {item.proposalCount === 1 ? 'proposal' : 'proposals'}</button>{item.status !== 'awarded' && <button type="button" onClick={() => onEdit(item)}>Edit</button>}<button type="button" className="danger-action" onClick={() => onDelete(item)}>Delete</button></div>}
  </article>
}
