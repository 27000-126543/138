import { nanoid } from 'nanoid';
import { alertRepository } from '../repositories/AlertRepository.js';
import { monitoringRepository } from '../repositories/MonitoringRepository.js';
import { taskRepository } from '../repositories/TaskRepository.js';
import { getSocket } from '../lib/socket.js';
import type { MonitoringData, Alert, SimulationTask } from '../../shared/types.js';
import { AlertLevel, SimulationStatus } from '../../shared/types.js';
import { config } from '../config/index.js';

export interface MonitoringCheckResult {
  hasAnomaly: boolean;
  alerts: Alert[];
  metrics: {
    rmsd?: { value: number; threshold: number; deviation: number };
    energyJump?: { current: number; previous: number; difference: number; threshold: number };
    temperature?: { variance: number; threshold: number; values: number[] };
  };
}

export interface AlertConfig {
  rmsdWarningThreshold: number;
  rmsdCriticalThreshold: number;
  energyJumpThreshold: number;
  temperatureVarianceThreshold: number;
}

export type MetricType = 'rmsd' | 'potentialEnergy' | 'temperature' | 'pressure' | 'volume';

export class MonitoringService {
  private readonly defaultConfig: AlertConfig;
  private taskConfigs: Map<string, AlertConfig> = new Map();
  private recentData: Map<string, MonitoringData[]> = new Map();
  private readonly maxRecentData = 100;

  constructor() {
    this.defaultConfig = {
      rmsdWarningThreshold: config.monitoring.rmsdWarningThreshold,
      rmsdCriticalThreshold: config.monitoring.rmsdCriticalThreshold,
      energyJumpThreshold: config.monitoring.energyJumpThreshold,
      temperatureVarianceThreshold: config.monitoring.temperatureVarianceThreshold,
    };
  }

  setTaskConfig(taskId: string, config: Partial<AlertConfig>): void {
    const existing = this.taskConfigs.get(taskId) || { ...this.defaultConfig };
    this.taskConfigs.set(taskId, { ...existing, ...config });
  }

  getTaskConfig(taskId: string): AlertConfig {
    return this.taskConfigs.get(taskId) || this.defaultConfig;
  }

