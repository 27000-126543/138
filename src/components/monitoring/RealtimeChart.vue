<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, shallowRef } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent
} from 'echarts/components';
import type { EChartsOption } from 'echarts';
import type { MonitoringData } from '@shared/types';
import { Activity, Pause, Play, Settings, AlertTriangle } from 'lucide-vue-next';

use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent
]);

type MetricType = 'rmsd' | 'potentialEnergy' | 'temperature';

interface Props {
  taskId: string;
  metric: MetricType;
  threshold?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const props = withDefaults(defineProps<Props>(), {
  autoRefresh: true,
  refreshInterval: 2000
});

const emit = defineEmits<{
  thresholdExceeded: [data: MonitoringData];
  dataUpdated: [data: MonitoringData[]];
}>();

const isPaused = ref(false);
const dataPoints = ref<MonitoringData[]>([]);
const showSettings = ref(false);
const chartRef = shallowRef<typeof VChart | null>(null);

const metricConfig = {
  rmsd: {
    name: 'RMSD',
    unit: 'Å',
    color: '#3b82f6',
    areaColor: 'rgba(59, 130, 246, 0.1)',
    defaultThreshold: 2.0
  },
  potentialEnergy: {
    name: '势能',
    unit: 'kcal/mol',
    color: '#8b5cf6',
    areaColor: 'rgba(139, 92, 246, 0.1)',
    defaultThreshold: -10000
  },
  temperature: {
    name: '温度',
    unit: 'K',
    color: '#f59e0b',
    areaColor: 'rgba(245, 158, 11, 0.1)',
    defaultThreshold: 310
  }
};

const config = computed(() => metricConfig[props.metric]);
const currentThreshold = computed(() => props.threshold || config.value.defaultThreshold);

const currentValue = computed(() => {
  if (dataPoints.value.length === 0) return null;
  const latest = dataPoints.value[dataPoints.value.length - 1];
  return latest[props.metric];
});

const isThresholdExceeded = computed(() => {
  if (currentValue.value === null) return false;
  if (props.metric === 'potentialEnergy') {
    return currentValue.value < currentThreshold.value;
  }
  return currentValue.value > currentThreshold.value;
});

const chartOption = computed<EChartsOption>(() => {
  const data = dataPoints.value.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: d[props.metric]
  }));

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: {
        color: '#111827',
        fontSize: 12
      },
      formatter: (params: any) => {
        const param = params[0];
        return `
          <div style="font-weight: 600; margin-bottom: 4px;">${param.axisValue}</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${config.value.color};"></span>
            <span>${config.value.name}: ${param.value.toFixed(2)} ${config.value.unit}</span>
          </div>
        `;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(d => d.time),
      axisLine: {
        lineStyle: {
          color: '#e5e7eb'
        }
      },
      axisLabel: {
        color: '#6b7280',
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value',
      name: `${config.value.name} (${config.value.unit})`,
      nameTextStyle: {
        color: '#6b7280',
        fontSize: 11
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#6b7280',
        fontSize: 10
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        name: config.value.name,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        data: data.map(d => d.value),
        lineStyle: {
          width: 2,
          color: config.value.color
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: config.value.areaColor },
              { offset: 1, color: 'rgba(255, 255, 255, 0)' }
            ]
          }
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: {
            color: '#ef4444',
            type: 'dashed',
            width: 2
          },
          label: {
            formatter: `阈值: {c} ${config.value.unit}`,
            color: '#ef4444',
            fontSize: 10,
            position: 'end'
          },
          data: [
            {
              yAxis: currentThreshold.value
            }
          ]
        }
      }
    ]
  };
});

const generateMockData = (): MonitoringData => {
  const baseValue = {
    rmsd: 1.5,
    potentialEnergy: -8000,
    temperature: 300
  };

  const variance = {
    rmsd: 0.3,
    potentialEnergy: 200,
    temperature: 2
  };

  const base = baseValue[props.metric];
  const vary = variance[props.metric];
  const randomChange = (Math.random() - 0.5) * vary * 2;
  const value = base + randomChange;

  return {
    taskId: props.taskId,
    timestamp: new Date().toISOString(),
    rmsd: props.metric === 'rmsd' ? value : 1.5 + (Math.random() - 0.5) * 0.6,
    potentialEnergy: props.metric === 'potentialEnergy' ? value : -8000 + (Math.random() - 0.5) * 400,
    temperature: props.metric === 'temperature' ? value : 300 + (Math.random() - 0.5) * 4,
    pressure: 1.0 + (Math.random() - 0.5) * 0.2,
    volume: 100000 + (Math.random() - 0.5) * 2000
  };
};

