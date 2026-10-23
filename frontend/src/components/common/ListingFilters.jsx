import { useState } from 'react'
import { Icon } from './Icon.jsx'
import { emptyListingFilters } from './listingFilterUtils.js'

export function ListingFilters({ items = [], value, onChange, priceLabel = 'Price', showCity = false }) {
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort()
  const cities = [...new Map(items.map((item) => item.city?.trim()).filter(Boolean).map((city) => [city.toLocaleLowerCase(), city])).values()].sort((a, b) => a.localeCompare(b))
  const [expanded, setExpanded] = useState(true)
  return <div className="listing-filters">
    <button className="listing-filters-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><Icon name="search" size={17}/> Filter listings <span>{expanded ? 'Hide' : 'Show'}</span></button>
    {expanded && <div className={`listing-filters-fields${showCity ? ' listing-filters-fields-city' : ''}`}>
      <label>Name<input type="search" value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="Search by name"/></label>
      <label>Category<select value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value })}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      {showCity && <label>City<select value={value.city} onChange={(event) => onChange({ ...value, city: event.target.value })}><option value="">All cities</option>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>}
      <label>Min {priceLabel} (Rs.)<input type="number" min="0" value={value.minPrice} onChange={(event) => onChange({ ...value, minPrice: event.target.value })} placeholder="Any"/></label>
      <label>Max {priceLabel} (Rs.)<input type="number" min="0" value={value.maxPrice} onChange={(event) => onChange({ ...value, maxPrice: event.target.value })} placeholder="Any"/></label>
      <button type="button" className="listing-filters-clear" onClick={() => onChange({ ...emptyListingFilters })}>Clear</button>
    </div>}
  </div>
}
