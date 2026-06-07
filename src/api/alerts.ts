import { apiClient } from './client';
import type { Alert, PaginatedResponse } from '@shared/types';

interface ReviewAlertRequest {
  reviewComment?: string;
  reviewAction?: string;
}

export const alertsApi = {
  list: (params?: {
    page?: number;
    size?: number;
    reviewed?: boolean;
    level?: string;
    taskId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    return apiClient.get<PaginatedResponse<Alert>>('/alerts', { params });
  },

  get: (id: string) => {
    return apiClient.get<Alert>(`/alerts/${id}`);
  },

  review: (id: string, data: ReviewAlertRequest) => {
    return apiClient.put<Alert>(`/alerts/${id}/review`, data);
  },

  getUnreviewedCount: () => {
    return apiClient.get<{ count: number }>('/alerts/unreviewed-count');
  }
};

export default alertsApi;
