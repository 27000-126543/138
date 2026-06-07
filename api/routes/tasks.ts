import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { validateBody, validateQuery, validateParams } from '../middleware/validation.js'
import { z } from 'zod'
import {
  listTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  startTask,
  pauseTask,
  restartTask,
  getTaskMonitoring,
  getTaskAlerts,
  getTaskResult,
  getTaskLogs,
  generateReport,
  exportTrajectory,
  exportComponents,
  listTasksQuerySchema,
  createTaskSchema,
  updateTaskSchema,
  generateReportSchema,
  exportTrajectorySchema,
} from '../controllers/TaskController.js'

const router = Router()
const idParamSchema = z.object({ id: z.string().min(1, '任务ID不能为空') })

router.get('/', authenticate, validateQuery(listTasksQuerySchema), listTasks)
router.post('/', authenticate, validateBody(createTaskSchema), createTask)
router.get('/:id', authenticate, validateParams(idParamSchema), getTask)
router.put('/:id', authenticate, validateParams(idParamSchema), validateBody(updateTaskSchema), updateTask)
router.delete('/:id', authenticate, validateParams(idParamSchema), deleteTask)
router.post('/:id/start', authenticate, validateParams(idParamSchema), startTask)
router.post('/:id/pause', authenticate, validateParams(idParamSchema), pauseTask)
router.post('/:id/restart', authenticate, validateParams(idParamSchema), restartTask)
router.get('/:id/monitoring', authenticate, validateParams(idParamSchema), getTaskMonitoring)
router.get('/:id/alerts', authenticate, validateParams(idParamSchema), getTaskAlerts)
router.get('/:id/result', authenticate, validateParams(idParamSchema), getTaskResult)
router.get('/:id/logs', authenticate, validateParams(idParamSchema), getTaskLogs)
router.post('/:id/report', authenticate, validateParams(idParamSchema), validateBody(generateReportSchema), generateReport)
router.post('/:id/export/trajectory', authenticate, validateParams(idParamSchema), validateBody(exportTrajectorySchema), exportTrajectory)
router.post('/:id/export/components', authenticate, validateParams(idParamSchema), exportComponents)

export default router
