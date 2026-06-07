import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { validateBody } from '../middleware/validation.js'
import {
  login,
  getCurrentUser,
  logout,
  loginSchema,
} from '../controllers/AuthController.js'

const router = Router()

router.post('/login', validateBody(loginSchema), login)
router.get('/me', authenticate, getCurrentUser)
router.post('/logout', authenticate, logout)

export default router
