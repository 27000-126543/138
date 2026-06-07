import { createMachine, interpret, type ActorRef } from 'xstate';
import { taskRepository } from '../repositories/TaskRepository.js';
import { getSocket } from '../lib/socket.js';
import type { SimulationTask } from '../../shared/types.js';
import { SimulationStatus } from '../../shared/types.js';
import { config } from '../config/index.js';

export interface StateMachineContext {
  taskId: string;
  task?: SimulationTask;
  error?: string;
  progress: number;
  currentStep?: string;
}

export type StateMachineEvents =
  | { type: 'START' }
  | { type: 'VALIDATE_SUCCESS' }
  | { type: 'VALIDATE_FAIL'; error: string }
  | { type: 'BUILD_SUCCESS' }
  | { type: 'BUILD_FAIL'; error: string }
  | { type: 'MINIMIZE_SUCCESS' }
  | { type: 'MINIMIZE_FAIL'; error: string }
  | { type: 'EQUILIBRATE_SUCCESS' }
  | { type: 'EQUILIBRATE_FAIL'; error: string }
  | { type: 'FEP_SUCCESS' }
  | { type: 'FEP_FAIL'; error: string }
  | { type: 'RETRY' }
  | { type: 'RESET'; error: string };

type SimulationActor = ActorRef<any, any>;

