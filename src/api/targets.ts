import { apiClient } from './client';
import type { Target, PaginatedResponse } from '@shared/types';

interface CreateTargetRequest {
  name: string;
  uniprotId?: string;
  pdbId?: string;
  description?: string;
}

interface UpdateTargetRequest {
  name?: string;
  uniprotId?: string;
  pdbId?: string;
  description?: string;
}

interface PauseTargetRequest {
  pauseReason: string;
}

export const targetsApi = {
  list: (params?: {
    page?: number;
    size?: number;
    search?: string;
    isPaused?: boolean;
    sortBy?: string;
    sortOrder?: string;
  }) => {
    return apiClient.get<PaginatedResponse<Target>>('/targets', { params });
  },

  create: (data: CreateTargetRequest) => {
    return apiClient.post<Target>('/targets', data);
  },

  get: (id: string) => {
    return apiClient.get<Target>(`/targets/${id}`);
  },

  update: (id: string, data: UpdateTargetRequest) => {
    return apiClient.put<Target>(`/targets/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete<void>(`/targets/${id}`);
  },

  pause: (id: string, data: PauseTargetRequest) => {
    return apiClient.post<Target>(`/targets/${id}/pause`, data);
  },

  resume: (id: string) => {
    return apiClient.post<Target>(`/targets/${id}/resume`);
  },

  getStats: (id: string) => {
    return apiClient.get<{
      totalTasks: number;
      completedTasks: number;
      runningTasks: number;
      successRate: number;
      averageAccuracy: number;
      consecutiveDeviations: number;
    }>(`/targets/${id}/stats`);
  }
};

export default targetsApi;
