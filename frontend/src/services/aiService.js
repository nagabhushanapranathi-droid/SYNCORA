import api from './api'

export const aiService = {
  chat: async (message, history = []) => {
    const res = await api.post('/ai/chat', { message, history })
    return res.data
  },

  explain: async (substitutionId) => {
    const res = await api.post('/ai/explain', { substitution_id: substitutionId })
    return res.data
  },

  generateReport: async (params = {}) => {
    const res = await api.post('/ai/report', params)
    return res.data
  }
}

export default aiService
