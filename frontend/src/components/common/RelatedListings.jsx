import { Icon } from './Icon.jsx'

export function RelatedListings({ source, count, children }) {
  if (!count) return null
  return <section className="related-listings" aria-label="Recommended listings">
    <div className="related-listings-heading"><div><span><Icon name="spark" size={15}/> RECOMMENDED FOR YOU</span><h2>More in the categories you like</h2><p>Based on {source}. Explore similar listings below.</p></div><strong>{count} {count === 1 ? 'match' : 'matches'}</strong></div>
    {children}
  </section>
}
