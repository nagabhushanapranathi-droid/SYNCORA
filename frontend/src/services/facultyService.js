import api from './api'

export const facultyService = {
  getAll: async (params = {}) => {
    const res = await api.get('/faculty', { params })
    return res.data
  },

  getById: async (id) => {
    const res = await api.get(`/faculty/${id}`)
    return res.data
  },

  create: async (data) => {
    const res = await api.post('/faculty', data)
    return res.data
  },

  update: async (id, data) => {
    const res = await api.put(`/faculty/${id}`, data)
    return res.data
  },

  delete: async (id) => {
    const res = await api.delete(`/faculty/${id}`)
    return res.data
  },

  assignSubjects: async (id, subjectIds) => {
    const res = await api.post(`/faculty/${id}/subjects`, { subject_ids: subjectIds })
    return res.data
  },

  getHistory: async (id) => {
    const res = await api.get(`/faculty/${id}/history`)
    return res.data
  }
}

export default facultyService
