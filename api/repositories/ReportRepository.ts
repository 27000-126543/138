import { BaseRepository } from './BaseRepository.js';
import type { Report } from '../../shared/types.js';

export class ReportRepository extends BaseRepository<Report> {
  constructor() {
    super('reports');
  }

  findByTaskId(taskId: string): Report[] {
    return this.queryMany(
      'SELECT * FROM reports WHERE task_id = ? ORDER BY generated_at DESC',
      [taskId]
    );
  }

  findByFileType(fileType: string, limit: number = 100): Report[] {
    return this.queryMany(
      'SELECT * FROM reports WHERE file_type = ? ORDER BY generated_at DESC LIMIT ?',
      [fileType, limit]
    );
  }

  findRecent(limit: number = 50): Report[] {
    return this.queryMany(
      'SELECT * FROM reports ORDER BY generated_at DESC LIMIT ?',
      [limit]
    );
  }
}

export const reportRepository = new ReportRepository();
