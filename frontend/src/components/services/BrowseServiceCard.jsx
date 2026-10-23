import { ServiceImage } from './ServiceImage.jsx'
import { ReviewsButton } from '../common/ReviewsButton.jsx'
import { VoicePlayer } from '../common/VoicePlayer.jsx'
import { PriceDisplay } from '../common/PriceDisplay.jsx'
import { ShareButton } from '../common/ShareButton.jsx'
import { ChatButton } from '../common/UiParts.jsx'
import { BoostButton } from '../common/BoostButton.jsx'
import { Icon } from '../common/Icon.jsx'

export function BrowseServiceCard({ service, onBook, onChat, isOwner, focused = false }) {
  return <article id={focused ? 'focused-listing' : undefined} className={`shop-product-card service-browse-card${focused ? ' listing-focused' : ''}`}>
    <div className="shop-product-photo service-browse-photo"><ServiceImage service={service}/><ReviewsButton type="service" id={service.id} title={service.title} average={service.ratingAverage} count={service.ratingCount} ownerUserId={service.ownerUserId} onImage/></div>
    <div className="shop-product-body service-browse-body">
      <div className="service-browse-heading"><span className="card-kicker">{service.category}</span><span className="status-pill active">Available</span></div>
      <h3>{service.title}</h3>
      {service.city && <span className="service-city"><Icon name="pin" size={14}/>{service.city}</span>}
      <VoicePlayer type="services" id={service.id} hasVoice={service.hasVoice} duration={service.voiceDurationSeconds}/>
      <div className="shop-product-seller">By {service.ownerName}</div>
      <div className="shop-product-price"><PriceDisplay price={service.price} originalPrice={service.originalPrice}/><span>{isOwner ? 'Your service' : `${service.experienceYears} ${service.experienceYears === 1 ? 'year' : 'years'} experience`}</span></div>
      <div className="listing-action-row listing-action-row-four">{!isOwner && <><button className="shop-cart-button" type="button" onClick={() => onBook(service)}><Icon name="bag" size={16}/>Book</button><ChatButton onClick={() => onChat(service)} label="Chat"/></>}<ShareButton type="service" id={service.id} title={service.title} count={service.shareCount}/><BoostButton type="service" id={service.id} title={service.title} ownerUserId={service.ownerUserId}/></div>
    </div>
  </article>
}

