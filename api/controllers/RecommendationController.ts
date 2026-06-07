import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { NotFoundError } from '../lib/errors.js'
import { recommendationService } from '../services/RecommendationService.js'
import { statisticsService } from '../services/StatisticsService.js'
import type { Recommendation } from '../../shared/types.js'
import { getDb } from '../db/index.js'

export const getRecommendationQuerySchema = z.object({
  targetId: z.string().min(1, '靶标ID不能为空'),
  ligandType: z.enum(['small_molecule', 'covalent', 'macrocycle', 'peptide']).default('small_molecule'),
})

export const getMethodComparisonQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export const getRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { targetId, ligandType } = req.query as z.infer<
      typeof getRecommendationQuerySchema
    >

    const db = getDb()
    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetId)
    if (!target) {
      throw new NotFoundError('靶标不存在')
    }

    const recommendation = await recommendationService.recommendMethod(
      targetId,
      ligandType,
    )

    res.status(200).json({
      success: true,
      data: recommendation,
    })
  } catch (error) {
    next(error)
  }
}

export const getMethodComparison = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as z.infer<
      typeof getMethodComparisonQuerySchema
    >

    const today = new Date()
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const defaultEnd = today.toISOString().split('T')[0]

    const comparison = await statisticsService.getMethodComparison(
      startDate || defaultStart,
      endDate || defaultEnd,
    )

    res.status(200).json({
      success: true,
      data: {
        startDate: startDate || defaultStart,
        endDate: endDate || defaultEnd,
        methods: comparison,
      },
    })
  } catch (error) {
    next(error)
  }
}
