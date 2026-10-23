import { Icon } from './Icon.jsx'

// Presentational highlight cards shown at the top of every page. They describe
// what the page offers and never read or change any data.
const highlights = {
  overview: [
    { icon: 'briefcase', title: 'Services', text: 'Offer skills and take booking requests.' },
    { icon: 'users', title: 'Jobs', text: 'Post jobs and compare proposals.' },
    { icon: 'bag', title: 'Mart', text: 'Buy and sell products with independent sellers.' },
    { icon: 'chat', title: 'Messages', text: 'Talk privately with the people you work with.' },
  ],
  services: [
    { icon: 'briefcase', title: 'Skilled providers', text: 'Browse services across every category.' },
    { icon: 'clock', title: 'Quick booking', text: 'Pick your needs and send a request in minutes.' },
    { icon: 'chat', title: 'Direct chat', text: 'Ask questions before you commit.' },
    { icon: 'check', title: 'Clear tracking', text: 'Follow each request from pending to approved.' },
  ],
  hiring: [
    { icon: 'layers', title: 'Open requirements', text: 'Find work that matches your skills.' },
    { icon: 'mic', title: 'Rich briefs', text: 'Photos, video and voice notes explain the job.' },
    { icon: 'users', title: 'Compare proposals', text: 'Review offers side by side and choose.' },
    { icon: 'check', title: 'Award with ease', text: 'Accept the best proposal in one step.' },
  ],
  explore: [
    { icon: 'briefcase', title: 'Services', text: 'Hire trusted providers for your next task.' },
    { icon: 'users', title: 'Jobs', text: 'Open requirements waiting for proposals.' },
    { icon: 'bag', title: 'Products', text: 'Shop from independent sellers.' },
    { icon: 'share', title: 'Shareable', text: 'Send any listing to a friend with a link.' },
  ],
  listings: [
    { icon: 'briefcase', title: 'Publish services', text: 'Set a price and start receiving bookings.' },
    { icon: 'users', title: 'Post requirements', text: 'Describe the job and gather proposals.' },
    { icon: 'bag', title: 'List products', text: 'Manage stock, images and sales orders.' },
    { icon: 'chat', title: 'Stay in touch', text: 'Reply to customers without leaving the app.' },
  ],
  mart: [
    { icon: 'bag', title: 'Independent sellers', text: 'Discover products made by real people.' },
    { icon: 'heart', title: 'Save favorites', text: 'Keep the items you love one tap away.' },
    { icon: 'layers', title: 'Simple cart', text: 'Review quantities and totals before checkout.' },
    { icon: 'check', title: 'Order tracking', text: 'Follow every order from request to delivery.' },
  ],
  chat: [
    { icon: 'chat', title: 'Private by design', text: 'Only the two people involved can read a chat.' },
    { icon: 'check', title: 'Read receipts', text: 'Know when your message has been seen.' },
    { icon: 'edit', title: 'Edit and delete', text: 'Fix a message or remove it for both sides.' },
    { icon: 'spark', title: 'In context', text: 'Chats start from the listing you are viewing.' },
  ],
  trade: [
    { icon: 'arrows', title: 'Live Deals', text: 'Make an offer on any active product.' },
    { icon: 'eye', title: 'Visible bids', text: 'Review the existing bids before you decide.' },
    { icon: 'clock', title: 'Live activity', text: 'Fresh offers appear as buyers place them.' },
    { icon: 'check', title: 'Fair outcomes', text: 'Sellers compare offers and pick the best.' },
  ],
}

export function PageHighlights({ page = 'overview' }) {
  const items = highlights[page] || highlights.overview
  return <section className="page-stats" aria-label="Highlights">{items.map((item, index) => <article className={`page-stat tone-${index + 1}`} key={item.title} data-aos="fade-up" data-aos-delay={index * 60}>
    <span className="page-stat-icon"><Icon name={item.icon} size={22} /></span>
    <div><strong>{item.title}</strong><p>{item.text}</p></div>
  </article>)}</section>
}
