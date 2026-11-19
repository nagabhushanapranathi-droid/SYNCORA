import api from './api'

export const substitutionService = {
  getAll: async (params = {}) => {
    const res = await api.get('/substitutions', { params })
    return res.data
  },

  getById: async (id) => {
    const res = await api.get(`/substitutions/${id}`)
    return res.data
  },

  approve: async (id, data = {}) => {
    const res = await api.post(`/substitutions/${id}/approve`, data)
    return res.data
  },

  reject: async (id, data = {}) => {
    const res = await api.post(`/substitutions/${id}/reject`, data)
    return res.data
  },

  manualAssign: async (id, data) => {
    const res = await api.post(`/substitutions/${id}/manual-assign`, data)
    return res.data
  },

  suspend: async (id, data = {}) => {
    const res = await api.post(`/substitutions/${id}/suspend`, data)
    return res.data
  },

  acknowledge: async (id) => {
    const res = await api.post(`/substitutions/${id}/acknowledge`)
    return res.data
  },

  getCandidates: async (id) => {
    const res = await api.get(`/substitutions/${id}/candidates`)
    return res.data
  }
}

export default substitutionService
