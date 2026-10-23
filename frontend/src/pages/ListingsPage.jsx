import { useEffect, useState } from 'react'
import { ServicesPage } from './ServicesPage.jsx'
import { HiringPage } from './HiringPage.jsx'
import { MartPage } from './MartPage.jsx'
import { toast } from 'react-toastify'
import { PageHeader } from '../components/common/PageHeader.jsx'
import { EmptyState, SearchBox } from '../components/common/UiParts.jsx'
import { Icon } from '../components/common/Icon.jsx'
import { ListingFilters } from '../components/common/ListingFilters.jsx'
import { emptyListingFilters, matchesListingFilters } from '../components/common/listingFilterUtils.js'
import { useBoostExpiryRefresh } from '../components/common/useBoostExpiryRefresh.js'
import { RequirementCard } from '../components/hiring/RequirementCard.jsx'
import { RequirementDetail } from '../components/hiring/RequirementDetail.jsx'
import { ProposalForm } from '../components/hiring/ProposalForm.jsx'
import { BookingForm } from '../components/services/BookingForm.jsx'
import { BrowseServiceCard } from '../components/services/BrowseServiceCard.jsx'
import { ProductShop } from '../components/products/ProductShop.jsx'
import { getStoredUser, useAuthToken } from '../redux/Api/auth/AuthApi.js'
import { useCreateBookingMutation, useGetActiveServicesQuery } from '../redux/Api/service/ServiceApi.js'
import { useGetMyProposalsQuery, useGetOpenRequirementsQuery, useSubmitProposalMutation } from '../redux/Api/hiring/HiringApi.js'
import { useBrowseProductsQuery, useGetMyProductsQuery, useGetSalesOrdersQuery } from '../redux/Api/product/ProductApi.js'
import { useGetMyServicesQuery, useGetReceivedBookingsQuery } from '../redux/Api/service/ServiceApi.js'
import { useGetMyRequirementsQuery } from '../redux/Api/hiring/HiringApi.js'

const matches = (item, search) => `${item.title} ${item.category} ${item.city || ''} ${item.description || ''}`.toLowerCase().includes(search.trim().toLowerCase())

const listingSlides = [
  { title: 'Services that speak for your work.', eyebrow: '01 / SERVICES', description: 'Present your skills with clarity and make every booking feel effortless.', image: '/listing-carousel/services.png' },
  { title: 'Give every product its moment.', eyebrow: '02 / PRODUCTS', description: 'Showcase what makes your products special and keep your shop moving.', image: '/listing-carousel/products.png' },
  { title: 'See what your market values.', eyebrow: '03 / LIVE DEALS', description: 'Put your products in front of interested buyers and follow every offer.', image: '/listing-carousel/bidding.png' },
]


