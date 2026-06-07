import { apiClient } from './client';
import type { DailyStats } from '@shared/types';

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

interface AccuracyBoxPlotData {
  method: string;
  values: number[];
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

export const statisticsApi = {
  getDashboardStats: () => {
    return apiClient.get<DashboardStats>('/statistics/dashboard');
  },

  getDailyStats: (params?: {
    startDate?: string;
    endDate?: string;
    days?: number;
  }) => {
    return apiClient.get<DailyStats[]>('/statistics/daily', { params });
  },

  getPerformanceTrend: (params?: {
    startDate?: string;
    endDate?: string;
    days?: number;
  }) => {
    return apiClient.get<PerformanceTrend[]>('/statistics/performance-trend', { params });
  },

  getAccuracyBoxPlot: (params?: {
    method?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    return apiClient.get<AccuracyBoxPlotData[]>('/statistics/accuracy-boxplot', { params });
  },

  getMethodComparison: (params?: {
    startDate?: string;
    endDate?: string;
  }) => {
    return apiClient.get<
      {
        method: string;
        averageError: number;
        successRate: number;
        sampleSize: number;
        averageRuntime: number;
      }[]
    >('/statistics/method-comparison', { params });
  },

  getTargetRanking: (params?: {
    limit?: number;
    sortBy?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    return apiClient.get<
      {
        targetId: string;
        targetName: string;
        taskCount: number;
        successRate: number;
        averageAccuracy: number;
        totalComputeHours: number;
      }[]
    >('/statistics/target-ranking', { params });
  }
};

export default statisticsApi;