  processMonitoringData(taskId: string, data: MonitoringData): MonitoringCheckResult {
    this.addRecentData(taskId, data);
    
    const task = taskRepository.findById(taskId);
    const threshold = task?.rmsdThreshold || config.simulation.defaultRmsdThreshold;
    const taskConfig = this.getTaskConfig(taskId);
    
    const alerts: Alert[] = [];
    const metrics: MonitoringCheckResult['metrics'] = {};

    const rmsdResult = this.checkRMSDThreshold(data.rmsd, threshold);
    if (rmsdResult.exceeded) {
      metrics.rmsd = {
        value: data.rmsd,
        threshold,
        deviation: rmsdResult.deviation,
      };
      
      const level = this.getAlertLevel('rmsd', rmsdResult.deviation);
      const alert = this.createAlert(
        taskId,
        level,
        'rmsd_threshold',
        `RMSD exceeded threshold: ${data.rmsd.toFixed(3)} > ${threshold.toFixed(3)} Å`,
        'rmsd',
        data.rmsd,
        threshold
      );
      alerts.push(alert);
    }

    const recentData = this.getRecentData(taskId);
    if (recentData.length >= 2) {
      const previousData = recentData[recentData.length - 2];
      const energyResult = this.checkEnergyJump(
        data.potentialEnergy,
        previousData.potentialEnergy,
        taskConfig.energyJumpThreshold
      );
      
      if (energyResult.exceeded) {
        metrics.energyJump = {
          current: data.potentialEnergy,
          previous: previousData.potentialEnergy,
          difference: energyResult.difference,
          threshold: taskConfig.energyJumpThreshold,
        };
        
        const level = this.getAlertLevel('potentialEnergy', Math.abs(energyResult.difference) / taskConfig.energyJumpThreshold);
        const alert = this.createAlert(
          taskId,
          level,
          'energy_jump',
          `Energy jump detected: ${energyResult.difference.toFixed(1)} kJ/mol`,
          'potentialEnergy',
          data.potentialEnergy,
          taskConfig.energyJumpThreshold
        );
        alerts.push(alert);
      }
    }

    if (recentData.length >= 10) {
      const recentTemperatures = recentData.slice(-10).map(d => d.temperature);
      const tempResult = this.checkTemperatureStability(
        recentTemperatures,
        taskConfig.temperatureVarianceThreshold
      );
      
      if (tempResult.exceeded) {
        metrics.temperature = {
          variance: tempResult.variance,
          threshold: taskConfig.temperatureVarianceThreshold,
          values: recentTemperatures,
        };
        
        const level = this.getAlertLevel('temperature', tempResult.variance / taskConfig.temperatureVarianceThreshold);
        const alert = this.createAlert(
          taskId,
          level,
          'temperature_unstable',
          `Temperature instability detected: variance = ${tempResult.variance.toFixed(2)} K²`,
          'temperature',
          data.temperature,
          taskConfig.temperatureVarianceThreshold
        );
        alerts.push(alert);
      }
    }

    if (alerts.length > 0) {
      const io = getSocket();
      io.emit('monitoring:alert', {
        taskId,
        alerts,
        data,
        timestamp: new Date().toISOString(),
      });

      const hasCriticalOrFatal = alerts.some(
        a => a.level === AlertLevel.CRITICAL || a.level === AlertLevel.FATAL
      );
      
      if (hasCriticalOrFatal && task) {
        const consecutiveDeviations = (task as any).consecutiveDeviations || 0;
        const newConsecutiveDeviations = consecutiveDeviations + 1;
        
        if (newConsecutiveDeviations >= config.simulation.maxConsecutiveDeviations) {
          taskRepository.updateStatus(taskId, SimulationStatus.ERROR_ROLLBACK);
          taskRepository.incrementRetry(taskId, 'Multiple critical alerts detected');
          
          io.emit('task:pause', {
            taskId,
            reason: 'Multiple critical alerts detected',
            timestamp: new Date().toISOString(),
          });
        } else {
          taskRepository.update(taskId, {
            consecutiveDeviations: newConsecutiveDeviations,
            lastDeviationCheck: new Date().toISOString(),
          } as Partial<SimulationTask>);
        }
      }
    }

    return {
      hasAnomaly: alerts.length > 0,
      alerts,
      metrics,
    };
  }

  checkRMSDThreshold(value: number, threshold: number): { exceeded: boolean; deviation: number } {
    const deviation = value - threshold;
    return {
      exceeded: value > threshold,
      deviation: Math.max(0, deviation),
    };
  }

  checkEnergyJump(
    current: number,
    previous: number,
    threshold: number
  ): { exceeded: boolean; difference: number } {
    const difference = current - previous;
    return {
      exceeded: Math.abs(difference) > threshold,
      difference,
    };
  }

  checkTemperatureStability(
    values: number[],
    threshold: number
  ): { exceeded: boolean; variance: number; mean: number } {
    if (values.length < 2) {
      return { exceeded: false, variance: 0, mean: 0 };
    }

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

    return {
      exceeded: variance > threshold,
      variance,
      mean,
    };
  }

  createAlert(
    taskId: string,
    level: AlertLevel,
    type: string,
    message: string,
    metric?: string,
    value?: number,
    threshold?: number
  ): Alert {
    const alert: Alert = {
      id: nanoid(12),
      taskId,
      level,
      type,
      message,
      metric,
      value,
      threshold,
      timestamp: new Date().toISOString(),
    };

    alertRepository.create(alert);
    
    return alert;
  }

  getAlertLevel(metric: MetricType | string, deviation: number): AlertLevel {
    if (deviation >= 2.0) {
      return AlertLevel.FATAL;
    } else if (deviation >= 1.5) {
      return AlertLevel.CRITICAL;
    } else if (deviation >= 1.0) {
      return AlertLevel.WARNING;
    } else {
      return AlertLevel.INFO;
    }
  }

  private addRecentData(taskId: string, data: MonitoringData): void {
    const dataArray = this.recentData.get(taskId) || [];
    dataArray.push(data);
    
    if (dataArray.length > this.maxRecentData) {
      dataArray.shift();
    }
    
    this.recentData.set(taskId, dataArray);
  }

  getRecentData(taskId: string): MonitoringData[] {
    return this.recentData.get(taskId) || [];
  }

  clearRecentData(taskId: string): void {
    this.recentData.delete(taskId);
  }

