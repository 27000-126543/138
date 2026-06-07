<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { RadarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent
} from 'echarts/components';
import type { EChartsOption } from 'echarts';
import { FEMethod, FE_METHOD_LABELS } from '@shared/types';
import { Radar } from 'lucide-vue-next';

use([
  CanvasRenderer,
  RadarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent
]);

interface MethodData {
  method: FEMethod;
  accuracy: number;
  speed: number;
  stability: number;
  coverage: number;
  easeOfUse: number;
  cost: number;
}

interface Props {
  data: MethodData[];
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '方法对比雷达图'
});

const chartRef = shallowRef<typeof VChart | null>(null);

const indicators = [
  { name: '精度', max: 100 },
  { name: '速度', max: 100 },
  { name: '稳定性', max: 100 },
  { name: '覆盖范围', max: 100 },
  { name: '易用性', max: 100 },
  { name: '成本效益', max: 100 }
];

const methodColors: Record<FEMethod, string> = {
  [FEMethod.FEP]: '#3b82f6',
  [FEMethod.TI]: '#8b5cf6',
  [FEMethod.MMPBSA]: '#f59e0b'
};

const chartOption = computed<EChartsOption>(() => {
  const seriesData = props.data.map(d => ({
    value: [
      d.accuracy,
      d.speed,
      d.stability,
      d.coverage,
      d.easeOfUse,
      d.cost
    ],
    name: FE_METHOD_LABELS[d.method],
    itemStyle: {
      color: methodColors[d.method]
    },
    lineStyle: {
      width: 2
    },
    areaStyle: {
      opacity: 0.2
    }
  }));

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
        const data = params.data;
        let html = `<div style="font-weight: 600; margin-bottom: 8px;">${params.name}</div>`;
        indicators.forEach((indicator, index) => {
          const value = data.value[index];
          html += `
            <div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 2px;">
              <span>${indicator.name}:</span>
              <span style="font-weight: 600;">${value.toFixed(1)}</span>
            </div>
          `;
        });
        return html;
      }
    },
    legend: {
      data: props.data.map(d => FE_METHOD_LABELS[d.method]),
      bottom: 0,
      textStyle: {
        color: '#6b7280',
        fontSize: 11
      },
      itemWidth: 12,
      itemHeight: 12
    },
    radar: {
      indicator: indicators,
      center: ['50%', '50%'],
      radius: '60%',
      startAngle: 90,
      splitNumber: 5,
      shape: 'polygon',
      axisName: {
        color: '#6b7280',
        fontSize: 11
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(249, 250, 251, 0.5)', 'rgba(243, 244, 246, 0.3)']
        }
      },
      axisLine: {
        lineStyle: {
          color: '#e5e7eb'
        }
      },
      splitLine: {
        lineStyle: {
          color: '#e5e7eb'
        }
      }
    },
    series: [
      {
        type: 'radar',
        emphasis: {
          lineStyle: {
            width: 3
          }
        },
        data: seriesData
      }
    ]
  };
});
</script>

<template>
  <div class="card overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-info-100 dark:bg-info-900/30 flex items-center justify-center">
          <Radar class="w-4 h-4 text-info-600 dark:text-info-400" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {{ title }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            多维度方法性能对比
          </p>
        </div>
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
      <div class="grid grid-cols-3 gap-4 text-center">
        <div
          v-for="item in data"
          :key="item.method"
          class="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        >
          <div
            class="w-3 h-3 rounded-full mx-auto mb-1"
            :style="{ backgroundColor: methodColors[item.method] }"
          />
          <p class="text-xs font-medium text-gray-900 dark:text-gray-100">
            {{ FE_METHOD_LABELS[item.method].split(' ')[0] }}
          </p>
          <p class="text-lg font-bold font-display" :style="{ color: methodColors[item.method] }">
            {{ item.accuracy.toFixed(1) }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">精度</p>
        </div>
      </div>
    </div>
  </div>
</template>
