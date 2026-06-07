import { Router } from 'express'
import authRoutes from './auth.js'
import taskRoutes from './tasks.js'
import alertRoutes from './alerts.js'
import approvalRoutes from './approvals.js'
import targetRoutes from './targets.js'
import recommendationRoutes from './recommendations.js'
import statisticsRoutes from './statistics.js'
import userRoutes from './users.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/tasks', taskRoutes)
router.use('/alerts', alertRoutes)
router.use('/approvals', approvalRoutes)
router.use('/targets', targetRoutes)
router.use('/recommendations', recommendationRoutes)
router.use('/statistics', statisticsRoutes)
router.use('/users', userRoutes)

export default router
