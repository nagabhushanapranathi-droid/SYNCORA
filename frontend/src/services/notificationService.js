import api, { body } from './api'

export const notificationService = {
  getAll: async () => {
    const res = await api.get('/notifications')
    return body(res)
  },

  markRead: async (id) => {
    const res = await api.put(`/notifications/${id}/read`)
    return body(res)
  },

  markAllRead: async () => {
    const res = await api.put('/notifications/read-all')
    return body(res)
  }
}

export default notificationService
