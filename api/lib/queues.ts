import { simulationQueue, reportQueue, statsQueue, alertQueue } from '../worker/queues.js';
import type { SimulationTask } from '../../shared/types.js';

export interface SimulationJobData {
  taskId: string;
  task?: SimulationTask;
  skipValidation?: boolean;
}

export interface ReportJobData {
  taskId: string;
  generatePDF?: boolean;
  exportTrajectory?: boolean;
  exportFormat?: 'csv' | 'json' | 'pdb';
  notifyUsers?: string[];
}

export interface StatsJobData {
  date?: string;
  type: 'daily' | 'performance' | 'deviation';
  days?: number;
}

export interface AlertJobData {
  taskId: string;
  alertId: string;
  level: string;
  message: string;
  notifyChannels: ('email' | 'socket' | 'inapp')[];
}

export const addSimulationTask = async (
  data: SimulationJobData,
  options?: { priority?: number; delay?: number }
): Promise<string> => {
  const job = await simulationQueue.add('simulation', data, {
    priority: options?.priority || 10,
    delay: options?.delay || 0,
    jobId: `simulation-${data.taskId}`,
  });
  return job.id as string;
};

export const addReportTask = async (
  data: ReportJobData,
  options?: { priority?: number; delay?: number }
): Promise<string> => {
  const job = await reportQueue.add('report', data, {
    priority: options?.priority || 20,
    delay: options?.delay || 0,
    jobId: `report-${data.taskId}-${Date.now()}`,
  });
  return job.id as string;
};

export const addStatsTask = async (
  data: StatsJobData,
  options?: { priority?: number; delay?: number }
): Promise<string> => {
  const jobId = data.date ? `stats-${data.type}-${data.date}` : `stats-${data.type}-${Date.now()}`;
  const job = await statsQueue.add(data.type, data, {
    priority: options?.priority || 30,
    delay: options?.delay || 0,
    jobId,
    repeat: data.type === 'daily' ? {
      pattern: '0 0 2 * * *',
    } : undefined,
  });
  return job.id as string;
};

export const addAlertTask = async (
  data: AlertJobData,
  options?: { priority?: number; delay?: number }
): Promise<string> => {
  const job = await alertQueue.add('alert', data, {
    priority: options?.priority || 5,
    delay: options?.delay || 0,
    jobId: `alert-${data.alertId}`,
  });
  return job.id as string;
};

export const getSimulationJobStatus = async (taskId: string) => {
  const job = await simulationQueue.getJob(`simulation-${taskId}`);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;

  return {
    jobId: job.id,
    state,
    progress,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
};

export const cancelSimulationJob = async (taskId: string): Promise<boolean> => {
  const job = await simulationQueue.getJob(`simulation-${taskId}`);
  if (!job) return false;

  const state = await job.getState();
  if (state === 'completed' || state === 'failed') return false;

  await job.remove();
  return true;
};

export const getQueueStats = async () => {
  const [simulationStats, reportStats, statsStats, alertStats] = await Promise.all([
    simulationQueue.getJobCounts(),
    reportQueue.getJobCounts(),
    statsQueue.getJobCounts(),
    alertQueue.getJobCounts(),
  ]);

  return {
    simulation: simulationStats,
    report: reportStats,
    stats: statsStats,
    alert: alertStats,
  };
};

export const pauseSimulationQueue = async (): Promise<void> => {
  await simulationQueue.pause();
};

export const resumeSimulationQueue = async (): Promise<void> => {
  await simulationQueue.resume();
};
