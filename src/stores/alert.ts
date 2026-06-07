import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Alert, PaginatedResponse, SimulationTask } from '@shared/types';
import { AlertLevel, SimulationStatus, FEMethod, UserRole } from '@shared/types';
import { alertsApi } from '../api/alerts';

const mockTasks: SimulationTask[] = [
  {
    id: 'task-1',
    name: 'EGFR 抑制剂 Gefitinib 结合自由能计算',
    targetId: 'target-1',
    target: { id: 'target-1', name: 'EGFR', isPaused: false, consecutiveDeviations: 0 },
    createdBy: 'user-1',
    creator: { id: 'user-1', username: '张三', email: 'zhangsan@example.com', role: UserRole.COMPUTATIONAL_CHEMIST, createdAt: '2024-01-01T00:00:00Z' },
    assignedTo: 'user-2',
    assignee: { id: 'user-2', username: '李四', email: 'lisi@example.com', role: UserRole.MEDICINAL_CHEMIST, createdAt: '2024-01-01T00:00:00Z' },
    status: SimulationStatus.FEP_CALCULATION,
    forceField: 'amber14SB',
    temperature: 300,
    saltConcentration: 0.15,
    feMethod: FEMethod.FEP,
    rmsdThreshold: 2.0,
    progress: 65,
    estimatedTime: 7200,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    retryCount: 0,
    lastError: null
  },
  {
    id: 'task-2',
    name: 'BRD4 结合能预测',
    targetId: 'target-2',
    target: { id: 'target-2', name: 'BRD4', isPaused: false, consecutiveDeviations: 0 },
    createdBy: 'user-2',
    creator: { id: 'user-2', username: '李四', email: 'lisi@example.com', role: UserRole.MEDICINAL_CHEMIST, createdAt: '2024-01-01T00:00:00Z' },
    assignedTo: 'user-1',
    assignee: { id: 'user-1', username: '张三', email: 'zhangsan@example.com', role: UserRole.COMPUTATIONAL_CHEMIST, createdAt: '2024-01-01T00:00:00Z' },
    status: SimulationStatus.EQUILIBRATION,
    forceField: 'charmm36',
    temperature: 310,
    saltConcentration: 0.15,
    feMethod: FEMethod.TI,
    rmsdThreshold: 2.0,
    progress: 35,
    estimatedTime: 5400,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    startedAt: new Date(Date.now() - 1800000).toISOString(),
    retryCount: 0,
    lastError: null
  }
];

const mockAlerts: Alert[] = [
  {
    id: 'alert-1',
    taskId: 'task-1',
    task: mockTasks[0],
    level: AlertLevel.WARNING,
    type: 'rmsd_deviation',
    message: 'RMSD 超过阈值 2.0 Å，当前值为 2.5 Å，请检查体系稳定性',
    metric: 'rmsd',
    value: 2.5,
    threshold: 2.0,
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewComment: null,
    reviewAction: null
  },
  {
    id: 'alert-2',
    taskId: 'task-2',
    task: mockTasks[1],
    level: AlertLevel.CRITICAL,
    type: 'temperature_fluctuation',
    message: '温度波动超过 ±5K，当前波动范围 298K-315K',
    metric: 'temperature',
    value: 315,
    threshold: 310,
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewComment: null,
    reviewAction: null
  },
  {
    id: 'alert-3',
    taskId: 'task-1',
    task: mockTasks[0],
    level: AlertLevel.INFO,
    type: 'task_started',
    message: '能量最小化步骤已开始，预计耗时 10 分钟',
    metric: null,
    value: null,
    threshold: null,
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    reviewedAt: new Date(Date.now() - 25 * 60000).toISOString(),
    reviewedBy: 'user-1',
    reviewComment: '已确认，继续监控',
    reviewAction: 'continue'
  },
  {
    id: 'alert-4',
    taskId: 'task-2',
    task: mockTasks[1],
    level: AlertLevel.WARNING,
    type: 'energy_jump',
    message: '势能出现异常跳跃，从 -8500 kcal/mol 跃升至 -7800 kcal/mol',
    metric: 'potentialEnergy',
    value: -7800,
    threshold: -8500,
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewComment: null,
    reviewAction: null
  },
  {
    id: 'alert-5',
    taskId: 'task-1',
    task: mockTasks[0],
    level: AlertLevel.FATAL,
    type: 'simulation_crash',
    message: '模拟崩溃，错误代码：127，需要重新启动',
    metric: null,
    value: null,
    threshold: null,
    timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewComment: null,
    reviewAction: null
  }
];

export const useAlertStore = defineStore('alert', () => {
  const alerts = ref<Alert[]>([]);
  const unreviewedCount = ref(0);
  const loading = ref(false);

  const unreviewedAlerts = computed(() => alerts.value.filter(a => !a.reviewedAt));
  const criticalAlerts = computed(() => alerts.value.filter(a => a.level === AlertLevel.CRITICAL || a.level === AlertLevel.FATAL));

  const fetchAlerts = async (params?: { page?: number; size?: number; reviewed?: boolean; level?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    loading.value = true;
    try {
      const response: PaginatedResponse<Alert> = await alertsApi.list(params);
      alerts.value = response.items;
      await fetchUnreviewedCount();
      return response;
    } catch (error) {
      console.warn('Using mock alerts data:', error);
      alerts.value = mockAlerts;
      unreviewedCount.value = mockAlerts.filter(a => !a.reviewedAt).length;
      return {
        items: mockAlerts,
        total: mockAlerts.length,
        page: params?.page || 1,
        size: params?.size || 10,
        totalPages: Math.ceil(mockAlerts.length / (params?.size || 10))
      };
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
    unreviewedAlerts,
    criticalAlerts,
    fetchAlerts,
    fetchUnreviewedCount,
    reviewAlert,
    addAlert
  };
});
