export const emptyListingFilters = { name: '', category: '', city: '', minPrice: '', maxPrice: '' }

export function matchesListingFilters(item, filters, priceFields = ['price']) {
  const name = item.title || item.requirementTitle || item.productTitle || item.serviceTitle || ''
  if (!name.toLowerCase().includes(filters.name.trim().toLowerCase())) return false
  if (filters.category && item.category !== filters.category) return false
  if (filters.city && (item.city || '').toLocaleLowerCase() !== filters.city.toLocaleLowerCase()) return false
  const prices = priceFields.filter((field) => item[field] !== undefined && item[field] !== null).map((field) => Number(item[field])).filter(Number.isFinite)
  const low = prices.length ? Math.min(...prices) : undefined
  const high = prices.length ? Math.max(...prices) : undefined
  if (filters.minPrice !== '' && (high === undefined || high < Number(filters.minPrice))) return false
  if (filters.maxPrice !== '' && (low === undefined || low > Number(filters.maxPrice))) return false
  return true
}
