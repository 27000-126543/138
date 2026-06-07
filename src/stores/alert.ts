import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Alert, PaginatedResponse } from '@shared/types';
import { alertsApi } from '../api/alerts';

export const useAlertStore = defineStore('alert', () => {
  const alerts = ref<Alert[]>([]);
  const unreviewedCount = ref(0);
  const loading = ref(false);

  const fetchAlerts = async (params?: { page?: number; size?: number; reviewed?: boolean; level?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    loading.value = true;
    try {
      const response: PaginatedResponse<Alert> = await alertsApi.list(params);
      alerts.value = response.items;
      await fetchUnreviewedCount();
      return response;
    } finally {
      loading.value = false;
    }
  };

  const fetchUnreviewedCount = async () => {
    try {
      const response = await alertsApi.getUnreviewedCount();
      unreviewedCount.value = response.count;
      return response;
    } catch {
      unreviewedCount.value = 0;
    }
  };

  const reviewAlert = async (id: string, data: { reviewComment?: string; reviewAction?: string }) => {
    loading.value = true;
    try {
      const response = await alertsApi.review(id, data);
      const index = alerts.value.findIndex(a => a.id === id);
      if (index !== -1) {
        alerts.value[index] = response;
      }
      await fetchUnreviewedCount();
      return response;
    } finally {
      loading.value = false;
    }
  };

  const addAlert = (alert: Alert) => {
    alerts.value.unshift(alert);
    if (!alert.reviewedAt) {
      unreviewedCount.value++;
    }
  };

  return {
    alerts,
    unreviewedCount,
    loading,
    fetchAlerts,
    fetchUnreviewedCount,
    reviewAlert,
    addAlert
  };
});