let intervalId: number | null = null;

const fetchData = () => {
  const newData = generateMockData();
  dataPoints.value.push(newData);

  if (dataPoints.value.length > 50) {
    dataPoints.value.shift();
  }

  const exceeded = props.metric === 'potentialEnergy'
    ? newData[props.metric] < currentThreshold.value
    : newData[props.metric] > currentThreshold.value;

  if (exceeded) {
    emit('thresholdExceeded', newData);
  }

  emit('dataUpdated', [...dataPoints.value]);
};

const togglePause = () => {
  isPaused.value = !isPaused.value;
  if (isPaused.value) {
    stopRefresh();
  } else {
    startRefresh();
  }
};

const startRefresh = () => {
  if (intervalId) return;
  intervalId = window.setInterval(() => {
    if (!isPaused.value) {
      fetchData();
    }
  }, props.refreshInterval);
};

const stopRefresh = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const clearData = () => {
  dataPoints.value = [];
};

onMounted(() => {
  for (let i = 0; i < 20; i++) {
    dataPoints.value.push(generateMockData());
  }

  if (props.autoRefresh) {
    startRefresh();
  }
});

onUnmounted(() => {
  stopRefresh();
});

watch(() => props.metric, () => {
  clearData();
  for (let i = 0; i < 20; i++) {
    dataPoints.value.push(generateMockData());
  }
});
</script>

<template>
  <div class="card overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center"
          :class="isThresholdExceeded ? 'bg-danger-100 dark:bg-danger-900/30' : 'bg-primary-100 dark:bg-primary-900/30'"
        >
          <Activity
            class="w-4 h-4"
            :class="isThresholdExceeded ? 'text-danger-600 dark:text-danger-400' : 'text-primary-600 dark:text-primary-400'"
          />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {{ config.name }} 实时监控
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            任务 ID: {{ taskId }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div
          v-if="currentValue !== null"
          class="mr-2 text-right"
        >
          <p
            class="text-lg font-bold font-display"
            :class="isThresholdExceeded ? 'text-danger-600 dark:text-danger-400' : 'text-gray-900 dark:text-gray-100'"
          >
            {{ currentValue.toFixed(2) }}
            <span class="text-xs font-normal text-gray-500 dark:text-gray-400">{{ config.unit }}</span>
          </p>
          <div
            v-if="isThresholdExceeded"
            class="flex items-center gap-1 text-xs text-danger-600 dark:text-danger-400"
          >
            <AlertTriangle class="w-3 h-3" />
            超过阈值
          </div>
        </div>

        <button
          @click="togglePause"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          :title="isPaused ? '继续' : '暂停'"
        >
          <Play v-if="isPaused" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <Pause v-else class="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        <button
          @click="showSettings = !showSettings"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="设置"
        >
          <Settings class="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    </div>

    <transition
      enter-active-class="transition-all duration-200"
      enter-from-class="max-h-0 opacity-0"
      enter-to-class="max-h-20 opacity-100"
      leave-active-class="transition-all duration-200"
      leave-from-class="max-h-20 opacity-100"
      leave-to-class="max-h-0 opacity-0"
    >
      <div
        v-if="showSettings"
        class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center gap-4">
          <div class="flex-1">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400">
              阈值 ({{ config.unit }})
            </label>
            <input
              type="number"
              :value="currentThreshold"
              class="input mt-1"
              step="0.1"
            />
          </div>
          <button
            @click="clearData"
            class="btn-secondary mt-5"
          >
            清除数据
          </button>
        </div>
      </div>
    </transition>

    <div class="p-4">
      <v-chart
        ref="chartRef"
        :option="chartOption"
        autoresize
        style="height: 300px; width: 100%;"
      />
    </div>

    <div class="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <span>数据点: {{ dataPoints.length }}</span>
      <span class="flex items-center gap-1">
        <span
          class="w-2 h-2 rounded-full"
          :class="isPaused ? 'bg-gray-400' : 'bg-success-500 animate-pulse'"
        />
        {{ isPaused ? '已暂停' : '实时更新中' }}
      </span>
      <span>更新间隔: {{ refreshInterval / 1000 }}s</span>
    </div>
  </div>
</template>
