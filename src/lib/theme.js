// Theme preference: 'system' | 'light' | 'dark'. Default is 'dark' (the app's
// original look) when nothing is stored. 'system' follows the OS setting.

const KEY = 'veralis-theme'

export function getStoredTheme() {
  const t = localStorage.getItem(KEY)
  return t === 'light' || t === 'dark' || t === 'system' ? t : 'dark'
}

function systemPrefersLight() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
}

// Resolve a preference to an actual mode ('light' | 'dark').
export function resolveTheme(pref) {
  if (pref === 'light') return 'light'
  if (pref === 'dark') return 'dark'
  return systemPrefersLight() ? 'light' : 'dark'
}

export function applyResolved(mode) {
  if (mode === 'light') document.documentElement.setAttribute('data-theme', 'light')
  else document.documentElement.removeAttribute('data-theme')
}

// Persist a preference and apply it immediately.
export function setTheme(pref) {
  localStorage.setItem(KEY, pref)
  applyResolved(resolveTheme(pref))
}
