import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
})

// CSRF token management
let csrfToken = null

export async function fetchCsrfToken() {
  try {
    const res = await api.get('/auth/csrf-token')
    csrfToken = res.data.csrf_token || res.data.csrfToken || null
    return csrfToken
  } catch {
    return null
  }
}

// Interceptor: add CSRF token to mutating requests
api.interceptors.request.use(async (config) => {
  const method = config.method ? config.method.toLowerCase() : ''
  if (['post', 'put', 'delete', 'patch'].includes(method)) {
    if (!csrfToken) {
      await fetchCsrfToken()
    }
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken
    }
  }
  return config
})

// Interceptor: handle auth errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
