import { BaseRepository } from './BaseRepository.js';
import type { Approval } from '../../shared/types.js';

export class ApprovalRepository extends BaseRepository<Approval> {
  constructor() {
    super('approvals');
  }

  findPending(limit: number = 100): Approval[] {
    return this.queryMany(
      'SELECT * FROM approvals WHERE status = ? ORDER BY level ASC, id ASC LIMIT ?',
      ['pending', limit]
    );
  }

  create(data: Omit<Approval, 'id'>): Approval {
    return super.create(data as Partial<Approval>) as Approval;
  }

  updateStatus(id: string, status: string, comment?: string): Approval | undefined {
    const now = new Date().toISOString();
    return this.queryOne(
      'UPDATE approvals SET status = ?, comment = ?, signed_at = ? WHERE id = ? RETURNING *',
      [status, comment || null, now, id]
    );
  }
}

export const approvalRepository = new ApprovalRepository();
