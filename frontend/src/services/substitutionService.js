import api, { body } from './api'

export const substitutionService = {
  getAll: async (params = {}) => {
    const res = await api.get('/substitutions', { params })
    return body(res)
  },

  getById: async (id) => {
    const res = await api.get(`/substitutions/${id}`)
    return body(res)
  },

  approve: async (id, data = {}) => {
    const res = await api.post(`/substitutions/${id}/approve`, data)
    return body(res)
  },

  reject: async (id, data = {}) => {
    const res = await api.post(`/substitutions/${id}/reject`, data)
    return body(res)
  },

  manualAssign: async (id, data) => {
    const res = await api.post(`/substitutions/${id}/manual-assign`, data)
    return body(res)
  },

  suspend: async (id, data = {}) => {
    const res = await api.post(`/substitutions/${id}/suspend`, data)
    return body(res)
  },

  acknowledge: async (id) => {
    const res = await api.post(`/substitutions/${id}/acknowledge`)
    return body(res)
  },

  /** Re-run the deterministic allocation algorithm for this request. */
  recalculate: async (id) => {
    const res = await api.post(`/substitutions/generate/${id}`)
    return body(res)
  },

  getCandidates: async (id) => {
    const res = await api.get(`/substitutions/${id}/candidates`)
    return body(res)
  },

  getLessonPlan: async (id) => {
    const res = await api.get(`/substitutions/${id}/lesson-plan`)
    return body(res)
  },

  generateLessonPlan: async (id, force = false) => {
    const res = await api.post(`/substitutions/${id}/lesson-plan/generate`, { force })
    return body(res)
  },

  updateLessonPlan: async (id, data) => {
    const res = await api.put(`/substitutions/${id}/lesson-plan`, data)
    return body(res)
  },

  recordProgress: async (id, data) => {
    const res = await api.post(`/substitutions/${id}/progress`, data)
    return body(res)
  },

  submitHandover: async (id, data) => {
    const res = await api.post(`/substitutions/${id}/handover`, data)
    return body(res)
  },

  getAcademicContext: async (id) => {
    const res = await api.get(`/substitutions/${id}/academic-context`)
    return body(res)
  }
}

export default substitutionService
