import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { validateQuery, validateParams } from '../middleware/validation.js'
import { z } from 'zod'
import {
  listReports,
  getReport,
  downloadReport,
  deleteReport,
  listReportsQuerySchema,
} from '../controllers/ReportController.js'

const router = Router()
const idParamSchema = z.object({ id: z.string().min(1, '报告ID不能为空') })

router.get('/', authenticate, validateQuery(listReportsQuerySchema), listReports)
router.get('/:id', authenticate, validateParams(idParamSchema), getReport)
router.get('/:id/download', authenticate, validateParams(idParamSchema), downloadReport)
router.delete('/:id', authenticate, validateParams(idParamSchema), deleteReport)

export default router
