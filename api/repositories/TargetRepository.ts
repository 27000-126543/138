import { BaseRepository } from './BaseRepository.js';
import type { Target } from '../../shared/types.js';

export class TargetRepository extends BaseRepository<Target> {
  constructor() {
    super('targets');
  }

  findAll(): Target[] {
    return this.queryMany('SELECT * FROM targets ORDER BY created_at DESC');
  }

  updatePauseStatus(id: string, isPaused: boolean, pauseReason?: string, pausedBy?: string): Target | undefined {
    const data: Partial<Target> = {
      isPaused,
      pausedAt: isPaused ? new Date().toISOString() : undefined,
      pauseReason: isPaused ? pauseReason : undefined,
      pausedBy: isPaused ? pausedBy : undefined
    };
    return this.update(id, data);
  }

  incrementDeviation(id: string): Target | undefined {
    const now = new Date().toISOString();
    return this.queryOne(
      'UPDATE targets SET consecutive_deviations = consecutive_deviations + 1, last_deviation_check = ? WHERE id = ? RETURNING *',
      [now, id]
    );
  }

  resetDeviation(id: string): Target | undefined {
    const now = new Date().toISOString();
    return this.queryOne(
      'UPDATE targets SET consecutive_deviations = 0, last_deviation_check = ? WHERE id = ? RETURNING *',
      [now, id]
    );
  }
}

export const targetRepository = new TargetRepository();
