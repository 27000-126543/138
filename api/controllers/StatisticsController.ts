import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { statisticsService } from '../services/StatisticsService.js'
import type { DailyStats } from '../../shared/types.js'
import { getDb } from '../db/index.js'

export const dailyStatsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export const performanceTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export const accuracyBoxPlotQuerySchema = z.object({
  method: z.string().optional(),
})

export const resourceConsumptionQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const db = getDb()

    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const taskStats = db
      .prepare(
        `SELECT
          COUNT(*) as totalTasks,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedTasks,
          SUM(CASE WHEN status = 'running' OR status LIKE '%_calculation' OR status LIKE '%_building' OR status LIKE '%_minimization' OR status LIKE '%_equilibration' THEN 1 ELSE 0 END) as runningTasks,
          SUM(CASE WHEN status = 'error_rollback' THEN 1 ELSE 0 END) as failedTasks,
          SUM(CASE WHEN status = 'pending_validation' THEN 1 ELSE 0 END) as pendingTasks
        FROM simulation_tasks`,
      )
      .get() as {
      totalTasks: number
      completedTasks: number
      runningTasks: number
      failedTasks: number
      pendingTasks: number
    }

    const alertStats = db
      .prepare(
        `SELECT
          COUNT(*) as totalAlerts,
          SUM(CASE WHEN reviewed_by IS NULL THEN 1 ELSE 0 END) as unreviewedAlerts,
          SUM(CASE WHEN level = 'critical' OR level = 'fatal' THEN 1 ELSE 0 END) as criticalAlerts
        FROM alerts WHERE timestamp >= ?`,
      )
      .get(thirtyDaysAgo) as {
      totalAlerts: number
      unreviewedAlerts: number
      criticalAlerts: number
    }

    const approvalStats = db
      .prepare(
        `SELECT
          COUNT(*) as totalApprovals,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingApprovals
        FROM approvals`,
      )
      .get() as {
      totalApprovals: number
      pendingApprovals: number
    }

    const performanceData = await statisticsService.getPerformanceTrendData(7)
    const completionRate = await statisticsService.getCompletionRate(
      thirtyDaysAgo,
      today,
    )

    res.status(200).json({
      success: true,
      data: {
        tasks: {
          total: taskStats.totalTasks,
          completed: taskStats.completedTasks,
          running: taskStats.runningTasks,
          failed: taskStats.failedTasks,
          pending: taskStats.pendingTasks,
          completionRate:
            taskStats.totalTasks > 0
              ? (taskStats.completedTasks / taskStats.totalTasks) * 100
              : 0,
        },
        alerts: {
          total: alertStats.totalAlerts,
          unreviewed: alertStats.unreviewedAlerts,
          critical: alertStats.criticalAlerts,
        },
        approvals: {
          total: approvalStats.totalApprovals,
          pending: approvalStats.pendingApprovals,
        },
        recentTrend: performanceData,
        periodStats: completionRate,
      },
    })
  } catch (error) {
    next(error)
  }
}

export const getDailyStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as z.infer<
      typeof dailyStatsQuerySchema
    >

    const today = new Date().toISOString().split('T')[0]
    const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const stats = await statisticsService.getCompletionRate(
      startDate || defaultStart,
      endDate || today,
    )

    const dailyStats: DailyStats[] = []
    const currentDate = new Date(startDate || defaultStart)
    const end = new Date(endDate || today)

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const daily = await statisticsService.generateDailyStats(dateStr)
      dailyStats.push(daily)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    res.status(200).json({
      success: true,
      data: {
        summary: stats,
        daily: dailyStats,
      },
    })
  } catch (error) {
    next(error)
  }
}

export const getPerformanceTrend = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { days } = req.query as z.infer<typeof performanceTrendQuerySchema>

    const trendData = await statisticsService.getPerformanceTrendData(days)

    res.status(200).json({
      success: true,
      data: {
        days,
        trend: trendData,
      },
    })
  } catch (error) {
    next(error)
  }
}

export const getAccuracyBoxPlot = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { method } = req.query as z.infer<typeof accuracyBoxPlotQuerySchema>

    const boxPlotData = await statisticsService.getAccuracyBoxPlotData(method)

    res.status(200).json({
      success: true,
      data: boxPlotData,
    })
  } catch (error) {
    next(error)
  }
}

export const getResourceConsumption = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as z.infer<
      typeof resourceConsumptionQuerySchema
    >

    const today = new Date().toISOString().split('T')[0]
    const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const resourceData = await statisticsService.getResourceConsumption(
      startDate || defaultStart,
      endDate || today,
    )

    res.status(200).json({
      success: true,
      data: resourceData,
    })
  } catch (error) {
    next(error)
  }
}
