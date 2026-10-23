import { useEffect } from 'react'

const maxTimerMs = 2_147_483_647

// Refresh once the next active boost expires so the server can rank listings again.
export function useBoostExpiryRefresh(items, refetch, enabled = true) {
  useEffect(() => {
    if (!enabled || !items?.length) return undefined
    const nextExpiry = Math.min(...items.map((item) => Date.parse(item.boostExpiresAt)).filter(Number.isFinite))
    if (!Number.isFinite(nextExpiry)) return undefined
    let timer
    function schedule() {
      const remaining = nextExpiry - Date.now() + 100
      timer = window.setTimeout(() => {
        if (remaining > maxTimerMs) schedule()
        else refetch()
      }, Math.max(0, Math.min(remaining, maxTimerMs)))
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [items, refetch, enabled])
}
