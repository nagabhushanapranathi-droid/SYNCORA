import api, { body } from './api'

export const timetableService = {
  getAll: async (params = {}) => {
    const res = await api.get('/timetable', { params })
    return body(res)
  },

  getWeekly: async (params = {}) => {
    const res = await api.get('/timetable/weekly', { params })
    return body(res)
  },

  getFacultySchedule: async (facultyId) => {
    const res = await api.get(`/timetable/faculty/${facultyId}/schedule`)
    return body(res)
  },

  create: async (data) => {
    const res = await api.post('/timetable', data)
    return body(res)
  },

  update: async (id, data) => {
    const res = await api.put(`/timetable/${id}`, data)
    return body(res)
  },

  delete: async (id) => {
    const res = await api.delete(`/timetable/${id}`)
    return body(res)
  }
}

export default timetableService
