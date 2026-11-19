import api, { body, fetchCsrfToken, setCsrfToken } from './api'

export const authService = {
  /** Returns { success, user, csrf_token }. The session's CSRF token is adopted immediately. */
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    if (res.data?.csrf_token) setCsrfToken(res.data.csrf_token)
    return res.data
  },

  /** Clears the Flask session; the cached CSRF token belongs to that session, so drop it. */
  logout: async () => {
    try {
      const res = await api.post('/auth/logout')
      return body(res)
    } finally {
      setCsrfToken(null)
    }
  },

  /** Current user record (unwrapped from { success, data }). */
  me: async () => {
    const res = await api.get('/auth/me')
    return body(res)
  },

  csrfToken: async () => {
    return await fetchCsrfToken()
  },
}

export default authService
