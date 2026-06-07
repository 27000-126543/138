import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js'
import { approvalService } from '../services/ApprovalService.js'
import type { Approval, PaginatedResponse } from '../../shared/types.js'
import { ApprovalStatus } from '../../shared/types.js'
import { getDb } from '../db/index.js'

export const listApprovalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(ApprovalStatus).optional(),
  taskId: z.string().optional(),
  approverId: z.string().optional(),
  level: z.coerce.number().int().optional(),
})

export const processApprovalSchema = z.object({
  status: z.enum([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED]),
  comment: z.string().min(1, '审批意见不能为空'),
})

export const listApprovals = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page, size, status, taskId, approverId, level } =
      req.query as z.infer<typeof listApprovalsQuerySchema>

    const db = getDb()

    const conditions: string[] = []
    const params: unknown[] = []

    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }
    if (taskId) {
      conditions.push('task_id = ?')
      params.push(taskId)
    }
    if (approverId) {
      conditions.push('approver_id = ?')
      params.push(approverId)
    }
    if (level !== undefined) {
      conditions.push('level = ?')
      params.push(level)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countResult = db
      .prepare(`SELECT COUNT(*) as count FROM approvals ${whereClause}`)
      .get(...params) as { count: number }

    const total = countResult.count

    const offset = (page - 1) * size
    const items = db
      .prepare(
        `SELECT * FROM approvals ${whereClause} ORDER BY level ASC, id ASC LIMIT ? OFFSET ?`,
      )
      .all(...params, size, offset) as Approval[]

    const response: PaginatedResponse<Approval> = {
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

export const submitApproval = async (
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

    const db = getDb()
    const task = db.prepare('SELECT * FROM simulation_tasks WHERE id = ?').get(id)

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    const existingApproval = db
      .prepare('SELECT * FROM approvals WHERE task_id = ? AND status = ?')
      .get(id, ApprovalStatus.PENDING)

    if (existingApproval) {
      throw new ValidationError('该任务已存在待处理的审批')
    }

    const result = await approvalService.submitApproval(id, userId)

    res.status(200).json({
      success: true,
      data: result,
      message: '审批提交成功',
    })
  } catch (error) {
    next(error)
  }
}

export const processApproval = async (
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
    const { status, comment } = req.body as z.infer<typeof processApprovalSchema>

    const db = getDb()
    const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as
      | Approval
      | undefined

    if (!approval) {
      throw new NotFoundError('审批不存在')
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new ValidationError('该审批已处理')
    }

    if (approval.approverId !== userId) {
      throw new ForbiddenError('您无权处理此审批')
    }

    const result = await approvalService.processApproval(id, userId, status, comment)

    res.status(200).json({
      success: true,
      data: result,
      message: '审批处理完成',
    })
  } catch (error) {
    next(error)
  }
}
