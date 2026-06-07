import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { validateBody, validateQuery, validateParams } from '../middleware/validation.js'
import { z } from 'zod'
import {
  listAlerts,
  getAlert,
  reviewAlert,
  listAlertsQuerySchema,
  reviewAlertSchema,
} from '../controllers/AlertController.js'

const router = Router()
const idParamSchema = z.object({ id: z.string().min(1, '预警ID不能为空') })

router.get('/', authenticate, validateQuery(listAlertsQuerySchema), listAlerts)
router.get('/:id', authenticate, validateParams(idParamSchema), getAlert)
router.post('/:id/review', authenticate, validateParams(idParamSchema), validateBody(reviewAlertSchema), reviewAlert)

export default router
