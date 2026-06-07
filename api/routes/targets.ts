import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { validateBody, validateParams } from '../middleware/validation.js'
import { z } from 'zod'
import {
  listTargets,
  createTarget,
  updateTarget,
  pauseTarget,
  resumeTarget,
  getTargetStats,
  createTargetSchema,
  updateTargetSchema,
  pauseTargetSchema,
} from '../controllers/TargetController.js'

const router = Router()
const idParamSchema = z.object({ id: z.string().min(1, '靶标ID不能为空') })

router.get('/', authenticate, listTargets)
router.post('/', authenticate, validateBody(createTargetSchema), createTarget)
router.put('/:id', authenticate, validateParams(idParamSchema), validateBody(updateTargetSchema), updateTarget)
router.post('/:id/pause', authenticate, validateParams(idParamSchema), validateBody(pauseTargetSchema), pauseTarget)
router.post('/:id/resume', authenticate, validateParams(idParamSchema), resumeTarget)
router.get('/:id/stats', authenticate, validateParams(idParamSchema), getTargetStats)

export default router
