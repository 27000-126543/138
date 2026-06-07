import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Report, PaginatedResponse } from '@shared/types';
import { reportsApi } from '../api/reports';
import { tasksApi } from '../api/tasks';

export const useReportStore = defineStore('report', () => {
  const reports = ref<Report[]>([]);
  const currentReport = ref<Report | null>(null);
  const loading = ref(false);
  const total = ref(0);
  const page = ref(1);
  const size = ref(20);

  const totalPages = computed(() => Math.ceil(total.value / size.value));

  const fetchReports = async (params?: { page?: number; size?: number; taskId?: string; fileType?: string; startDate?: string; endDate?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    loading.value = true;
    try {
      const response: PaginatedResponse<Report> = await reportsApi.list(params);
      reports.value = response.items;
      total.value = response.total;
      page.value = response.page;
      size.value = response.size;
      return response;
    } finally {
      loading.value = false;
    }
  };

  const fetchReport = async (id: string) => {
    loading.value = true;
    try {
      const response = await reportsApi.get(id);
      currentReport.value = response;
      return response;
    } finally {
      loading.value = false;
    }
  };

  const generateReport = async (taskId: string) => {
    loading.value = true;
    try {
      const response = await tasksApi.generateReport(taskId);
      const report = (response as any).report || response;
      return report as Report;
    } finally {
      loading.value = false;
    }
  };

  const downloadReport = async (id: string) => {
    try {
      await reportsApi.download(id);
    } catch (error) {
      console.error('Failed to download report:', error);
      throw error;
    }
  };

  const deleteReport = async (id: string) => {
    loading.value = true;
    try {
      await reportsApi.delete(id);
      reports.value = reports.value.filter(r => r.id !== id);
    } finally {
      loading.value = false;
    }
  };

  return {
    reports,
    currentReport,
    loading,
    total,
    page,
    size,
    totalPages,
    fetchReports,
    fetchReport,
    generateReport,
    downloadReport,
    deleteReport,
  };
});
