import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import type {
  SimulationTask,
  MonitoringData,
  Alert,
  FreeEnergyResult,
  TaskListFilters,
  PaginatedResponse,
  Report,
  CreateTaskRequest,
  BindingSite,
  InteractionFingerprint
} from '@shared/types';
import { SimulationStatus, FEMethod, UserRole } from '@shared/types';
import { tasksApi } from '../api/tasks';

const mockTargets = [
  { id: 'target-1', name: 'EGFR', description: '表皮生长因子受体', isPaused: false, consecutiveDeviations: 0 },
  { id: 'target-2', name: 'BRD4', description: 'Bromodomain-containing protein 4', isPaused: false, consecutiveDeviations: 0 },
  { id: 'target-3', name: 'CDK2', description: 'Cyclin-dependent kinase 2', isPaused: false, consecutiveDeviations: 0 },
  { id: 'target-4', name: 'KRAS G12D', description: 'KRAS proto-oncogene G12D mutant', isPaused: false, consecutiveDeviations: 0 },
  { id: 'target-5', name: 'HER2', description: 'Human epidermal growth factor receptor 2', isPaused: false, consecutiveDeviations: 0 }
];

const mockUsers = [
  { id: 'user-1', username: '张三', email: 'zhangsan@example.com', role: UserRole.COMPUTATIONAL_CHEMIST, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'user-2', username: '李四', email: 'lisi@example.com', role: UserRole.MEDICINAL_CHEMIST, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'user-3', username: '王五', email: 'wangwu@example.com', role: UserRole.SYNTHESIS_TEAM, createdAt: '2024-01-01T00:00:00Z' }
];

const mockTaskNames = [
  'EGFR 抑制剂 Gefitinib 结合自由能计算',
  'BRAF V600E 突变体抑制剂筛选',
  'KRAS G12C 共价抑制剂优化',
  'HER2 双特异性抗体设计',
  'CDK4/6 抑制剂耐药机制研究',
  'EGFR 第三代抑制剂 AZD9291 类似物',
  'BRAF 二聚体抑制剂设计',
  'KRAS 野生型抑制剂开发',
  'HER2 抗体药物偶联物研究',
  'CDK4 选择性抑制剂优化'
];

const forceFields = ['amber14SB', 'charmm36', 'oplsaa', 'amber99SB', 'gromos54a7'];
const feMethods = [FEMethod.FEP, FEMethod.TI, FEMethod.MMPBSA];
const statuses = Object.values(SimulationStatus);

const generateMockTask = (index: number): SimulationTask => {
  const target = mockTargets[index % mockTargets.length];
  const creator = mockUsers[index % mockUsers.length];
  const assignee = mockUsers[(index + 1) % mockUsers.length];
  const status = statuses[index % statuses.length];
  const progress = status === SimulationStatus.COMPLETED ? 100 :
    status === SimulationStatus.PENDING_VALIDATION ? 0 :
    Math.floor(Math.random() * 80) + 10;

  const bindingSite: BindingSite = {
    residues: [721, 723, 725, 726, 728, 729, 730, 731, 733, 734],
    center: { x: 12.5, y: 45.2, z: -32.1 },
    radius: 12,
    method: 'pocket'
  };

  return {
    id: `task-${index + 1}`,
    name: mockTaskNames[index % mockTaskNames.length],
    targetId: target.id,
    target: target,
    createdBy: creator.id,
    creator: creator,
    assignedTo: assignee.id,
    assignee: assignee,
    status: status,
    forceField: forceFields[index % forceFields.length],
    temperature: 300 + Math.random() * 10,
    saltConcentration: 0.15,
    feMethod: feMethods[index % feMethods.length],
    rmsdThreshold: 2.0 + Math.random() * 1.0,
    progress: progress,
    currentStep: status === SimulationStatus.FEP_CALCULATION ? `lambda window ${Math.floor(Math.random() * 12) + 1}/12` : undefined,
    estimatedTime: Math.floor(3600 + Math.random() * 7200),
    proteinFilePath: undefined,
    ligandFilePath: undefined,
    bindingSite: bindingSite,
    createdAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(),
    startedAt: status !== SimulationStatus.PENDING_VALIDATION ? new Date(Date.now() - index * 24 * 60 * 60 * 1000 + 3600000).toISOString() : undefined,
    completedAt: status === SimulationStatus.COMPLETED ? new Date(Date.now() - index * 24 * 60 * 60 * 1000 + 7200000).toISOString() : undefined,
    retryCount: Math.floor(Math.random() * 3),
    lastError: status === SimulationStatus.ERROR_ROLLBACK ? 'RMSD 偏离阈值超过 3 倍，自动回退到能量最小化阶段' : undefined
  };
};

