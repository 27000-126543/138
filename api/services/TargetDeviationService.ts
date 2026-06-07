import { getDb } from '../db/index.js';
import { targetRepository } from '../repositories/TargetRepository.js';
import { taskRepository } from '../repositories/TaskRepository.js';
import { resultRepository } from '../repositories/ResultRepository.js';
import { alertRepository } from '../repositories/AlertRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import type { Target, SimulationTask, FreeEnergyResult, Alert, User } from '../../shared/types.js';
import { AlertLevel, UserRole } from '../../shared/types.js';

export interface DeviationResult {
  taskId: string;
  predictedValue: number;
  experimentalValue: number;
  deviation: number;
  deviationPercentage: number;
  isSignificant: boolean;
  threshold: number;
}

export class TargetDeviationService {
  private readonly DEVIATION_THRESHOLD = 1.0;
  private readonly CONSECUTIVE_DEVIATION_LIMIT = 3;
  private readonly SIGNIFICANT_DEVIATION_PERCENTAGE = 20;

  async calculateDeviation(taskId: string, experimentalValue: number): Promise<DeviationResult> {
    const task = taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const results = resultRepository.findByTaskId(taskId);
    if (results.length === 0) {
      throw new Error('未找到该任务的自由能结果');
    }

    const result = results[0];
    const predictedValue = result.totalBindingEnergy;
    const deviation = Math.abs(predictedValue - experimentalValue);
    const deviationPercentage = (deviation / Math.abs(experimentalValue)) * 100;
    const isSignificant = deviation > this.DEVIATION_THRESHOLD || deviationPercentage > this.SIGNIFICANT_DEVIATION_PERCENTAGE;

    if (isSignificant) {
      await targetRepository.incrementDeviation(task.targetId);
      
      alertRepository.create({
        taskId,
        level: deviation > 2.0 ? AlertLevel.CRITICAL : AlertLevel.WARNING,
        type: 'prediction_deviation',
        message: `预测值与实验值偏差显著: ${deviation.toFixed(2)} kcal/mol (${deviationPercentage.toFixed(1)}%)`,
        metric: 'deviation',
        value: deviation,
        threshold: this.DEVIATION_THRESHOLD,
        timestamp: new Date().toISOString()
      } as Omit<Alert, 'id'>);

      const consecutiveDeviations = await this.checkConsecutiveDeviations(task.targetId);
      if (consecutiveDeviations >= this.CONSECUTIVE_DEVIATION_LIMIT) {
        await this.notifyChiefScientist(task.targetId, consecutiveDeviations);
      }
    } else {
      await targetRepository.resetDeviation(task.targetId);
    }

    return {
      taskId,
      predictedValue,
      experimentalValue,
      deviation,
      deviationPercentage,
      isSignificant,
      threshold: this.DEVIATION_THRESHOLD
    };
  }

  async checkConsecutiveDeviations(targetId: string): Promise<number> {
    const target = targetRepository.findById(targetId);
    if (!target) {
      throw new Error('靶标不存在');
    }

    return target.consecutiveDeviations || 0;
  }

  async pauseTarget(targetId: string, reason: string, pausedBy: string): Promise<Target | undefined> {
    const target = targetRepository.findById(targetId);
    if (!target) {
      throw new Error('靶标不存在');
    }

    if (target.isPaused) {
      throw new Error('该靶标已处于暂停状态');
    }

    const updatedTarget = targetRepository.updatePauseStatus(targetId, true, reason, pausedBy);

    if (updatedTarget) {
      alertRepository.create({
        taskId: '',
        level: AlertLevel.WARNING,
        type: 'target_paused',
        message: `靶标 ${target.name} 已被暂停: ${reason}`,
        timestamp: new Date().toISOString()
      } as Omit<Alert, 'id'>);

      const db = getDb();
      const pendingTasks = db.prepare(
        'SELECT * FROM tasks WHERE targetId = ? AND status NOT IN (?, ?)'
      ).all(targetId, 'completed', 'error_rollback') as SimulationTask[];

      for (const task of pendingTasks) {
        taskRepository.update(task.id, {
          lastError: `靶标已暂停: ${reason}`
        } as Partial<SimulationTask>);
      }
    }

    return updatedTarget;
  }

