import api from './api'

export const timetableService = {
  getAll: async (params = {}) => {
    const res = await api.get('/timetable', { params })
    return res.data
  },

  getWeekly: async (params = {}) => {
    const res = await api.get('/timetable/weekly', { params })
    return res.data
  },

  create: async (data) => {
    const res = await api.post('/timetable', data)
    return res.data
  },

  update: async (id, data) => {
    const res = await api.put(`/timetable/${id}`, data)
    return res.data
  },

  delete: async (id) => {
    const res = await api.delete(`/timetable/${id}`)
    return res.data
  }
}

export default timetableService
