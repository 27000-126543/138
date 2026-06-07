import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { NotFoundError, ForbiddenError } from '../lib/errors.js'
import type { Target } from '../../shared/types.js'
import { getDb } from '../db/index.js'

export const createTargetSchema = z.object({
  name: z.string().min(1, '靶标名称不能为空'),
  uniprotId: z.string().optional(),
  pdbId: z.string().optional(),
  description: z.string().optional(),
})

export const updateTargetSchema = z.object({
  name: z.string().min(1).optional(),
  uniprotId: z.string().optional().nullable(),
  pdbId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

export const pauseTargetSchema = z.object({
  reason: z.string().min(1, '暂停原因不能为空'),
})

export const listTargets = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const db = getDb()
    const targets = db
      .prepare('SELECT * FROM targets ORDER BY created_at DESC')
      .all() as Target[]

    res.status(200).json({
      success: true,
      data: targets,
    })
  } catch (error) {
    next(error)
  }
}

export const createTarget = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw new ForbiddenError('未登录')
    }

    const body = req.body as z.infer<typeof createTargetSchema>

    const db = getDb()
    const id = nanoid()
    const now = new Date().toISOString()

    db.prepare(
      'INSERT INTO targets (id, name, uniprot_id, pdb_id, description, is_paused, consecutive_deviations, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?)',
    ).run(
      id,
      body.name,
      body.uniprotId || null,
      body.pdbId || null,
      body.description || null,
      now,
    )

    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(id) as Target

    res.status(201).json({
      success: true,
      data: target,
    })
  } catch (error) {
    next(error)
  }
}

export const updateTarget = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params
    const body = req.body as z.infer<typeof updateTargetSchema>

    const db = getDb()
    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(id) as
      | Target
      | undefined

    if (!target) {
      throw new NotFoundError('靶标不存在')
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.uniprotId !== undefined) updateData.uniprot_id = body.uniprotId
    if (body.pdbId !== undefined) updateData.pdb_id = body.pdbId
    if (body.description !== undefined) updateData.description = body.description

    if (Object.keys(updateData).length > 0) {
      const setClause = Object.keys(updateData).map((k) => `${k} = ?`).join(', ')
      db.prepare(`UPDATE targets SET ${setClause} WHERE id = ?`).run(
        ...Object.values(updateData),
        id,
      )
    }

    const updatedTarget = db.prepare('SELECT * FROM targets WHERE id = ?').get(id) as Target

    res.status(200).json({
      success: true,
      data: updatedTarget,
    })
  } catch (error) {
    next(error)
  }
}

export const pauseTarget = async (
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
    const { reason } = req.body as z.infer<typeof pauseTargetSchema>

    const db = getDb()
    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(id) as
      | Target
      | undefined

    if (!target) {
      throw new NotFoundError('靶标不存在')
    }

    if (target.isPaused) {
      res.status(200).json({
        success: true,
        data: target,
        message: '靶标已处于暂停状态',
      })
      return
    }

    const now = new Date().toISOString()
    db.prepare(
      'UPDATE targets SET is_paused = 1, pause_reason = ?, paused_at = ?, paused_by = ? WHERE id = ?',
    ).run(reason, now, userId, id)

    const updatedTarget = db.prepare('SELECT * FROM targets WHERE id = ?').get(id) as Target

    res.status(200).json({
      success: true,
      data: updatedTarget,
      message: '靶标已暂停',
    })
  } catch (error) {
    next(error)
  }
}

export const resumeTarget = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(id) as
      | Target
      | undefined

    if (!target) {
      throw new NotFoundError('靶标不存在')
    }

    if (!target.isPaused) {
      res.status(200).json({
        success: true,
        data: target,
        message: '靶标未处于暂停状态',
      })
      return
    }

    db.prepare(
      'UPDATE targets SET is_paused = 0, pause_reason = NULL, paused_at = NULL, paused_by = NULL WHERE id = ?',
    ).run(id)

    const updatedTarget = db.prepare('SELECT * FROM targets WHERE id = ?').get(id) as Target

    res.status(200).json({
      success: true,
      data: updatedTarget,
      message: '靶标已恢复',
    })
  } catch (error) {
    next(error)
  }
}

export const getTargetStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(id) as
      | Target
      | undefined

    if (!target) {
      throw new NotFoundError('靶标不存在')
    }

    const taskStats = db
      .prepare(
        `SELECT 
          COUNT(*) as totalTasks,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedTasks,
          SUM(CASE WHEN status = 'error_rollback' THEN 1 ELSE 0 END) as failedTasks,
          AVG(r.standard_error) as averageError
        FROM simulation_tasks t
        LEFT JOIN results r ON t.id = r.task_id
        WHERE t.target_id = ?`,
      )
      .get(id) as {
      totalTasks: number
      completedTasks: number
      failedTasks: number
      averageError: number | null
    }

    const recentResults = db
      .prepare(
        `SELECT r.*, t.created_at as taskCreatedAt
        FROM results r
        JOIN simulation_tasks t ON r.task_id = t.id
        WHERE t.target_id = ?
        ORDER BY r.calculated_at DESC
        LIMIT 10`,
      )
      .all(id)

    res.status(200).json({
      success: true,
      data: {
        target,
        stats: {
          totalTasks: taskStats.totalTasks,
          completedTasks: taskStats.completedTasks,
          failedTasks: taskStats.failedTasks,
          successRate:
            taskStats.totalTasks > 0
              ? (taskStats.completedTasks / taskStats.totalTasks) * 100
              : 0,
          averageError: taskStats.averageError || 0,
        },
        recentResults,
      },
    })
  } catch (error) {
    next(error)
  }
}
