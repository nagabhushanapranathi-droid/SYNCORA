import api from './api'

export const attendanceService = {
  getAll: async (params = {}) => {
    const res = await api.get('/attendance', { params })
    return res.data
  },

  getToday: async (params = {}) => {
    const res = await api.get('/attendance/today', { params })
    return res.data
  },

  mark: async (data) => {
    const res = await api.post('/attendance/mark', data)
    return res.data
  },

  override: async (id, data) => {
    const res = await api.put(`/attendance/${id}`, data)
    return res.data
  }
}

export default attendanceService
