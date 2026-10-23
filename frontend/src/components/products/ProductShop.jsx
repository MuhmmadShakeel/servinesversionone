import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { EmptyState, RequestError, SurfaceModal } from '../common/UiParts.jsx'
import { ShopProductCard } from './ShopProductCard.jsx'
import { CartPanel } from './CartPanel.jsx'
import { CheckoutForm } from './CheckoutForm.jsx'
import { OrderCard } from './OrderCard.jsx'
import { getStoredUser } from '../../redux/Api/auth/AuthApi.js'
import { ListingFilters } from '../common/ListingFilters.jsx'
import { useBoostExpiryRefresh } from '../common/useBoostExpiryRefresh.js'
import { RelatedListings } from '../common/RelatedListings.jsx'
import { relatedListings } from '../common/relatedListingUtils.js'
import { emptyListingFilters, matchesListingFilters } from '../common/listingFilterUtils.js'
import {
  useAddCartMutation, useAddWishlistMutation, useBrowseProductsQuery,
  useCancelOrderMutation, useCheckoutMutation, useGetCartQuery,
  useGetMyOrdersQuery, useGetWishlistQuery, useRemoveCartMutation,
  useRemoveWishlistMutation, useUpdateCartMutation,
} from '../../redux/Api/product/ProductApi.js'

const tabs = [
  { id: 'discover', label: 'Shop products' },
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'cart', label: 'Cart' },
  { id: 'orders', label: 'My orders' },
]

const matches = (item, search) => [item.title, item.category].join(' ').toLowerCase().includes(search.trim().toLowerCase())