const mockTasks: SimulationTask[] = Array.from({ length: 10 }, (_, i) => generateMockTask(i));

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<SimulationTask[]>([]);
  const currentTask = ref<SimulationTask | null>(null);
  const monitoringData = ref<MonitoringData[]>([]);
  const alerts = ref<Alert[]>([]);
  const filters = reactive<TaskListFilters>({});
  const pagination = reactive({
    page: 1,
    size: 10,
    total: 0,
    totalPages: 0
  });
  const loading = ref(false);

  const pendingCount = computed(() => tasks.value.filter(t => t.status === SimulationStatus.PENDING_VALIDATION).length);
  const runningCount = computed(() => tasks.value.filter(t =>
    t.status === SimulationStatus.SYSTEM_BUILDING ||
    t.status === SimulationStatus.ENERGY_MINIMIZATION ||
    t.status === SimulationStatus.EQUILIBRATION ||
    t.status === SimulationStatus.FEP_CALCULATION
  ).length);
  const completedCount = computed(() => tasks.value.filter(t => t.status === SimulationStatus.COMPLETED).length);

  const fetchTasks = async (params?: TaskListFilters & { page?: number; size?: number }) => {
    loading.value = true;
    try {
      if (params) {
        Object.assign(filters, params);
        if (params.page) pagination.page = params.page;
        if (params.size) pagination.size = params.size;
      }
      const response: PaginatedResponse<SimulationTask> = await tasksApi.list({
        ...filters,
        page: pagination.page,
        size: pagination.size
      });
      tasks.value = response.items;
      pagination.total = response.total;
      pagination.totalPages = response.totalPages;
      return response;
    } catch (error) {
      console.warn('Using mock tasks data:', error);
      tasks.value = mockTasks;
      pagination.total = mockTasks.length;
      pagination.totalPages = Math.ceil(mockTasks.length / pagination.size);
      return {
        items: mockTasks,
        total: mockTasks.length,
        page: pagination.page,
        size: pagination.size,
        totalPages: Math.ceil(mockTasks.length / pagination.size)
      };
    } finally {
      loading.value = false;
    }
  };

  const fetchTask = async (id: string) => {
    loading.value = true;
    try {
      const response = await tasksApi.get(id);
      currentTask.value = response;
      return response;
    } catch (error) {
      console.warn('Using mock task detail:', error);
      const mockTask = mockTasks.find(t => t.id === id) || mockTasks[0];
      currentTask.value = mockTask;
      return mockTask;
    } finally {
      loading.value = false;
    }
  };

  const createTask = async (data: CreateTaskRequest) => {
    loading.value = true;
    try {
      const response = await tasksApi.create(data);
      await fetchTasks();
      return response;
    } finally {
      loading.value = false;
    }
  };

  const startTask = async (id: string) => {
    loading.value = true;
    try {
      const response = await tasksApi.start(id);
      if (currentTask.value?.id === id) {
        currentTask.value = response;
      }
      await fetchTasks();
      return response;
    } finally {
      loading.value = false;
    }
  };

  const pauseTask = async (id: string) => {
    loading.value = true;
    try {
      const response = await tasksApi.pause(id);
      if (currentTask.value?.id === id) {
        currentTask.value = response;
      }
      await fetchTasks();
      return response;
    } finally {
      loading.value = false;
    }
  };

  const restartTask = async (id: string) => {
    loading.value = true;
    try {
      const response = await tasksApi.restart(id);
      if (currentTask.value?.id === id) {
        currentTask.value = response;
      }
      await fetchTasks();
      return response;
    } finally {
      loading.value = false;
    }
  };

  const fetchMonitoringData = async (taskId: string) => {
    try {
      const response = await tasksApi.getMonitoring(taskId);
      monitoringData.value = response;
      return response;
    } catch (error) {
      console.warn('Using mock monitoring data:', error);
      const mockData: MonitoringData[] = Array.from({ length: 50 }, (_, i) => ({
        taskId,
        timestamp: new Date(Date.now() - (50 - i) * 2000).toISOString(),
        rmsd: 1.5 + Math.sin(i * 0.3) * 0.3 + Math.random() * 0.2,
        potentialEnergy: -8000 + Math.sin(i * 0.2) * 200 + Math.random() * 50,
        temperature: 300 + Math.sin(i * 0.25) * 3 + Math.random() * 1,
        pressure: 1.0 + Math.random() * 0.1,
        volume: 100000 + Math.random() * 1000
      }));
      monitoringData.value = mockData;
      return mockData;
    }
  };

  const fetchAlerts = async (taskId: string) => {
    try {
      const response = await tasksApi.getAlerts(taskId);
      alerts.value = response;
      return response;
    } catch (error) {
      alerts.value = [];
      throw error;
    }
  };

  const fetchResult = async (taskId: string): Promise<FreeEnergyResult | null> => {
    try {
      const response = await tasksApi.getResult(taskId);
      return response;
    } catch (error) {
      console.warn('Using mock result data:', error);
      const energyComponents = [
        { name: '范德华力', value: -6.5, error: 0.2 },
        { name: '静电作用', value: -4.2, error: 0.3 },
        { name: '溶剂化自由能', value: 3.8, error: 0.25 },
        { name: '熵贡献', value: 2.1, error: 0.15 }
      ];

      const decompositionPerResidue = Array.from({ length: 20 }, (_, i) => ({
        residueNumber: 700 + i,
        residueName: ['ALA', 'SER', 'THR', 'VAL', 'LEU', 'ILE', 'PHE', 'TYR', 'TRP', 'ASP'][i % 10],
        energyContribution: -2.0 + Math.random() * 3,
        interactionType: ['hydrogen_bond', 'hydrophobic', 'pi_stacking', 'salt_bridge'][i % 4]
      }));

      const interactionFingerprint: InteractionFingerprint = {};
      for (let i = 0; i < 20; i++) {
        const residueKey = `${['ALA', 'SER', 'THR', 'VAL', 'LEU', 'ILE', 'PHE', 'TYR', 'TRP', 'ASP'][i % 10]}${700 + i}`;
        interactionFingerprint[residueKey] = {
          hydrogenBond: Math.floor(Math.random() * 5),
          hydrophobic: Math.floor(Math.random() * 8),
          piStacking: Math.floor(Math.random() * 3),
          saltBridge: Math.floor(Math.random() * 2),
          vanDerWaals: Math.floor(Math.random() * 6)
        };
      }

      return {
        id: `result-${taskId}`,
        taskId,
        method: FEMethod.FEP,
        totalBindingEnergy: -8.5 + Math.random() * 3,
        standardError: 0.3 + Math.random() * 0.5,
        energyComponents,
        decompositionPerResidue,
        interactionFingerprint,
        calculatedAt: new Date().toISOString()
      };
    }
  };

  const generateReport = async (taskId: string): Promise<Report> => {
    loading.value = true;
    try {
      const response = await tasksApi.generateReport(taskId);
      return response;
    } finally {
      loading.value = false;
    }
  };

  const updateTaskStatus = (taskId: string, status: SimulationTask['status'], progress: number) => {
    const task = tasks.value.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      task.progress = progress;
    }
    if (currentTask.value?.id === taskId) {
      currentTask.value.status = status;
      currentTask.value.progress = progress;
    }
  };

  const addMonitoringData = (data: MonitoringData) => {
    monitoringData.value.push(data);
    if (monitoringData.value.length > 1000) {
      monitoringData.value = monitoringData.value.slice(-1000);
    }
  };

  return {
    tasks,
    currentTask,
    monitoringData,
    alerts,
    filters,
    pagination,
    loading,
    pendingCount,
    runningCount,
    completedCount,
    fetchTasks,
    fetchTask,
    createTask,
    startTask,
    pauseTask,
    restartTask,
    fetchMonitoringData,
    fetchAlerts,
    fetchResult,
    generateReport,
    updateTaskStatus,
    addMonitoringData
  };
});
