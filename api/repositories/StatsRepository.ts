import { db } from '../db/index.js';
import type { DailyStats } from '../../shared/types.js';

function convertKeysToCamel(obj: unknown): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysToCamel(item));
  }
  const result: Record<string, unknown> = {};
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    result[key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] = convertKeysToCamel(record[key]);
  }
  return result;
}

export class StatsRepository {
  getDailyStats(startDate: string, endDate: string): DailyStats[] {
    const sql = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'error_rollback' THEN 1 ELSE 0 END) as failed_tasks,
        ROUND(
          CASE WHEN COUNT(*) > 0
            THEN CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS REAL)
            ELSE 0
          END, 2
        ) as completion_rate,
        COALESCE(AVG(r.standard_error), 0) as average_error,
        COALESCE(SUM(CASE
          WHEN t.completed_at IS NOT NULL AND t.started_at IS NOT NULL
          THEN (JULIANDAY(t.completed_at) - JULIANDAY(t.started_at)) * 24
          ELSE 0
        END), 0) as total_compute_hours,
        COALESCE(AVG(CASE
          WHEN t.completed_at IS NOT NULL AND t.started_at IS NOT NULL
          THEN (JULIANDAY(t.completed_at) - JULIANDAY(t.started_at)) * 24
          ELSE NULL
        END), 0) as average_simulation_time,
        (SELECT COUNT(*) FROM alerts a WHERE DATE(a.timestamp) = DATE(t.created_at)) as alerts_generated,
        (SELECT COUNT(*) FROM approvals ap WHERE DATE(ap.signed_at) = DATE(t.created_at)) as approvals_processed
      FROM simulation_tasks t
      LEFT JOIN free_energy_results r ON t.id = r.task_id
      WHERE DATE(t.created_at) BETWEEN ? AND ?
      GROUP BY DATE(t.created_at)
      ORDER BY date ASC
    `;

    const stmt = db.prepare(sql);
    const results = stmt.all(startDate, endDate);
    return convertKeysToCamel(results) as DailyStats[];
  }

  getPerformanceTrend(days: number = 30): {
    date: string;
    method: string;
    averageError: number;
    successRate: number;
    sampleSize: number;
  }[] {
    const sql = `
      SELECT
        DATE(r.calculated_at) as date,
        r.method,
        ROUND(AVG(r.standard_error), 4) as average_error,
        ROUND(
          CASE WHEN COUNT(*) > 0
            THEN CAST(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS REAL)
            ELSE 0
          END, 2
        ) as success_rate,
        COUNT(*) as sample_size
      FROM free_energy_results r
      JOIN simulation_tasks t ON r.task_id = t.id
      WHERE r.calculated_at >= DATE('now', ?)
      GROUP BY DATE(r.calculated_at), r.method
      ORDER BY date ASC, r.method ASC
    `;

    const stmt = db.prepare(sql);
    const results = stmt.all(`-${days} days`);
    return convertKeysToCamel(results) as {
      date: string;
      method: string;
      averageError: number;
      successRate: number;
      sampleSize: number;
    }[];
  }

  getAccuracyBoxPlotData(method?: string): {
    method: string;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
  }[] {
    const methodCondition = method ? 'WHERE method = ?' : '';
    const params = method ? [method] : [];

    const sql = `
      SELECT method, standard_error as standardError
      FROM free_energy_results
      ${methodCondition}
      ORDER BY method ASC, standard_error ASC
    `;

    const stmt = db.prepare(sql);
    const rawData = stmt.all(...params) as { method: string; standardError: number }[];

    const grouped = new Map<string, number[]>();
    for (const item of rawData) {
      if (!grouped.has(item.method)) {
        grouped.set(item.method, []);
      }
      grouped.get(item.method)!.push(item.standardError);
    }

    const result: {
      method: string;
      min: number;
      q1: number;
      median: number;
      q3: number;
      max: number;
    }[] = [];

    for (const [methodName, values] of grouped) {
      result.push({
        method: methodName,
        min: values[0],
        q1: this.percentile(values, 25),
        median: this.percentile(values, 50),
        q3: this.percentile(values, 75),
        max: values[values.length - 1]
      });
    }

    return result;
  }

  saveDailyStats(stats: any): any {
    const existing = this.getDailyStats(stats.date, stats.date);
    if (existing.length > 0) {
      return existing[0];
    }
    return stats;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sorted[lower] + weight * (sorted[upper] - sorted[lower]);
  }
}

export const statsRepository = new StatsRepository();
