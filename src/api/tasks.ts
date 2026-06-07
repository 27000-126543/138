import { apiClient } from './client';
import type {
  SimulationTask,
  MonitoringData,
  Alert,
  FreeEnergyResult,
  SimulationLog,
  Report,
  PaginatedResponse,
  TaskListFilters,
  CreateTaskRequest
} from '@shared/types';

export const tasksApi = {
  list: (params?: TaskListFilters & { page?: number; size?: number }) => {
    return apiClient.get<PaginatedResponse<SimulationTask>>('/tasks', { params });
  },

  create: (data: CreateTaskRequest) => {
    return apiClient.post<SimulationTask>('/tasks', data);
  },

  get: (id: string) => {
    return apiClient.get<SimulationTask>(`/tasks/${id}`);
  },

  update: (id: string, data: Partial<SimulationTask>) => {
    return apiClient.put<SimulationTask>(`/tasks/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete<void>(`/tasks/${id}`);
  },

  start: (id: string) => {
    return apiClient.post<SimulationTask>(`/tasks/${id}/start`);
  },

  pause: (id: string) => {
    return apiClient.post<SimulationTask>(`/tasks/${id}/pause`);
  },

  restart: (id: string) => {
    return apiClient.post<SimulationTask>(`/tasks/${id}/restart`);
  },

  getMonitoring: (taskId: string, params?: { limit?: number; from?: string }) => {
    return apiClient.get<MonitoringData[]>(`/tasks/${taskId}/monitoring`, { params });
  },

  getAlerts: (taskId: string, params?: { page?: number; size?: number }) => {
    return apiClient.get<Alert[]>(`/tasks/${taskId}/alerts`, { params });
  },

  getResult: (taskId: string) => {
    return apiClient.get<FreeEnergyResult>(`/tasks/${taskId}/result`);
  },

  getLogs: (taskId: string, params?: { level?: string; limit?: number }) => {
    return apiClient.get<SimulationLog[]>(`/tasks/${taskId}/logs`, { params });
  },

  generateReport: (taskId: string) => {
    return apiClient.post<Report>(`/tasks/${taskId}/report`);
  },

  exportTrajectory: (taskId: string) => {
    return apiClient.get<{ url: string; filename: string }>(`/tasks/${taskId}/export/trajectory`);
  },

  exportComponents: (taskId: string) => {
    return apiClient.get<{ url: string; filename: string }>(`/tasks/${taskId}/export/components`);
  },

  uploadFiles: (taskId: string, formData: FormData) => {
    return apiClient.upload<{ proteinFilePath: string; ligandFilePath: string }>(
      `/tasks/${taskId}/upload`,
      formData
    );
  },

  advanceState: (taskId: string) => {
    return apiClient.post<{
      task: SimulationTask;
      currentState: string;
      advanced: boolean;
      message: string;
    }>(`/tasks/${taskId}/advance-state`);
  },

  getStateTransitionHistory: (taskId: string) => {
    return apiClient.get<{
      currentState: string;
      statusFlow: { status: string; timestamp: string }[];
      logs: SimulationLog[];
    }>(`/tasks/${taskId}/state-history`);
  }
};

export default tasksApi;
