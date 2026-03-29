'use client'

import { useEffect, useState } from 'react'

const NARROW_VIEWPORT_QUERY = '(max-width: 720px)'

export function useIsNarrowViewport() {
  const [isNarrowViewport, setIsNarrowViewport] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(NARROW_VIEWPORT_QUERY)
    const update = () => setIsNarrowViewport(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return isNarrowViewport
}
