import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { taskRepository } from '../repositories/TaskRepository.js'
import { monitoringRepository } from '../repositories/MonitoringRepository.js'
import { resultRepository } from '../repositories/ResultRepository.js'
import { alertRepository } from '../repositories/AlertRepository.js'
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js'
import { monitoringService } from '../services/MonitoringService.js'
import { reportService } from '../services/ReportService.js'
import { simulationEngineService } from '../services/SimulationEngineService.js'
import { stateMachineService } from '../services/StateMachineService.js'
import type {
  SimulationTask,
  TaskListFilters,
  PaginatedResponse,
  MonitoringData,
  Alert,
  FreeEnergyResult,
  SimulationLog,
  Report,
} from '../../shared/types.js'
import { SimulationStatus, FEMethod } from '../../shared/types.js'
import { getDb } from '../db/index.js'
import { convertKeysToCamel } from '../utils/convertKeys.js'

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(SimulationStatus).optional(),
  targetId: z.string().optional(),
  createdBy: z.string().optional(),
  assignedTo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
})

export const createTaskSchema = z.object({
  name: z.string().min(1, '任务名称不能为空'),
  targetId: z.string().min(1, '靶标ID不能为空'),
  assignedTo: z.string().optional(),
  forceField: z.string().min(1, '力场不能为空'),
  temperature: z.coerce.number().min(0, '温度必须大于0'),
  saltConcentration: z.coerce.number().min(0, '盐浓度必须大于等于0'),
  feMethod: z.nativeEnum(FEMethod),
  rmsdThreshold: z.coerce.number().min(0, 'RMSD阈值必须大于0'),
  proteinFilePath: z.string().optional(),
  ligandFilePath: z.string().optional(),
  bindingSite: z
    .object({
      residues: z.array(z.number()),
      center: z.object({ x: z.number(), y: z.number(), z: z.number() }),
      radius: z.number(),
      method: z.string(),
    })
    .optional(),
})

export const updateTaskSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.nativeEnum(SimulationStatus).optional(),
  forceField: z.string().min(1).optional(),
  temperature: z.coerce.number().min(0).optional(),
  saltConcentration: z.coerce.number().min(0).optional(),
  feMethod: z.nativeEnum(FEMethod).optional(),
  rmsdThreshold: z.coerce.number().min(0).optional(),
  assignedTo: z.string().optional(),
})

export const reviewAlertSchema = z.object({
  reviewComment: z.string().optional(),
  reviewAction: z.string().optional(),
})

export const generateReportSchema = z.object({
  format: z.enum(['pdf', 'html']).default('pdf'),
})

export const exportTrajectorySchema = z.object({
  format: z.enum(['csv', 'json', 'pdb']).default('csv'),
  forceField: z.string().optional(),
  temperature: z.coerce.number().optional(),
  saltConcentration: z.coerce.number().optional(),
})

export const listTasks = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page, size, ...filters } = req.query as z.infer<typeof listTasksQuerySchema>

    const result = taskRepository.findWithFilters(
      filters as TaskListFilters,
      page,
      size,
    )

    const response: PaginatedResponse<SimulationTask> = {
      items: result.items,
      total: result.total,
      page,
      size,
      totalPages: Math.ceil(result.total / size),
    }

    res.status(200).json({
      success: true,
      data: response,
    })
  } catch (error) {
    next(error)
  }
}

export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw new ForbiddenError('未登录')
    }

    const body = req.body as z.infer<typeof createTaskSchema>

    const db = getDb()
    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(body.targetId)
    if (!target) {
      throw new NotFoundError('靶标不存在')
    }

    const taskData = {
      id: nanoid(),
      name: body.name,
      target_id: body.targetId,
      created_by: userId,
      assigned_to: body.assignedTo || null,
      status: SimulationStatus.PENDING_VALIDATION,
      force_field: body.forceField,
      temperature: body.temperature,
      salt_concentration: body.saltConcentration,
      fe_method: body.feMethod,
      rmsd_threshold: body.rmsdThreshold,
      progress: 0,
      protein_file_path: body.proteinFilePath || null,
      ligand_file_path: body.ligandFilePath || null,
      binding_site: body.bindingSite ? JSON.stringify(body.bindingSite) : null,
      created_at: new Date().toISOString(),
      retry_count: 0,
    } as const

    const keys = Object.keys(taskData)
    const values = Object.values(taskData)
    const placeholders = keys.map(() => '?').join(', ')

    db.prepare(
      `INSERT INTO simulation_tasks (${keys.join(', ')}) VALUES (${placeholders})`,
    ).run(...values)

    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(taskData.id) as SimulationTask

    res.status(201).json({
      success: true,
      data: task,
    })
  } catch (error) {
    next(error)
  }
}

