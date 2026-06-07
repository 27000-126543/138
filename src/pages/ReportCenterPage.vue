<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import StatusBadge from '@/components/common/StatusBadge.vue'
import {
  FileText,
  Download,
  Eye,
  Calendar,
  User,
  Target,
  FlaskConical,
  ChevronRight,
  FileDown,
  GitCompare,
  Loader2
} from 'lucide-vue-next'
import type { Report } from '@shared/types'
import { FE_METHOD_LABELS } from '@shared/types'

const router = useRouter()

const loading = ref(true)
const showPreview = ref(false)
const selectedReport = ref<Report | null>(null)
const showCompare = ref(false)

const reports = ref<Report[]>([
  {
    id: 'report-1',
    taskId: 'task-1',
    task: {
      id: 'task-1',
      name: 'EGFR 抑制剂 FEP 计算',
      targetId: 'target-1',
      createdBy: 'user-1',
      status: 'completed' as any,
      forceField: 'amber14SB',
      temperature: 300,
      saltConcentration: 0.15,
      feMethod: 'fep' as any,
      rmsdThreshold: 2.0,
      progress: 100,
      createdAt: '2024-01-15T10:30:00Z',
      retryCount: 0
    },
    filePath: '/reports/report-1.pdf',
    fileType: 'pdf',
    fileSize: 2456789,
    generatedAt: '2024-01-16T14:20:00Z'
  },
  {
    id: 'report-2',
    taskId: 'task-2',
    task: {
      id: 'task-2',
      name: 'BRD4 结合能预测',
      targetId: 'target-2',
      createdBy: 'user-1',
      status: 'completed' as any,
      forceField: 'charmm36',
      temperature: 310,
      saltConcentration: 0.15,
      feMethod: 'ti' as any,
      rmsdThreshold: 2.0,
      progress: 100,
      createdAt: '2024-01-14T09:00:00Z',
      retryCount: 0
    },
    filePath: '/reports/report-2.pdf',
    fileType: 'pdf',
    fileSize: 3124567,
    generatedAt: '2024-01-15T18:45:00Z'
  }
])

const exportOptions = ref({
  trajectory: false,
  components: false
})

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const openPreview = (report: Report) => {
  selectedReport.value = report
  showPreview.value = true
}

const closePreview = () => {
  showPreview.value = false
  selectedReport.value = null
}

const handleDownload = (report: Report) => {
  alert(`下载报告: ${report.task?.name}`)
}

const handleExport = () => {
  const items = []
  if (exportOptions.value.trajectory) items.push('轨迹文件')
  if (exportOptions.value.components) items.push('能量分量')
  alert(`导出: ${items.join(', ')}`)
}

