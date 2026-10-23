import { OwnerStatusButton } from '../common/OwnerStatusButton.jsx'
import { Icon } from '../common/Icon.jsx'
import { ProductImage } from './ProductImage.jsx'
import { ShareButton } from '../common/ShareButton.jsx'
import { VoicePlayer } from '../common/VoicePlayer.jsx'
import { BoostButton } from '../common/BoostButton.jsx'
import { PriceDisplay } from '../common/PriceDisplay.jsx'
import { ReviewsButton } from '../common/ReviewsButton.jsx'

export function MyProductCard({ product, onEdit, onDelete, onStatusChange }) {
  return <article className="seller-product-card">
    <div className="review-image-wrap"><ProductImage product={product}/><ReviewsButton type="product" id={product.id} title={product.title} average={product.ratingAverage} count={product.ratingCount} ownerUserId={product.ownerUserId} onImage/></div>
    <div className="seller-product-body">
      <div className="seller-product-top"><span className="card-kicker">{product.category}</span><span className={`status-pill ${product.status}`}>{product.status === 'active' ? 'Active' : 'Draft'}</span></div>
      <h3>{product.title}</h3>

      <VoicePlayer type="products" id={product.id} hasVoice={product.hasVoice} duration={product.voiceDurationSeconds}/>
      <div className="seller-product-facts"><PriceDisplay price={product.price} originalPrice={product.originalPrice}/><span>{product.quantity} in stock</span></div>
      <div className="seller-product-actions"><button type="button" onClick={() => onEdit(product)}><Icon name="edit" size={15}/> Edit</button><button type="button" className="danger-action" onClick={() => onDelete(product)}><Icon name="trash" size={15}/> Delete</button></div>
      <div className="listing-action-row"><ShareButton type="product" id={product.id} title={product.title} count={product.shareCount} disabled={product.status !== 'active' || product.quantity < 1}/><OwnerStatusButton item={product} onChange={onStatusChange} kind="product"/><BoostButton type="product" id={product.id} title={product.title} ownerUserId={product.ownerUserId} active={product.status === 'active' && product.quantity > 0}/></div>
    </div>
  </article>
}
