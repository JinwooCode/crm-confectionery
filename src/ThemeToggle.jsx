import { useState } from 'react'

const STORAGE_KEY = 'crm-theme'

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

// Called once before React renders, so the page never flashes the wrong theme.
export function applyInitialTheme() {
  const saved = readSaved()
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme = saved ?? (prefersDark ? 'dark' : 'light')
}

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light')

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable (private mode) – theme still applies for this visit
    }
    setTheme(next)
  }

  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      title={isDark ? 'מצב בהיר' : 'מצב כהה'}
      aria-label={isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
    >
      <span className={isDark ? 'knob dark' : 'knob'}>{isDark ? '🌙' : '☀️'}</span>
    </button>
  )
}