  async getTaskMonitoringSummary(taskId: string): Promise<{
    latestData?: MonitoringData;
    dataCount: number;
    alertCount: number;
    unreviewedAlertCount: number;
    avgRMSD: number;
    avgEnergy: number;
    avgTemperature: number;
  }> {
    const latestData = monitoringRepository.findLatest(taskId);
    const allData = monitoringRepository.findByTaskId(taskId);
    
    const unreviewedAlerts = alertRepository.findUnreviewed();
    const taskAlerts = unreviewedAlerts.filter(a => a.taskId === taskId);
    
    const avgRMSD = allData.length > 0
      ? allData.reduce((sum, d) => sum + d.rmsd, 0) / allData.length
      : 0;
    
    const avgEnergy = allData.length > 0
      ? allData.reduce((sum, d) => sum + d.potentialEnergy, 0) / allData.length
      : 0;
    
    const avgTemperature = allData.length > 0
      ? allData.reduce((sum, d) => sum + d.temperature, 0) / allData.length
      : 0;

    return {
      latestData,
      dataCount: allData.length,
      alertCount: taskAlerts.length + allData.length / 100,
      unreviewedAlertCount: taskAlerts.length,
      avgRMSD: Math.round(avgRMSD * 1000) / 1000,
      avgEnergy: Math.round(avgEnergy * 10) / 10,
      avgTemperature: Math.round(avgTemperature * 10) / 10,
    };
  }

  detectConvergence(taskId: string, windowSize: number = 50): {
    converged: boolean;
    rmsdTrend: number;
    energyTrend: number;
    temperatureStability: number;
  } {
    const recentData = this.getRecentData(taskId);
    
    if (recentData.length < windowSize * 2) {
      return {
        converged: false,
        rmsdTrend: 0,
        energyTrend: 0,
        temperatureStability: 0,
      };
    }

    const firstHalf = recentData.slice(-windowSize * 2, -windowSize);
    const secondHalf = recentData.slice(-windowSize);

    const firstAvgRMSD = firstHalf.reduce((sum, d) => sum + d.rmsd, 0) / windowSize;
    const secondAvgRMSD = secondHalf.reduce((sum, d) => sum + d.rmsd, 0) / windowSize;
    const rmsdTrend = Math.abs(secondAvgRMSD - firstAvgRMSD);

    const firstAvgEnergy = firstHalf.reduce((sum, d) => sum + d.potentialEnergy, 0) / windowSize;
    const secondAvgEnergy = secondHalf.reduce((sum, d) => sum + d.potentialEnergy, 0) / windowSize;
    const energyTrend = Math.abs(secondAvgEnergy - firstAvgEnergy);

    const temperatures = recentData.slice(-windowSize).map(d => d.temperature);
    const tempMean = temperatures.reduce((sum, v) => sum + v, 0) / temperatures.length;
    const tempVariance = temperatures.reduce((sum, v) => sum + Math.pow(v - tempMean, 2), 0) / temperatures.length;
    const temperatureStability = 1 / (1 + tempVariance);

    const rmsdConverged = rmsdTrend < 0.1;
    const energyConverged = energyTrend < 50;
    const tempConverged = tempVariance < config.monitoring.temperatureVarianceThreshold;

    return {
      converged: rmsdConverged && energyConverged && tempConverged,
      rmsdTrend: Math.round(rmsdTrend * 1000) / 1000,
      energyTrend: Math.round(energyTrend * 10) / 10,
      temperatureStability: Math.round(temperatureStability * 100) / 100,
    };
  }

  calculateStatistics(taskId: string): {
    rmsd: { min: number; max: number; mean: number; std: number };
    potentialEnergy: { min: number; max: number; mean: number; std: number };
    temperature: { min: number; max: number; mean: number; std: number };
  } | null {
    const data = this.getRecentData(taskId);
    if (data.length === 0) return null;

    const calculate = (values: number[]) => {
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      return {
        min: Math.min(...values),
        max: Math.max(...values),
        mean: Math.round(mean * 1000) / 1000,
        std: Math.round(std * 1000) / 1000,
      };
    };

    return {
      rmsd: calculate(data.map(d => d.rmsd)),
      potentialEnergy: calculate(data.map(d => d.potentialEnergy)),
      temperature: calculate(data.map(d => d.temperature)),
    };
  }
}

export const monitoringService = new MonitoringService();
