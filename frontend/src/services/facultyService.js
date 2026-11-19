import api, { body } from './api'

export const facultyService = {
  getAll: async (params = {}) => {
    const res = await api.get('/faculty', { params })
    return body(res)
  },

  getById: async (id) => {
    const res = await api.get(`/faculty/${id}`)
    return body(res)
  },

  create: async (data) => {
    const res = await api.post('/faculty', data)
    return body(res)
  },

  update: async (id, data) => {
    const res = await api.put(`/faculty/${id}`, data)
    return body(res)
  },

  delete: async (id) => {
    const res = await api.delete(`/faculty/${id}`)
    return body(res)
  },

  /**
   * Replace the faculty member's qualified subjects. The backend's PUT /faculty/<id>
   * accepts the full `subject_ids` list (POST /faculty/<id>/subjects takes a single id).
   */
  assignSubjects: async (id, subjectIds) => {
    const res = await api.put(`/faculty/${id}`, { subject_ids: subjectIds.map(Number) })
    return body(res)
  },

  getHistory: async (id) => {
    const res = await api.get(`/faculty/${id}/history`)
    return body(res)
  }
}

export default facultyService
