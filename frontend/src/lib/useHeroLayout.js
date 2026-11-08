import { useSyncExternalStore } from 'react'

// The landing page's text sits beside the model on wide screens and below it otherwise.
// The page layout and the camera both read this, so they can't disagree.
export const HERO_SIDE_BY_SIDE = '(min-width: 40rem) and (min-aspect-ratio: 5/4)'

function subscribe(onChange) {
  const query = window.matchMedia(HERO_SIDE_BY_SIDE)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function useHeroSideBySide() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(HERO_SIDE_BY_SIDE).matches)
}
