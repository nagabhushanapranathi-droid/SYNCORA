import api, { fetchCsrfToken } from './api'

export const authService = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    return res.data
  },

  logout: async () => {
    const res = await api.post('/auth/logout')
    return res.data
  },

  me: async () => {
    const res = await api.get('/auth/me')
    return res.data
  },

  csrfToken: async () => {
    return await fetchCsrfToken()
  }
}

export default authService
