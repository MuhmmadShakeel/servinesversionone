import { toast } from 'react-toastify'

const lastShown = new Map()
const names = {
  me: 'your profile',
  getConversations: 'your inbox',
  getMessages: 'messages',
  getCart: 'your cart',
  getWishlist: 'your wishlist',
  getMyOrders: 'your orders',
  getSalesOrders: 'sales orders',
}

export const apiToastMiddleware = () => (next) => (action) => {
  const result = next(action)
  const endpoint = action.meta?.arg?.endpointName
  if (action.meta?.arg?.type !== 'query' || !endpoint) return result
  const key = `${action.type.split('/')[0]}:${endpoint}`
  if (action.type.endsWith('/fulfilled')) lastShown.delete(key)
  // The sidebar polls conversations on every page; handle inbox failures in ChatPage instead.
  if (!action.type.endsWith('/rejected') || endpoint === 'getConversations' || action.meta?.aborted || action.payload?.status === 401 || document.visibilityState === 'hidden') return result
  const now = Date.now()
  if (now - (lastShown.get(key) || 0) < 60000) return result
  lastShown.set(key, now)
  const label = names[endpoint] || endpoint.replace(/^(get|browse)/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  toast.error(action.payload?.data?.message || `Could not load ${label}. Please try again.`, { toastId: `query-error-${key}` })
  return result
}
