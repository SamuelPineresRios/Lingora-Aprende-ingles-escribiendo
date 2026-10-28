import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { storeLastRoute } from '@/lib/hooks/useSessionPersistence'

/**
 * Client component that tracks route changes
 * Silently stores the current pathname for session restoration
 * Renders as null - doesn't affect UI
 */
export function RouteTracker() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Don't track login/signup routes
    if (pathname !== '/login' && pathname !== '/signup' && pathname !== '/') {
      storeLastRoute(pathname)
    }
  }, [pathname])

  return null
}

