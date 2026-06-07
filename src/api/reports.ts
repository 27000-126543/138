import { apiClient } from './client';
import type { Report, PaginatedResponse } from '@shared/types';

export const reportsApi = {
  list: (params?: { page?: number; size?: number; taskId?: string; fileType?: string; startDate?: string; endDate?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    return apiClient.get<PaginatedResponse<Report>>('/reports', { params });
  },

  get: (id: string) => {
    return apiClient.get<Report>(`/reports/${id}`);
  },

  download: (id: string) => {
    return apiClient.download(`/reports/${id}/download`, `report-${id}.pdf`);
  },

  delete: (id: string) => {
    return apiClient.delete<void>(`/reports/${id}`);
  },
};
