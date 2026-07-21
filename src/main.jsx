import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PostHogProvider } from 'posthog-js/react'
import './index.css'
import App from './App.jsx'
import { getStoredTheme, resolveTheme, applyResolved } from './lib/theme'
import { initAnalytics, posthog } from './lib/analytics'

// Apply the theme before first paint (avoids a flash), and keep it in sync with
// the OS when the user's preference is "system".
applyResolved(resolveTheme(getStoredTheme()))
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (getStoredTheme() === 'system') applyResolved(resolveTheme('system'))
})

// Init at module scope (not in an effect) so StrictMode's double-invoke of
// effects can't double-init PostHog.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <PostHogProvider client={posthog}>
        <App />
      </PostHogProvider>
    </BrowserRouter>
  </StrictMode>,
)
