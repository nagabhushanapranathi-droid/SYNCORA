import api from './api'

export const absenceService = {
  getAll: async (params = {}) => {
    const res = await api.get('/absences', { params })
    return res.data
  },

  getToday: async () => {
    const res = await api.get('/absences/today')
    return res.data
  },

  report: async (data) => {
    const res = await api.post('/absences', data)
    return res.data
  },

  getById: async (id) => {
    const res = await api.get(`/absences/${id}`)
    return res.data
  }
}

export default absenceService