onMounted(() => {
  setTimeout(() => {
    loading.value = false
  }, 500)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          报告中心
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          查看和下载计算报告
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="showCompare = true"
          class="btn-secondary flex items-center gap-2"
        >
          <GitCompare class="w-4 h-4" />
          版本对比
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <div class="card overflow-hidden">
          <div class="p-4">
            <div v-if="loading" class="flex items-center justify-center py-12">
              <Loader2 class="w-8 h-8 text-primary-500 animate-spin" />
            </div>

            <div v-else-if="reports.length === 0" class="py-12 text-center">
              <FileText class="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p class="text-gray-500 dark:text-gray-400">暂无报告</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="report in reports"
                :key="report.id"
                class="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all"
              >
                <div class="flex items-start gap-4">
                  <div class="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                    <FileText class="w-6 h-6" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-4">
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {{ report.task?.name || '未知任务' }}
                        </p>
                        <div class="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span class="flex items-center gap-1">
                            <Target class="w-3 h-3" />
                            {{ report.task?.target?.name || '--' }}
                          </span>
                          <span class="flex items-center gap-1">
                            <User class="w-3 h-3" />
                            {{ report.task?.creator?.username || '--' }}
                          </span>
                          <span>{{ report.fileType.toUpperCase() }}</span>
                          <span>{{ formatFileSize(report.fileSize) }}</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 flex-shrink-0">
                        <button
                          @click="openPreview(report)"
                          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="预览"
                        >
                          <Eye class="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          @click="handleDownload(report)"
                          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="下载"
                        >
                          <Download class="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                    <div class="mt-2 text-xs text-gray-400 flex items-center gap-1">
                      <Calendar class="w-3 h-3" />
                      生成于 {{ formatDate(report.generatedAt) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="card overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">数据导出</h2>
          </div>
          <div class="p-5 space-y-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">选择需要导出的数据类型</p>
            <div class="space-y-3">
              <label class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <input
                  v-model="exportOptions.trajectory"
                  type="checkbox"
                  class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">轨迹文件</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">分子动力学模拟轨迹数据</p>
                </div>
              </label>
              <label class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <input
                  v-model="exportOptions.components"
                  type="checkbox"
                  class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">能量分量</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">详细的能量分解数据</p>
                </div>
              </label>
            </div>
            <button
              @click="handleExport"
              :disabled="!exportOptions.trajectory && !exportOptions.components"
              class="w-full btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown class="w-4 h-4" />
              导出数据
            </button>
          </div>
        </div>
      </div>
    </div>

    <transition
      enter-active-class="transition-all duration-300"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-200"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showPreview && selectedReport"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closePreview"
      >
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {{ selectedReport.task?.name }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">PDF 预览</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="handleDownload(selectedReport)"
                class="btn-secondary flex items-center gap-2"
              >
                <Download class="w-4 h-4" />
                下载
              </button>
              <button
                @click="closePreview"
                class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div class="flex-1 overflow-auto p-8 bg-gray-100 dark:bg-gray-900">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-2xl mx-auto min-h-[600px]">
              <div class="text-center mb-8">
                <FlaskConical class="w-16 h-16 mx-auto mb-4 text-primary-500" />
                <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {{ selectedReport.task?.name }}
                </h1>
                <p class="text-gray-500 dark:text-gray-400">
                  分子动力学模拟计算报告
                </p>
              </div>

              <div class="grid grid-cols-2 gap-4 mb-8">
                <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">靶标</p>
                  <p class="font-medium text-gray-900 dark:text-gray-100">{{ selectedReport.task?.target?.name || '--' }}</p>
                </div>
                <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">计算方法</p>
                  <p class="font-medium text-gray-900 dark:text-gray-100">
                    {{ selectedReport.task ? FE_METHOD_LABELS[selectedReport.task.feMethod]?.split(' ')[0] : '--' }}
                  </p>
                </div>
                <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">力场</p>
                  <p class="font-medium text-gray-900 dark:text-gray-100">{{ selectedReport.task?.forceField || '--' }}</p>
                </div>
                <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">温度</p>
                  <p class="font-medium text-gray-900 dark:text-gray-100">{{ selectedReport.task?.temperature || '--' }}K</p>
                </div>
              </div>

              <div class="text-center py-12 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl mb-8">
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">结合自由能</p>
                <p class="text-5xl font-bold text-gray-900 dark:text-gray-100 font-display">
                  -12.50
                  <span class="text-2xl text-gray-500">kcal/mol</span>
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  标准误差: ±0.300 kcal/mol
                </p>
              </div>

              <div class="text-center text-sm text-gray-400">
                <p>报告生成时间: {{ formatDate(selectedReport.generatedAt) }}</p>
                <p class="mt-1">报告 ID: {{ selectedReport.id }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <transition
      enter-active-class="transition-all duration-300"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-200"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showCompare"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="showCompare = false"
      >
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">版本对比</h3>
            <button
              @click="showCompare = false"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-auto p-6">
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">版本 A</label>
                <select class="input">
                  <option value="">选择报告</option>
                  <option v-for="r in reports" :key="r.id" :value="r.id">
                    {{ r.task?.name }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">版本 B</label>
                <select class="input">
                  <option value="">选择报告</option>
                  <option v-for="r in reports" :key="r.id" :value="r.id">
                    {{ r.task?.name }}
                  </option>
                </select>
              </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 text-center">
              <GitCompare class="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p class="text-gray-500 dark:text-gray-400">选择两个报告进行对比</p>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              @click="showCompare = false"
              class="btn-primary"
            >
              开始对比
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