const createSimulationMachine = (taskId: string) => {
  return createMachine({
    id: `simulation-${taskId}`,
    initial: SimulationStatus.PENDING_VALIDATION,
    context: {
      taskId,
      progress: 0,
    } as StateMachineContext,
    states: {
      [SimulationStatus.PENDING_VALIDATION]: {
        entry: ['onEnterState'],
        exit: ['onExitState'],
        on: {
          VALIDATE_SUCCESS: {
            target: SimulationStatus.SYSTEM_BUILDING,
            actions: ['updateProgress'],
          },
          VALIDATE_FAIL: {
            target: SimulationStatus.ERROR_ROLLBACK,
            actions: ['handleError'],
          },
        },
      },
      [SimulationStatus.SYSTEM_BUILDING]: {
        entry: ['onEnterState'],
        exit: ['onExitState'],
        on: {
          BUILD_SUCCESS: {
            target: SimulationStatus.ENERGY_MINIMIZATION,
            actions: ['updateProgress'],
          },
          BUILD_FAIL: {
            target: SimulationStatus.ERROR_ROLLBACK,
            actions: ['handleError'],
          },
        },
      },
      [SimulationStatus.ENERGY_MINIMIZATION]: {
        entry: ['onEnterState'],
        exit: ['onExitState'],
        on: {
          MINIMIZE_SUCCESS: {
            target: SimulationStatus.EQUILIBRATION,
            actions: ['updateProgress'],
          },
          MINIMIZE_FAIL: {
            target: SimulationStatus.ERROR_ROLLBACK,
            actions: ['handleError'],
          },
        },
      },
      [SimulationStatus.EQUILIBRATION]: {
        entry: ['onEnterState'],
        exit: ['onExitState'],
        on: {
          EQUILIBRATE_SUCCESS: {
            target: SimulationStatus.FEP_CALCULATION,
            actions: ['updateProgress'],
          },
          EQUILIBRATE_FAIL: {
            target: SimulationStatus.ERROR_ROLLBACK,
            actions: ['handleError'],
          },
        },
      },
      [SimulationStatus.FEP_CALCULATION]: {
        entry: ['onEnterState'],
        exit: ['onExitState'],
        on: {
          FEP_SUCCESS: {
            target: SimulationStatus.COMPLETED,
            actions: ['updateProgress'],
          },
          FEP_FAIL: {
            target: SimulationStatus.ERROR_ROLLBACK,
            actions: ['handleError'],
          },
        },
      },
      [SimulationStatus.COMPLETED]: {
        entry: ['onEnterState', 'onComplete'],
        type: 'final',
      },
      [SimulationStatus.ERROR_ROLLBACK]: {
        entry: ['onEnterState', 'onError'],
        on: {
          RETRY: {
            target: SimulationStatus.PENDING_VALIDATION,
            actions: ['resetProgress'],
          },
        },
      },
    },
  }, {
    actions: {
      onEnterState: ({ context, event }: any) => {
        const eventType = (event as any).type || 'xstate.init';
        const targetStates = [
          SimulationStatus.PENDING_VALIDATION,
          SimulationStatus.SYSTEM_BUILDING,
          SimulationStatus.ENERGY_MINIMIZATION,
          SimulationStatus.EQUILIBRATION,
          SimulationStatus.FEP_CALCULATION,
          SimulationStatus.COMPLETED,
          SimulationStatus.ERROR_ROLLBACK,
        ];
        
        let currentState = SimulationStatus.ERROR_ROLLBACK;
        
        if (eventType === 'xstate.init') {
          currentState = SimulationStatus.PENDING_VALIDATION;
        } else if (eventType.includes('SUCCESS')) {
          const stateKey = eventType.replace('_SUCCESS', '');
          const stateIndex = targetStates.findIndex(s => 
            s.toUpperCase().replace(/_/g, '') === stateKey
          );
          if (stateIndex >= 0 && stateIndex < targetStates.length - 1) {
            currentState = targetStates[stateIndex + 1];
          }
        } else if (eventType.includes('FAIL')) {
          currentState = SimulationStatus.ERROR_ROLLBACK;
        } else if (eventType === 'RETRY') {
          currentState = SimulationStatus.PENDING_VALIDATION;
        }

        const updatedTask = taskRepository.updateStatus(context.taskId, currentState);
        
        if (updatedTask) {
          const io = getSocket();
          io.emit('task:status', {
            taskId: context.taskId,
            status: currentState,
            task: updatedTask,
            timestamp: new Date().toISOString(),
          });
        }
      },
      onExitState: ({ context, event }: any) => {
        const io = getSocket();
        io.emit('task:transition', {
          taskId: context.taskId,
          event: (event as any).type,
          timestamp: new Date().toISOString(),
        });
      },
      updateProgress: ({ context }: any) => {
        const stateOrder = [
          SimulationStatus.PENDING_VALIDATION,
          SimulationStatus.SYSTEM_BUILDING,
          SimulationStatus.ENERGY_MINIMIZATION,
          SimulationStatus.EQUILIBRATION,
          SimulationStatus.FEP_CALCULATION,
          SimulationStatus.COMPLETED,
        ];
        
        const task = taskRepository.findById(context.taskId);
        if (task) {
          const currentIndex = stateOrder.indexOf(task.status as SimulationStatus);
          const progress = Math.round(((currentIndex + 1) / stateOrder.length) * 100);
          taskRepository.updateProgress(context.taskId, progress, task.status);
        }
      },
      handleError: ({ context, event }: any) => {
        const errorEvent = event as any;
        context.error = errorEvent.error;
        
        const task = taskRepository.findById(context.taskId);
        if (task) {
          taskRepository.incrementRetry(context.taskId, errorEvent.error);
        }
        
        const io = getSocket();
        io.emit('task:error', {
          taskId: context.taskId,
          error: errorEvent.error,
          timestamp: new Date().toISOString(),
        });
      },
      onComplete: ({ context }: any) => {
        const now = new Date().toISOString();
        const task = taskRepository.findById(context.taskId);
        if (task) {
          taskRepository.update(context.taskId, {
            completedAt: now,
            progress: 100,
          } as Partial<SimulationTask>);
        }
        
        const io = getSocket();
        io.emit('task:complete', {
          taskId: context.taskId,
          completedAt: now,
          timestamp: now,
        });
      },
      onError: ({ context }: any) => {
        const io = getSocket();
        io.emit('task:rollback', {
          taskId: context.taskId,
          error: context.error,
          timestamp: new Date().toISOString(),
        });
      },
      resetProgress: ({ context }: any) => {
        taskRepository.updateProgress(context.taskId, 0, SimulationStatus.PENDING_VALIDATION);
        context.error = undefined;
      },
    },
    guards: {
      canRetry: ({ context }: any) => {
        const task = taskRepository.findById(context.taskId);
        return task ? task.retryCount < config.simulation.maxRetries : false;
      },
    },
  });
};

export class StateMachineService {
  private actors: Map<string, SimulationActor> = new Map();

