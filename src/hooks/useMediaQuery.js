import { useState, useEffect } from 'react'

// Returns true while the given media query matches. Used to render distinct
// layouts on mobile vs desktop where CSS alone can't express the difference
// (e.g. the Home dashboard reorders modules across the two-column breakpoint).
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
