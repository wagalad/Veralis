import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { getStoredTheme, resolveTheme, applyResolved } from './lib/theme'

// Apply the theme before first paint (avoids a flash), and keep it in sync with
// the OS when the user's preference is "system".
applyResolved(resolveTheme(getStoredTheme()))
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (getStoredTheme() === 'system') applyResolved(resolveTheme('system'))
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
