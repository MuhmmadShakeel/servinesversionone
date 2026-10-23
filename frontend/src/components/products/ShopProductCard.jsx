import { Icon } from '../common/Icon.jsx'
import { ProductImage } from './ProductImage.jsx'
import { ChatButton } from '../common/UiParts.jsx'
import { ShareButton } from '../common/ShareButton.jsx'
import { VoicePlayer } from '../common/VoicePlayer.jsx'
import { BoostButton } from '../common/BoostButton.jsx'
import { PriceDisplay } from '../common/PriceDisplay.jsx'
import { ReviewsButton } from '../common/ReviewsButton.jsx'

export function ShopProductCard({ product, wishlisted, isOwner, onWishlist, onCart, onChat, busy, focused = false }) {
  const available = product.status === 'active' && product.quantity > 0
  return <article id={focused ? 'focused-listing' : undefined} className={`shop-product-card${focused ? ' listing-focused' : ''}`}>
    <div className="shop-product-photo"><ProductImage product={product}/><ReviewsButton type="product" id={product.id} title={product.title} average={product.ratingAverage} count={product.ratingCount} ownerUserId={product.ownerUserId} onImage/><button type="button" className={`shop-heart ${wishlisted ? 'selected' : ''}`} aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={wishlisted} onClick={() => onWishlist(product)} disabled={busy || isOwner}><Icon name="heart" size={18}/></button></div>
    <div className="shop-product-body"><span className="card-kicker">{product.category}</span><h3>{product.title}</h3><VoicePlayer type="products" id={product.id} hasVoice={product.hasVoice} duration={product.voiceDurationSeconds}/><div className="shop-product-seller">By {product.ownerName || 'You'}</div><div className="shop-product-price"><PriceDisplay price={product.price} originalPrice={product.originalPrice}/><span>{available ? `${product.quantity} available` : 'Unavailable'}</span></div><div className="listing-action-row listing-action-row-four">{!isOwner && <><button className="shop-cart-button" type="button" onClick={() => onCart(product)} disabled={busy || !available}><Icon name="bag" size={16}/>Cart</button>{onChat && <ChatButton onClick={() => onChat(product)} label="Chat"/>}</>}<ShareButton type="product" id={product.id} title={product.title} count={product.shareCount} disabled={!available}/>{isOwner && <BoostButton type="product" id={product.id} title={product.title} ownerUserId={product.ownerUserId} active={available}/>}</div></div>
  </article>
}
