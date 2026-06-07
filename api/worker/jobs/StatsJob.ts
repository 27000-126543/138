import type { Job } from 'bullmq';
import { statisticsService } from '../../services/StatisticsService.js';
import { targetDeviationService } from '../../services/TargetDeviationService.js';
import { statsRepository } from '../../repositories/StatsRepository.js';
import { targetRepository } from '../../repositories/TargetRepository.js';
import { getSocket } from '../../lib/socket.js';
import { addAlertTask } from '../../lib/queues.js';
import type { StatsJobData } from '../../lib/queues.js';
import { AlertLevel, SimulationStatus } from '../../../shared/types.js';
import { config } from '../../config/index.js';
import dayjs from 'dayjs';
// @ts-ignore

export class StatsJob {
  private job: Job<StatsJobData>;

  constructor(job: Job<StatsJobData>) {
    this.job = job;
  }

  async process(): Promise<void> {
    const { type, date, days } = this.job.data;

    try {
      this.job.updateProgress({
        type,
        stage: 'started',
        progress: 0,
        message: `开始${this.getJobTypeName(type)}任务`,
      });

      switch (type) {
        case 'daily':
          await this.processDailyStats(date || this.getDefaultDate());
          break;
        case 'performance':
          await this.processPerformanceTrend(days || 30);
          break;
        case 'deviation':
          await this.processDeviationCheck();
          break;
        default:
          throw new Error(`未知的统计任务类型: ${type}`);
      }

      this.job.updateProgress({
        type,
        stage: 'completed',
        progress: 100,
        message: `${this.getJobTypeName(type)}任务完成`,
      });

      await this.onComplete(type);
    } catch (error) {
      await this.handleError(error, type);
      throw error;
    }
  }

  private getJobTypeName(type: string): string {
    const names: Record<string, string> = {
      daily: '每日统计',
      performance: '性能趋势',
      deviation: '偏差检查',
    };
    return names[type] || type;
  }

  private getDefaultDate(): string {
    return dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  }

  private async processDailyStats(date: string): Promise<void> {
    await this.updateProgress(20, `正在生成 ${date} 的统计数据...`);
    
    const stats = await statisticsService.generateDailyStats(date);
    
    await this.updateProgress(60, '正在保存统计数据...');
    statsRepository.saveDailyStats(stats);
    
    await this.updateProgress(80, '正在检查异常指标...');
    await this.checkDailyAnomalies(stats);
  }

