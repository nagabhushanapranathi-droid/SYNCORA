import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Theme preference: 'light' (Hello Kitty-inspired), 'dark' (Kuromi-inspired) or 'system'.
 * The resolved theme is written to <html data-theme>. index.html applies the stored
 * preference before first paint, so this provider only keeps React in sync with it.
 * Only the visual preference is stored — never credentials or user data.
 */
const STORAGE_KEY = 'syncora-theme'
const ThemeContext = createContext(null)

function readPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

function applyTheme(resolved) {
  const root = document.documentElement
  root.classList.add('theme-switching')
  root.setAttribute('data-theme', resolved)
  root.style.colorScheme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#17141F' : '#FFF9EF')
  // Re-enable transitions after the browser has painted the new theme.
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')))
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readPreference)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    if (document.documentElement.getAttribute('data-theme') !== theme) applyTheme(theme)
  }, [theme])

  const setPreference = useCallback((next) => {
    setPreferenceState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage unavailable (private mode) — preference lasts for this session only */
    }
  }, [])

  const toggle = useCallback(() => setPreference(theme === 'dark' ? 'light' : 'dark'), [theme, setPreference])

  const value = useMemo(() => ({ theme, preference, setPreference, toggle }), [theme, preference, setPreference, toggle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}

export default ThemeContext