export function ProductShop({ search, filters, showFilters = false, full = false, focusId = null, onChat }) {
  const user = getStoredUser()
  const [view, setView] = useState('discover')
  const [localFilters, setLocalFilters] = useState(emptyListingFilters)
  const [showCheckout, setShowCheckout] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const browseQuery = useBrowseProductsQuery(undefined, { pollingInterval: view === 'discover' ? 30000 : 0, skipPollingIfUnfocused: true })
  useBoostExpiryRefresh(browseQuery.data?.products, browseQuery.refetch, view === 'discover')
  const wishlistQuery = useGetWishlistQuery(undefined, { pollingInterval: view === 'wishlist' ? 30000 : 0, skipPollingIfUnfocused: true })
  const cartQuery = useGetCartQuery(undefined, { skip: !full || (!browseQuery.isSuccess && view !== 'cart'), pollingInterval: view === 'cart' ? 30000 : 0, skipPollingIfUnfocused: true })
  const ordersQuery = useGetMyOrdersQuery(undefined, { skip: !full || (!browseQuery.isSuccess && view !== 'orders'), pollingInterval: view === 'orders' ? 30000 : 0, skipPollingIfUnfocused: true })
  const [addWishlist, { isLoading: addingWish }] = useAddWishlistMutation()
  const [removeWishlist, { isLoading: removingWish }] = useRemoveWishlistMutation()
  const [addCart, { isLoading: addingCart }] = useAddCartMutation()
  const [updateCart, { isLoading: updatingCart }] = useUpdateCartMutation()
  const [removeCart, { isLoading: removingCart }] = useRemoveCartMutation()
  const [checkout, { isLoading: checkingOut }] = useCheckoutMutation()
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation()
  const wishlist = wishlistQuery.data?.products || []
  const cart = cartQuery.data?.items || []
  const orders = ordersQuery.data?.orders || []
  const wishIds = new Set(wishlist.map((item) => item.id))
  const busy = addingWish || removingWish || addingCart || updatingCart || removingCart
  const products = (view === 'wishlist' ? wishlist : browseQuery.data?.products || []).filter((item) => matches(item, search) && matchesListingFilters(item, filters || localFilters) && (!focusId || view !== 'discover' || item.id === focusId))
  useEffect(() => {
    if (!focusId || !browseQuery.isSuccess) return undefined
    const frame = requestAnimationFrame(() => document.getElementById('focused-listing')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }))
    return () => cancelAnimationFrame(frame)
  }, [focusId, browseQuery.isSuccess])
  const cartRecommendations = relatedListings(browseQuery.data?.products || [], cart, 'id', user?.id)

  async function toggleWishlist(product) {
    try {
      if (wishIds.has(product.id)) { await removeWishlist(product.id).unwrap(); toast.success('Removed from wishlist.') }
      else { await addWishlist(product.id).unwrap(); toast.success('Saved to your wishlist.') }
    } catch (error) { toast.error(error?.data?.message || 'Could not update wishlist.') }
  }

  async function addToCart(product) {
    try { await addCart({ id: product.id, quantity: 1 }).unwrap(); toast.success('Added to cart.') }
    catch (error) { toast.error(error?.data?.message || 'Could not add this product to cart.') }
  }

  async function changeQuantity(item, quantity) {
    try { await updateCart({ id: item.id, quantity }).unwrap(); toast.success('Cart quantity updated.', { toastId: 'cart-quantity' }) }
    catch (error) { toast.error(error?.data?.message || 'Could not update quantity.') }
  }

  async function removeFromCart(item) {
    try { await removeCart(item.id).unwrap(); toast.success('Removed from cart.') }
    catch (error) { toast.error(error?.data?.message || 'Could not remove this item.') }
  }

  async function placeOrder(details) {
    const result = await checkout(details).unwrap()
    toast.success(result.message)
    setShowCheckout(false)
    setView('orders')
  }

  async function confirmCancel() {
    try { await cancelOrder(cancelTarget.id).unwrap(); toast.success('Order cancelled.'); setCancelTarget(null) }
    catch (error) { toast.error(error?.data?.message || 'Could not cancel this order.') }
  }

  const currentQuery = view === 'wishlist' ? wishlistQuery : view === 'cart' ? cartQuery : view === 'orders' ? ordersQuery : browseQuery
  return <section className="content-section listing-section shop-section">
    {full ? <div className="shop-heading"><div><span>THE MARKETPLACE</span><h2>Find something worth keeping.</h2><p>Browse products from independent sellers, save favorites, and order with confidence.</p></div><div className="shop-heading-art" aria-hidden="true">✦</div></div> : <div className="shop-section-title"><h2>Products <span>{browseQuery.data?.products?.length || 0}</span></h2><p>Discover products from the Mart.</p></div>}
    {full && <div className="shop-tabs" role="tablist" aria-label="Product views">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} className={view === tab.id ? 'active' : ''} onClick={() => setView(tab.id)}>{tab.label}{tab.id === 'wishlist' && <span>{wishlist.length}</span>}{tab.id === 'cart' && <span>{cart.length}</span>}{tab.id === 'orders' && <span>{orders.length}</span>}</button>)}</div>}
    {showFilters && (view === 'discover' || view === 'wishlist') && <ListingFilters items={view === 'wishlist' ? wishlist : browseQuery.data?.products || []} value={localFilters} onChange={setLocalFilters}/>}
    {currentQuery.isLoading ? <div className="service-loading" role="status">Loading {view === 'discover' ? 'products' : view}...</div> : currentQuery.isError ? <RequestError title="The Mart is temporarily unavailable" detail="We could not reach the marketplace. Please try again in a moment." onRetry={currentQuery.refetch}/> : view === 'cart' ? <CartPanel items={cart} onQuantity={changeQuantity} onRemove={removeFromCart} onCheckout={() => setShowCheckout(true)} onChat={(item) => onChat('cart', item.id)} busy={busy}/> : view === 'orders' ? orders.length ? <div className="commerce-orders-grid">{orders.map((order) => <OrderCard key={order.id} order={order} mode="mine" busy={cancelling} onAction={setCancelTarget} onChat={(item) => onChat('order', item.id)}/>)}</div> : <EmptyState label="No orders yet" detail="Your purchases will appear here after checkout."/> : products.length ? <div className="shop-product-grid">{products.map((product) => <ShopProductCard key={product.id} product={product} focused={focusId === product.id && view === 'discover'} wishlisted={wishIds.has(product.id)} isOwner={product.ownerUserId === user?.id} onWishlist={toggleWishlist} onCart={addToCart} onChat={(item) => onChat('product', item.id)} busy={busy}/>)}</div> : <EmptyState label={view === 'wishlist' ? wishlist.length ? 'No matching saved products' : 'Your wishlist is empty' : 'No matching products'} detail={view === 'wishlist' ? wishlist.length ? 'Try a different search.' : 'Tap the heart on a product to save it here.' : 'Try another search or check back soon.'}/>}
    {view === 'cart' && cart.length > 0 && <RelatedListings source="the products in your cart" count={cartRecommendations.length}><div className="shop-product-grid">{cartRecommendations.map((product) => <ShopProductCard key={product.id} product={product} wishlisted={wishIds.has(product.id)} isOwner={false} onWishlist={toggleWishlist} onCart={addToCart} onChat={(item) => onChat('product', item.id)} busy={busy}/>)}</div></RelatedListings>}
    {showCheckout && <CheckoutForm items={cart} onClose={() => setShowCheckout(false)} onSubmit={placeOrder} isSaving={checkingOut}/>}
    {cancelTarget && <SurfaceModal title="Cancel order?" onClose={() => setCancelTarget(null)}><p className="delete-copy">Cancel your pending order for <strong>{cancelTarget.productTitle}</strong>? The reserved stock will be returned to the seller.</p><div className="service-form-actions"><button type="button" className="secondary-button" onClick={() => setCancelTarget(null)}>Keep order</button><button type="button" className="delete-button" onClick={confirmCancel} disabled={cancelling}>{cancelling ? 'Cancelling...' : 'Cancel order'}</button></div></SurfaceModal>}
  </section>
}