  createMachine(taskId: string): SimulationActor {
    const existing = this.actors.get(taskId);
    if (existing) {
      return existing;
    }

    const machine = createSimulationMachine(taskId);
    const actor = interpret(machine) as unknown as SimulationActor;
    
    actor.subscribe((state: any) => {
      const io = getSocket();
      io.emit('task:state', {
        taskId,
        state: state.value,
        context: state.context,
        timestamp: new Date().toISOString(),
      });
    });

    actor.start();
    this.actors.set(taskId, actor);
    
    return actor;
  }

  getActor(taskId: string): SimulationActor | undefined {
    return this.actors.get(taskId);
  }

  sendEvent(taskId: string, event: StateMachineEvents): boolean {
    const actor = this.actors.get(taskId);
    if (!actor) {
      return false;
    }
    
    try {
      actor.send(event);
      return true;
    } catch (error) {
      console.error(`Failed to send event ${event.type} to task ${taskId}:`, error);
      
      const errorState = actor.getSnapshot() as any;
      if (errorState.value !== SimulationStatus.ERROR_ROLLBACK) {
        taskRepository.updateStatus(taskId, SimulationStatus.ERROR_ROLLBACK);
        
        const io = getSocket();
        io.emit('task:error', {
          taskId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
      
      return false;
    }
  }

  stopMachine(taskId: string): boolean {
    const actor = this.actors.get(taskId);
    if (!actor) {
      return false;
    }
    
    actor.stop();
    this.actors.delete(taskId);
    return true;
  }

  transitionToNext(taskId: string): boolean {
    const actor = this.actors.get(taskId);
    if (!actor) {
      return false;
    }

    const state = actor.getSnapshot() as any;
    const currentState = state.value as SimulationStatus;

    const transitionMap: Record<SimulationStatus, StateMachineEvents['type']> = {
      [SimulationStatus.PENDING_VALIDATION]: 'VALIDATE_SUCCESS',
      [SimulationStatus.SYSTEM_BUILDING]: 'BUILD_SUCCESS',
      [SimulationStatus.ENERGY_MINIMIZATION]: 'MINIMIZE_SUCCESS',
      [SimulationStatus.EQUILIBRATION]: 'EQUILIBRATE_SUCCESS',
      [SimulationStatus.FEP_CALCULATION]: 'FEP_SUCCESS',
      [SimulationStatus.COMPLETED]: 'FEP_SUCCESS',
      [SimulationStatus.ERROR_ROLLBACK]: 'RETRY',
    };

    const eventType = transitionMap[currentState];
    if (eventType) {
      return this.sendEvent(taskId, { type: eventType } as StateMachineEvents);
    }

    return false;
  }

  handleError(taskId: string, error: string): boolean {
    const actor = this.actors.get(taskId);
    if (!actor) {
      return false;
    }

    const state = actor.getSnapshot() as any;
    const currentState = state.value as SimulationStatus;

    const errorTransitionMap: Record<SimulationStatus, StateMachineEvents['type']> = {
      [SimulationStatus.PENDING_VALIDATION]: 'VALIDATE_FAIL',
      [SimulationStatus.SYSTEM_BUILDING]: 'BUILD_FAIL',
      [SimulationStatus.ENERGY_MINIMIZATION]: 'MINIMIZE_FAIL',
      [SimulationStatus.EQUILIBRATION]: 'EQUILIBRATE_FAIL',
      [SimulationStatus.FEP_CALCULATION]: 'FEP_FAIL',
      [SimulationStatus.COMPLETED]: 'FEP_FAIL',
      [SimulationStatus.ERROR_ROLLBACK]: 'RESET',
    };

    const eventType = errorTransitionMap[currentState];
    if (eventType) {
      return this.sendEvent(taskId, { type: eventType, error } as StateMachineEvents);
    }

    return false;
  }

  getCurrentState(taskId: string): SimulationStatus | undefined {
    const actor = this.actors.get(taskId);
    if (!actor) {
      return undefined;
    }

    const state = actor.getSnapshot() as any;
    return state.value as SimulationStatus;
  }

  retry(taskId: string): boolean {
    const task = taskRepository.findById(taskId);
    if (!task || task.retryCount >= config.simulation.maxRetries) {
      return false;
    }
    return this.sendEvent(taskId, { type: 'RETRY' });
  }
}

export const stateMachineService = new StateMachineService();
