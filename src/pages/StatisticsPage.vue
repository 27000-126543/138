<script setup lang="ts">
import { ref, computed, shallowRef, onMounted, watch } from 'vue'
import { BarChart3, TrendingUp, Activity, Server, Calendar, Download, RefreshCw, Loader2, Filter, Database, CheckCircle } from 'lucide-vue-next'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent
} from 'echarts/components'
import type { EChartsOption } from 'echarts'
import AccuracyBoxPlot from '@/components/charts/AccuracyBoxPlot.vue'
import DataCard from '@/components/common/DataCard.vue'
import { FEMethod, FE_METHOD_LABELS } from '@shared/types'
import type { DailyStats } from '@shared/types'
import { useStatisticsStore } from '../stores/statistics'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent
])

const statisticsStore = useStatisticsStore()

const dateRange = ref({
  startDate: '',
  endDate: ''
})

const loading = ref(false)

const performanceTrendChart = shallowRef<typeof VChart | null>(null)
const methodComparisonChart = shallowRef<typeof VChart | null>(null)
const resourceConsumptionChart = shallowRef<typeof VChart | null>(null)

const summaryStats = computed(() => {
  if (!statisticsStore.dailyStats.length) return null
  
  const stats = statisticsStore.dailyStats
  return {
    totalTasks: stats.reduce((sum, d) => sum + d.totalTasks, 0),
    completedTasks: stats.reduce((sum, d) => sum + d.completedTasks, 0),
    failedTasks: stats.reduce((sum, d) => sum + d.failedTasks, 0),
    avgCompletionRate: stats.reduce((sum, d) => sum + d.completionRate, 0) / stats.length,
    avgError: stats.reduce((sum, d) => sum + d.averageError, 0) / stats.length,
    totalComputeHours: stats.reduce((sum, d) => sum + d.totalComputeHours, 0),
    avgSimulationTime: stats.reduce((sum, d) => sum + d.averageSimulationTime, 0) / stats.length,
    totalAlerts: stats.reduce((sum, d) => sum + d.alertsGenerated, 0),
    totalApprovals: stats.reduce((sum, d) => sum + d.approvalsProcessed, 0)
  }
})

const performanceTrendOption = computed<EChartsOption>(() => {
  const data = statisticsStore.performanceTrend
  
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
      }
    },
    legend: {
      data: ['成功率', '平均误差', '任务数'],
      bottom: 0,
      textStyle: {
        color: '#6b7280',
        fontSize: 11
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
      axisLine: {
        lineStyle: { color: '#e5e7eb' }
      },
      axisLabel: {
        color: '#6b7280',
        fontSize: 10
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '百分比 (%)',
        min: 0,
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#6b7280',
          fontSize: 10,
          formatter: '{value}%'
        },
        splitLine: {
          lineStyle: {
            color: '#f3f4f6',
            type: 'dashed'
          }
        }
      },
      {
        type: 'value',
        name: '任务数',
        min: 0,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#6b7280',
          fontSize: 10
        },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '成功率',
        type: 'line',
        yAxisIndex: 0,
        data: data.map(d => d.successRate * 100),
        smooth: true,
        lineStyle: {
          width: 2,
          color: '#10b981'
        },
        itemStyle: {
          color: '#10b981'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
            ]
          }
        }
      },
      {
        name: '平均误差',
        type: 'line',
        yAxisIndex: 0,
        data: data.map(d => Math.min(100, d.averageError * 20)),
        smooth: true,
        lineStyle: {
          width: 2,
          color: '#f59e0b'
        },
        itemStyle: {
          color: '#f59e0b'
        }
      },
      {
        name: '任务数',
        type: 'bar',
        yAxisIndex: 1,
        data: data.map(d => d.taskCount),
        barWidth: '40%',
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [4, 4, 0, 0]
        }
      }
    ]
  }
})

