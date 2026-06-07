import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { DailyStats } from '@shared/types';
import { statisticsApi } from '../api/statistics';

interface DashboardStats {
  totalTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;
  averageAccuracy: number;
  totalComputeHours: number;
  activeUsers: number;
}

interface PerformanceTrend {
  date: string;
  successRate: number;
  averageError: number;
  taskCount: number;
}

interface AccuracyData {
  method: string;
  values: number[];
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

export const useStatisticsStore = defineStore('statistics', () => {
  const dashboardStats = ref<DashboardStats | null>(null);
  const dailyStats = ref<DailyStats[]>([]);
  const performanceTrend = ref<PerformanceTrend[]>([]);
  const accuracyData = ref<AccuracyData[]>([]);
  const loading = ref(false);

  const fetchDashboardStats = async () => {
    loading.value = true;
    try {
      const response = await statisticsApi.getDashboardStats();
      dashboardStats.value = response;
      return response;
    } finally {
      loading.value = false;
    }
  };

  const fetchDailyStats = async (params?: { startDate?: string; endDate?: string; days?: number }) => {
    loading.value = true;
    try {
      const response = await statisticsApi.getDailyStats(params);
      dailyStats.value = response;
      return response;
    } finally {
      loading.value = false;
    }
  };

  const fetchPerformanceTrend = async (params?: { startDate?: string; endDate?: string; days?: number }) => {
    loading.value = true;
    try {
      const response = await statisticsApi.getPerformanceTrend(params);
      performanceTrend.value = response;
      return response;
    } finally {
      loading.value = false;
    }
  };

  const fetchAccuracyBoxPlot = async (params?: { method?: string; startDate?: string; endDate?: string }) => {
    loading.value = true;
    try {
      const response = await statisticsApi.getAccuracyBoxPlot(params);
      accuracyData.value = response;
      return response;
    } finally {
      loading.value = false;
    }
  };

  return {
    dashboardStats,
    dailyStats,
    performanceTrend,
    accuracyData,
    loading,
    fetchDashboardStats,
    fetchDailyStats,
    fetchPerformanceTrend,
    fetchAccuracyBoxPlot
  };
});
