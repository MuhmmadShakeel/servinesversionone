import { useState } from 'react'
import { Icon } from '../components/common/Icon.jsx'
import './help.css'

const guides = [
  {
    id: 'start', number: '01', icon: 'user', title: 'Get started', summary: 'One account lets you buy, sell, offer services, and hire.',
    steps: [
      'Select Sign up in the top bar and enter your name, email, and password.',
      'Log in with your new account. You can add services and products later; an empty workspace is normal.',
      'Use Overview to see your listings, activity, and marketplace opportunities.',
    ],
    action: { label: 'Open overview', page: 'overview' },
  },
  {
    id: 'services', number: '02', icon: 'briefcase', title: 'Create and offer a service', summary: 'Show what you do and manage booking requests.',
    steps: [
      'Open Make Listing, choose Services, and select Add a service.',
      'Enter the service details, price, and image. Save as Draft while you prepare it; publish it as Active when ready.',
      'Find incoming requests under Make Listing → Services → Booking requests. Approve or reject each request there.',
    ],
    action: { label: 'Create a service', page: 'listings', detail: 'services' },
  },
  {
    id: 'book', number: '03', icon: 'search', title: 'Book a service', summary: 'Find a provider and send a booking request.',
    steps: [
      'Open Marketplace or Services and browse active services.',
      'Choose a service, select the booking action, and enter your contact number, address, and request details.',
      'Track the request under Services → My bookings. You can cancel a pending request; the provider can approve or reject it.',
    ],
    action: { label: 'Explore services', page: 'services' },
  },
  {
    id: 'products', number: '04', icon: 'bag', title: 'List and sell a product', summary: 'Set up a product and follow its orders.',
    steps: [
      'Open Make Listing, choose Products, and select Add product.',
      'Add a clear title, category, description, price, stock, and image. Keep it as Draft until it is ready to publish.',
      'Make it Active to show it to buyers. Review purchases under Make Listing → Products → Sales orders, then confirm, decline, or mark them fulfilled.',
    ],
    action: { label: 'Create a product', page: 'listings', detail: 'products' },
  },
  {
    id: 'buy', number: '05', icon: 'heart', title: 'Buy a product', summary: 'From browsing to checkout and order tracking.',
    steps: [
      'Open Mart or Marketplace → Products. Browse listings and use the heart to save an item to your Wishlist.',
      'Add an available product to your Cart, review its quantity, and select Checkout.',
      'Enter your contact number and delivery address, then place the order. Track it under Mart → My orders. Payment is arranged with the seller; there is no online payment at checkout.',
    ],
    action: { label: 'Shop the Mart', page: 'mart' },
  },
  {
    id: 'jobs', number: '06', icon: 'users', title: 'Post a job or send a proposal', summary: 'Hire someone or respond to open work.',
    steps: [
      'To hire, open Make Listing → Jobs and select Post a job. Add the brief and budget, then publish it.',
      'Review proposals on your job post and accept the offer that fits.',
      'To find work, open Jobs or Marketplace → Jobs, inspect an open requirement, and send a proposal. Track it under Jobs → My proposals.',
    ],
    action: { label: 'Explore jobs', page: 'hiring' },
  },
  {
    id: 'messages', number: '07', icon: 'chat', title: 'Stay in touch', summary: 'Discuss a listing, request, or order with the other person.',
    steps: [
      'Use the Chat action on an eligible listing, booking, proposal, cart item, or order.',
      'Open Messages in the sidebar to read and reply to conversations.',
      'Keep order and booking status up to date in their respective pages so both sides can follow progress.',
    ],
    action: { label: 'Open messages', page: 'chat' },
  },
]

export function HelpPage({ onNavigate }) {
  const [search, setSearch] = useState('')
  const visibleGuides = guides.filter((guide) => `${guide.title} ${guide.summary} ${guide.steps.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()))

  return <div className="help-page">
    <header className="help-hero">
      <div className="help-hero-copy"><span className="help-eyebrow">HELP CENTER <span aria-hidden="true"/> USER GUIDE</span><h1>How can we help?</h1><p>Clear steps for setting up your workspace, creating listings, finding work, and shopping on jobNshop.</p>
        <label className="help-search"><Icon name="search" size={20}/><span className="sr-only">Search help topics</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guides, topics, or actions"/><span className="help-search-hint">{visibleGuides.length} guides</span></label>
      </div>
      <div className="help-hero-art" aria-hidden="true"><div className="help-art-card help-art-card-back"><Icon name="briefcase" size={22}/><span/></div><div className="help-art-card help-art-card-front"><span className="help-art-check"><Icon name="check" size={22}/></span><span><i/><i/><i/></span></div><div className="help-art-orb"/></div>
    </header>

    <div className="help-layout">
      <aside className="help-rail"><div className="help-rail-inner"><span className="help-rail-label">ON THIS PAGE</span><nav aria-label="Help topics">{visibleGuides.map((guide) => <a href={`#${guide.id}`} key={guide.id}><span>{guide.number}</span>{guide.title}</a>)}</nav><div className="help-rail-note"><Icon name="spark" size={18}/><p>You can create an account first and add listings whenever you are ready.</p></div></div></aside>
      <div className="help-content">
        <div className="help-section-heading"><div><span>THE ESSENTIALS</span><h2>Explore the guides</h2><p>Follow a guide, then jump straight to the relevant page.</p></div><span className="help-result-count">{visibleGuides.length} {visibleGuides.length === 1 ? 'topic' : 'topics'}</span></div>
        {visibleGuides.length ? <div className="help-guides">{visibleGuides.map((guide) => <section id={guide.id} className="help-guide" key={guide.id} aria-labelledby={`help-${guide.id}`}>
          <div className="help-guide-image"><img src={`/images/help/${guide.id}.webp`} alt={`${guide.title} illustration`} loading="lazy" decoding="async"/><span>GUIDE {guide.number}</span></div>
          <div className="help-guide-body"><div className="help-guide-heading"><span className="help-guide-icon"><Icon name={guide.icon} size={21}/></span><div><h3 id={`help-${guide.id}`}>{guide.title}</h3><p>{guide.summary}</p></div></div>
            <ol>{guide.steps.map((step) => <li key={step}><span>{step}</span></li>)}</ol>
            <button type="button" onClick={() => onNavigate(guide.action.page, guide.action.detail)}>{guide.action.label}<Icon name="arrow" size={17}/></button>
          </div>
        </section>)}</div> : <div className="help-no-results"><Icon name="search" size={24}/><h3>No matching guide</h3><p>Try a different word, such as product, booking, or job.</p><button type="button" onClick={() => setSearch('')}>Show all guides</button></div>}
      </div>
    </div>
  </div>
}
