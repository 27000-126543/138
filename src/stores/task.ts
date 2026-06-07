import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import type {
  SimulationTask,
  MonitoringData,
  Alert,
  FreeEnergyResult,
  TaskListFilters,
  PaginatedResponse,
  Report,
  CreateTaskRequest
} from '@shared/types';
import { tasksApi } from '../api/tasks';

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
      monitoringData.value = [];
      throw error;
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
    } catch {
      return null;
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
