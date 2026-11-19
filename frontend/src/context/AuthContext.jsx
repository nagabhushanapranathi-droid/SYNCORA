import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { authService } from '../services/authService'

const AuthContext = createContext(null)

/** Accepts either { user: {...} } (login) or the bare user record (/auth/me). */
function normalizeUser(data) {
  const u = data?.user || data
  return u && typeof u === 'object' && u.role ? u : null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authService
      .me()
      .then((data) => setUser(normalizeUser(data)))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password)
    const loggedInUser = normalizeUser(data)
    setUser(loggedInUser)
    return loggedInUser
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } catch {
      // The session is cleared client-side regardless.
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout, setUser }), [user, loading, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export default AuthContext
