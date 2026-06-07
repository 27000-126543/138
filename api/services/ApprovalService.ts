import { getDb } from '../db/index.js';
import { approvalRepository } from '../repositories/ApprovalRepository.js';
import { taskRepository } from '../repositories/TaskRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import type { Approval, SimulationTask, User, UserRole } from '../../shared/types.js';
import { ApprovalStatus, SimulationStatus, UserRole as UserRoleEnum } from '../../shared/types.js';

export class ApprovalService {
  async submitForApproval(taskId: string, level: number): Promise<Approval> {
    if (level < 1 || level > 2) {
      throw new Error('审批级别必须为1或2');
    }

    const task = taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const db = getDb();
    const existingApproval = db.prepare(
      'SELECT * FROM approvals WHERE taskId = ? AND level = ? AND status = ?'
    ).get(taskId, level, ApprovalStatus.PENDING) as Approval | undefined;

    if (existingApproval) {
      return existingApproval;
    }

    const approverRole: UserRole = level === 1 
      ? UserRoleEnum.MEDICINAL_CHEMIST 
      : UserRoleEnum.CHIEF_SCIENTIST;

    const approvers = db.prepare(
      'SELECT * FROM users WHERE role = ? LIMIT 1'
    ).all(approverRole) as User[];

    if (approvers.length === 0) {
      throw new Error(`未找到${level === 1 ? '药物化学家' : '首席科学家'}审批人`);
    }

    const approval = approvalRepository.create({
      taskId,
      level,
      status: ApprovalStatus.PENDING,
      approverId: approvers[0].id
    });

    return approval;
  }

  async processApproval(
    approvalId: string,
    approverId: string,
    status: ApprovalStatus,
    comment?: string
  ): Promise<Approval> {
    const approval = approvalRepository.findById(approvalId);
    if (!approval) {
      throw new Error('审批记录不存在');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new Error('该审批已被处理');
    }

    if (approval.approverId !== approverId) {
      throw new Error('您没有权限处理此审批');
    }

    const updatedApproval = approvalRepository.updateStatus(approvalId, status, comment);
    if (!updatedApproval) {
      throw new Error('审批处理失败');
    }

    if (status === ApprovalStatus.APPROVED) {
      if (approval.level === 1) {
        await this.submitForApproval(approval.taskId, 2);
      } else if (approval.level === 2) {
        taskRepository.updateStatus(approval.taskId, SimulationStatus.COMPLETED);
        await this.sendToSynthesisTeam(approval.taskId);
      }
    } else if (status === ApprovalStatus.REJECTED) {
      taskRepository.updateStatus(approval.taskId, SimulationStatus.ERROR_ROLLBACK);
    }

    return updatedApproval;
  }

  async checkApprovalCompletion(taskId: string): Promise<{ level1: boolean; level2: boolean; allCompleted: boolean }> {
    const db = getDb();
    const approvals = db.prepare(
      'SELECT * FROM approvals WHERE taskId = ? ORDER BY level ASC'
    ).all(taskId) as Approval[];

    const level1Approval = approvals.find(a => a.level === 1);
    const level2Approval = approvals.find(a => a.level === 2);

    const level1Completed = level1Approval?.status === ApprovalStatus.APPROVED;
    const level2Completed = level2Approval?.status === ApprovalStatus.APPROVED;

    return {
      level1: level1Completed,
      level2: level2Completed,
      allCompleted: level1Completed && level2Completed
    };
  }

  async sendToSynthesisTeam(taskId: string): Promise<SimulationTask | undefined> {
    const task = taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const db = getDb();
    const synthesisTeamMembers = db.prepare(
      'SELECT * FROM users WHERE role = ?'
    ).all(UserRoleEnum.SYNTHESIS_TEAM) as User[];

    if (synthesisTeamMembers.length > 0) {
      return taskRepository.update(taskId, {
        assignedTo: synthesisTeamMembers[0].id
      } as Partial<SimulationTask>);
    }

    return task;
  }

  async submitApproval(taskId: string, userId: string): Promise<Approval> {
    return this.submitForApproval(taskId, 1);
  }
}

export const approvalService = new ApprovalService();
