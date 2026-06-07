import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import { validateBody, validateQuery, validateParams } from '../middleware/validation.js'
import { z } from 'zod'
import { UserRole } from '../../shared/types.js'
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  updateRole,
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  updateRoleSchema,
} from '../controllers/UserController.js'

const router = Router()
const idParamSchema = z.object({ id: z.string().min(1, '用户ID不能为空') })
const adminOnly = requireRole([UserRole.ADMIN])

router.get('/', authenticate, adminOnly, validateQuery(listUsersQuerySchema), listUsers)
router.post('/', authenticate, adminOnly, validateBody(createUserSchema), createUser)
router.put('/:id', authenticate, adminOnly, validateParams(idParamSchema), validateBody(updateUserSchema), updateUser)
router.delete('/:id', authenticate, adminOnly, validateParams(idParamSchema), deleteUser)
router.put('/:id/role', authenticate, adminOnly, validateParams(idParamSchema), validateBody(updateRoleSchema), updateRole)

export default router
