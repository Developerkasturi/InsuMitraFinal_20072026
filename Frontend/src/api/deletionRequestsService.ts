import api from '../services/api';

export const deletionRequestsService = {
  requestDeletion: async (entityType: string, entityId: string, reason?: string) => {
    const res = await api.post('/deletion-requests', { entityType, entityId, reason });
    return res.data;
  },
  
  getRequests: async () => {
    const res = await api.get('/deletion-requests');
    return res.data;
  },

  resolveRequest: async (id: string, action: 'APPROVED' | 'REJECTED') => {
    const res = await api.put(`/deletion-requests/${id}/resolve`, { action });
    return res.data;
  },
};
