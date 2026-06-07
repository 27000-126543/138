import type { Job } from 'bullmq';
import { simulationEngineService } from '../../services/SimulationEngineService.js';
import { stateMachineService } from '../../services/StateMachineService.js';
import { monitoringService } from '../../services/MonitoringService.js';
import { taskRepository } from '../../repositories/TaskRepository.js';
import { getSocket } from '../../lib/socket.js';
import { addAlertTask } from '../../lib/queues.js';
import type { SimulationJobData } from '../../lib/queues.js';
import { SimulationStatus, AlertLevel } from '../../../shared/types.js';
import { config } from '../../config/index.js';

interface SimulationProgress {
  stage: SimulationStatus;
  progress: number;
  step: number;
  totalSteps: number;
  message: string;
}

export class SimulationJob {
  private job: Job<SimulationJobData>;
  private taskId: string;
  private actor: any;

  constructor(job: Job<SimulationJobData>) {
    this.job = job;
    this.taskId = job.data.taskId;
  }

  async process(): Promise<void> {
    const task = taskRepository.findById(this.taskId);
    if (!task) {
      throw new Error(`任务 ${this.taskId} 不存在`);
    }

    this.actor = stateMachineService.createMachine(this.taskId);

    try {
      await this.updateProgress({
        stage: task.status as SimulationStatus,
        progress: 0,
        step: 0,
        totalSteps: 100,
        message: '开始模拟任务',
      });

      if (!this.job.data.skipValidation) {
        await this.validateTask();
      }

      await this.runSimulationStages();

      await this.onComplete();
    } catch (error) {
      await this.handleError(error);
      throw error;
    }
  }

