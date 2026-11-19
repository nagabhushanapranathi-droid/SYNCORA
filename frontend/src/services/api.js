import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * The Flask API wraps most payloads as { success: true, data: <payload>, message? }.
 * `body()` returns the payload when that envelope is present and the raw body otherwise
 * (e.g. /auth/login returns { success, user, csrf_token }). Services use it so pages
 * receive the actual records instead of the envelope.
 */
export function body(res) {
  const b = res?.data
  if (b && typeof b === 'object' && !Array.isArray(b) && 'success' in b && 'data' in b) return b.data
  return b
}

/** Human-readable message from a failed request (backend uses `error`). */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const d = err?.response?.data
  if (d && typeof d === 'object') return d.error || d.message || fallback
  if (err?.code === 'ERR_NETWORK') return 'The SYNCORA server is not reachable. Check that the backend is running.'
  return fallback
}

// ---------------------------------------------------------------------------
// CSRF token management
// ---------------------------------------------------------------------------
let csrfToken = null

export function setCsrfToken(token) {
  csrfToken = token || null
}

export async function fetchCsrfToken() {
  try {
    const res = await api.get('/auth/csrf-token')
    csrfToken = res.data.csrf_token || res.data.csrfToken || null
    return csrfToken
  } catch {
    return null
  }
}

const MUTATING = ['post', 'put', 'delete', 'patch']

api.interceptors.request.use(async (config) => {
  const method = (config.method || '').toLowerCase()
  if (MUTATING.includes(method)) {
    if (!csrfToken) await fetchCsrfToken()
    if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status
    const code = err.response?.data?.code
    const config = err.config

    // Session rotated (login/logout) → refresh the CSRF token once and replay.
    if (status === 403 && code === 'CSRF_ERROR' && config && !config.__csrfRetried) {
      config.__csrfRetried = true
      await fetchCsrfToken()
      if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken
      return api.request(config)
    }

    if (status === 401) {
      const path = typeof window !== 'undefined' ? window.location.pathname : ''
      const isAuthProbe = config?.url?.includes('/auth/me')
      if (!isAuthProbe && path && !path.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