export const getTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    res.status(200).json({
      success: true,
      data: task,
    })
  } catch (error) {
    next(error)
  }
}

export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params
    const body = req.body as z.infer<typeof updateTaskSchema>

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.status !== undefined) updateData.status = body.status
    if (body.forceField !== undefined) updateData.force_field = body.forceField
    if (body.temperature !== undefined) updateData.temperature = body.temperature
    if (body.saltConcentration !== undefined) updateData.salt_concentration = body.saltConcentration
    if (body.feMethod !== undefined) updateData.fe_method = body.feMethod
    if (body.rmsdThreshold !== undefined) updateData.rmsd_threshold = body.rmsdThreshold
    if (body.assignedTo !== undefined) updateData.assigned_to = body.assignedTo

    if (Object.keys(updateData).length > 0) {
      const setClause = Object.keys(updateData).map((k) => `${k} = ?`).join(', ')
      db.prepare(`UPDATE simulation_tasks SET ${setClause} WHERE id = ?`).run(
        ...Object.values(updateData),
        id,
      )
    }

    const updatedTask = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask

    res.status(200).json({
      success: true,
      data: updatedTask,
    })
  } catch (error) {
    next(error)
  }
}

export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    db.prepare('DELETE FROM simulation_tasks WHERE id = ?').run(id)

    res.status(200).json({
      success: true,
      message: '任务删除成功',
    })
  } catch (error) {
    next(error)
  }
}

export const startTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    if (
      task.status !== SimulationStatus.PENDING_VALIDATION &&
      task.status !== SimulationStatus.ERROR_ROLLBACK
    ) {
      throw new ValidationError('任务状态不允许启动')
    }

    const now = new Date().toISOString()
    db.prepare(
      'UPDATE simulation_tasks SET status = ?, current_step = ?, started_at = ? WHERE id = ?',
    ).run(SimulationStatus.SYSTEM_BUILDING, '体系构建中', now, id)

    simulationEngineService.startSimulation(id).catch((err) => {
      console.error('启动模拟失败:', err)
    })

    const updatedTask = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask

    res.status(200).json({
      success: true,
      data: updatedTask,
      message: '任务已启动',
    })
  } catch (error) {
    next(error)
  }
}

export const pauseTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    if (
      task.status !== SimulationStatus.SYSTEM_BUILDING &&
      task.status !== SimulationStatus.ENERGY_MINIMIZATION &&
      task.status !== SimulationStatus.EQUILIBRATION &&
      task.status !== SimulationStatus.FEP_CALCULATION
    ) {
      throw new ValidationError('任务状态不允许暂停')
    }

    simulationEngineService.pauseSimulation(id)

    res.status(200).json({
      success: true,
      message: '任务已暂停',
    })
  } catch (error) {
    next(error)
  }
}

export const restartTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    db.prepare(
      'UPDATE simulation_tasks SET status = ?, progress = ?, current_step = ?, retry_count = retry_count + 1 WHERE id = ?',
    ).run(SimulationStatus.SYSTEM_BUILDING, 0, '重启中', id)

    simulationEngineService.restartSimulation(id).catch((err) => {
      console.error('重启模拟失败:', err)
    })

    const updatedTask = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask

    res.status(200).json({
      success: true,
      data: updatedTask,
      message: '任务已重启',
    })
  } catch (error) {
    next(error)
  }
}