  private async validateTask(): Promise<void> {
    const task = taskRepository.findById(this.taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    await this.updateProgress({
      stage: SimulationStatus.PENDING_VALIDATION,
      progress: 5,
      step: 0,
      totalSteps: 1,
      message: '正在校验输入文件...',
    });

    if (task.proteinFilePath) {
      const protein = simulationEngineService.parsePDB(task.proteinFilePath);
      if (protein.atoms.length === 0) {
        throw new Error('PDB 文件解析失败，未找到原子数据');
      }
    }

    if (task.ligandFilePath) {
      const ligand = simulationEngineService.parseSDF(task.ligandFilePath);
      if (ligand.atoms.length === 0) {
        throw new Error('SDF 文件解析失败，未找到原子数据');
      }
    }

    stateMachineService.sendEvent(this.taskId, { type: 'VALIDATE_SUCCESS' });

    await this.updateProgress({
      stage: SimulationStatus.SYSTEM_BUILDING,
      progress: 10,
      step: 1,
      totalSteps: 5,
      message: '输入文件校验通过',
    });
  }

  private async runSimulationStages(): Promise<void> {
    const stages = [
      {
        status: SimulationStatus.SYSTEM_BUILDING,
        handler: this.buildSystem.bind(this),
        progressStart: 10,
        progressEnd: 30,
        eventSuccess: 'BUILD_SUCCESS',
        eventFail: 'BUILD_FAIL',
      },
      {
        status: SimulationStatus.ENERGY_MINIMIZATION,
        handler: this.runEnergyMinimization.bind(this),
        progressStart: 30,
        progressEnd: 50,
        eventSuccess: 'MINIMIZE_SUCCESS',
        eventFail: 'MINIMIZE_FAIL',
      },
      {
        status: SimulationStatus.EQUILIBRATION,
        handler: this.runEquilibration.bind(this),
        progressStart: 50,
        progressEnd: 75,
        eventSuccess: 'EQUILIBRATE_SUCCESS',
        eventFail: 'EQUILIBRATE_FAIL',
      },
      {
        status: SimulationStatus.FEP_CALCULATION,
        handler: this.runFEPCalculation.bind(this),
        progressStart: 75,
        progressEnd: 100,
        eventSuccess: 'FEP_SUCCESS',
        eventFail: 'FEP_FAIL',
      },
    ];

    for (const stage of stages) {
      const currentState = stateMachineService.getCurrentState(this.taskId);
      
      if (currentState === SimulationStatus.ERROR_ROLLBACK) {
        throw new Error('模拟已进入错误回退状态，终止执行');
      }

      if (currentState !== stage.status) {
        continue;
      }

      try {
        await stage.handler(stage.progressStart, stage.progressEnd);
        stateMachineService.sendEvent(this.taskId, { type: stage.eventSuccess as any });
      } catch (error) {
        stateMachineService.sendEvent(this.taskId, { 
          type: stage.eventFail as any, 
          error: error instanceof Error ? error.message : '未知错误' 
        });
        throw error;
      }
    }
  }

  private async buildSystem(startProgress: number, endProgress: number): Promise<void> {
    const task = taskRepository.findById(this.taskId);
    if (!task || !task.proteinFilePath || !task.ligandFilePath) {
      throw new Error('任务文件路径不完整');
    }

    await this.updateProgress({
      stage: SimulationStatus.SYSTEM_BUILDING,
      progress: startProgress,
      step: 0,
      totalSteps: 4,
      message: '正在解析蛋白质结构...',
    });

    const protein = simulationEngineService.parsePDB(task.proteinFilePath);
    
    await this.updateProgress({
      stage: SimulationStatus.SYSTEM_BUILDING,
      progress: startProgress + (endProgress - startProgress) * 0.25,
      step: 1,
      totalSteps: 4,
      message: '正在解析配体结构...',
    });

    const ligand = simulationEngineService.parseSDF(task.ligandFilePath);
    
    await this.updateProgress({
      stage: SimulationStatus.SYSTEM_BUILDING,
      progress: startProgress + (endProgress - startProgress) * 0.5,
      step: 2,
      totalSteps: 4,
      message: '正在识别结合位点...',
    });

    const bindingSite = task.bindingSite || simulationEngineService.identifyBindingSite(protein, ligand);
    
    await this.updateProgress({
      stage: SimulationStatus.SYSTEM_BUILDING,
      progress: startProgress + (endProgress - startProgress) * 0.75,
      step: 3,
      totalSteps: 4,
      message: '正在构建复合物体系...',
    });

    let complex = simulationEngineService.buildComplex(protein, ligand, bindingSite);
    complex = simulationEngineService.initializeForceField(complex, task.forceField);
    complex = simulationEngineService.setupSolvent(complex, 'tip3p', task.saltConcentration);

    taskRepository.update(this.taskId, {
      bindingSite,
    } as any);

    await this.updateProgress({
      stage: SimulationStatus.SYSTEM_BUILDING,
      progress: endProgress,
      step: 4,
      totalSteps: 4,
      message: `体系构建完成，共 ${complex.totalAtoms} 个原子`,
    });
  }

  private async runEnergyMinimization(startProgress: number, endProgress: number): Promise<void> {
    await this.updateProgress({
      stage: SimulationStatus.ENERGY_MINIMIZATION,
      progress: startProgress,
      step: 0,
      totalSteps: 500,
      message: '开始能量最小化...',
    });

    const onProgress = (step: number, totalSteps: number, data: any) => {
      const progress = startProgress + (endProgress - startProgress) * (step / totalSteps);
      this.updateProgress({
        stage: SimulationStatus.ENERGY_MINIMIZATION,
        progress: Math.round(progress * 10) / 10,
        step,
        totalSteps,
        message: `能量最小化进行中: ${step}/${totalSteps}`,
      });

      if (step % 10 === 0) {
        monitoringService.processMonitoringData(this.taskId, {
          taskId: this.taskId,
          timestamp: new Date().toISOString(),
          rmsd: data.rmsd,
          potentialEnergy: data.potentialEnergy,
          temperature: data.temperature,
          pressure: data.pressure,
          volume: data.volume,
        });
      }
    };

    const result = await simulationEngineService.energyMinimization(this.taskId, 500);
    
    if (!result.success) {
      throw new Error(result.error || '能量最小化失败');
    }

    await this.checkConvergence(SimulationStatus.ENERGY_MINIMIZATION);

    await this.updateProgress({
      stage: SimulationStatus.ENERGY_MINIMIZATION,
      progress: endProgress,
      step: 500,
      totalSteps: 500,
      message: `能量最小化完成，最终能量: ${result.finalEnergy?.toFixed(1)} kJ/mol`,
    });
  }

  private async runEquilibration(startProgress: number, endProgress: number): Promise<void> {
    await this.updateProgress({
      stage: SimulationStatus.EQUILIBRATION,
      progress: startProgress,
      step: 0,
      totalSteps: 1000,
      message: '开始平衡模拟...',
    });

    const onProgress = (step: number, totalSteps: number, data: any) => {
      const progress = startProgress + (endProgress - startProgress) * (step / totalSteps);
      const phase = step / totalSteps < 0.5 ? '加热阶段' : '平衡阶段';
      this.updateProgress({
        stage: SimulationStatus.EQUILIBRATION,
        progress: Math.round(progress * 10) / 10,
        step,
        totalSteps,
        message: `平衡模拟进行中 (${phase}): ${step}/${totalSteps}`,
      });

      if (step % 20 === 0) {
        monitoringService.processMonitoringData(this.taskId, {
          taskId: this.taskId,
          timestamp: new Date().toISOString(),
          rmsd: data.rmsd,
          potentialEnergy: data.potentialEnergy,
          temperature: data.temperature,
          pressure: data.pressure,
          volume: data.volume,
        });
      }
    };

    const result = await simulationEngineService.equilibration(this.taskId, 1000);
    
    if (!result.success) {
      throw new Error(result.error || '平衡模拟失败');
    }

    await this.checkConvergence(SimulationStatus.EQUILIBRATION);

    await this.updateProgress({
      stage: SimulationStatus.EQUILIBRATION,
      progress: endProgress,
      step: 1000,
      totalSteps: 1000,
      message: `平衡模拟完成，最终 RMSD: ${result.finalRMSD?.toFixed(3)} Å`,
    });
  }

  private async runFEPCalculation(startProgress: number, endProgress: number): Promise<void> {
    await this.updateProgress({
      stage: SimulationStatus.FEP_CALCULATION,
      progress: startProgress,
      step: 0,
      totalSteps: 5500,
      message: '开始自由能微扰计算...',
    });

    const lambdaWindows = 11;
    const stepsPerWindow = 500;
    const totalSteps = lambdaWindows * stepsPerWindow;

    const onProgress = (step: number, totalSteps: number, data: any, windowIndex: number) => {
      const progress = startProgress + (endProgress - startProgress) * (step / totalSteps);
      this.updateProgress({
        stage: SimulationStatus.FEP_CALCULATION,
        progress: Math.round(progress * 10) / 10,
        step,
        totalSteps,
        message: `FEP 计算进行中: λ窗口 ${windowIndex + 1}/${lambdaWindows}, ${step % stepsPerWindow}/${stepsPerWindow}`,
      });

      if (step % 50 === 0) {
        monitoringService.processMonitoringData(this.taskId, {
          taskId: this.taskId,
          timestamp: new Date().toISOString(),
          rmsd: data.rmsd,
          potentialEnergy: data.potentialEnergy,
          temperature: data.temperature,
          pressure: data.pressure,
          volume: data.volume,
        });
      }
    };

    const result = await simulationEngineService.fepCalculation(this.taskId, lambdaWindows);
    
    if (!result.success) {
      throw new Error(result.error || 'FEP 计算失败');
    }

    await this.updateProgress({
      stage: SimulationStatus.FEP_CALCULATION,
      progress: endProgress,
      step: totalSteps,
      totalSteps,
      message: `FEP 计算完成，最终能量: ${result.finalEnergy?.toFixed(1)} kJ/mol`,
    });
  }

  private async checkConvergence(stage: SimulationStatus): Promise<void> {
    const convergence = monitoringService.detectConvergence(this.taskId, 50);
    
    if (!convergence.converged) {
      await addAlertTask({
        taskId: this.taskId,
        alertId: `conv-${this.taskId}-${Date.now()}`,
        level: AlertLevel.WARNING,
        message: `${stage} 阶段收敛性检查未通过: RMSD趋势=${convergence.rmsdTrend}, 能量趋势=${convergence.energyTrend}`,
        notifyChannels: ['socket', 'inapp'],
      });
    }
  }

  private async updateProgress(data: SimulationProgress): Promise<void> {
    this.job.updateProgress(data);

    taskRepository.updateProgress(this.taskId, data.progress, data.stage);

    const io = getSocket();
    io.emit('task:progress', {
      taskId: this.taskId,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  private async handleError(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    console.error(`模拟任务 ${this.taskId} 失败:`, error);

    stateMachineService.handleError(this.taskId, errorMessage);

    await addAlertTask({
      taskId: this.taskId,
      alertId: `error-${this.taskId}-${Date.now()}`,
      level: AlertLevel.CRITICAL,
      message: `模拟任务失败: ${errorMessage}`,
      notifyChannels: ['socket', 'inapp', 'email'],
    });

    const io = getSocket();
    io.emit('task:error', {
      taskId: this.taskId,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }

  private async onComplete(): Promise<void> {
    const io = getSocket();
    io.emit('task:complete', {
      taskId: this.taskId,
      timestamp: new Date().toISOString(),
    });

    stateMachineService.stopMachine(this.taskId);
  }
}

export const processSimulationJob = async (job: Job<SimulationJobData>): Promise<void> => {
  const simulationJob = new SimulationJob(job);
  await simulationJob.process();
};
