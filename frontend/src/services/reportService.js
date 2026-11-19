import api from './api'

export const reportService = {
  getStats: async (params = {}) => {
    const res = await api.get('/reports', { params })
    return res.data
  },

  getWorkload: async () => {
    const res = await api.get('/reports/workload')
    return res.data
  },

  getSystemStatus: async () => {
    const res = await api.get('/reports/system-status')
    return res.data
  }
}

export default reportService
