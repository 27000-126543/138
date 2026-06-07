<script setup lang="ts">
import { computed } from 'vue';
import {
  FlaskConical,
  Clock,
  User,
  Target,
  Play,
  Pause,
  Square,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  RotateCcw
} from 'lucide-vue-next';
import type { SimulationTask } from '@shared/types';
import {
  SimulationStatus,
  FE_METHOD_LABELS,
  SIMULATION_STATUS_COLORS,
  SIMULATION_STATUS_LABELS
} from '@shared/types';
import StatusBadge from '../common/StatusBadge.vue';

interface Props {
  task: SimulationTask;
  showActions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true
});

const emit = defineEmits<{
  view: [taskId: string];
  start: [taskId: string];
  pause: [taskId: string];
  stop: [taskId: string];
  retry: [taskId: string];
}>();

const isRunning = computed(() => {
  return [
    SimulationStatus.SYSTEM_BUILDING,
    SimulationStatus.ENERGY_MINIMIZATION,
    SimulationStatus.EQUILIBRATION,
    SimulationStatus.FEP_CALCULATION
  ].includes(props.task.status);
});

const canStart = computed(() => {
  return props.task.status === SimulationStatus.PENDING_VALIDATION;
});

const canPause = computed(() => isRunning.value);
const canStop = computed(() => isRunning.value);
const canRetry = computed(() => props.task.status === SimulationStatus.ERROR_ROLLBACK);

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusDotColor = (status: SimulationStatus): string => {
  return SIMULATION_STATUS_COLORS[status];
};
</script>

<template>
  <div class="card-hover overflow-hidden group">
    <div class="p-5">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            :class="[
              task.status === SimulationStatus.COMPLETED
                ? 'bg-success-100 dark:bg-success-900/30'
                : task.status === SimulationStatus.ERROR_ROLLBACK
                  ? 'bg-danger-100 dark:bg-danger-900/30'
                  : 'bg-primary-100 dark:bg-primary-900/30'
            ]"
          >
            <FlaskConical
              class="w-5 h-5"
              :class="[
                task.status === SimulationStatus.COMPLETED
                  ? 'text-success-600 dark:text-success-400'
                  : task.status === SimulationStatus.ERROR_ROLLBACK
                    ? 'text-danger-600 dark:text-danger-400'
                    : 'text-primary-600 dark:text-primary-400'
              ]"
            />
          </div>
          <div class="flex-1 min-w-0">
            <h3
              class="font-semibold text-gray-900 dark:text-gray-100 truncate cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              @click="emit('view', task.id)"
            >
              {{ task.name }}
            </h3>
            <div class="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span class="flex items-center gap-1">
                <Target class="w-3 h-3" />
                {{ task.target?.name || '未知靶点' }}
              </span>
              <span class="flex items-center gap-1">
                <User class="w-3 h-3" />
                {{ task.creator?.username || '未知创建者' }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0 ml-3">
          <StatusBadge
            type="simulation"
            :status="task.status"
            show-icon
          />
          <div class="relative">
            <button class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <MoreHorizontal class="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="task.lastError" class="mb-3 p-2.5 bg-danger-50 dark:bg-danger-900/20 rounded-lg flex items-start gap-2">
        <AlertTriangle class="w-4 h-4 text-danger-500 flex-shrink-0 mt-0.5" />
        <p class="text-xs text-danger-700 dark:text-danger-400 line-clamp-2">
          {{ task.lastError }}
        </p>
      </div>

      <div class="mb-4">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
          <span class="flex items-center gap-1">
            <span
              class="w-2 h-2 rounded-full animate-pulse"
              :class="[
                isRunning ? getStatusDotColor(task.status) : 'bg-gray-300 dark:bg-gray-600'
              ]"
            />
            {{ SIMULATION_STATUS_LABELS[task.status] }}
          </span>
          <span>{{ task.progress }}%</span>
        </div>
        <div class="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="[
              task.status === SimulationStatus.COMPLETED
                ? 'bg-success-500'
                : task.status === SimulationStatus.ERROR_ROLLBACK
                  ? 'bg-danger-500'
                  : getStatusDotColor(task.status)
            ]"
            :style="{ width: `${task.progress}%` }"
          />
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">方法</p>
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
            {{ FE_METHOD_LABELS[task.feMethod]?.split(' ')[0] || '--' }}
          </p>
        </div>
        <div class="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">温度</p>
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
            {{ task.temperature }}K
          </p>
        </div>
        <div class="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">预计时间</p>
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
            {{ formatDuration(task.estimatedTime) }}
          </p>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700">
        <span class="flex items-center gap-1">
          <Clock class="w-3 h-3" />
          创建于 {{ formatDate(task.createdAt) }}
        </span>
        <span v-if="task.retryCount > 0" class="flex items-center gap-1 text-warning-600 dark:text-warning-400">
          <RotateCcw class="w-3 h-3" />
          重试 {{ task.retryCount }} 次
        </span>
      </div>
    </div>

    <div
      v-if="showActions"
      class="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <button
          v-if="canStart"
          @click="emit('start', task.id)"
          class="btn-success btn-sm"
          title="开始任务"
        >
          <Play class="w-4 h-4" />
          开始
        </button>
        <button
          v-if="canPause"
          @click="emit('pause', task.id)"
          class="btn-secondary btn-sm"
          title="暂停任务"
        >
          <Pause class="w-4 h-4" />
          暂停
        </button>
        <button
          v-if="canStop"
          @click="emit('stop', task.id)"
          class="btn-danger btn-sm"
          title="停止任务"
        >
          <Square class="w-4 h-4" />
          停止
        </button>
        <button
          v-if="canRetry"
          @click="emit('retry', task.id)"
          class="btn-warning btn-sm"
          title="重试任务"
        >
          <RotateCcw class="w-4 h-4" />
          重试
        </button>
      </div>
      <button
        @click="emit('view', task.id)"
        class="btn-ghost btn-sm"
        title="查看详情"
      >
        <Eye class="w-4 h-4" />
        详情
      </button>
    </div>
  </div>
</template>

<style scoped>
.btn-sm {
  @apply px-3 py-1.5 text-xs gap-1;
}
</style>
