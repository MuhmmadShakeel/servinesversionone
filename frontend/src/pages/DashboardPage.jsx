import { useState } from 'react'
import { Icon } from '../components/common/Icon.jsx'
import { PriceDisplay } from '../components/common/PriceDisplay.jsx'
import { SectionTitle } from '../components/common/UiParts.jsx'
import { useAuthToken } from '../redux/Api/auth/AuthApi.js'
import { useGetActiveServicesQuery, useGetMyServicesQuery, useGetReceivedBookingsQuery } from '../redux/Api/service/ServiceApi.js'
import { useGetMyRequirementsQuery, useGetOpenRequirementsQuery } from '../redux/Api/hiring/HiringApi.js'
import { useBrowseProductsQuery, useGetMyProductsQuery, useGetSalesOrdersQuery } from '../redux/Api/product/ProductApi.js'
import { useBoostExpiryRefresh } from '../components/common/useBoostExpiryRefresh.js'

const monthName = new Intl.DateTimeFormat('en-PK', { month: 'short', timeZone: 'UTC' })

const chartStyles = `
.overview-heading { display:flex; align-items:end; justify-content:space-between; gap:20px; margin:0 0 20px; }
.overview-heading small { color:var(--brand); font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; }
.overview-heading h1 { margin:6px 0 5px; color:var(--text-1); font:800 clamp(30px,3vw,42px)/1.1 Manrope,sans-serif; letter-spacing:-1.6px; }
.overview-heading p { margin:0; color:var(--text-2); font-size:14px; font-weight:500; line-height:1.65; }
.overview-charts { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(300px,1fr); gap:16px; margin:0 0 30px; }
.overview-chart-panel { min-width:0; padding:24px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); box-shadow:var(--s-sm); }
.overview-chart-title { display:flex; justify-content:space-between; gap:12px; align-items:start; margin-bottom:18px; }
.overview-chart-title h2 { margin:0 0 5px; color:var(--text-1); font:800 20px Manrope,sans-serif; letter-spacing:-.4px; }
.overview-chart-title p { margin:0; color:var(--text-2); font-size:13px; font-weight:500; line-height:1.6; }
.overview-chart-title span { flex:none; padding:6px 10px; border-radius:20px; background:var(--brand-pale); color:var(--brand); font-size:10px; font-weight:800; }
.overview-chart-svg { width:100%; height:auto; overflow:visible; }
.overview-chart-svg text { fill:var(--text-4); font:11px var(--font-sans),sans-serif; }
.overview-chart-legend { display:flex; justify-content:center; flex-wrap:wrap; gap:16px; margin-top:10px; color:var(--text-3); font-size:11px; font-weight:700; }
.overview-chart-legend span { display:inline-flex; align-items:center; gap:7px; }
.overview-chart-dot { display:inline-block; width:9px; height:9px; border-radius:50%; }
.overview-pie-content { display:flex; align-items:center; justify-content:center; gap:clamp(18px,3vw,32px); min-height:225px; }
.overview-pie { display:grid; place-items:center; width:clamp(150px,15vw,190px); aspect-ratio:1; flex:none; border-radius:50%; }
.overview-pie-inner { display:grid; place-content:center; width:65%; aspect-ratio:1; border-radius:50%; background:var(--surface); text-align:center; box-shadow:0 0 0 3px var(--border); }
.overview-pie-inner strong { color:var(--text-1); font:800 28px Manrope,sans-serif; }
.overview-pie-inner small { color:var(--text-3); font-size:11px; }
.overview-pie-legend { display:grid; gap:14px; min-width:120px; }
.overview-pie-legend span { display:grid; grid-template-columns:10px 1fr auto; align-items:center; gap:8px; color:var(--text-3); font-size:12px; }
.overview-pie-legend b { color:var(--text-1); font-weight:700; }
.overview-chart-empty { display:grid; place-items:center; min-height:225px; color:var(--text-3); font-size:13px; text-align:center; }
@media (max-width:1050px) { .overview-charts { grid-template-columns:1fr; } }
@media (max-width:620px) { .overview-heading { align-items:start; flex-direction:column; } .overview-chart-panel { padding:17px; } .overview-pie-content { flex-direction:column; } .overview-pie-legend { width:100%; max-width:225px; } }
`

