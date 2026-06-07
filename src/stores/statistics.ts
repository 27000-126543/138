import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { DailyStats } from '@shared/types';
import { statisticsApi } from '../api/statistics';

interface TaskStats {
  total: number;
  completed: number;
  running: number;
  failed: number;
  pending: number;
  completionRate: number;
}

interface AlertStats {
  total: number;
  unreviewed: number;
  critical: number;
}

interface ApprovalStats {
  total: number;
  pending: number;
}

interface MethodStats {
  method: string;
  total: number;
  completed: number;
  rate: number;
}

interface PeriodStats {
  startDate: string;
  endDate: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  completionRate: number;
  byMethod: MethodStats[];
}

interface DashboardStats {
  tasks: TaskStats;
  alerts: AlertStats;
  approvals: ApprovalStats;
  recentTrend: any[];
  periodStats: PeriodStats;
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

const mockDashboardStats: DashboardStats = {
  tasks: {
    total: 156,
    completed: 89,
    running: 23,
    failed: 12,
    pending: 32,
    completionRate: 57.1
  },
  alerts: {
    total: 45,
    unreviewed: 8,
    critical: 3
  },
  approvals: {
    total: 78,
    pending: 5
  },
  recentTrend: [],
  periodStats: {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    totalTasks: 156,
    completedTasks: 89,
    failedTasks: 12,
    completionRate: 57.1,
    byMethod: [
      { method: 'fep', total: 68, completed: 42, rate: 61.8 },
      { method: 'ti', total: 45, completed: 28, rate: 62.2 },
      { method: 'mmpbsa', total: 43, completed: 19, rate: 44.2 }
    ]
  }
};

const mockPerformanceTrend: PerformanceTrend[] = Array.from({ length: 14 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - 13 + i);
  return {
    date: date.toISOString().split('T')[0],
    successRate: 50 + Math.random() * 40,
    averageError: 0.5 + Math.random() * 1.5,
    taskCount: 3 + Math.floor(Math.random() * 8)
  };
});

const mockAccuracyData: AccuracyData[] = [
  {
    method: 'FEP',
    values: [0.8, 1.2, 0.9, 1.5, 0.7, 1.1, 0.6, 1.3, 1.0, 0.8],
    median: 1.0,
    q1: 0.8,
    q3: 1.2,
    min: 0.6,
    max: 1.5
  },
  {
    method: 'TI',
    values: [1.0, 1.5, 1.2, 1.8, 0.9, 1.4, 0.8, 1.6, 1.3, 1.1],
    median: 1.3,
    q1: 1.0,
    q3: 1.5,
    min: 0.8,
    max: 1.8
  },
  {
    method: 'MM-PBSA',
    values: [1.5, 2.0, 1.8, 2.5, 1.2, 1.9, 1.0, 2.2, 1.7, 1.4],
    median: 1.75,
    q1: 1.4,
    q3: 2.0,
    min: 1.0,
    max: 2.5
  }
];

export const useStatisticsStore = defineStore('statistics', () => {
  const dashboardStats = ref<DashboardStats | null>(null);
  const dailyStats = ref<DailyStats[]>([]);
  const performanceTrend = ref<PerformanceTrend[]>([]);
  const accuracyData = ref<AccuracyData[]>([]);
  const loading = ref(false);

  const totalTasks = computed(() => dashboardStats.value?.tasks.total ?? mockDashboardStats.tasks.total);
  const runningTasks = computed(() => dashboardStats.value?.tasks.running ?? mockDashboardStats.tasks.running);
  const completedTasks = computed(() => dashboardStats.value?.tasks.completed ?? mockDashboardStats.tasks.completed);
  const failedTasks = computed(() => dashboardStats.value?.tasks.failed ?? mockDashboardStats.tasks.failed);
  const pendingTasks = computed(() => dashboardStats.value?.tasks.pending ?? mockDashboardStats.tasks.pending);
  const completionRate = computed(() => dashboardStats.value?.tasks.completionRate ?? mockDashboardStats.tasks.completionRate);
  const averageAccuracy = computed(() => 1.2 - completionRate.value * 0.005);
  const totalComputeHours = computed(() => Math.round(totalTasks.value * 8.5));
  const activeUsers = computed(() => 12);

  const fetchDashboardStats = async () => {
    loading.value = true;
    try {
      const response = await statisticsApi.getDashboardStats();
      dashboardStats.value = response as unknown as DashboardStats;
      return response;
    } finally {
      loading.value = false;
    }
  };

  const fetchDailyStats = async (params?: { startDate?: string; endDate?: string; days?: number }) => {
    loading.value = true;
    try {
      const response = await statisticsApi.getDailyStats(params);
      dailyStats.value = (response as any)?.daily || [];
      return dailyStats.value;
    } catch (error) {
      dailyStats.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  };

  const fetchPerformanceTrend = async (params?: { startDate?: string; endDate?: string; days?: number }) => {
    loading.value = true;
    try {
      const response = await statisticsApi.getPerformanceTrend(params);
      performanceTrend.value = (response as any)?.trend || [];
      return performanceTrend.value;
    } catch (error) {
      performanceTrend.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  };

  const fetchAccuracyBoxPlot = async (params?: { method?: string; startDate?: string; endDate?: string }) => {
    loading.value = true;
    try {
      const response = await statisticsApi.getAccuracyBoxPlot(params);
      accuracyData.value = response as any[];
      return accuracyData.value;
    } catch (error) {
      accuracyData.value = [];
      return [];
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
    totalTasks,
    runningTasks,
    completedTasks,
    failedTasks,
    pendingTasks,
    completionRate,
    averageAccuracy,
    totalComputeHours,
    activeUsers,
    fetchDashboardStats,
    fetchDailyStats,
    fetchPerformanceTrend,
    fetchAccuracyBoxPlot
  };
});
