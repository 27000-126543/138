import { apiClient } from './client';
import type { User, PaginatedResponse } from '@shared/types';

interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: string;
}

interface UpdateUserRequest {
  username?: string;
  email?: string;
  role?: string;
  password?: string;
}

interface UpdateProfileRequest {
  username?: string;
  email?: string;
  oldPassword?: string;
  newPassword?: string;
}

export const usersApi = {
  list: (params?: {
    page?: number;
    size?: number;
    search?: string;
    role?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => {
    return apiClient.get<PaginatedResponse<User>>('/users', { params });
  },

  create: (data: CreateUserRequest) => {
    return apiClient.post<User>('/users', data);
  },

  get: (id: string) => {
    return apiClient.get<User>(`/users/${id}`);
  },

  update: (id: string, data: UpdateUserRequest) => {
    return apiClient.put<User>(`/users/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete<void>(`/users/${id}`);
  },

  getProfile: () => {
    return apiClient.get<User>('/users/profile');
  },

  updateProfile: (data: UpdateProfileRequest) => {
    return apiClient.put<User>('/users/profile', data);
  },

  getStats: (id: string) => {
    return apiClient.get<{
      totalTasks: number;
      completedTasks: number;
      runningTasks: number;
      successRate: number;
      totalComputeHours: number;
      averageAccuracy: number;
    }>(`/users/${id}/stats`);
  }
};

export default usersApi;
