import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Approval, PaginatedResponse, SimulationTask } from '@shared/types';
import { ApprovalStatus, SimulationStatus, FEMethod, UserRole } from '@shared/types';
import { approvalsApi } from '../api/approvals';

const mockTasks: SimulationTask[] = [
  {
    id: 'task-1',
    name: 'KRAS G12D 突变体研究',
    targetId: 'target-4',
    target: { id: 'target-4', name: 'KRAS G12D', isPaused: false, consecutiveDeviations: 0 },
    createdBy: 'user-2',
    creator: { id: 'user-2', username: '李四', email: 'lisi@example.com', role: UserRole.MEDICINAL_CHEMIST, createdAt: '2024-01-01T00:00:00Z' },
    assignedTo: 'user-1',
    assignee: { id: 'user-1', username: '张三', email: 'zhangsan@example.com', role: UserRole.COMPUTATIONAL_CHEMIST, createdAt: '2024-01-01T00:00:00Z' },
    status: SimulationStatus.PENDING_VALIDATION,
    forceField: 'amber14SB',
    temperature: 300,
    saltConcentration: 0.15,
    feMethod: FEMethod.FEP,
    rmsdThreshold: 2.0,
    progress: 0,
    estimatedTime: 7200,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    startedAt: undefined,
    retryCount: 0,
    lastError: undefined
  },
  {
    id: 'task-2',
    name: 'HER2 抗体模拟',
    targetId: 'target-5',
    target: { id: 'target-5', name: 'HER2', isPaused: false, consecutiveDeviations: 0 },
    createdBy: 'user-3',
    creator: { id: 'user-3', username: '王五', email: 'wangwu@example.com', role: UserRole.SYNTHESIS_TEAM, createdAt: '2024-01-01T00:00:00Z' },
    assignedTo: 'user-1',
    assignee: { id: 'user-1', username: '张三', email: 'zhangsan@example.com', role: UserRole.COMPUTATIONAL_CHEMIST, createdAt: '2024-01-01T00:00:00Z' },
    status: SimulationStatus.PENDING_VALIDATION,
    forceField: 'charmm36',
    temperature: 310,
    saltConcentration: 0.15,
    feMethod: FEMethod.FEP,
    rmsdThreshold: 2.0,
    progress: 0,
    estimatedTime: 5400,
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    startedAt: undefined,
    retryCount: 0,
    lastError: undefined
  }
];

const mockApprovals: Approval[] = [
  {
    id: 'approval-1',
    taskId: 'task-1',
    task: mockTasks[0],
    level: 1,
    status: ApprovalStatus.PENDING,
    approverId: 'user-1',
    approver: {
      id: 'user-1',
      username: '张三',
      email: 'zhangsan@example.com',
      role: UserRole.COMPUTATIONAL_CHEMIST,
      createdAt: '2024-01-01T00:00:00Z'
    },
    signedAt: undefined,
    comment: undefined
  },
  {
    id: 'approval-2',
    taskId: 'task-2',
    task: mockTasks[1],
    level: 2,
    status: ApprovalStatus.PENDING,
    approverId: 'user-2',
    approver: {
      id: 'user-2',
      username: '李四',
      email: 'lisi@example.com',
      role: UserRole.MEDICINAL_CHEMIST,
      createdAt: '2024-01-01T00:00:00Z'
    },
    signedAt: undefined,
    comment: undefined
  },
  {
    id: 'approval-3',
    taskId: 'task-1',
    task: mockTasks[0],
    level: 2,
    status: ApprovalStatus.APPROVED,
    approverId: 'user-2',
    approver: {
      id: 'user-2',
      username: '李四',
      email: 'lisi@example.com',
      role: UserRole.MEDICINAL_CHEMIST,
      createdAt: '2024-01-01T00:00:00Z'
    },
    signedAt: new Date(Date.now() - 20 * 3600000).toISOString(),
    comment: '预测结果可靠，同意进入合成阶段'
  }
];

export const useApprovalStore = defineStore('approval', () => {
  const approvals = ref<Approval[]>([]);
  const pendingCount = ref(0);
  const loading = ref(false);

  const pendingApprovals = computed(() => approvals.value.filter(a => a.status === ApprovalStatus.PENDING));
  const level1Approvals = computed(() => approvals.value.filter(a => a.level === 1));
  const level2Approvals = computed(() => approvals.value.filter(a => a.level === 2));

  const fetchApprovals = async (params?: { page?: number; size?: number; status?: string; taskId?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    loading.value = true;
    try {
      const response: PaginatedResponse<Approval> = await approvalsApi.list(params);
      approvals.value = response.items;
      await fetchPendingCount();
      return response;
    } catch (error) {
      console.warn('Using mock approvals data:', error);
      approvals.value = mockApprovals;
      pendingCount.value = mockApprovals.filter(a => a.status === ApprovalStatus.PENDING).length;
      return {
        items: mockApprovals,
        total: mockApprovals.length,
        page: params?.page || 1,
        size: params?.size || 10,
        totalPages: Math.ceil(mockApprovals.length / (params?.size || 10))
      };
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
    pendingApprovals,
    level1Approvals,
    level2Approvals,
    fetchApprovals,
    fetchPendingCount,
    submitApproval,
    processApproval
  };
});
