import { toast } from 'react-toastify'
import { SurfaceModal } from '../common/UiParts.jsx'
import { Icon } from '../common/Icon.jsx'
import { authErrorMessage } from '../../redux/Api/auth/AuthApi.js'

const money = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 })

export function CheckoutForm({ items, onClose, onSubmit, isSaving }) {
  const total = items.reduce((sum, item) => sum + Number(item.price) * item.cartQuantity, 0)

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try { await onSubmit({ paymentMethod: form.get('paymentMethod'), contactPhone: form.get('contactPhone').trim(), deliveryAddress: form.get('deliveryAddress').trim(), buyerNote: form.get('buyerNote').trim() }) }
    catch (failure) { toast.error(authErrorMessage(failure)) }
  }

  return <SurfaceModal title="Review your order" onClose={onClose}><form className="product-form" onSubmit={submit}><div className="shop-checkout-summary"><span>YOUR ORDER</span>{items.map((item) => <div key={item.id}><span>{item.title} × {item.cartQuantity}</span><strong>Rs. {money.format(Number(item.price) * item.cartQuantity)}</strong></div>)}<div className="shop-checkout-total"><strong>Total</strong><strong>Rs. {money.format(total)}</strong></div></div><fieldset className="shop-payment-method"><legend>Payment method</legend><label><input type="radio" name="paymentMethod" value="cash" defaultChecked required/><span><strong>Cash</strong><small>Pay the seller in cash at delivery or handover.</small></span><Icon name="check" size={17}/></label></fieldset><p className="shop-payment-note"><Icon name="check" size={17}/> No online payment is collected. The seller will confirm your order and arrange delivery with you.</p><label>Contact number<input name="contactPhone" type="tel" minLength="7" maxLength="30" autoComplete="tel" placeholder="e.g. +92 300 1234567" required/></label><label>Delivery address<textarea name="deliveryAddress" minLength="10" maxLength="300" rows="3" autoComplete="street-address" placeholder="Street, area, city and delivery details" required/></label><label>Note for the seller (optional)<textarea name="buyerNote" maxLength="1000" rows="3" placeholder="Color, size or delivery instructions"/></label><div className="product-form-actions"><button type="button" className="secondary-button" onClick={onClose}>Back to cart</button><button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? 'Placing order...' : 'Place order'} <Icon name="arrow" size={16}/></button></div></form></SurfaceModal>
}
