import { getDb } from '../db/index.js';
import { targetRepository } from '../repositories/TargetRepository.js';
import { taskRepository } from '../repositories/TaskRepository.js';
import { resultRepository } from '../repositories/ResultRepository.js';
import type { Target, SimulationTask, FreeEnergyResult, Recommendation } from '../../shared/types.js';
import { FEMethod } from '../../shared/types.js';
import { convertKeysToCamel } from '../utils/convertKeys.js';

export interface HistoricalPerformance {
  method: FEMethod;
  averageError: number;
  successRate: number;
  sampleSize: number;
  tasks: string[];
}

export class RecommendationService {
  async recommendMethod(targetId: string, ligandType: string): Promise<Recommendation> {
    const target = targetRepository.findById(targetId);
    if (!target) {
      throw new Error('靶标不存在');
    }

    const historicalPerformance = await this.analyzeHistoricalPerformance(targetId);
    const confidence = this.calculateConfidenceScore(historicalPerformance);

    let recommendedMethod: FEMethod;
    let reason: string;

    const fepPerformance = historicalPerformance.find(p => p.method === FEMethod.FEP);
    const tiPerformance = historicalPerformance.find(p => p.method === FEMethod.TI);
    const mmpbsaPerformance = historicalPerformance.find(p => p.method === FEMethod.MMPBSA);

    if (ligandType === 'covalent') {
      recommendedMethod = FEMethod.FEP;
      reason = '共价配体推荐使用FEP方法，可准确描述共价键形成过程';
    } else if (ligandType === 'macrocycle') {
      recommendedMethod = FEMethod.TI;
      reason = '大环配体推荐使用TI方法，对构象变化采样更充分';
    } else if (confidence < 0.5 || historicalPerformance.every(p => p.sampleSize < 3)) {
      recommendedMethod = FEMethod.MMPBSA;
      reason = '历史数据不足，推荐使用MM-PBSA方法进行快速初筛';
    } else {
      const sortedByError = [...historicalPerformance].sort((a, b) => a.averageError - b.averageError);
      recommendedMethod = sortedByError[0].method;
      reason = `基于历史性能，${FEMethod[recommendedMethod]}方法平均误差最低(${sortedByError[0].averageError.toFixed(2)} kcal/mol)`;
    }

    const samplingStrategy = this.recommendSamplingStrategy(targetId, recommendedMethod);
    const lambdaWindows = this.selectOptimalLambdaWindows(recommendedMethod, 0);

    return {
      method: recommendedMethod,
      confidence,
      reason,
      samplingStrategy: {
        ...samplingStrategy,
        lambdaWindows
      },
      historicalPerformance: historicalPerformance.map(p => ({
        method: p.method,
        averageError: p.averageError,
        successRate: p.successRate,
        sampleSize: p.sampleSize
      }))
    };
  }

  recommendSamplingStrategy(targetId: string, method: FEMethod): {
    equilibrationTime: number;
    productionTime: number;
    replicaCount: number;
    lambdaWindows: number;
  } {
    const target = targetRepository.findById(targetId);
    
    const baseConfig = {
      [FEMethod.FEP]: {
        equilibrationTime: 5,
        productionTime: 20,
        replicaCount: 5
      },
      [FEMethod.TI]: {
        equilibrationTime: 10,
        productionTime: 30,
        replicaCount: 3
      },
      [FEMethod.MMPBSA]: {
        equilibrationTime: 2,
        productionTime: 10,
        replicaCount: 1
      }
    };

    const config = baseConfig[method];
    const lambdaWindows = this.selectOptimalLambdaWindows(method, 0);

    return {
      ...config,
      lambdaWindows
    };
  }

  async analyzeHistoricalPerformance(targetId: string): Promise<HistoricalPerformance[]> {
    const target = targetRepository.findById(targetId);
    if (!target) {
      throw new Error('靶标不存在');
    }

    const db = getDb();
    const tasksRaw = db.prepare(
      'SELECT * FROM simulation_tasks WHERE target_id = ? AND status = ?'
    ).all(targetId, 'completed') as any[];
    const tasks = convertKeysToCamel(tasksRaw) as SimulationTask[];

    const taskIds = tasks.map(t => t.id);
    const results: FreeEnergyResult[] = [];
    
    for (const taskId of taskIds) {
      const taskResults = resultRepository.findByTaskId(taskId);
      results.push(...taskResults);
    }

    const performanceByMethod = new Map<FEMethod, { errors: number[]; successCount: number; totalCount: number; tasks: string[] }>();

    for (const result of results) {
      if (!performanceByMethod.has(result.method as FEMethod)) {
        performanceByMethod.set(result.method as FEMethod, {
          errors: [],
          successCount: 0,
          totalCount: 0,
          tasks: []
        });
      }

      const perf = performanceByMethod.get(result.method as FEMethod)!;
      perf.errors.push(result.standardError);
      perf.totalCount++;
      perf.tasks.push(result.taskId);

      const task = tasks.find(t => t.id === result.taskId);
      if (task && task.status === 'completed') {
        perf.successCount++;
      }
    }

    const performance: HistoricalPerformance[] = [];

    for (const method of Object.values(FEMethod)) {
      const perf = performanceByMethod.get(method);
      if (perf && perf.errors.length > 0) {
        const averageError = perf.errors.reduce((sum, e) => sum + e, 0) / perf.errors.length;
        const successRate = perf.totalCount > 0 ? (perf.successCount / perf.totalCount) * 100 : 0;

        performance.push({
          method,
          averageError,
          successRate,
          sampleSize: perf.errors.length,
          tasks: perf.tasks
        });
      } else {
        performance.push({
          method,
          averageError: 0,
          successRate: 0,
          sampleSize: 0,
          tasks: []
        });
      }
    }

    return performance;
  }

  calculateConfidenceScore(historicalData: HistoricalPerformance[]): number {
    const validData = historicalData.filter(d => d.sampleSize > 0);
    
    if (validData.length === 0) {
      return 0.1;
    }

    const totalSampleSize = validData.reduce((sum, d) => sum + d.sampleSize, 0);
    const avgSuccessRate = validData.reduce((sum, d) => sum + d.successRate, 0) / validData.length;
    const avgError = validData.reduce((sum, d) => sum + d.averageError, 0) / validData.length;

    const sampleSizeScore = Math.min(totalSampleSize / 20, 1);
    const successRateScore = avgSuccessRate / 100;
    const errorScore = Math.max(0, 1 - avgError / 2);

    const confidence = (sampleSizeScore * 0.4 + successRateScore * 0.3 + errorScore * 0.3);

    return Math.min(Math.max(confidence, 0.1), 0.99);
  }

  selectOptimalLambdaWindows(method: FEMethod, systemSize: number): number {
    const baseWindows: Record<FEMethod, number> = {
      [FEMethod.FEP]: 12,
      [FEMethod.TI]: 21,
      [FEMethod.MMPBSA]: 5
    };

    const base = baseWindows[method];
    
    if (systemSize > 100000) {
      return Math.floor(base * 1.5);
    } else if (systemSize > 50000) {
      return Math.floor(base * 1.2);
    } else if (systemSize < 10000) {
      return Math.max(Math.floor(base * 0.7), 3);
    }

    return base;
  }
}

export const recommendationService = new RecommendationService();
