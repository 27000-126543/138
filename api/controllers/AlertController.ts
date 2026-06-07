import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { NotFoundError, ForbiddenError } from '../lib/errors.js'
import type { Alert, PaginatedResponse } from '../../shared/types.js'
import { AlertLevel } from '../../shared/types.js'
import { getDb } from '../db/index.js'

export const listAlertsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  level: z.nativeEnum(AlertLevel).optional(),
  taskId: z.string().optional(),
  reviewed: z.coerce.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export const reviewAlertSchema = z.object({
  reviewComment: z.string().min(1, '复核意见不能为空'),
  reviewAction: z.enum(['acknowledge', 'ignore', 'escalate']).default('acknowledge'),
})

export const listAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page, size, level, taskId, reviewed, startDate, endDate } =
      req.query as z.infer<typeof listAlertsQuerySchema>

    const db = getDb()

    const conditions: string[] = []
    const params: unknown[] = []

    if (level) {
      conditions.push('level = ?')
      params.push(level)
    }
    if (taskId) {
      conditions.push('task_id = ?')
      params.push(taskId)
    }
    if (reviewed !== undefined) {
      conditions.push(reviewed ? 'reviewed_by IS NOT NULL' : 'reviewed_by IS NULL')
    }
    if (startDate) {
      conditions.push('timestamp >= ?')
      params.push(startDate)
    }
    if (endDate) {
      conditions.push('timestamp <= ?')
      params.push(endDate)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countResult = db
      .prepare(`SELECT COUNT(*) as count FROM alerts ${whereClause}`)
      .get(...params) as { count: number }

    const total = countResult.count

    const offset = (page - 1) * size
    const items = db
      .prepare(
        `SELECT * FROM alerts ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, size, offset) as Alert[]

    const response: PaginatedResponse<Alert> = {
      items,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    }

    res.status(200).json({
      success: true,
      data: response,
    })
  } catch (error) {
    next(error)
  }
}

export const getAlert = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as
      | Alert
      | undefined

    if (!alert) {
      throw new NotFoundError('预警不存在')
    }

    res.status(200).json({
      success: true,
      data: alert,
    })
  } catch (error) {
    next(error)
  }
}

export const reviewAlert = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw new ForbiddenError('未登录')
    }

    const { id } = req.params
    const { reviewComment, reviewAction } = req.body as z.infer<
      typeof reviewAlertSchema
    >

    const db = getDb()
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as
      | Alert
      | undefined

    if (!alert) {
      throw new NotFoundError('预警不存在')
    }

    const now = new Date().toISOString()
    db.prepare(
      'UPDATE alerts SET reviewed_by = ?, review_comment = ?, review_action = ?, reviewed_at = ? WHERE id = ?',
    ).run(userId, reviewComment, reviewAction, now, id)

    const updatedAlert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as Alert

    res.status(200).json({
      success: true,
      data: updatedAlert,
      message: '预警复核完成',
    })
  } catch (error) {
    next(error)
  }
}
