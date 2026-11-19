import api, { body } from './api'

export const aiService = {
  chat: async (message, history = []) => {
    const res = await api.post('/ai/chat', { message, history })
    return body(res)
  },

  explain: async (substitutionId) => {
    const res = await api.post('/ai/explain', { substitution_id: substitutionId })
    return body(res)
  },

  generateReport: async (params = {}) => {
    const res = await api.post('/ai/report', params)
    return body(res)
  },

  getConfig: async () => {
    const res = await api.get('/ai/config')
    return body(res)
  },

  updateConfig: async (data) => {
    const res = await api.post('/ai/config', data)
    return body(res)
  },

  testProvider: async (provider) => {
    const res = await api.post('/ai/test-provider', { provider })
    return body(res)
  },

  getModels: async (refresh = false) => {
    const res = await api.get('/ai/models', { params: { refresh } })
    return body(res)
  },

  testConnection: async () => {
    const res = await api.post('/ai/test-connection')
    return body(res)
  }
}

export default aiService
