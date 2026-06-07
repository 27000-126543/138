import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Approval, PaginatedResponse } from '@shared/types';
import { approvalsApi } from '../api/approvals';

export const useApprovalStore = defineStore('approval', () => {
  const approvals = ref<Approval[]>([]);
  const pendingCount = ref(0);
  const loading = ref(false);

  const fetchApprovals = async (params?: { page?: number; size?: number; status?: string; taskId?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    loading.value = true;
    try {
      const response: PaginatedResponse<Approval> = await approvalsApi.list(params);
      approvals.value = response.items;
      await fetchPendingCount();
      return response;
    } finally {
      loading.value = false;
    }
  };

  const fetchPendingCount = async () => {
    try {
      const response = await approvalsApi.getPendingCount();
      pendingCount.value = response.count;
      return response;
    } catch {
      pendingCount.value = 0;
    }
  };

  const submitApproval = async (taskId: string, data: { level: number }) => {
    loading.value = true;
    try {
      const response = await approvalsApi.submit(taskId, data);
      await fetchApprovals();
      return response;
    } finally {
      loading.value = false;
    }
  };

  const processApproval = async (id: string, data: { status: string; comment?: string }) => {
    loading.value = true;
    try {
      const response = await approvalsApi.process(id, data);
      const index = approvals.value.findIndex(a => a.id === id);
      if (index !== -1) {
        approvals.value[index] = response;
      }
      await fetchPendingCount();
      return response;
    } finally {
      loading.value = false;
    }
  };

  return {
    approvals,
    pendingCount,
    loading,
    fetchApprovals,
    fetchPendingCount,
    submitApproval,
    processApproval
  };
});