  async notifyChiefScientist(targetId: string, deviationCount: number): Promise<Alert | undefined> {
    const target = targetRepository.findById(targetId);
    if (!target) {
      throw new Error('靶标不存在');
    }

    const db = getDb();
    const chiefScientists = db.prepare(
      'SELECT * FROM users WHERE role = ?'
    ).all(UserRole.CHIEF_SCIENTIST) as User[];

    const alert = alertRepository.create({
      taskId: '',
      level: AlertLevel.CRITICAL,
      type: 'consecutive_deviations',
      message: `靶标 ${target.name} 已连续 ${deviationCount} 次出现预测偏差，需要人工审核`,
      metric: 'consecutive_deviations',
      value: deviationCount,
      threshold: this.CONSECUTIVE_DEVIATION_LIMIT,
      timestamp: new Date().toISOString()
    } as Omit<Alert, 'id'>);

    if (chiefScientists.length > 0) {
      console.log(`[通知] 已通知首席科学家 ${chiefScientists.map(u => u.username).join(', ')}: 靶标 ${target.name} 连续 ${deviationCount} 次预测偏差`);
    }

    if (deviationCount >= this.CONSECUTIVE_DEVIATION_LIMIT) {
      const autoPauseReason = `连续 ${deviationCount} 次预测偏差超过阈值，系统自动暂停`;
      const systemUser = db.prepare(
        'SELECT * FROM users WHERE role = ? LIMIT 1'
      ).get(UserRole.ADMIN) as User | undefined;
      
      if (systemUser) {
        await this.pauseTarget(targetId, autoPauseReason, systemUser.id);
      }
    }

    return alert;
  }

  async getDeviationHistory(targetId: string, limit: number = 20): Promise<DeviationResult[]> {
    const target = targetRepository.findById(targetId);
    if (!target) {
      throw new Error('靶标不存在');
    }

    const db = getDb();
    const tasks = db.prepare(
      'SELECT * FROM tasks WHERE targetId = ? AND status = ? ORDER BY completedAt DESC LIMIT ?'
    ).all(targetId, 'completed', limit) as SimulationTask[];

    const deviations: DeviationResult[] = [];

    for (const task of tasks) {
      const results = resultRepository.findByTaskId(task.id);
      if (results.length > 0) {
        const result = results[0];
        const predictedValue = result.totalBindingEnergy;
        
        const deviationAlert = db.prepare(
          'SELECT * FROM alerts WHERE taskId = ? AND type = ? ORDER BY timestamp DESC LIMIT 1'
        ).get(task.id, 'prediction_deviation') as Alert | undefined;

        if (deviationAlert && deviationAlert.value !== undefined && deviationAlert.threshold !== undefined) {
          const deviation = deviationAlert.value;
          const experimentalValue = predictedValue > 0 
            ? predictedValue - deviation 
            : predictedValue + deviation;
          const deviationPercentage = (deviation / Math.abs(experimentalValue)) * 100;

          deviations.push({
            taskId: task.id,
            predictedValue,
            experimentalValue,
            deviation,
            deviationPercentage,
            isSignificant: deviation > deviationAlert.threshold,
            threshold: deviationAlert.threshold
          });
        }
      }
    }

    return deviations;
  }

  async checkTargetDeviation(targetId: string): Promise<{
    hasDeviation: boolean;
    deviation: number;
    shouldPause: boolean;
  }> {
    const target = targetRepository.findById(targetId);
    if (!target) {
      throw new Error('靶标不存在');
    }

    const db = getDb();
    const recentTasks = db.prepare(
      `SELECT * FROM tasks 
       WHERE targetId = ? AND status = ? 
       ORDER BY completedAt DESC 
       LIMIT 10`
    ).all(targetId, 'completed') as SimulationTask[];

    if (recentTasks.length === 0) {
      return {
        hasDeviation: false,
        deviation: 0,
        shouldPause: false,
      };
    }

    let totalDeviation = 0;
    let deviationCount = 0;

    for (const task of recentTasks) {
      const alert = db.prepare(
        `SELECT * FROM alerts 
         WHERE taskId = ? AND type = ? 
         ORDER BY timestamp DESC 
         LIMIT 1`
      ).get(task.id, 'prediction_deviation') as Alert | undefined;

      if (alert && alert.value !== undefined) {
        totalDeviation += alert.value;
        deviationCount++;
      }
    }

    const avgDeviation = deviationCount > 0 ? totalDeviation / deviationCount : 0;
    const hasDeviation = avgDeviation > this.DEVIATION_THRESHOLD;
    const shouldPause = target.consecutiveDeviations >= this.CONSECUTIVE_DEVIATION_LIMIT;

    return {
      hasDeviation,
      deviation: avgDeviation,
      shouldPause,
    };
  }
}

export const targetDeviationService = new TargetDeviationService();
