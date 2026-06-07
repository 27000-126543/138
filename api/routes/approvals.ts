import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { validateBody, validateQuery, validateParams } from '../middleware/validation.js'
import { z } from 'zod'
import {
  listApprovals,
  submitApproval,
  processApproval,
  listApprovalsQuerySchema,
  processApprovalSchema,
} from '../controllers/ApprovalController.js'

const router = Router()
const idParamSchema = z.object({ id: z.string().min(1, '审批ID不能为空') })

router.get('/', authenticate, validateQuery(listApprovalsQuerySchema), listApprovals)
router.post('/:id/submit', authenticate, validateParams(idParamSchema), submitApproval)
router.post('/:id/process', authenticate, validateParams(idParamSchema), validateBody(processApprovalSchema), processApproval)

export default router
