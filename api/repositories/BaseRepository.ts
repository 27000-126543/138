import { db } from '../db/index.js';

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeysToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[camelToSnake(key)] = obj[key];
  }
  return result;
}

function convertKeysToCamel(obj: unknown): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysToCamel(item));
  }
  const result: Record<string, unknown> = {};
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    result[snakeToCamel(key)] = convertKeysToCamel(record[key]);
  }
  return result;
}

export abstract class BaseRepository<T> {
  protected tableName: string;
  protected primaryKey: string = 'id';

  constructor(tableName: string, primaryKey: string = 'id') {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
  }

  findById(id: string): T | undefined {
    const stmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`);
    const result = stmt.get(id);
    return result ? convertKeysToCamel(result) as T : undefined;
  }

  findAll(): T[] {
    const stmt = db.prepare(`SELECT * FROM ${this.tableName}`);
    const results = stmt.all();
    return convertKeysToCamel(results) as T[];
  }

  create(data: Partial<T>): T {
    const snakeData = convertKeysToSnake(data as Record<string, unknown>);
    const keys = Object.keys(snakeData);
    const values = Object.values(snakeData);
    const placeholders = keys.map(() => '?').join(', ');
    const columns = keys.join(', ');

    const stmt = db.prepare(`INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`);
    const result = stmt.run(...values);

    return {
      ...data,
      [this.primaryKey]: BigInt(result.lastInsertRowid)
    } as T;
  }

  update(id: string, data: Partial<T>): T | undefined {
    const snakeData = convertKeysToSnake(data as Record<string, unknown>);
    const keys = Object.keys(snakeData);
    const values = Object.values(snakeData);
    const setClause = keys.map(key => `${key} = ?`).join(', ');

    const stmt = db.prepare(`UPDATE ${this.tableName} SET ${setClause} WHERE ${this.primaryKey} = ?`);
    stmt.run(...values, id);

    return this.findById(id);
  }

  delete(id: string): boolean {
    const stmt = db.prepare(`DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  count(): number {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
    const result = stmt.get() as { count: number };
    return result.count;
  }

  protected queryOne(sql: string, params: unknown[] = []): T | undefined {
    const stmt = db.prepare(sql);
    const result = stmt.get(...params);
    return result ? convertKeysToCamel(result) as T : undefined;
  }

  protected queryMany(sql: string, params: unknown[] = []): T[] {
    const stmt = db.prepare(sql);
    const results = stmt.all(...params);
    return convertKeysToCamel(results) as T[];
  }

  protected execute(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: bigint } {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: BigInt(result.lastInsertRowid)
    };
  }
}
