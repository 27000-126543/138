<script setup lang="ts">
import { computed } from 'vue';
import { Check, Loader2 } from 'lucide-vue-next';
import {
  SimulationStatus,
  SIMULATION_STATUS_LABELS,
  SIMULATION_STATUS_COLORS,
  SIMULATION_STEPS
} from '@shared/types';

interface Props {
  currentStatus: SimulationStatus;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  showLabels: true,
  size: 'md'
});

interface StepConfig {
  status: SimulationStatus;
  label: string;
  color: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isError: boolean;
}

const steps = computed<StepConfig[]>(() => {
  const currentIndex = SIMULATION_STEPS.indexOf(props.currentStatus);
  const isError = props.currentStatus === SimulationStatus.ERROR_ROLLBACK;

  return SIMULATION_STEPS.map((status, index) => {
    const isCompleted = index < currentIndex || (isError && index < currentIndex);
    const isCurrent = index === currentIndex && !isError;

    return {
      status,
      label: SIMULATION_STATUS_LABELS[status],
      color: SIMULATION_STATUS_COLORS[status],
      isCompleted,
      isCurrent,
      isError: isError && index === currentIndex
    };
  });
});

const sizeConfig = computed(() => {
  switch (props.size) {
    case 'sm':
      return {
        dot: 'w-6 h-6',
        icon: 'w-3 h-3',
        line: 'h-0.5',
        label: 'text-xs'
      };
    case 'lg':
      return {
        dot: 'w-10 h-10',
        icon: 'w-5 h-5',
        line: 'h-1',
        label: 'text-sm'
      };
    default:
      return {
        dot: 'w-8 h-8',
        icon: 'w-4 h-4',
        line: 'h-0.5',
        label: 'text-xs'
      };
  }
});

function getBgClass(config: StepConfig): string {
  if (config.isError) return 'bg-red-500 text-white';
  if (config.isCompleted) return 'bg-emerald-500 text-white';
  if (config.isCurrent) return `${config.color} text-white`;
  return 'bg-gray-200 dark:bg-gray-700 text-gray-400';
}

function getLineClass(index: number): string {
  if (index >= steps.value.length - 1) return 'bg-transparent';
  const nextStep = steps.value[index + 1];
  if (steps.value[index].isCompleted && nextStep.isCompleted) {
    return 'bg-emerald-500';
  }
  return 'bg-gray-200 dark:bg-gray-700';
}
</script>

<template>
  <div class="w-full">
    <div class="flex items-center justify-between">
      <template v-for="(step, index) in steps" :key="step.status">
        <div class="flex flex-col items-center flex-1 relative">
          <div
            class="relative flex items-center justify-center rounded-full font-medium transition-all duration-300 z-10"
            :class="[sizeConfig.dot, getBgClass(step)]"
          >
            <Check
              v-if="step.isCompleted && !step.isError"
              :class="sizeConfig.icon"
            />
            <Loader2
              v-else-if="step.isCurrent && !step.isError"
              :class="[sizeConfig.icon, 'animate-spin']"
            />
            <span v-else :class="sizeConfig.icon">
              {{ index + 1 }}
            </span>
          </div>

          <div
            v-if="index < steps.length - 1"
            class="absolute top-1/2 left-1/2 w-full -translate-y-1/2 -z-0"
          >
            <div
              :class="[sizeConfig.line, 'transition-all duration-300', getLineClass(index)]"
              style="width: calc(100% - 2rem); margin-left: 1rem;"
            />
          </div>

          <div
            v-if="showLabels"
            class="mt-2 text-center font-medium"
            :class="[
              sizeConfig.label,
              step.isCompleted || step.isCurrent
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-400 dark:text-gray-500'
            ]"
          >
            {{ step.label }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
