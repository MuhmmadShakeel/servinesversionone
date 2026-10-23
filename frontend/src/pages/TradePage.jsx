import { useState } from 'react'
import { toast } from 'react-toastify'
import { PageHeader } from '../components/common/PageHeader.jsx'
import { EmptyState, SearchBox, SurfaceModal } from '../components/common/UiParts.jsx'
import { ProductImage } from '../components/products/ProductImage.jsx'
import { VoicePlayer } from '../components/common/VoicePlayer.jsx'
import { PriceDisplay } from '../components/common/PriceDisplay.jsx'
import { ReviewsButton } from '../components/common/ReviewsButton.jsx'
import { useBoostExpiryRefresh } from '../components/common/useBoostExpiryRefresh.js'
import { Icon } from '../components/common/Icon.jsx'
import { getStoredUser, useAuthToken } from '../redux/Api/auth/AuthApi.js'
import { useBrowseProductsQuery, useGetProductBidsQuery, usePlaceBidMutation } from '../redux/Api/product/ProductApi.js'

const money = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function BidDetail({ product, onClose }) {
  const user = getStoredUser()
  const owner = user?.id === product.ownerUserId
  const { data, isLoading, isError, refetch } = useGetProductBidsQuery(product.id)
  const [placeBid, { isLoading: submitting }] = usePlaceBidMutation()
  const bids = data?.bids || []
  const minimum = bids.length ? bids[0].amount : product.price

  async function submit(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      await placeBid({ id: product.id, amount: form.get('amount'), note: form.get('note').trim() }).unwrap()
      formElement.reset()
      toast.success('Your bid has been placed.')
    } catch (failure) { toast.error(failure?.data?.message || 'Could not place your bid. Please try again.') }
  }

  return <SurfaceModal title={product.title} onClose={onClose}>
    <div className="bid-detail">
      <div className="bid-detail-product"><ProductImage product={product}/><div><span>{product.category}</span><PriceDisplay price={product.price} originalPrice={product.originalPrice}/><small>Listed by {product.ownerName}</small></div></div>
      <VoicePlayer key={product.id} type="products" id={product.id} hasVoice={product.hasVoice} duration={product.voiceDurationSeconds}/>
      {!owner && !isLoading && !isError && <form className="bid-form" onSubmit={submit}>
        <h3>Make a bid</h3><p>Enter more than Rs. {money.format(Number(minimum))}. The seller can see your account name and note.</p>
        <div><label><span>Your price (Rs.)</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="Enter your bid" required /></label><label><span>Note (optional)</span><input name="note" maxLength="500" placeholder="Add a note" /></label></div>
        <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit bid'}</button>
      </form>}
      <div className="bid-history-heading"><h3>Bid history</h3><span>{bids.length} {bids.length === 1 ? 'bid' : 'bids'}</span></div>
      {isLoading ? <p className="bid-message">Loading bids...</p> : isError ? <p className="bid-message">Could not load bids. <button type="button" onClick={refetch}>Try again</button></p> : bids.length ? <ol className="bid-history">{bids.map((bid) => <li key={bid.id}><div><strong>{bid.bidderName}{bid.bidderUserId === user?.id ? ' (you)' : ''}</strong><time dateTime={bid.createdAt}>{new Date(bid.createdAt).toLocaleString()}</time></div><b>Rs. {money.format(Number(bid.amount))}</b>{bid.note && <p>{bid.note}</p>}</li>)}</ol> : <p className="bid-message">No bids yet. Be the first to place one.</p>}
      {owner && <p className="bid-message">This is your product. Review offers in Make Listing → Products → Offers received.</p>}
    </div>
  </SurfaceModal>
}

export function TradePage({ onNavigate }) {
  const token = useAuthToken()
  const user = getStoredUser()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const { data, isLoading, isError, refetch } = useBrowseProductsQuery(true, { skip: !token, pollingInterval: 10000, skipPollingIfUnfocused: true })
  useBoostExpiryRefresh(data?.products, refetch, Boolean(token))
  const products = (data?.products || []).filter((product) => `${product.title} ${product.category}`.toLowerCase().includes(search.trim().toLowerCase()))

  return <>
    <PageHeader stats="trade" eyebrow="PRODUCT OFFERS" title="Live Deals" description="Explore active products, review existing bids, and make an offer from your account."/>
    {!token ? <EmptyState label="Log in to see product bids" detail="Use Log in in the top bar to browse products and place a bid."/> : <>
      <div className="bid-page-intro"><span>DISCOVER LIVE DEALS</span><h2>Find a product worth an offer.</h2><p>Browse active products, compare existing bids, and make your offer.</p></div>
      <div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search products to bid on..."/></div>
      {isLoading ? <div className="service-loading" role="status">Loading live deals...</div> : isError ? <div className="service-loading" role="alert">Could not load live deals. <button type="button" onClick={refetch}>Try again</button></div> : products.length ? <div className="bid-product-grid">{products.map((product) => <article className="bid-product-card" key={product.id}><div className="review-image-wrap"><ProductImage product={product}/><ReviewsButton type="product" id={product.id} title={product.title} average={product.ratingAverage} count={product.ratingCount} ownerUserId={product.ownerUserId} onImage/></div><div><span className="card-kicker">{product.category}</span><h3>{product.title}</h3><small>By {product.ownerName}{product.ownerUserId === user?.id && <> · Your product; other accounts can make bids</>}</small><div className="bid-product-facts"><PriceDisplay price={product.price} originalPrice={product.originalPrice}/><span>{product.bidCount} {product.bidCount === 1 ? 'bid' : 'bids'}</span></div><p className="bid-deadline">Bidding ends {new Date(product.biddingEndsAt).toLocaleString()}</p><button className="bid-place-button" type="button" onClick={() => product.ownerUserId === user?.id ? onNavigate('listings', 'products-bidding') : setSelected(product)}><span>{product.ownerUserId === user?.id ? 'Manage offers' : 'Place your bid'}</span><Icon name="arrow" size={17}/></button></div></article>)}</div> : <EmptyState label="No live deals right now" detail="New products open for bidding will appear here."/>}
    </>}
    {selected && <BidDetail product={selected} onClose={() => setSelected(null)}/>}
  </>
}