const methodComparisonOption = computed<EChartsOption>(() => {
  const methods = Object.values(FEMethod)
  
  const mockData = methods.map(method => ({
    method,
    averageError: method === 'fep' ? 1.2 : method === 'ti' ? 1.5 : 2.1,
    successRate: method === 'fep' ? 0.85 : method === 'ti' ? 0.78 : 0.72,
    sampleSize: method === 'fep' ? 156 : method === 'ti' ? 98 : 234,
    averageRuntime: method === 'fep' ? 24 : method === 'ti' ? 18 : 12
  }))

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
      }
    },
    legend: {
      data: ['平均误差 (kcal/mol)', '成功率 (%)', '平均运行时间 (h)'],
      bottom: 0,
      textStyle: {
        color: '#6b7280',
        fontSize: 11
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: methods.map(m => FE_METHOD_LABELS[m].split(' ')[0]),
      axisLine: {
        lineStyle: { color: '#e5e7eb' }
      },
      axisLabel: {
        color: '#6b7280',
        fontSize: 10
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '误差/时间',
        min: 0,
        axisLine: { show: false },
        axisTick: { show: false },
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
      {
        type: 'value',
        name: '成功率 (%)',
        min: 0,
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#6b7280',
          fontSize: 10,
          formatter: '{value}%'
        },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '平均误差 (kcal/mol)',
        type: 'bar',
        yAxisIndex: 0,
        data: mockData.map(d => d.averageError),
        barWidth: '20%',
        itemStyle: {
          color: '#ef4444',
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: '平均运行时间 (h)',
        type: 'bar',
        yAxisIndex: 0,
        data: mockData.map(d => d.averageRuntime),
        barWidth: '20%',
        itemStyle: {
          color: '#8b5cf6',
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: '成功率 (%)',
        type: 'line',
        yAxisIndex: 1,
        data: mockData.map(d => d.successRate * 100),
        smooth: true,
        lineStyle: {
          width: 2,
          color: '#10b981'
        },
        itemStyle: {
          color: '#10b981'
        }
      }
    ]
  }
})

const resourceConsumptionOption = computed<EChartsOption>(() => {
  const data = statisticsStore.dailyStats

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
      }
    },
    legend: {
      data: ['计算耗时', '模拟时长'],
      bottom: 0,
      textStyle: {
        color: '#6b7280',
        fontSize: 11
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
      axisLine: {
        lineStyle: { color: '#e5e7eb' }
      },
      axisLabel: {
        color: '#6b7280',
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value',
      name: '时间 (小时)',
      axisLine: { show: false },
      axisTick: { show: false },
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
        name: '计算耗时',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.totalComputeHours),
        itemStyle: {
          color: '#3b82f6'
        }
      },
      {
        name: '模拟时长',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.averageSimulationTime * d.completedTasks),
        itemStyle: {
          color: '#06b6d4'
        }
      }
    ]
  }
})

const boxPlotData = computed(() => {
  const methods = Object.values(FEMethod)
  return methods.map(method => ({
    method,
    values: Array.from({ length: 30 }, () => {
      const base = method === 'fep' ? 1.2 : method === 'ti' ? 1.5 : 2.1
      return +(base + (Math.random() - 0.5) * 1.5).toFixed(2)
    })
  }))
})

