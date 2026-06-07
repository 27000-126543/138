<script setup lang="ts">
import { computed } from 'vue';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-vue-next';

interface Props {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  subtitle?: string;
}

const props = withDefaults(defineProps<Props>(), {
  color: 'primary'
});

const colorClasses = computed(() => {
  const colorMap = {
    primary: {
      bg: 'bg-primary-50 dark:bg-primary-900/20',
      icon: 'bg-primary-500 text-white',
      text: 'text-primary-600 dark:text-primary-400',
      border: 'border-primary-200 dark:border-primary-800'
    },
    secondary: {
      bg: 'bg-secondary-50 dark:bg-secondary-900/20',
      icon: 'bg-secondary-500 text-white',
      text: 'text-secondary-600 dark:text-secondary-400',
      border: 'border-secondary-200 dark:border-secondary-800'
    },
    success: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      icon: 'bg-success-500 text-white',
      text: 'text-success-600 dark:text-success-400',
      border: 'border-success-200 dark:border-success-800'
    },
    warning: {
      bg: 'bg-warning-50 dark:bg-warning-900/20',
      icon: 'bg-warning-500 text-white',
      text: 'text-warning-600 dark:text-warning-400',
      border: 'border-warning-200 dark:border-warning-800'
    },
    danger: {
      bg: 'bg-danger-50 dark:bg-danger-900/20',
      icon: 'bg-danger-500 text-white',
      text: 'text-danger-600 dark:text-danger-400',
      border: 'border-danger-200 dark:border-danger-800'
    },
    info: {
      bg: 'bg-info-50 dark:bg-info-900/20',
      icon: 'bg-info-500 text-white',
      text: 'text-info-600 dark:text-info-400',
      border: 'border-info-200 dark:border-info-800'
    }
  };
  return colorMap[props.color];
});

const trendIcon = computed(() => {
  if (!props.trend) return Minus;
  return props.trend > 0 ? TrendingUp : TrendingDown;
});

const trendColor = computed(() => {
  if (!props.trend) return 'text-gray-500 dark:text-gray-400';
  if (props.trend > 0) return 'text-success-600 dark:text-success-400';
  return 'text-danger-600 dark:text-danger-400';
});

const formattedTrend = computed(() => {
  if (!props.trend) return '0%';
  const sign = props.trend > 0 ? '+' : '';
  return `${sign}${props.trend.toFixed(1)}%`;
});
</script>

<template>
  <div
    class="card p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300"
    :class="colorClasses.border"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
          {{ title }}
        </p>
        <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 font-display">
          {{ value }}
        </p>
        <p v-if="subtitle" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ subtitle }}
        </p>
        <div
          v-if="trend !== undefined"
          class="mt-3 flex items-center gap-1.5"
        >
          <component
            :is="trendIcon"
            class="w-4 h-4"
            :class="trendColor"
          />
          <span
            class="text-sm font-medium"
            :class="trendColor"
          >
            {{ formattedTrend }}
          </span>
          <span v-if="trendLabel" class="text-xs text-gray-500 dark:text-gray-400">
            {{ trendLabel }}
          </span>
        </div>
      </div>
      <div
        class="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
        :class="[colorClasses.icon, colorClasses.bg]"
      >
        <component :is="icon" class="w-6 h-6" />
      </div>
    </div>
  </div>
</template>
