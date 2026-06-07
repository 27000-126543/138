import { getDb } from '../db/index.js';
import { statsRepository } from '../repositories/StatsRepository.js';
import { taskRepository } from '../repositories/TaskRepository.js';
import { resultRepository } from '../repositories/ResultRepository.js';
import type { DailyStats, FEMethod } from '../../shared/types.js';

function convertKeysToCamel(obj: unknown): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysToCamel(item));
  }
  const result: Record<string, unknown> = {};
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    result[key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] = convertKeysToCamel(record[key]);
  }
  return result;
}

export interface CompletionRateResult {
  startDate: string;
  endDate: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  completionRate: number;
  byMethod: {
    method: FEMethod;
    total: number;
    completed: number;
    rate: number;
  }[];
}

export interface ResourceConsumptionResult {
  startDate: string;
  endDate: string;
  totalComputeHours: number;
  averageSimulationTime: number;
  totalTasks: number;
  byMethod: {
    method: FEMethod;
    computeHours: number;
    averageTime: number;
    taskCount: number;
  }[];
}

export interface PerformanceTrendPoint {
  date: string;
  method: string;
  averageError: number;
  successRate: number;
  sampleSize: number;
}

export interface AccuracyBoxPlotData {
  method: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export class StatisticsService {
  async generateDailyStats(date: string): Promise<DailyStats> {
    const startDate = date;
    const endDate = date;
    const stats = statsRepository.getDailyStats(startDate, endDate);
    
    if (stats.length === 0) {
      return {
        date,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        completionRate: 0,
        averageError: 0,
        totalComputeHours: 0,
        averageSimulationTime: 0,
        alertsGenerated: 0,
        approvalsProcessed: 0
      };
    }

    return stats[0];
  }

  async getCompletionRate(startDate: string, endDate: string): Promise<CompletionRateResult> {
    const dailyStats = statsRepository.getDailyStats(startDate, endDate);
    
    let totalTasks = 0;
    let completedTasks = 0;
    let failedTasks = 0;

    for (const stat of dailyStats) {
      totalTasks += stat.totalTasks;
      completedTasks += stat.completedTasks;
      failedTasks += stat.failedTasks;
    }

    const db = getDb();
    const tasksRaw = db.prepare(
      `SELECT fe_method as feMethod, status FROM simulation_tasks WHERE DATE(created_at) BETWEEN ? AND ?`
    ).all(startDate, endDate) as { feMethod: string; status: string }[];

    const tasks = convertKeysToCamel(tasksRaw);

    const methodCounts = new Map<string, { total: number; completed: number }>();
    
    for (const task of tasks) {
      const method = task.feMethod as FEMethod;
      if (!methodCounts.has(method)) {
        methodCounts.set(method, { total: 0, completed: 0 });
      }
      const counts = methodCounts.get(method)!;
      counts.total++;
      if (task.status === 'completed') {
        counts.completed++;
      }
    }

    const byMethod = Array.from(methodCounts.entries()).map(([method, counts]) => ({
      method: method as FEMethod,
      total: counts.total,
      completed: counts.completed,
      rate: counts.total > 0 ? (counts.completed / counts.total) * 100 : 0
    }));

    return {
      startDate,
      endDate,
      totalTasks,
      completedTasks,
      failedTasks,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      byMethod
    };
  }

  async getAveragePredictionError(startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    overallAverageError: number;
    byMethod: {
      method: FEMethod;
      averageError: number;
      sampleSize: number;
    }[];
  }> {
    const db = getDb();
    const resultsRaw = db.prepare(
      `SELECT r.method, r.standard_error as standardError FROM free_energy_results r
       JOIN simulation_tasks t ON r.task_id = t.id
       WHERE DATE(r.calculated_at) BETWEEN ? AND ?`
    ).all(startDate, endDate) as { method: string; standardError: number }[];

    const results = convertKeysToCamel(resultsRaw);

    if (results.length === 0) {
      return {
        startDate,
        endDate,
        overallAverageError: 0,
        byMethod: []
      };
    }

    const overallAverageError = results.reduce((sum, r) => sum + r.standardError, 0) / results.length;

    const methodErrors = new Map<string, { total: number; count: number }>();
    
    for (const result of results) {
      const method = result.method as FEMethod;
      if (!methodErrors.has(method)) {
        methodErrors.set(method, { total: 0, count: 0 });
      }
      const errors = methodErrors.get(method)!;
      errors.total += result.standardError;
      errors.count++;
    }

    const byMethod = Array.from(methodErrors.entries()).map(([method, errors]) => ({
      method: method as FEMethod,
      averageError: errors.count > 0 ? errors.total / errors.count : 0,
      sampleSize: errors.count
    }));

    return {
      startDate,
      endDate,
      overallAverageError,
      byMethod
    };
  }

  async getResourceConsumption(startDate: string, endDate: string): Promise<ResourceConsumptionResult> {
    const dailyStats = statsRepository.getDailyStats(startDate, endDate);
    
    let totalComputeHours = 0;
    let totalTasks = 0;
    let totalSimulationTime = 0;

    for (const stat of dailyStats) {
      totalComputeHours += stat.totalComputeHours;
      totalTasks += stat.totalTasks;
      if (stat.averageSimulationTime > 0) {
        totalSimulationTime += stat.averageSimulationTime * stat.completedTasks;
      }
    }

    const db = getDb();
    const tasksRaw = db.prepare(
      `SELECT fe_method as feMethod, started_at as startedAt, completed_at as completedAt FROM simulation_tasks 
       WHERE DATE(created_at) BETWEEN ? AND ? 
       AND completed_at IS NOT NULL 
       AND started_at IS NOT NULL`
    ).all(startDate, endDate) as { feMethod: string; startedAt: string; completedAt: string }[];

    const tasks = convertKeysToCamel(tasksRaw);

    const methodResources = new Map<string, { totalHours: number; count: number }>();
    
    for (const task of tasks) {
      const method = task.feMethod as FEMethod;
      const hours = (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / (1000 * 60 * 60);
      
      if (!methodResources.has(method)) {
        methodResources.set(method, { totalHours: 0, count: 0 });
      }
      const resources = methodResources.get(method)!;
      resources.totalHours += hours;
      resources.count++;
    }

    const byMethod = Array.from(methodResources.entries()).map(([method, resources]) => ({
      method: method as FEMethod,
      computeHours: resources.totalHours,
      averageTime: resources.count > 0 ? resources.totalHours / resources.count : 0,
      taskCount: resources.count
    }));

    return {
      startDate,
      endDate,
      totalComputeHours,
      averageSimulationTime: totalTasks > 0 ? totalSimulationTime / totalTasks : 0,
      totalTasks,
      byMethod
    };
  }

  async getPerformanceTrendData(days: number = 30): Promise<PerformanceTrendPoint[]> {
    const trendData = statsRepository.getPerformanceTrend(days);
    return trendData as PerformanceTrendPoint[];
  }

  async getAccuracyBoxPlotData(method?: string): Promise<AccuracyBoxPlotData[]> {
    return statsRepository.getAccuracyBoxPlotData(method) as AccuracyBoxPlotData[];
  }

  async getMethodComparison(startDate: string, endDate: string): Promise<{
    method: FEMethod;
    taskCount: number;
    completionRate: number;
    averageError: number;
    averageComputeTime: number;
    successRate: number;
  }[]> {
    const db = getDb();
    const tasksRaw = db.prepare(
      `SELECT fe_method as feMethod, status, started_at as startedAt, completed_at as completedAt FROM simulation_tasks WHERE DATE(created_at) BETWEEN ? AND ?`
    ).all(startDate, endDate) as { feMethod: string; status: string; startedAt?: string; completedAt?: string }[];

    const resultsRaw = db.prepare(
      `SELECT r.method, r.standard_error as standardError, r.task_id as taskId FROM free_energy_results r
       JOIN simulation_tasks t ON r.task_id = t.id
       WHERE DATE(r.calculated_at) BETWEEN ? AND ?`
    ).all(startDate, endDate) as { taskId: string; method: string; standardError: number }[];

    const tasks = convertKeysToCamel(tasksRaw);
    const results = convertKeysToCamel(resultsRaw);

    const methodStats = new Map<string, {
      taskCount: number;
      completed: number;
      totalError: number;
      errorCount: number;
      totalComputeTime: number;
      computeCount: number;
      successCount: number;
    }>();

    for (const task of tasks) {
      const method = task.feMethod as FEMethod;
      if (!methodStats.has(method)) {
        methodStats.set(method, {
          taskCount: 0,
          completed: 0,
          totalError: 0,
          errorCount: 0,
          totalComputeTime: 0,
          computeCount: 0,
          successCount: 0
        });
      }
      const stats = methodStats.get(method)!;
      stats.taskCount++;
      
      if (task.status === 'completed') {
        stats.completed++;
        stats.successCount++;
        
        if (task.startedAt && task.completedAt) {
          const hours = (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / (1000 * 60 * 60);
          stats.totalComputeTime += hours;
          stats.computeCount++;
        }
      }
    }

    for (const result of results) {
      const method = result.method as FEMethod;
      if (methodStats.has(method)) {
        const stats = methodStats.get(method)!;
        stats.totalError += result.standardError;
        stats.errorCount++;
      }
    }

    return Array.from(methodStats.entries()).map(([method, stats]) => ({
      method: method as FEMethod,
      taskCount: stats.taskCount,
      completionRate: stats.taskCount > 0 ? (stats.completed / stats.taskCount) * 100 : 0,
      averageError: stats.errorCount > 0 ? stats.totalError / stats.errorCount : 0,
      averageComputeTime: stats.computeCount > 0 ? stats.totalComputeTime / stats.computeCount : 0,
      successRate: stats.taskCount > 0 ? (stats.successCount / stats.taskCount) * 100 : 0
    }));
  }
}

export const statisticsService = new StatisticsService();