export const getTaskMonitoring = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params
    const limit = Number(req.query.limit) || 1000

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    const monitoringData = monitoringRepository.findByTaskId(id, limit)
    const summary = await monitoringService.getTaskMonitoringSummary(id)

    res.status(200).json({
      success: true,
      data: {
        data: monitoringData,
        summary,
        statistics: monitoringService.calculateStatistics(id),
        convergence: monitoringService.detectConvergence(id),
      },
    })
  } catch (error) {
    next(error)
  }
}

export const getTaskAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    const alerts = db
      .prepare('SELECT * FROM alerts WHERE task_id = ? ORDER BY timestamp DESC')
      .all(id) as Alert[]

    res.status(200).json({
      success: true,
      data: alerts,
    })
  } catch (error) {
    next(error)
  }
}

export const getTaskResult = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    const results = resultRepository.findByTaskId(id)

    res.status(200).json({
      success: true,
      data: results,
    })
  } catch (error) {
    next(error)
  }
}

export const getTaskLogs = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params
    const limit = Number(req.query.limit) || 100
    const level = req.query.level as string | undefined

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    let sql = 'SELECT * FROM simulation_logs WHERE task_id = ?'
    const params: unknown[] = [id]

    if (level) {
      sql += ' AND level = ?'
      params.push(level)
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?'
    params.push(limit)

    const logs = db.prepare(sql).all(...params) as SimulationLog[]

    res.status(200).json({
      success: true,
      data: logs,
    })
  } catch (error) {
    next(error)
  }
}

export const generateReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    const filePath = await reportService.generatePDFReport(id)
    const statsRaw = await db
      .prepare('SELECT * FROM reports WHERE task_id = ? ORDER BY generated_at DESC LIMIT 1')
      .get(id) as Report | undefined
    const stats = statsRaw ? convertKeysToCamel(statsRaw) as Report : undefined

    res.status(200).json({
      success: true,
      data: {
        report: stats,
        filePath,
      },
      message: '报告生成成功',
    })
  } catch (error) {
    next(error)
  }
}

export const exportTrajectory = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params
    const options = req.body as z.infer<typeof exportTrajectorySchema>

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    const filePath = await reportService.exportTrajectoryData(id, options)

    res.status(200).json({
      success: true,
      data: {
        filePath,
        format: options.format,
      },
      message: '轨迹导出成功',
    })
  } catch (error) {
    next(error)
  }
}

export const exportComponents = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    const filePath = await reportService.exportFreeEnergyComponents(id)

    res.status(200).json({
      success: true,
      data: {
        filePath,
      },
      message: '能量分量导出成功',
    })
  } catch (error) {
    next(error)
  }
}

export const advanceState = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    const actor = stateMachineService.getActor(id)
    if (!actor) {
      stateMachineService.createMachine(id)
    }

    const success = stateMachineService.transitionToNext(id)

    const updatedTaskRaw = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask
    const updatedTask = convertKeysToCamel(updatedTaskRaw) as SimulationTask

    const currentState = stateMachineService.getCurrentState(id)

    res.status(200).json({
      success: true,
      data: {
        task: updatedTask,
        currentState,
        advanced: success,
        message: success ? `状态已推进到 ${currentState}` : '状态无法推进',
      },
    })
  } catch (error) {
    next(error)
  }
}

export const getStateTransitionHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params

    const db = getDb()
    const task = db
      .prepare('SELECT * FROM simulation_tasks WHERE id = ?')
      .get(id) as SimulationTask | undefined

    if (!task) {
      throw new NotFoundError('任务不存在')
    }

    const logs = db
      .prepare(
        'SELECT * FROM simulation_logs WHERE task_id = ? AND (message LIKE "%状态%" OR message LIKE "%阶段%") ORDER BY timestamp ASC',
      )
      .all(id) as SimulationLog[]

    const statusFlow = [
      { status: SimulationStatus.PENDING_VALIDATION, timestamp: task.createdAt },
      task.startedAt && { status: SimulationStatus.SYSTEM_BUILDING, timestamp: task.startedAt },
      task.completedAt && { status: SimulationStatus.COMPLETED, timestamp: task.completedAt },
    ].filter(Boolean)

    res.status(200).json({
      success: true,
      data: {
        currentState: task.status,
        statusFlow,
        logs,
      },
    })
  } catch (error) {
    next(error)
  }
}
