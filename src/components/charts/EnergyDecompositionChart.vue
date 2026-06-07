<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
} from 'echarts/components';
import type { EChartsOption } from 'echarts';
import type { EnergyComponent } from '@shared/types';
import { BarChart2 } from 'lucide-vue-next';

use([
  CanvasRenderer,
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
]);

interface Props {
  data: EnergyComponent[];
  title?: string;
  showTotal?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '能量分解分析',
  showTotal: true
});

const chartRef = shallowRef<typeof VChart | null>(null);

const totalEnergy = computed(() => {
  return props.data.reduce((sum, item) => sum + item.value, 0);
});

const totalError = computed(() => {
  return Math.sqrt(props.data.reduce((sum, item) => sum + item.error * item.error, 0));
});

const chartOption = computed<EChartsOption>(() => {
  const labels = props.data.map(d => d.name);
  const values = props.data.map(d => d.value);
  const errors = props.data.map(d => d.error);

  const colors = [
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#10b981',
    '#06b6d4',
    '#6366f1',
    '#ef4444'
  ];

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
        const dataIndex = param.dataIndex;
        const component = props.data[dataIndex];
        return `
          <div style="font-weight: 600; margin-bottom: 8px;">${component.name}</div>
          <div style="margin-bottom: 4px;">能量: <strong>${component.value.toFixed(2)}</strong> kcal/mol</div>
          <div>标准误差: ±${component.error.toFixed(2)} kcal/mol</div>
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
      data: labels,
      axisLine: {
        lineStyle: {
          color: '#e5e7eb'
        }
      },
      axisLabel: {
        color: '#6b7280',
        fontSize: 11,
        rotate: 30,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      name: '能量 (kcal/mol)',
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
        name: '能量分量',
        type: 'bar',
        data: values.map((value, index) => ({
          value,
          itemStyle: {
            color: colors[index % colors.length],
            borderRadius: [4, 4, 0, 0]
          }
        })),
        barWidth: '50%'
      }
    ]
  };
});
</script>

<template>
  <div class="card overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <BarChart2 class="w-4 h-4 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {{ title }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            各能量分量贡献
          </p>
        </div>
      </div>
      <div v-if="showTotal" class="text-right">
        <p class="text-lg font-bold text-gray-900 dark:text-gray-100 font-display">
          {{ totalEnergy.toFixed(2) }}
          <span class="text-xs font-normal text-gray-500 dark:text-gray-400">kcal/mol</span>
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          ±{{ totalError.toFixed(2) }} 标准误差
        </p>
      </div>
    </div>
    <div class="p-4">
      <v-chart
        ref="chartRef"
        :option="chartOption"
        autoresize
        style="height: 350px; width: 100%;"
      />
    </div>
    <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
      <div class="flex flex-wrap gap-2">
        <div
          v-for="(item, index) in data"
          :key="item.name"
          class="flex items-center gap-1.5 text-xs"
        >
          <span
            class="w-3 h-3 rounded"
            :style="{ backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ef4444'][index % 8] }"
          />
          <span class="text-gray-600 dark:text-gray-400">{{ item.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
