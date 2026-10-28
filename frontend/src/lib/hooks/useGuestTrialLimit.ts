import { useCallback, useState } from 'react'
import { GUEST_LIMIT_CODE } from '@vox/shared'

/** La API marca el fin de la prueba de invitado con un código estable. */
function isGuestLimitResponse(data: unknown): boolean {
  return Boolean(
    data &&
      typeof data === 'object' &&
      (data as { code?: unknown }).code === GUEST_LIMIT_CODE,
  )
}

export function useGuestTrialLimit() {
  const [guestLimit, setGuestLimit] = useState(false)

  const flagGuestLimit = useCallback((data: unknown) => {
    if (!isGuestLimitResponse(data)) return false
    setGuestLimit(true)
    return true
  }, [])

  const clearGuestLimit = useCallback(() => setGuestLimit(false), [])

  return { guestLimit, flagGuestLimit, clearGuestLimit }
}
