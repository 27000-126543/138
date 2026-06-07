import { ref, onUnmounted } from 'vue';
import { io, type Socket } from 'socket.io-client';
import type { MonitoringData, Alert, SimulationTask } from '@shared/types';

interface UseSocketOptions {
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface SocketCallbacks {
  onTaskStatusUpdate?: (data: { taskId: string; status: SimulationTask['status']; progress: number }) => void;
  onMonitoringData?: (data: MonitoringData) => void;
  onAlert?: (alert: Alert) => void;
  onTaskCompleted?: (task: SimulationTask) => void;
  onTaskFailed?: (data: { taskId: string; error: string }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    autoConnect = true,
    reconnectionAttempts = 10,
    reconnectionDelay = 3000
  } = options;

  const socket = ref<Socket | null>(null);
  const isConnected = ref(false);
  const isReconnecting = ref(false);
  const reconnectAttempts = ref(0);

  const callbacks: SocketCallbacks = {};

  const getToken = (): string | null => {
    return localStorage.getItem('token');
  };

  const connect = () => {
    const token = getToken();
    if (!token) {
      console.warn('No token found, cannot connect to socket');
      return;
    }

    if (socket.value) {
      socket.value.disconnect();
    }

    socket.value = io({
      transports: ['websocket', 'polling'],
      autoConnect,
      reconnection: true,
      reconnectionAttempts,
      reconnectionDelay,
      auth: {
        token: `Bearer ${token}`
      }
    });

    socket.value.on('connect', () => {
      isConnected.value = true;
      isReconnecting.value = false;
      reconnectAttempts.value = 0;
      callbacks.onConnect?.();
    });

    socket.value.on('disconnect', (reason) => {
      isConnected.value = false;
      if (reason === 'io server disconnect') {
        setTimeout(() => connect(), reconnectionDelay);
      }
      callbacks.onDisconnect?.();
    });

    socket.value.on('connect_error', (error) => {
      isReconnecting.value = true;
      reconnectAttempts.value++;
      callbacks.onError?.(error as Error);
    });

    socket.value.on('task:status', (data: { taskId: string; status: SimulationTask['status']; progress: number }) => {
      callbacks.onTaskStatusUpdate?.(data);
    });

    socket.value.on('task:monitoring', (data: MonitoringData) => {
      callbacks.onMonitoringData?.(data);
    });

    socket.value.on('task:alert', (alert: Alert) => {
      callbacks.onAlert?.(alert);
    });

    socket.value.on('task:completed', (task: SimulationTask) => {
      callbacks.onTaskCompleted?.(task);
    });

    socket.value.on('task:failed', (data: { taskId: string; error: string }) => {
      callbacks.onTaskFailed?.(data);
    });

    socket.value.connect();
  };

  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
    isConnected.value = false;
  };

  const subscribeToTask = (taskId: string) => {
    if (socket.value && isConnected.value) {
      socket.value.emit('task:subscribe', { taskId });
    }
  };

  const unsubscribeFromTask = (taskId: string) => {
    if (socket.value && isConnected.value) {
      socket.value.emit('task:unsubscribe', { taskId });
    }
  };

  const subscribeToAlerts = () => {
    if (socket.value && isConnected.value) {
      socket.value.emit('alerts:subscribe');
    }
  };

  const unsubscribeFromAlerts = () => {
    if (socket.value && isConnected.value) {
      socket.value.emit('alerts:unsubscribe');
    }
  };

  const on = <K extends keyof SocketCallbacks>(event: K, callback: NonNullable<SocketCallbacks[K]>) => {
    callbacks[event] = callback;
  };

  const off = <K extends keyof SocketCallbacks>(event: K) => {
    delete callbacks[event];
  };

  onUnmounted(() => {
    disconnect();
  });

  return {
    socket,
    isConnected,
    isReconnecting,
    reconnectAttempts,
    connect,
    disconnect,
    subscribeToTask,
    unsubscribeFromTask,
    subscribeToAlerts,
    unsubscribeFromAlerts,
    on,
    off
  };
}

export default useSocket;