const loadData = async () => {
  loading.value = true
  try {
    await Promise.all([
      statisticsStore.fetchDailyStats({
        startDate: dateRange.value.startDate || undefined,
        endDate: dateRange.value.endDate || undefined,
        days: 30
      }),
      statisticsStore.fetchPerformanceTrend({
        startDate: dateRange.value.startDate || undefined,
        endDate: dateRange.value.endDate || undefined,
        days: 30
      })
    ])
  } catch (error) {
    console.error('Failed to load statistics:', error)
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
  loadData()
}

const exportData = () => {
  const csvContent = [
    ['日期', '总任务', '已完成', '失败', '完成率', '平均误差', '计算耗时', '平均模拟时间', '预警数', '审批数'].join(','),
    ...statisticsStore.dailyStats.map(d => [
      d.date,
      d.totalTasks,
      d.completedTasks,
      d.failedTasks,
      d.completionRate.toFixed(2),
      d.averageError.toFixed(3),
      d.totalComputeHours.toFixed(1),
      d.averageSimulationTime.toFixed(1),
      d.alertsGenerated,
      d.approvalsProcessed
    ].join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `statistics_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          统计看板
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          平台运行数据和性能指标统计
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <Calendar class="w-4 h-4 text-gray-400" />
          <input
            v-model="dateRange.startDate"
            type="date"
            class="input-field text-sm w-40"
            @change="loadData"
          />
          <span class="text-gray-400">至</span>
          <input
            v-model="dateRange.endDate"
            type="date"
            class="input-field text-sm w-40"
            @change="loadData"
          />
        </div>
        <button
          @click="refreshData"
          class="btn-secondary flex items-center gap-2"
          :disabled="loading"
        >
          <RefreshCw
            class="w-4 h-4"
            :class="{ 'animate-spin': loading }"
          />
          刷新
        </button>
        <button
          @click="exportData"
          class="btn-primary flex items-center gap-2"
        >
          <Download class="w-4 h-4" />
          导出
        </button>
      </div>
    </div>

    <div v-if="summaryStats" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <DataCard
        title="总任务数"
        :value="summaryStats.totalTasks"
        :icon="Database"
        color="primary"
        subtitle="选定周期内"
      />
      <DataCard
        title="完成率"
        :value="`${(summaryStats.avgCompletionRate * 100).toFixed(1)}%`"
        :icon="CheckCircle"
        color="success"
        subtitle="平均完成率"
      />
      <DataCard
        title="平均误差"
        :value="`${summaryStats.avgError.toFixed(3)} kcal/mol`"
        :icon="TrendingUp"
        color="warning"
        subtitle="MAE"
      />
      <DataCard
        title="计算资源"
        :value="`${summaryStats.totalComputeHours.toFixed(0)} h`"
        :icon="Server"
        color="info"
        subtitle="总消耗"
      />
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <Loader2 class="w-10 h-10 text-primary-500 animate-spin mb-4" />
      <p class="text-gray-500 dark:text-gray-400">加载统计数据...</p>
    </div>

    <div v-else class="space-y-6">
      <div class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
              <TrendingUp class="w-4 h-4 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">性能趋势</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">成功率、误差和任务量变化</p>
            </div>
          </div>
        </div>
        <div class="p-4">
          <v-chart
            ref="performanceTrendChart"
            :option="performanceTrendOption"
            autoresize
            style="height: 350px; width: 100%;"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccuracyBoxPlot :data="boxPlotData" />

        <div class="card overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <BarChart3 class="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">方法对比</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">各计算方法性能指标对比</p>
              </div>
            </div>
          </div>
          <div class="p-4">
            <v-chart
              ref="methodComparisonChart"
              :option="methodComparisonOption"
              autoresize
              style="height: 300px; width: 100%;"
            />
          </div>
        </div>
      </div>

      <div class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <Server class="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">资源消耗</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">计算资源使用情况堆叠图</p>
            </div>
          </div>
        </div>
        <div class="p-4">
          <v-chart
            ref="resourceConsumptionChart"
            :option="resourceConsumptionOption"
            autoresize
            style="height: 300px; width: 100%;"
          />
        </div>
      </div>

      <div class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Activity class="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">日度统计</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">详细的每日运行数据</p>
            </div>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">日期</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">总任务</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">已完成</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">失败</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">完成率</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">平均误差</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">计算耗时</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">预警数</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">审批数</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="stat in statisticsStore.dailyStats"
                :key="stat.date"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">{{ stat.date }}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-center">{{ stat.totalTasks }}</td>
                <td class="px-4 py-3 text-sm text-success-600 dark:text-success-400 text-center font-medium">{{ stat.completedTasks }}</td>
                <td class="px-4 py-3 text-sm text-danger-600 dark:text-danger-400 text-center font-medium">{{ stat.failedTasks }}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-center">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="{
                      'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400': stat.completionRate >= 0.8,
                      'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400': stat.completionRate >= 0.6 && stat.completionRate < 0.8,
                      'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400': stat.completionRate < 0.6
                    }"
                  >
                    {{ (stat.completionRate * 100).toFixed(1) }}%
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-center font-mono">{{ stat.averageError.toFixed(3) }}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-center">{{ stat.totalComputeHours.toFixed(1) }}h</td>
                <td class="px-4 py-3 text-sm text-warning-600 dark:text-warning-400 text-center font-medium">{{ stat.alertsGenerated }}</td>
                <td class="px-4 py-3 text-sm text-info-600 dark:text-info-400 text-center font-medium">{{ stat.approvalsProcessed }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
