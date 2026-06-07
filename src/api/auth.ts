import { apiClient } from './client';
import type { User } from '@shared/types';

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: (data: LoginRequest) => {
    return apiClient.post<LoginResponse>('/auth/login', data);
  },

  getCurrentUser: () => {
    return apiClient.get<User>('/auth/me');
  },

  logout: () => {
    return apiClient.post<void>('/auth/logout');
  },

  refreshToken: () => {
    return apiClient.post<{ token: string }>('/auth/refresh');
  }
};

export default authApi;
