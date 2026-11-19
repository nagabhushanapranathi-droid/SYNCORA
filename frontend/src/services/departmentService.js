import api, { body } from './api'

export const departmentService = {
  getAll: async () => {
    const res = await api.get('/departments')
    return body(res)
  },

  getById: async (id) => {
    const res = await api.get(`/departments/${id}`)
    return body(res)
  },

  create: async (data) => {
    const res = await api.post('/departments', data)
    return body(res)
  },

  update: async (id, data) => {
    const res = await api.put(`/departments/${id}`, data)
    return body(res)
  },

  delete: async (id) => {
    const res = await api.delete(`/departments/${id}`)
    return body(res)
  }
}

export default departmentService