export function ExploreListings({ category = 'All', onNavigate = () => {} }) {
  const shared = new URLSearchParams(window.location.search)
  const sharedType = ['service', 'hiring', 'product'].includes(shared.get('listing')) ? shared.get('listing') : null
  const sharedId = sharedType ? shared.get('id') : null
  const focusedType = sharedType === 'service' ? 'Services' : sharedType === 'hiring' ? 'Jobs' : sharedType === 'product' ? 'Products' : null
  const token = useAuthToken()
  const currentUser = getStoredUser()
  const [type, setType] = useState(focusedType || category)
  const [search, setSearch] = useState('')
  const [listingFilters, setListingFilters] = useState(emptyListingFilters)
  const [detailId, setDetailId] = useState(sharedType === 'hiring' && token ? sharedId : null)
  const [proposalRequirement, setProposalRequirement] = useState(null)
  const [bookingService, setBookingService] = useState(null)
  const showServices = type === 'All' || type === 'Services'
  const showJobs = type === 'All' || type === 'Jobs'
  const servicesQuery = useGetActiveServicesQuery(undefined, { skip: !token || !showServices, pollingInterval: 30000, skipPollingIfUnfocused: true })
  const jobsQuery = useGetOpenRequirementsQuery(undefined, { skip: !token || !showJobs, pollingInterval: 30000, skipPollingIfUnfocused: true })
  const proposalsQuery = useGetMyProposalsQuery(undefined, { skip: !token || !showJobs })
  const productsQuery = useBrowseProductsQuery(undefined, { skip: !token || type !== 'All', pollingInterval: 30000, skipPollingIfUnfocused: true })
  useBoostExpiryRefresh(servicesQuery.data?.services, servicesQuery.refetch, Boolean(token && showServices))
  useBoostExpiryRefresh(jobsQuery.data?.requirements, jobsQuery.refetch, Boolean(token && showJobs))
  useBoostExpiryRefresh(productsQuery.data?.products, productsQuery.refetch, Boolean(token && type === 'All'))
  const [submitProposal, { isLoading: submitting }] = useSubmitProposalMutation()
  const [createBooking, { isLoading: booking }] = useCreateBookingMutation()

  const services = (servicesQuery.data?.services || []).filter((item) => matches(item, search) && matchesListingFilters(item, listingFilters) && (!sharedId || type !== focusedType || item.id === sharedId))
  const jobs = (jobsQuery.data?.requirements || []).filter((item) => matches(item, search) && matchesListingFilters(item, listingFilters, ['budgetMin', 'budgetMax', 'budget']) && (!sharedId || type !== focusedType || item.id === sharedId))
  useEffect(() => {
    if (sharedType !== 'service' || !sharedId || !servicesQuery.isSuccess) return undefined
    const frame = requestAnimationFrame(() => document.getElementById('focused-listing')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }))
    return () => cancelAnimationFrame(frame)
  }, [sharedType, sharedId, servicesQuery.isSuccess])
  const loading = (showServices && servicesQuery.isLoading) || (showJobs && jobsQuery.isLoading) || (type === 'All' && productsQuery.isLoading)
  const failed = (showServices && servicesQuery.isError) || (showJobs && jobsQuery.isError)
  const hasResults = (showServices && services.length > 0) || (showJobs && jobs.length > 0) || (type === 'All' && (productsQuery.data?.products || []).some((item) => matches(item, search) && matchesListingFilters(item, listingFilters)))

  async function saveProposal(details) {
    await submitProposal({ requirementId: proposalRequirement.id, ...details }).unwrap()
    toast.success('Proposal sent to the client.')
    setProposalRequirement(null)
  }

  async function saveBooking(details) {
    await createBooking({ serviceId: bookingService.id, ...details }).unwrap()
    toast.success('Booking request sent. Track it under Services > My bookings.')
    setBookingService(null)
  }

  return <>
    {category === 'All' && <PageHeader stats="explore" eyebrow="DISCOVER MORE" title="Explore listings" description="Find services, open jobs, and products from the marketplace."/>}
    {!token ? <EmptyState label="Log in to explore listings" detail="Use Log in in the top bar to browse and shop."/> : <>
      <div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search services, jobs and products..."/>{category === 'All' && <div className="segmented-control">{['All', 'Services', 'Jobs', 'Products'].map((item) => <button key={item} type="button" className={type === item ? 'selected' : ''} onClick={() => { setType(item); if (item !== 'Services') setListingFilters((current) => ({ ...current, city: '' })) }}>{item}</button>)}</div>}</div>
      <ListingFilters items={type === 'Services' ? (servicesQuery.data?.services || []) : [...(servicesQuery.data?.services || []), ...(jobsQuery.data?.requirements || []), ...(productsQuery.data?.products || [])]} value={listingFilters} onChange={setListingFilters} priceLabel="Price / budget" showCity={type === 'Services'}/>
      {sharedId && type === focusedType && <div className="shared-listing-banner"><Icon name="search" size={19}/><span>Selected listing</span><button type="button" onClick={() => { window.history.replaceState({}, '', '/explore'); setType('All') }}>Explore all listings <Icon name="arrow" size={15}/></button></div>}
      {type === 'Products' ? <ProductShop search={search} filters={listingFilters} full focusId={sharedId && type === focusedType ? sharedId : null} onChat={(context, id) => onNavigate('chat', { context, id })}/> : loading ? <div className="service-loading" role="status">Loading listings...</div> : failed ? <div className="service-loading" role="alert">Could not load listings. <button type="button" onClick={() => { if (showServices && servicesQuery.isError) servicesQuery.refetch(); if (showJobs && jobsQuery.isError) jobsQuery.refetch() }}>Try again</button></div> : <>
        {!hasResults && type !== 'All' && <EmptyState label="No matching listings" detail="Try another search or check back later."/>}
        {showServices && services.length > 0 && <section className="content-section listing-section"><h2>Services <span>{services.length}</span></h2><div className="service-grid">{services.map((service) => <BrowseServiceCard key={service.id} service={service} focused={sharedType === 'service' && service.id === sharedId} isOwner={service.ownerUserId === currentUser?.id} onBook={setBookingService} onChat={(item) => onNavigate('chat', { context: 'service', id: item.id })}/>)}</div></section>}
        {showJobs && jobs.length > 0 && <section className="content-section listing-section"><h2>Jobs & requirements <span>{jobs.length}</span></h2><div className="job-grid">{jobs.map((job) => <RequirementCard key={job.id} item={job} mode="discover" onView={() => setDetailId(job.id)} onChat={job.ownerUserId === currentUser?.id ? undefined : (item) => onNavigate('chat', { context: 'hiring', id: item.id })}/>)}</div></section>}
        {type === 'All' && <ProductShop search={search} filters={listingFilters} onChat={(context, id) => onNavigate('chat', { context, id })}/>}
      </>}
    </>}
    {detailId && <RequirementDetail id={detailId} currentUserId={currentUser?.id} myProposal={proposalsQuery.data?.proposals?.find((proposal) => proposal.requirementId === detailId)} onClose={() => setDetailId(null)} onPropose={(requirement) => { setDetailId(null); setProposalRequirement(requirement) }} onEdit={() => { setDetailId(null); onNavigate('listings', 'hiring') }} onChat={(context, id) => onNavigate('chat', { context, id })}/>}
    {proposalRequirement && <ProposalForm requirement={proposalRequirement} onClose={() => setProposalRequirement(null)} onSave={saveProposal} isSaving={submitting}/>}
    {bookingService && <BookingForm service={bookingService} onClose={() => setBookingService(null)} onSave={saveBooking} isSaving={booking}/>}
  </>
}

