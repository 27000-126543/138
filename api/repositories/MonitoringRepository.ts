import { db } from '../db/index.js';
import { BaseRepository } from './BaseRepository.js';
import type { MonitoringData } from '../../shared/types.js';

export class MonitoringRepository extends BaseRepository<MonitoringData> {
  constructor() {
    super('monitoring_data', 'id');
  }

  bulkInsert(data: Omit<MonitoringData, 'id'>[]): number {
    if (data.length === 0) return 0;

    const insertStmt = db.prepare(
      'INSERT INTO monitoring_data (task_id, timestamp, rmsd, potential_energy, temperature, pressure, volume) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const transaction = db.transaction((items: Omit<MonitoringData, 'id'>[]) => {
      for (const item of items) {
        insertStmt.run(
          item.taskId,
          item.timestamp,
          item.rmsd,
          item.potentialEnergy,
          item.temperature,
          item.pressure,
          item.volume
        );
      }
      return items.length;
    });

    return transaction(data);
  }

  findByTaskId(taskId: string, limit: number = 1000): MonitoringData[] {
    return this.queryMany(
      'SELECT * FROM monitoring_data WHERE task_id = ? ORDER BY timestamp DESC LIMIT ?',
      [taskId, limit]
    );
  }

  findLatest(taskId: string): MonitoringData | undefined {
    return this.queryOne(
      'SELECT * FROM monitoring_data WHERE task_id = ? ORDER BY timestamp DESC LIMIT 1',
      [taskId]
    );
  }
}

export const monitoringRepository = new MonitoringRepository();