function ActivityChart({ bookings, orders }) {
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1))
    return { key: `${date.getUTCFullYear()}-${date.getUTCMonth()}`, label: monthName.format(date), bookings: 0, orders: 0 }
  })
  const lookup = new Map(months.map((month) => [month.key, month]))
  for (const [items, field] of [[bookings, 'bookings'], [orders, 'orders']]) {
    for (const item of items) {
      const date = new Date(item.createdAt)
      if (Number.isNaN(date.getTime())) continue
      const month = lookup.get(`${date.getUTCFullYear()}-${date.getUTCMonth()}`)
      if (month) month[field] += 1
    }
  }
  const peak = Math.max(1, ...months.flatMap((month) => [month.bookings, month.orders]))
  const tick = Math.max(1, Math.ceil(peak / 3))
  const scale = tick * 3
  const y = (value) => 188 - value / scale * 138
  const points = (field) => months.map((month, index) => `${51 + index * 105},${y(month[field])}`).join(' ')
  return <><svg className="overview-chart-svg" viewBox="0 0 630 230" role="img" aria-label={months.map((month) => `${month.label}: ${month.bookings} booking requests and ${month.orders} sales orders`).join('; ')}>
    {[0, 1, 2, 3].map((step) => <g key={step}><line x1="51" x2="576" y1={50 + step * 46} y2={50 + step * 46} stroke="#eeeaf5" strokeDasharray="4 5"/><text x="41" y={54 + step * 46} textAnchor="end">{scale - step * tick}</text></g>)}
    <polyline points={points('bookings')} fill="none" stroke="#7053e8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points={points('orders')} fill="none" stroke="#25a579" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    {months.map((month, index) => <g key={month.key}><circle cx={51 + index * 105} cy={y(month.bookings)} r="5" fill="#7053e8" stroke="white" strokeWidth="2"><title>{`${month.label}: ${month.bookings} booking requests`}</title></circle><circle cx={51 + index * 105} cy={y(month.orders)} r="5" fill="#25a579" stroke="white" strokeWidth="2"><title>{`${month.label}: ${month.orders} sales orders`}</title></circle><text x={51 + index * 105} y="216" textAnchor="middle">{month.label}</text></g>)}
  </svg><div className="overview-chart-legend"><span><i className="overview-chart-dot" style={{ background: '#7053e8' }}/>Booking requests</span><span><i className="overview-chart-dot" style={{ background: '#25a579' }}/>Sales orders</span></div></>
}

function ListingsChart({ counts }) {
  const total = counts.reduce((sum, item) => sum + item.value, 0)
  let edge = 0
  const slices = counts.filter((item) => item.value).map((item) => {
    const start = edge
    edge += item.value / total * 100
    return `${item.color} ${start}% ${edge}%`
  })
  return <div className="overview-pie-content"><div className="overview-pie" role="img" aria-label={counts.map((item) => `${item.value} ${item.label.toLowerCase()}`).join(', ')} style={{ background: total ? `conic-gradient(${slices.join(', ')})` : '#eeeaf5' }}><div className="overview-pie-inner"><strong>{total}</strong><small>Total listings</small></div></div><div className="overview-pie-legend">{counts.map((item) => <span key={item.label}><i className="overview-chart-dot" style={{ background: item.color }}/>{item.label}<b>{item.value}</b></span>)}</div></div>
}