export function ListingsPage({ initialSection = 'services', onNavigate }) {
  const [section, setSection] = useState(initialSection === 'products-bidding' ? 'products' : initialSection)
  const [slideIndex, setSlideIndex] = useState(0)
  const [carouselPaused, setCarouselPaused] = useState(false)
  useEffect(() => {
    if (carouselPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => setSlideIndex((current) => (current + 1) % listingSlides.length), 5500)
    return () => window.clearInterval(timer)
  }, [carouselPaused])
  const token = useAuthToken()
  const ownServices = useGetMyServicesQuery(token, { skip: !token })
  const ownProducts = useGetMyProductsQuery(undefined, { skip: !token })
  const ownHiring = useGetMyRequirementsQuery(token, { skip: !token })
  const bookings = useGetReceivedBookingsQuery(undefined, { skip: !token })
  const sales = useGetSalesOrdersQuery(undefined, { skip: !token })
  const stats = [
    { label: 'Services listed', value: ownServices.data?.services?.length ?? '—' },
    { label: 'Booking requests', value: bookings.data?.bookings?.length ?? '—' },
    { label: 'Products listed', value: ownProducts.data?.products?.length ?? '—' },
    { label: 'Fulfilled orders', value: (sales.data?.orders || []).filter((order) => order.status === 'fulfilled').length },
    { label: 'Job posts', value: ownHiring.data?.requirements?.length ?? '—' },
  ]
  const sections = [
    { id: 'services', label: 'Services', icon: 'briefcase', description: 'Publish services and manage booking requests.' },
    { id: 'products', label: 'Products', icon: 'bag', description: 'Manage products, stock and sales orders.' },
    { id: 'hiring', label: 'Jobs', icon: 'users', description: 'Post jobs and review proposals.' },
  ]
  return <>
    <section className="listing-carousel" aria-label="Services, products and live deals carousel" aria-roledescription="carousel"
      onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={() => setCarouselPaused(false)}
      onFocus={() => setCarouselPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setCarouselPaused(false) }}>
      <div className="listing-carousel-track" style={{ transform: `translateX(-${slideIndex * 100}%)` }}>
        {listingSlides.map((slide, index) => <div className="listing-carousel-slide" key={slide.eyebrow} aria-hidden={slideIndex !== index}>
          <img src={slide.image} alt="" loading={index === 0 ? 'eager' : 'lazy'} />
          <div className="listing-carousel-shade"/>
          <div className="listing-carousel-copy"><span>{slide.eyebrow}</span><h1>{slide.title}</h1><p>{slide.description}</p></div>
        </div>)}
      </div>
      <div className="listing-carousel-controls">
        <div className="listing-carousel-dots" aria-label="Choose slide">{listingSlides.map((slide, index) => <button key={slide.eyebrow} type="button" className={slideIndex === index ? 'active' : ''} aria-label={`Show ${slide.eyebrow.split(' / ')[1].toLowerCase()} slide`} aria-current={slideIndex === index ? 'true' : undefined} onClick={() => setSlideIndex(index)}/>)}</div>
        <div className="listing-carousel-arrows"><button type="button" aria-label="Previous slide" onClick={() => setSlideIndex((current) => (current + listingSlides.length - 1) % listingSlides.length)}>‹</button><span>{String(slideIndex + 1).padStart(2, '0')} / 03</span><button type="button" aria-label="Next slide" onClick={() => setSlideIndex((current) => (current + 1) % listingSlides.length)}>›</button></div>
      </div>
    </section>
    {token && <div className="listing-hub-stats" aria-label="Listing activity">{stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>}
    <div className="listing-hub-nav" role="tablist" aria-label="Listing types">{sections.map((item) => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}><span className="listing-hub-icon"><Icon name={item.icon} size={22}/></span><span><strong>{item.label}</strong><small>{item.description}</small></span><Icon name="arrow" size={18}/></button>)}</div>
    {section === 'services' && <ServicesPage key="manage-services" mode="manage" onNavigate={onNavigate}/>}
    {section === 'products' && <MartPage key="manage-products" mode="manage" initialTab={initialSection === 'products-bidding' ? 'bidding' : 'products'} onNavigate={onNavigate}/>}
    {section === 'hiring' && <HiringPage key="manage-hiring" mode="manage" onNavigate={onNavigate}/>}
  </>
}
