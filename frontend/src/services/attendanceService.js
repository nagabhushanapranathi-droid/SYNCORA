import api, { body } from './api'

export const attendanceService = {
  getAll: async (params = {}) => {
    const res = await api.get('/attendance', { params })
    return body(res)
  },

  getToday: async (params = {}) => {
    const res = await api.get('/attendance/today', { params })
    return body(res)
  },

  mark: async (data) => {
    const res = await api.post('/attendance/mark', data)
    return body(res)
  },

  override: async (id, data) => {
    const res = await api.put(`/attendance/${id}`, data)
    return body(res)
  }
}

export default attendanceService
