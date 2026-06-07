import { BaseRepository } from './BaseRepository.js';
import type { Alert } from '../../shared/types.js';

export class AlertRepository extends BaseRepository<Alert> {
  constructor() {
    super('alerts');
  }

  findUnreviewed(limit: number = 100): Alert[] {
    return this.queryMany(
      'SELECT * FROM alerts WHERE reviewed_by IS NULL ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
  }

  markAsReviewed(
    id: string,
    reviewedBy: string,
    reviewComment?: string,
    reviewAction?: string
  ): Alert | undefined {
    const now = new Date().toISOString();
    return this.queryOne(
      'UPDATE alerts SET reviewed_by = ?, review_comment = ?, review_action = ?, reviewed_at = ? WHERE id = ? RETURNING *',
      [reviewedBy, reviewComment || null, reviewAction || null, now, id]
    );
  }
}

export const alertRepository = new AlertRepository();
