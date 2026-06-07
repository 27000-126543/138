import { apiClient } from './client';
import type { Approval, PaginatedResponse } from '@shared/types';

interface SubmitApprovalRequest {
  level: number;
}

interface ProcessApprovalRequest {
  status: string;
  comment?: string;
}

export const approvalsApi = {
  list: (params?: {
    page?: number;
    size?: number;
    status?: string;
    taskId?: string;
    approverId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    return apiClient.get<PaginatedResponse<Approval>>('/approvals', { params });
  },

  get: (id: string) => {
    return apiClient.get<Approval>(`/approvals/${id}`);
  },

  submit: (taskId: string, data: SubmitApprovalRequest) => {
    return apiClient.post<Approval>(`/approvals/task/${taskId}`, data);
  },

  process: (id: string, data: ProcessApprovalRequest) => {
    return apiClient.put<Approval>(`/approvals/${id}/process`, data);
  },

  getPendingCount: () => {
    return apiClient.get<{ count: number }>('/approvals/pending-count');
  }
};

export default approvalsApi;
