import type { Job } from 'bullmq';
import { reportService } from '../../services/ReportService.js';
import { taskRepository } from '../../repositories/TaskRepository.js';
import { userRepository } from '../../repositories/UserRepository.js';
import { getSocket } from '../../lib/socket.js';
import { addAlertTask } from '../../lib/queues.js';
import type { ReportJobData } from '../../lib/queues.js';
import { AlertLevel } from '../../../shared/types.js';

export class ReportJob {
  private job: Job<ReportJobData>;
  private taskId: string;

  constructor(job: Job<ReportJobData>) {
    this.job = job;
    this.taskId = job.data.taskId;
  }

  async process(): Promise<void> {
    const task = taskRepository.findById(this.taskId);
    if (!task) {
      throw new Error(`任务 ${this.taskId} 不存在`);
    }

    const results: {
      pdfPath?: string;
      trajectoryPath?: string;
    } = {};

    try {
      this.job.updateProgress({
        stage: 'started',
        progress: 0,
        message: '开始生成报告',
      });

      if (this.job.data.generatePDF !== false) {
        await this.updateProgress(10, '正在生成 PDF 报告...');
        results.pdfPath = await reportService.generatePDFReport(this.taskId);
        await this.updateProgress(60, 'PDF 报告生成完成');
      }

      if (this.job.data.exportTrajectory) {
        await this.updateProgress(65, '正在导出轨迹数据...');
        results.trajectoryPath = await reportService.exportTrajectoryData(this.taskId, {
          format: this.job.data.exportFormat || 'csv',
        });
        await this.updateProgress(90, '轨迹数据导出完成');
      }

      await this.updateProgress(95, '正在发送通知...');
      await this.sendNotifications(results);

      await this.updateProgress(100, '报告生成任务完成');
      await this.onComplete(results);
    } catch (error) {
      await this.handleError(error);
      throw error;
    }
  }

  private async updateProgress(progress: number, message: string): Promise<void> {
    this.job.updateProgress({
      stage: 'processing',
      progress,
      message,
    });

    const io = getSocket();
    io.emit('report:progress', {
      taskId: this.taskId,
      progress,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private async sendNotifications(results: {
    pdfPath?: string;
    trajectoryPath?: string;
  }): Promise<void> {
    const task = taskRepository.findById(this.taskId);
    if (!task) return;

    const notifyUsers = this.job.data.notifyUsers || [task.createdBy];
    
    for (const userId of notifyUsers) {
      const user = userRepository.findById(userId);
      if (!user) continue;

      const messages = [];
      if (results.pdfPath) {
        messages.push('PDF 报告已生成');
      }
      if (results.trajectoryPath) {
        messages.push('轨迹数据已导出');
      }

      if (messages.length > 0) {
        await addAlertTask({
          taskId: this.taskId,
          alertId: `report-${this.taskId}-${Date.now()}`,
          level: AlertLevel.INFO,
          message: `任务"${task.name}"${messages.join('，')}`,
          notifyChannels: ['inapp', 'socket'],
        });
      }
    }

    const io = getSocket();
    io.emit('report:complete', {
      taskId: this.taskId,
      pdfPath: results.pdfPath,
      trajectoryPath: results.trajectoryPath,
      timestamp: new Date().toISOString(),
    });
  }

  private async handleError(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    console.error(`报告生成任务 ${this.taskId} 失败:`, error);

    await addAlertTask({
      taskId: this.taskId,
      alertId: `report-error-${this.taskId}-${Date.now()}`,
      level: AlertLevel.WARNING,
      message: `报告生成失败: ${errorMessage}`,
      notifyChannels: ['socket', 'inapp'],
    });

    const io = getSocket();
    io.emit('report:error', {
      taskId: this.taskId,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }

  private async onComplete(results: {
    pdfPath?: string;
    trajectoryPath?: string;
  }): Promise<void> {
    const io = getSocket();
    io.emit('report:complete', {
      taskId: this.taskId,
      ...results,
      timestamp: new Date().toISOString(),
    });
  }
}

export const processReportJob = async (job: Job<ReportJobData>): Promise<void> => {
  const reportJob = new ReportJob(job);
  await reportJob.process();
};
