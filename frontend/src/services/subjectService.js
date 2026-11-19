import api, { body } from './api'

export const subjectService = {
  getAll: async (params = {}) => {
    const res = await api.get('/subjects', { params })
    return body(res)
  },

  getById: async (id) => {
    const res = await api.get(`/subjects/${id}`)
    return body(res)
  },

  create: async (data) => {
    const res = await api.post('/subjects', data)
    return body(res)
  },

  update: async (id, data) => {
    const res = await api.put(`/subjects/${id}`, data)
    return body(res)
  },

  delete: async (id) => {
    const res = await api.delete(`/subjects/${id}`)
    return body(res)
  }
}

export default subjectService
