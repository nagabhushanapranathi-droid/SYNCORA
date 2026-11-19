import api, { body } from './api'

export const reportService = {
  getStats: async (params = {}) => {
    const res = await api.get('/reports', { params })
    return body(res)
  },

  getWorkload: async () => {
    const res = await api.get('/reports/workload')
    return body(res)
  },

  getSystemStatus: async () => {
    const res = await api.get('/reports/system-status')
    return body(res)
  },

  getAnalytics: async (params = {}) => {
    const res = await api.get('/reports/analytics', { params })
    return body(res)
  }
}

export default reportService
