<script setup lang="ts">
import { computed } from 'vue';
import { Check, Clock, AlertCircle, Loader2 } from 'lucide-vue-next';
import {
  SimulationStatus,
  SIMULATION_STATUS_LABELS,
  SIMULATION_STATUS_COLORS,
  SIMULATION_STEPS
} from '@shared/types';
import type { SimulationLog } from '@shared/types';

interface Props {
  currentStatus: SimulationStatus;
  startedAt?: string;
  completedAt?: string;
  logs?: SimulationLog[];
}

const props = defineProps<Props>();

interface TimelineStep {
  status: SimulationStatus;
  label: string;
  color: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isError: boolean;
  startTime?: string;
  endTime?: string;
  duration?: string;
}

const formatTime = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const calculateDuration = (start: string, end?: string): string => {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diff = endTime - startTime;
  
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`;
  }
  return `${seconds}秒`;
};

const timeline = computed<TimelineStep[]>(() => {
  const isError = props.currentStatus === SimulationStatus.ERROR_ROLLBACK;
  const currentIndex = isError
    ? SIMULATION_STEPS.length - 1
    : SIMULATION_STEPS.indexOf(props.currentStatus);

  const stepTimes: Record<string, { start?: string; end?: string }> = {};
  
  if (props.logs) {
    props.logs.forEach(log => {
      const match = log.message.match(/(开始|完成):\s*(\S+)/);
      if (match) {
        const status = match[2] as SimulationStatus;
        if (!stepTimes[status]) {
          stepTimes[status] = {};
        }
        if (match[1] === '开始') {
          stepTimes[status].start = log.timestamp;
        } else {
          stepTimes[status].end = log.timestamp;
        }
      }
    });
  }

  return SIMULATION_STEPS.map((status, index) => {
    const times = stepTimes[status];
    const isCompleted = index < currentIndex || (isError && index < currentIndex);
    const isCurrent = index === currentIndex && !isError;
    
    let duration: string | undefined;
    if (times?.start) {
      duration = calculateDuration(times.start, isCompleted ? times.end : undefined);
    }

    return {
      status,
      label: SIMULATION_STATUS_LABELS[status],
      color: SIMULATION_STATUS_COLORS[status],
      isCompleted,
      isCurrent,
      isError: isError && index === currentIndex,
      startTime: times?.start,
      endTime: times?.end,
      duration
    };
  });
});

const getStatusIcon = (step: TimelineStep) => {
  if (step.isError) return AlertCircle;
  if (step.isCompleted) return Check;
  if (step.isCurrent) return Loader2;
  return Clock;
};
</script>

<template>
  <div class="card p-5">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
      任务状态时间轴
    </h3>

    <div class="relative">
      <div
        class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"
        style="margin-top: 1rem; margin-bottom: 1rem;"
      >
        <div
          class="absolute top-0 left-0 w-full bg-emerald-500 transition-all duration-500"
          :style="{
            height: `${(timeline.filter(s => s.isCompleted).length / timeline.length) * 100}%`
          }"
        />
      </div>

      <div class="space-y-4">
        <div
          v-for="(step, index) in timeline"
          :key="step.status"
          class="relative flex gap-4 pl-10"
        >
          <div
            class="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-all duration-300"
            :class="[
              step.isError
                ? 'bg-danger-500 text-white'
                : step.isCompleted
                  ? 'bg-emerald-500 text-white'
                  : step.isCurrent
                    ? `${step.color} text-white`
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
            ]"
          >
            <component
              :is="getStatusIcon(step)"
              class="w-4 h-4"
              :class="{ 'animate-spin': step.isCurrent && !step.isError }"
            />
          </div>

          <div
            class="flex-1 rounded-xl p-4 transition-all duration-300"
            :class="[
              step.isCompleted || step.isCurrent
                ? 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700'
                : 'bg-transparent border border-transparent'
            ]"
          >
            <div class="flex items-center justify-between mb-1">
              <h4
                class="font-medium"
                :class="[
                  step.isCompleted || step.isCurrent
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-400 dark:text-gray-500'
                ]"
              >
                {{ step.label }}
                <span
                  v-if="step.isCurrent"
                  class="ml-2 text-xs font-normal text-primary-600 dark:text-primary-400"
                >
                  进行中...
                </span>
                <span
                  v-if="step.isError"
                  class="ml-2 text-xs font-normal text-danger-600 dark:text-danger-400"
                >
                  异常
                </span>
              </h4>
              <span
                v-if="step.duration"
                class="text-xs font-mono"
                :class="[
                  step.isCompleted
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : step.isCurrent
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-400 dark:text-gray-500'
                ]"
              >
                {{ step.duration }}
              </span>
            </div>

            <div
              v-if="step.startTime"
              class="flex items-center gap-4 text-xs"
            >
              <span class="text-gray-500 dark:text-gray-400">
                开始: {{ formatTime(step.startTime) }}
              </span>
              <span
                v-if="step.endTime"
                class="text-gray-500 dark:text-gray-400"
              >
                完成: {{ formatTime(step.endTime) }}
              </span>
            </div>

            <div
              v-else-if="!step.isCompleted && !step.isCurrent"
              class="text-xs text-gray-400 dark:text-gray-500 italic"
            >
              等待执行
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="startedAt" class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">任务开始时间</p>
          <p class="font-medium text-gray-900 dark:text-gray-100">
            {{ formatTime(startedAt) }}
          </p>
        </div>
        <div v-if="completedAt">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">任务完成时间</p>
          <p class="font-medium text-gray-900 dark:text-gray-100">
            {{ formatTime(completedAt) }}
          </p>
        </div>
        <div v-else-if="startedAt">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">已运行时间</p>
          <p class="font-medium text-primary-600 dark:text-primary-400">
            {{ calculateDuration(startedAt) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
