<script setup lang="ts">
import { computed } from 'vue';
import type { SimulationStatus, AlertLevel, ApprovalStatus } from '@shared/types';
import {
  SIMULATION_STATUS_LABELS,
  SIMULATION_STATUS_COLORS,
  ALERT_LEVEL_LABELS,
  ALERT_LEVEL_COLORS
} from '@shared/types';

type BadgeType = 'simulation' | 'alert' | 'approval';

interface Props {
  type: BadgeType;
  status: SimulationStatus | AlertLevel | ApprovalStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  showIcon: false,
  size: 'md'
});

const config = computed(() => {
  if (props.type === 'simulation') {
    const status = props.status as SimulationStatus;
    return {
      label: SIMULATION_STATUS_LABELS[status],
      bgClass: getBgClass(SIMULATION_STATUS_COLORS[status]),
      textClass: getTextClass(SIMULATION_STATUS_COLORS[status])
    };
  }

  if (props.type === 'alert') {
    const level = props.status as AlertLevel;
    return {
      label: ALERT_LEVEL_LABELS[level],
      bgClass: getBgClass(ALERT_LEVEL_COLORS[level]),
      textClass: getTextClass(ALERT_LEVEL_COLORS[level])
    };
  }

  if (props.type === 'approval') {
    const status = props.status as ApprovalStatus;
    const colorMap: Record<ApprovalStatus, string> = {
      pending: 'bg-amber-500',
      approved: 'bg-emerald-500',
      rejected: 'bg-red-500'
    };
    const labelMap: Record<ApprovalStatus, string> = {
      pending: '待审批',
      approved: '已通过',
      rejected: '已拒绝'
    };
    return {
      label: labelMap[status],
      bgClass: getBgClass(colorMap[status]),
      textClass: getTextClass(colorMap[status])
    };
  }

  return { label: '', bgClass: '', textClass: '' };
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-1.5 py-0.5 text-xs gap-1';
    case 'lg':
      return 'px-3 py-1 text-sm gap-1.5';
    default:
      return 'px-2 py-0.5 text-xs gap-1';
  }
});

function getBgClass(color: string): string {
  const map: Record<string, string> = {
    'bg-slate-500': 'bg-slate-100 dark:bg-slate-900/30',
    'bg-blue-500': 'bg-blue-100 dark:bg-blue-900/30',
    'bg-cyan-500': 'bg-cyan-100 dark:bg-cyan-900/30',
    'bg-teal-500': 'bg-teal-100 dark:bg-teal-900/30',
    'bg-purple-500': 'bg-purple-100 dark:bg-purple-900/30',
    'bg-emerald-500': 'bg-emerald-100 dark:bg-emerald-900/30',
    'bg-red-500': 'bg-red-100 dark:bg-red-900/30',
    'bg-red-600': 'bg-red-100 dark:bg-red-900/30',
    'bg-amber-500': 'bg-amber-100 dark:bg-amber-900/30',
    'bg-orange-500': 'bg-orange-100 dark:bg-orange-900/30'
  };
  return map[color] || 'bg-gray-100 dark:bg-gray-800';
}

function getTextClass(color: string): string {
  const map: Record<string, string> = {
    'bg-slate-500': 'text-slate-700 dark:text-slate-400',
    'bg-blue-500': 'text-blue-700 dark:text-blue-400',
    'bg-cyan-500': 'text-cyan-700 dark:text-cyan-400',
    'bg-teal-500': 'text-teal-700 dark:text-teal-400',
    'bg-purple-500': 'text-purple-700 dark:text-purple-400',
    'bg-emerald-500': 'text-emerald-700 dark:text-emerald-400',
    'bg-red-500': 'text-red-700 dark:text-red-400',
    'bg-red-600': 'text-red-700 dark:text-red-400',
    'bg-amber-500': 'text-amber-700 dark:text-amber-400',
    'bg-orange-500': 'text-orange-700 dark:text-orange-400'
  };
  return map[color] || 'text-gray-700 dark:text-gray-400';
}

function getDotColor(color: string): string {
  const map: Record<string, string> = {
    'bg-slate-500': 'bg-slate-500',
    'bg-blue-500': 'bg-blue-500',
    'bg-cyan-500': 'bg-cyan-500',
    'bg-teal-500': 'bg-teal-500',
    'bg-purple-500': 'bg-purple-500',
    'bg-emerald-500': 'bg-emerald-500',
    'bg-red-500': 'bg-red-500',
    'bg-red-600': 'bg-red-600',
    'bg-amber-500': 'bg-amber-500',
    'bg-orange-500': 'bg-orange-500'
  };
  return map[color] || 'bg-gray-500';
}

const dotColor = computed(() => {
  if (props.type === 'simulation') {
    return getDotColor(SIMULATION_STATUS_COLORS[props.status as SimulationStatus]);
  }
  if (props.type === 'alert') {
    return getDotColor(ALERT_LEVEL_COLORS[props.status as AlertLevel]);
  }
  if (props.type === 'approval') {
    const status = props.status as ApprovalStatus;
    const colorMap: Record<ApprovalStatus, string> = {
      pending: 'bg-amber-500',
      approved: 'bg-emerald-500',
      rejected: 'bg-red-500'
    };
    return colorMap[status];
  }
  return 'bg-gray-500';
});
</script>

<template>
  <span
    class="inline-flex items-center font-medium rounded-full transition-all"
    :class="[sizeClasses, config.bgClass, config.textClass]"
  >
    <span
      v-if="showIcon"
      class="w-1.5 h-1.5 rounded-full"
      :class="dotColor"
    />
    {{ config.label }}
  </span>
</template>
