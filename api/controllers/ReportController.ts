import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { NotFoundError } from '../lib/errors.js'
import type { Report, PaginatedResponse } from '../../shared/types.js'
import { getDb } from '../db/index.js'
import { reportService } from '../services/ReportService.js'
import { convertKeysToCamel } from '../utils/convertKeys.js'

export const listReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  taskId: z.string().optional(),
  fileType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(['generatedAt', 'fileSize']).default('generatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const listReports = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page, size, taskId, fileType, startDate, endDate, sortBy, sortOrder } = req.query as z.infer<typeof listReportsQuerySchema>
    const db = getDb()

    let whereConditions: string[] = []
    let params: any[] = []

    if (taskId) {
      whereConditions.push('r.task_id = ?')
      params.push(taskId)
    }
    if (fileType) {
      whereConditions.push('r.file_type = ?')
      params.push(fileType)
    }
    if (startDate) {
      whereConditions.push('r.generated_at >= ?')
      params.push(startDate)
    }
    if (endDate) {
      whereConditions.push('r.generated_at <= ?')
      params.push(endDate)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const sortColumn = sortBy === 'generatedAt' ? 'r.generated_at' : 'r.file_size'
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

    const countResult = db.prepare(`
      SELECT COUNT(*) as count FROM reports r
      ${whereClause}
    `).get(...params) as { count: number }

    const offset = (page - 1) * size
    const rows = db.prepare(`
      SELECT r.*, t.name as task_name
      FROM reports r
      LEFT JOIN simulation_tasks t ON r.task_id = t.id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `).all(...params, size, offset) as any[]

    const reports = rows.map(row => {
      const report = convertKeysToCamel(row) as any
      return {
        ...report,
        task: row.task_name ? { id: row.taskId, name: row.taskName } : undefined,
      }
    })

    const response: PaginatedResponse<Report> = {
      items: reports,
      total: countResult.count,
      page,
      size,
      totalPages: Math.ceil(countResult.count / size),
    }

    res.status(200).json({
      success: true,
      data: response,
    })
  } catch (error) {
    next(error)
  }
}

export const getReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params
    const db = getDb()

    const row = db.prepare(`
      SELECT r.*, t.name as task_name
      FROM reports r
      LEFT JOIN simulation_tasks t ON r.task_id = t.id
      WHERE r.id = ?
    `).get(id) as any

    if (!row) {
      throw new NotFoundError('报告不存在')
    }

    const report = convertKeysToCamel(row) as any
    report.task = row.task_name ? { id: row.task_id, name: row.task_name } : undefined

    res.status(200).json({
      success: true,
      data: report,
    })
  } catch (error) {
    next(error)
  }
}

export const downloadReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params
    const db = getDb()

    const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any

    if (!row) {
      throw new NotFoundError('报告不存在')
    }

    const report = convertKeysToCamel(row) as Report

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.pdf"`)
    res.setHeader('Content-Length', report.fileSize)

    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.join(process.cwd(), report.filePath)

    if (fs.existsSync(filePath)) {
      const fileStream = fs.createReadStream(filePath)
      fileStream.pipe(res)
    } else {
      const pdfBuffer = await reportService.generatePDFBuffer(report.taskId)
      res.send(pdfBuffer)
    }
  } catch (error) {
    next(error)
  }
}

export const deleteReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params
    const db = getDb()

    const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id)

    if (!row) {
      throw new NotFoundError('报告不存在')
    }

    db.prepare('DELETE FROM reports WHERE id = ?').run(id)

    res.status(200).json({
      success: true,
      message: '报告删除成功',
    })
  } catch (error) {
    next(error)
  }
}