export function DashboardPage({ onNavigate }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const token = useAuthToken()
  const options = { skip: !token }
  const myServices = useGetMyServicesQuery(undefined, options)
  const receivedBookings = useGetReceivedBookingsQuery(undefined, options)
  const myRequirements = useGetMyRequirementsQuery(undefined, options)
  const myProducts = useGetMyProductsQuery(undefined, options)
  const salesOrders = useGetSalesOrdersQuery(undefined, options)
  const services = useGetActiveServicesQuery(undefined, options)
  const requirements = useGetOpenRequirementsQuery(undefined, options)
  const products = useBrowseProductsQuery(undefined, options)
  useBoostExpiryRefresh(services.data?.services, services.refetch, Boolean(token))
  useBoostExpiryRefresh(requirements.data?.requirements, requirements.refetch, Boolean(token))
  useBoostExpiryRefresh(products.data?.products, products.refetch, Boolean(token))
  const opportunities = [
    ...(services.data?.services || []).map((item) => ({ id: `service-${item.id}`, listingId: item.id, type: 'service', title: item.title, category: item.category, price: item.price, originalPrice: item.originalPrice })),
    ...(requirements.data?.requirements || []).map((item) => ({ id: `hiring-${item.id}`, listingId: item.id, type: 'hiring', title: item.title, category: item.category })),
    ...(products.data?.products || []).map((item) => ({ id: `product-${item.id}`, listingId: item.id, type: 'product', title: item.title, category: item.category, price: item.price, originalPrice: item.originalPrice })),
  ]
  const openOpportunity = (item) => onNavigate('explore', { listing: item.type, id: item.listingId })
  const visibleOpportunities = opportunities.filter((item) => (typeFilter === 'all' || item.type === typeFilter) && `${item.title} ${item.category || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const discoveryLoading = services.isLoading || requirements.isLoading || products.isLoading
  const discoveryError = services.isError || requirements.isError || products.isError
  const listingQueries = [myServices, myRequirements, myProducts]
  const activityQueries = [receivedBookings, salesOrders]
  const listingCounts = [
    { label: 'Services', value: myServices.data?.services?.length || 0, color: '#7053e8' },
    { label: 'Jobs', value: myRequirements.data?.requirements?.length || 0, color: '#25a579' },
    { label: 'Products', value: myProducts.data?.products?.length || 0, color: '#ffb765' },
  ]
  return <><style>{chartStyles}</style><div className="overview-heading"><div><small>Your workspace</small><h1>Overview</h1><p>Your listings, requests, and sales activity in one place.</p></div><button type="button" className="primary-button" onClick={() => onNavigate('listings')}><Icon name="plus" size={16}/> Make a listing</button></div>
    {token && <div className="overview-charts"><section className="overview-chart-panel" aria-labelledby="activity-chart-title"><div className="overview-chart-title"><div><h2 id="activity-chart-title">Incoming activity</h2><p>Booking requests and sales orders created in the last six calendar months.</p></div><span>6 months</span></div>{activityQueries.some((query) => query.isLoading) ? <div className="overview-chart-empty">Loading activity…</div> : activityQueries.some((query) => query.isError) ? <div className="overview-chart-empty">Activity is unavailable right now.</div> : <ActivityChart bookings={receivedBookings.data?.bookings || []} orders={salesOrders.data?.orders || []}/>}</section><section className="overview-chart-panel" aria-labelledby="listings-chart-title"><div className="overview-chart-title"><div><h2 id="listings-chart-title">Your listing mix</h2><p>All your service, hiring, and product listings.</p></div><span>Live totals</span></div>{listingQueries.some((query) => query.isLoading) ? <div className="overview-chart-empty">Loading listings…</div> : listingQueries.some((query) => query.isError) ? <div className="overview-chart-empty">Listing mix is unavailable right now.</div> : <ListingsChart counts={listingCounts}/>}</section></div>}
    <section className="content-section" data-aos="fade-up">
      <SectionTitle title="Explore the marketplace" description="Services, products, and open work from the community." action="View all listings" onAction={() => onNavigate('explore')}/>
      {token && <div className="dashboard-market-controls">
        <label className="dashboard-market-search"><Icon name="search" size={18}/><input type="search" aria-label="Search marketplace listings" placeholder="Search listings or categories" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
        <label className="dashboard-market-filter"><Icon name="filter" size={18}/><span>Filter</span><select aria-label="Filter marketplace listings" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All listings</option><option value="service">Services</option><option value="hiring">Hiring</option><option value="product">Products</option></select></label>
      </div>}
      {!token ? <div className="dashboard-discover-empty">Log in to see live listings and opportunities.</div> : discoveryLoading ? <div className="service-loading" role="status">Loading the marketplace...</div> : discoveryError ? <div className="service-loading" role="alert">Some marketplace listings could not load. <button type="button" onClick={() => { services.refetch(); requirements.refetch(); products.refetch() }}>Try again</button></div> : opportunities.length ? <div className="dashboard-market-table-wrap"><table className="dashboard-market-table"><thead><tr><th scope="col">Listing</th><th scope="col">Type</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead><tbody>{visibleOpportunities.length ? visibleOpportunities.map((item) => <tr key={item.id}><td><button type="button" className="dashboard-market-title" onClick={() => openOpportunity(item)}>{item.title}</button></td><td><span className={`dashboard-market-type ${item.type}`}>{item.type === 'hiring' ? 'Hiring' : item.type === 'product' ? 'Product' : 'Service'}</span></td><td>{item.category || 'Uncategorized'}</td><td>{item.type === 'hiring' ? 'Project' : <PriceDisplay price={item.price} originalPrice={item.originalPrice}/>}</td><td><button type="button" className="dashboard-market-open" aria-label={`Open ${item.title}`} onClick={() => openOpportunity(item)}><Icon name="arrow" size={17}/></button></td></tr>) : <tr><td colSpan="5" className="dashboard-market-no-results">No listings match your search or filter.</td></tr>}</tbody></table></div> : <div className="dashboard-discover-empty">No active listings yet. You can be the first to create one.</div>}
    </section></>
}