  private async processPerformanceTrend(days: number): Promise<void> {
    await this.updateProgress(20, `正在计算最近 ${days} 天的性能趋势...`);
    
    const trendData = await statisticsService.getPerformanceTrendData(days);
    
    await this.updateProgress(60, '正在分析性能变化...');
    const anomalies = await this.analyzePerformanceTrend(trendData);
    
    if (anomalies.length > 0) {
      await this.updateProgress(80, '检测到性能异常，正在发送通知...');
      for (const anomaly of anomalies) {
        await addAlertTask({
          taskId: 'system',
          alertId: `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          level: anomaly.level,
          message: anomaly.message,
          notifyChannels: ['inapp', 'socket'],
        });
      }
    }
  }

  private async processDeviationCheck(): Promise<void> {
    await this.updateProgress(20, '正在检查所有靶标偏差...');
    
    const targets = targetRepository.findAll();
    const totalTargets = targets.length;
    
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const progress = 20 + Math.round(((i + 1) / totalTargets) * 60);
      
      await this.updateProgress(progress, `正在检查靶标 ${target.name} (${i + 1}/${totalTargets})...`);
      
      if (target.isPaused) {
        continue;
      }
      
      try {
        const result = await targetDeviationService.checkTargetDeviation(target.id);
        
        if (result.hasDeviation) {
          await addAlertTask({
            taskId: 'system',
            alertId: `deviation-${target.id}-${Date.now()}`,
            level: AlertLevel.WARNING,
            message: `靶标"${target.name}"检测到偏差: ${result.deviation.toFixed(4)} > ${config.simulation.deviationThreshold}`,
            notifyChannels: ['inapp', 'socket'],
          });
        }
        
        if (result.shouldPause) {
          await addAlertTask({
            taskId: 'system',
            alertId: `pause-${target.id}-${Date.now()}`,
            level: AlertLevel.CRITICAL,
            message: `靶标"${target.name}"因连续偏差已自动暂停`,
            notifyChannels: ['inapp', 'socket', 'email'],
          });
        }
      } catch (error) {
        console.error(`检查靶标 ${target.name} 偏差失败:`, error);
      }
    }
  }

  private async checkDailyAnomalies(stats: any): Promise<void> {
    const anomalies = [];
    
    if (stats.completionRate < 70 && stats.totalTasks >= 5) {
      anomalies.push({
        level: AlertLevel.WARNING,
        message: `今日任务完成率偏低: ${stats.completionRate.toFixed(1)}% (共 ${stats.totalTasks} 个任务)`,
      });
    }
    
    if (stats.failedTasks > 0) {
      const failureRate = (stats.failedTasks / stats.totalTasks) * 100;
      if (failureRate > 20) {
        anomalies.push({
          level: AlertLevel.WARNING,
          message: `今日任务失败率偏高: ${failureRate.toFixed(1)}% (${stats.failedTasks}/${stats.totalTasks})`,
        });
      }
    }
    
    if (stats.averageError > config.simulation.deviationThreshold * 2) {
      anomalies.push({
        level: AlertLevel.WARNING,
        message: `今日平均预测误差偏高: ${stats.averageError.toFixed(4)} kcal/mol`,
      });
    }
    
    if (stats.alertsGenerated > 50) {
      anomalies.push({
        level: AlertLevel.INFO,
        message: `今日预警数量较多: ${stats.alertsGenerated} 条`,
      });
    }
    
    for (const anomaly of anomalies) {
      await addAlertTask({
        taskId: 'system',
        alertId: `daily-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        level: anomaly.level,
        message: anomaly.message,
        notifyChannels: ['inapp'],
      });
    }
  }

  private async analyzePerformanceTrend(trendData: any[]): Promise<{
    level: AlertLevel;
    message: string;
  }[]> {
    const anomalies: {
      level: AlertLevel;
      message: string;
    }[] = [];
    
    if (trendData.length < 7) {
      return anomalies;
    }
    
    const recentData = trendData.slice(-7);
    const olderData = trendData.slice(-14, -7);
    
    if (olderData.length === 0) {
      return anomalies;
    }
    
    const recentAvgError = recentData.reduce((sum, d) => sum + d.averageError, 0) / recentData.length;
    const olderAvgError = olderData.reduce((sum, d) => sum + d.averageError, 0) / olderData.length;
    
    if (recentAvgError > olderAvgError * 1.5) {
      anomalies.push({
        level: AlertLevel.WARNING,
        message: `近7天平均预测误差呈上升趋势: ${olderAvgError.toFixed(4)} → ${recentAvgError.toFixed(4)} kcal/mol`,
      });
    }
    
    const recentSuccessRate = recentData.reduce((sum, d) => sum + d.successRate, 0) / recentData.length;
    const olderSuccessRate = olderData.reduce((sum, d) => sum + d.successRate, 0) / olderData.length;
    
    if (recentSuccessRate < olderSuccessRate * 0.8) {
      anomalies.push({
        level: AlertLevel.WARNING,
        message: `近7天任务成功率呈下降趋势: ${(olderSuccessRate * 100).toFixed(1)}% → ${(recentSuccessRate * 100).toFixed(1)}%`,
      });
    }
    
    return anomalies;
  }

  private async updateProgress(progress: number, message: string): Promise<void> {
    this.job.updateProgress({
      type: this.job.data.type,
      stage: 'processing',
      progress,
      message,
    });

    const io = getSocket();
    io.emit('stats:progress', {
      type: this.job.data.type,
      progress,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private async handleError(error: unknown, type: string): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    console.error(`统计任务 ${type} 失败:`, error);

    await addAlertTask({
      taskId: 'system',
      alertId: `stats-error-${type}-${Date.now()}`,
      level: AlertLevel.WARNING,
      message: `统计任务(${this.getJobTypeName(type)})失败: ${errorMessage}`,
      notifyChannels: ['socket', 'inapp'],
    });

    const io = getSocket();
    io.emit('stats:error', {
      type,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }

  private async onComplete(type: string): Promise<void> {
    const io = getSocket();
    io.emit('stats:complete', {
      type,
      timestamp: new Date().toISOString(),
    });
  }
}

export const processStatsJob = async (job: Job<StatsJobData>): Promise<void> => {
  const statsJob = new StatsJob(job);
  await statsJob.process();
};
