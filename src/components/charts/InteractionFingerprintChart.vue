<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { HeatmapChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  VisualMapComponent
} from 'echarts/components';
import type { EChartsOption } from 'echarts';
import type { InteractionFingerprint } from '@shared/types';
import { Fingerprint } from 'lucide-vue-next';

use([
  CanvasRenderer,
  HeatmapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  VisualMapComponent
]);

interface Props {
  data: InteractionFingerprint;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '相互作用指纹'
});

const chartRef = shallowRef<typeof VChart | null>(null);

const interactionTypes = [
  { key: 'hydrogenBond', label: '氢键' },
  { key: 'hydrophobic', label: '疏水作用' },
  { key: 'piStacking', label: 'π-π堆积' },
  { key: 'saltBridge', label: '盐桥' },
  { key: 'vanDerWaals', label: '范德华力' }
];

const residues = computed(() => Object.keys(props.data));

const heatmapData = computed(() => {
  const data: [number, number, number][] = [];
  const residueList = residues.value;
  
  residueList.forEach((residue, residueIndex) => {
    interactionTypes.forEach((type, typeIndex) => {
      const value = props.data[residue]?.[type.key as keyof typeof props.data[string]] || 0;
      data.push([typeIndex, residueIndex, value]);
    });
  });
  
  return data;
});

const maxValue = computed(() => {
  let max = 0;
  heatmapData.value.forEach(([, , value]) => {
    if (value > max) max = value;
  });
  return max || 1;
});

const chartOption = computed<EChartsOption>(() => {
  const residueList = residues.value;
  
  return {
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: {
        color: '#111827',
        fontSize: 12
      },
      formatter: (params: any) => {
        const [typeIndex, residueIndex, value] = params.data;
        const type = interactionTypes[typeIndex];
        const residue = residueList[residueIndex];
        return `
          <div style="font-weight: 600; margin-bottom: 4px;">残基 ${residue}</div>
          <div>相互作用: <strong>${type.label}</strong></div>
          <div>强度: <strong>${value.toFixed(2)}</strong></div>
        `;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '10%'
    },
    xAxis: {
      type: 'category',
      data: interactionTypes.map(t => t.label),
      splitArea: {
        show: true
      },
      axisLine: {
        lineStyle: {
          color: '#e5e7eb'
        }
      },
      axisLabel: {
        color: '#6b7280',
        fontSize: 11,
        rotate: 30
      }
    },
    yAxis: {
      type: 'category',
      data: residueList,
      splitArea: {
        show: true
      },
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
    visualMap: {
      min: 0,
      max: maxValue.value,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      textStyle: {
        color: '#6b7280',
        fontSize: 10
      },
      inRange: {
        color: [
          '#f0fdf4',
          '#bbf7d0',
          '#86efac',
          '#4ade80',
          '#22c55e',
          '#16a34a',
          '#15803d',
          '#166534'
        ]
      }
    },
    series: [
      {
        name: '相互作用强度',
        type: 'heatmap',
        data: heatmapData.value,
        label: {
          show: true,
          fontSize: 9,
          color: '#374151',
          formatter: (params: any) => {
            const value = params.data[2];
            return value > 0 ? value.toFixed(1) : '';
          }
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)'
          }
        }
      }
    ]
  };
});
</script>

<template>
  <div class="card overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center">
          <Fingerprint class="w-4 h-4 text-secondary-600 dark:text-secondary-400" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {{ title }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            残基 × 相互作用类型 热力图
          </p>
        </div>
      </div>
    </div>
    <div class="p-4">
      <v-chart
        ref="chartRef"
        :option="chartOption"
        autoresize
        style="height: 400px; width: 100%;"
      />
    </div>
    <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>共 {{ residues.length }} 个残基</span>
        <span>{{ interactionTypes.length }} 种相互作用类型</span>
        <span>最大强度: {{ maxValue.toFixed(2) }}</span>
      </div>
    </div>
  </div>
</template>
