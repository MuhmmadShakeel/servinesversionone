// Compare boosts by daily budget. A shorter campaign with the same budget
// receives a higher score. Only campaigns within their saved duration rank.
const days = "CASE boost.duration_unit WHEN 'day' THEN 1 WHEN 'week' THEN 7 WHEN 'month' THEN 30 ELSE 365 END"

export function boostJoin(type, listingAlias) {
  if (!['service', 'product', 'hiring'].includes(type) || !['s', 'p', 'h'].includes(listingAlias)) {
    throw new Error('Invalid boost ranking target.')
  }
  return `LEFT JOIN LATERAL (
    SELECT boost.budget / (boost.duration_count * ${days}) AS daily_rate,
      boost.updated_at + (boost.duration_count * ${days}) * INTERVAL '1 day' AS expires_at
    FROM listing_boosts boost
    WHERE boost.listing_type = '${type}' AND boost.listing_id = ${listingAlias}.id
      AND boost.owner_user_id = ${listingAlias}.owner_user_id
      AND boost.updated_at + (boost.duration_count * ${days}) * INTERVAL '1 day' > NOW()
  ) ranking ON TRUE`
}

export const boostPercentage = `COALESCE(ROUND(
  100 * ranking.daily_rate / NULLIF(MAX(ranking.daily_rate) OVER (), 0), 1
), 0) AS "boostPercentage"`

export const boostOrder = 'ranking.daily_rate DESC NULLS LAST'
