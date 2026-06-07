<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BoxplotChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
} from 'echarts/components';
import type { EChartsOption } from 'echarts';
import { FEMethod, FE_METHOD_LABELS } from '@shared/types';
import { BarChart3 } from 'lucide-vue-next';

use([
  CanvasRenderer,
  BoxplotChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
]);

interface BoxPlotData {
  method: FEMethod;
  values: number[];
}

interface Props {
  data: BoxPlotData[];
  title?: string;
  unit?: string;
  showOutliers?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '精度箱线图',
  unit: 'kcal/mol',
  showOutliers: true
});

const chartRef = shallowRef<typeof VChart | null>(null);

const methodColors: Record<FEMethod, string> = {
  [FEMethod.FEP]: '#3b82f6',
  [FEMethod.TI]: '#8b5cf6',
  [FEMethod.MMPBSA]: '#f59e0b'
};

const calculateBoxPlotStats = (values: number[]): [number, number, number, number, number] => {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  const min = sorted[0];
  const max = sorted[n - 1];
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  
  return [min, q1, median, q3, max];
};

const boxPlotData = computed(() => {
  return props.data.map(d => calculateBoxPlotStats(d.values));
});

const outliers = computed(() => {
  if (!props.showOutliers) return [];
  
  const result: [string, number][] = [];
  
  props.data.forEach((d, methodIndex) => {
    const stats = calculateBoxPlotStats(d.values);
    const [, q1, , q3] = stats;
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    d.values.forEach(value => {
      if (value < lowerBound || value > upperBound) {
        result.push([FE_METHOD_LABELS[d.method].split(' ')[0], value]);
      }
    });
  });
  
  return result;
});

const chartOption = computed(() => {
  const labels = props.data.map(d => FE_METHOD_LABELS[d.method].split(' ')[0]);
  
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: {
        color: '#111827',
        fontSize: 12
      },
      formatter: (params: any) => {
        if (params.seriesType === 'boxplot') {
          const data = params.data;
          return `
            <div style="font-weight: 600; margin-bottom: 8px;">${params.name}</div>
            <div style="margin-bottom: 2px;">最小值: <strong>${data[0].toFixed(2)}</strong> ${props.unit}</div>
            <div style="margin-bottom: 2px;">Q1: <strong>${data[1].toFixed(2)}</strong> ${props.unit}</div>
            <div style="margin-bottom: 2px;">中位数: <strong>${data[2].toFixed(2)}</strong> ${props.unit}</div>
            <div style="margin-bottom: 2px;">Q3: <strong>${data[3].toFixed(2)}</strong> ${props.unit}</div>
            <div>最大值: <strong>${data[4].toFixed(2)}</strong> ${props.unit}</div>
          `;
        }
        return `
          <div style="font-weight: 600;">异常值</div>
          <div>${params.data[1].toFixed(2)} ${props.unit}</div>
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
        fontSize: 11
      }
    },
    yAxis: {
      type: 'value',
      name: `误差 (${props.unit})`,
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
        name: '箱线图',
        type: 'boxplot',
        data: boxPlotData.value.map((data, index) => ({
          value: data,
          itemStyle: {
            color: methodColors[props.data[index].method],
            borderColor: methodColors[props.data[index].method],
            borderWidth: 1
          }
        })),
        boxWidth: '40%',
        itemStyle: {
          borderWidth: 2,
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: '异常值',
        type: 'scatter',
        data: outliers.value,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: '#ef4444',
          borderColor: '#fff',
          borderWidth: 1
        }
      }
    ]
  };
});

const overallStats = computed(() => {
  return props.data.map(d => {
    const stats = calculateBoxPlotStats(d.values);
    const [, q1, median, q3] = stats;
    const iqr = q3 - q1;
    
    return {
      method: d.method,
      median,
      iqr,
      count: d.values.length
    };
  });
});
</script>

<template>
  <div class="card overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
          <BarChart3 class="w-4 h-4 text-warning-600 dark:text-warning-400" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {{ title }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            预测误差分布统计
          </p>
        </div>
      </div>
      <div class="text-right">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          样本总数
        </p>
        <p class="text-lg font-bold text-gray-900 dark:text-gray-100 font-display">
          {{ data.reduce((sum, d) => sum + d.values.length, 0) }}
        </p>
      </div>
    </div>
    <div class="p-4">
      <v-chart
        ref="chartRef"
        :option="chartOption"
        autoresize
        style="height: 300px; width: 100%;"
      />
    </div>
    <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
      <div class="grid grid-cols-3 gap-4 text-center">
        <div
          v-for="stat in overallStats"
          :key="stat.method"
          class="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        >
          <div
            class="w-3 h-3 rounded-full mx-auto mb-1"
            :style="{ backgroundColor: methodColors[stat.method] }"
          />
          <p class="text-xs font-medium text-gray-900 dark:text-gray-100">
            {{ FE_METHOD_LABELS[stat.method].split(' ')[0] }}
          </p>
          <p class="text-lg font-bold font-display" :style="{ color: methodColors[stat.method] }">
            {{ stat.median.toFixed(2) }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            中位数 · n={{ stat.count }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
