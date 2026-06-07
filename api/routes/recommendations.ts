import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { validateQuery } from '../middleware/validation.js'
import {
  getRecommendation,
  getMethodComparison,
  getRecommendationQuerySchema,
  getMethodComparisonQuerySchema,
} from '../controllers/RecommendationController.js'

const router = Router()

router.get('/', authenticate, validateQuery(getRecommendationQuerySchema), getRecommendation)
router.get('/comparison', authenticate, validateQuery(getMethodComparisonQuerySchema), getMethodComparison)

export default router
