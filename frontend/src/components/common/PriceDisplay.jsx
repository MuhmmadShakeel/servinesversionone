const money = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 })

export function PriceDisplay({ price, originalPrice }) {
  const current = Number(price)
  const original = Number(originalPrice)
  const discounted = Number.isFinite(original) && original > current
  return <span className="price-display">
    {discounted && <del aria-label={`Original price Rs. ${money.format(original)}`}>Rs. {money.format(original)}</del>}
    <strong>Rs. {money.format(current)}</strong>
    {discounted && <span className="price-display-badge">Save {Math.round((1 - current / original) * 100)}%</span>}
  </span>
}
