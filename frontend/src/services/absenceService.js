import api, { body } from './api'

export const absenceService = {
  getAll: async (params = {}) => {
    const res = await api.get('/absences', { params })
    return body(res)
  },

  getToday: async () => {
    const res = await api.get('/absences/today')
    return body(res)
  },

  report: async (data) => {
    const res = await api.post('/absences', data)
    return body(res)
  },

  getById: async (id) => {
    const res = await api.get(`/absences/${id}`)
    return body(res)
  }
}

export default absenceService
