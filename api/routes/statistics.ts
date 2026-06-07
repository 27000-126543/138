import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { validateQuery } from '../middleware/validation.js'
import {
  getDashboardStats,
  getDailyStats,
  getPerformanceTrend,
  getAccuracyBoxPlot,
  getResourceConsumption,
  dailyStatsQuerySchema,
  performanceTrendQuerySchema,
  accuracyBoxPlotQuerySchema,
  resourceConsumptionQuerySchema,
} from '../controllers/StatisticsController.js'

const router = Router()

router.get('/dashboard', authenticate, getDashboardStats)
router.get('/daily', authenticate, validateQuery(dailyStatsQuerySchema), getDailyStats)
router.get('/performance-trend', authenticate, validateQuery(performanceTrendQuerySchema), getPerformanceTrend)
router.get('/accuracy-boxplot', authenticate, validateQuery(accuracyBoxPlotQuerySchema), getAccuracyBoxPlot)
router.get('/resources', authenticate, validateQuery(resourceConsumptionQuerySchema), getResourceConsumption)

export default router
