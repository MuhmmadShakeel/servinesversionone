export function relatedListings(candidates, actions, actionIdKey, userId) {
  const categories = new Set(actions.map((item) => String(item.serviceCategory || item.category || '').trim().toLowerCase()).filter(Boolean))
  const seen = new Set(actions.map((item) => item[actionIdKey]))
  if (!categories.size) return []
  return candidates.filter((item) => categories.has(String(item.category || '').trim().toLowerCase())
    && !seen.has(item.id) && item.ownerUserId !== userId)
}

