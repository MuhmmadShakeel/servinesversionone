import { OwnerStatusButton } from '../common/OwnerStatusButton.jsx'
import { Icon } from '../common/Icon.jsx'
import { ShareButton } from '../common/ShareButton.jsx'
import { VoicePlayer } from '../common/VoicePlayer.jsx'
import { BoostButton } from '../common/BoostButton.jsx'
import { PriceDisplay } from '../common/PriceDisplay.jsx'
import { ReviewsButton } from '../common/ReviewsButton.jsx'
import { ServiceImage } from './ServiceImage.jsx'

export function MyServiceCard({ service, onEdit, onDelete, onStatusChange }) {
  return <article className="service-card my-service-card">
    <div className="review-image-wrap"><ServiceImage service={service}/><ReviewsButton type="service" id={service.id} title={service.title} average={service.ratingAverage} count={service.ratingCount} ownerUserId={service.ownerUserId} onImage/></div>
    <div className="my-service-card-body">
    <div className="card-top service-owner-status"><span className={`status-pill ${service.status}`}>{service.status === 'active' ? 'Active' : 'Draft'}</span></div>
    <span className="card-kicker">{service.category}</span>
    <h3>{service.title}</h3>
    {service.city && <span className="service-city"><Icon name="pin" size={14}/>{service.city}</span>}

    <VoicePlayer type="services" id={service.id} hasVoice={service.hasVoice} duration={service.voiceDurationSeconds}/>
    <div className="my-service-meta"><span>{service.experienceYears} {service.experienceYears === 1 ? 'year' : 'years'} experience</span></div>
    <div className="service-card-footer"><PriceDisplay price={service.price} originalPrice={service.originalPrice}/><div className="my-service-actions"><button type="button" onClick={() => onEdit(service)}><Icon name="edit" size={15}/>Edit</button><button type="button" className="danger-action" onClick={() => onDelete(service)}><Icon name="trash" size={15}/>Delete</button></div></div>
    <div className="listing-action-row"><ShareButton type="service" id={service.id} title={service.title} count={service.shareCount} disabled={service.status !== 'active'}/><OwnerStatusButton item={service} onChange={onStatusChange} kind="service"/><BoostButton type="service" id={service.id} title={service.title} ownerUserId={service.ownerUserId} active={service.status === 'active'}/></div>
    </div>
  </article>
}
