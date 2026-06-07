import { BaseRepository } from './BaseRepository.js';
import { db } from '../db/index.js';
import type { SimulationTask, TaskListFilters } from '../../shared/types.js';

export class TaskRepository extends BaseRepository<SimulationTask> {
  constructor() {
    super('simulation_tasks');
  }

  findWithFilters(filters: TaskListFilters, page: number = 1, size: number = 20): { items: SimulationTask[]; total: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.targetId) {
      conditions.push('target_id = ?');
      params.push(filters.targetId);
    }
    if (filters.createdBy) {
      conditions.push('created_by = ?');
      params.push(filters.createdBy);
    }
    if (filters.assignedTo) {
      conditions.push('assigned_to = ?');
      params.push(filters.assignedTo);
    }
    if (filters.startDate) {
      conditions.push('created_at >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('created_at <= ?');
      params.push(filters.endDate);
    }
    if (filters.search) {
      conditions.push('(name LIKE ? OR id LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM simulation_tasks ${whereClause}`);
    const countResult = countStmt.get(...params) as { count: number } | undefined;

    const total = countResult?.count || 0;

    const offset = (page - 1) * size;
    const items = this.queryMany(
      `SELECT * FROM simulation_tasks ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );

    return { items, total };
  }

  updateStatus(id: string, status: string, currentStep?: string): SimulationTask | undefined {
    const data: Partial<SimulationTask> = { status } as Partial<SimulationTask>;
    if (currentStep) {
      data.currentStep = currentStep;
    }
    if (status === 'completed') {
      data.completedAt = new Date().toISOString();
    }
    return this.update(id, data);
  }

  updateProgress(id: string, progress: number, currentStep?: string, estimatedTime?: number): SimulationTask | undefined {
    const data: Partial<SimulationTask> = { progress } as Partial<SimulationTask>;
    if (currentStep) {
      data.currentStep = currentStep;
    }
    if (estimatedTime !== undefined) {
      data.estimatedTime = estimatedTime;
    }
    return this.update(id, data);
  }

  incrementRetry(id: string, lastError?: string): SimulationTask | undefined {
    return this.queryOne(
      'UPDATE simulation_tasks SET retry_count = retry_count + 1, last_error = ? WHERE id = ? RETURNING *',
      [lastError || null, id]
    );
  }
}

export const taskRepository = new TaskRepository();
