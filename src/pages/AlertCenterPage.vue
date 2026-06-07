<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAlertStore } from '@/stores/alert'
import StatusBadge from '@/components/common/StatusBadge.vue'
import {
  AlertTriangle,
  Search,
  Filter,
  Calendar,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  X,
  Loader2
} from 'lucide-vue-next'
import type { Alert } from '@shared/types'
import { AlertLevel, ALERT_LEVEL_LABELS, ALERT_LEVEL_COLORS, SIMULATION_STATUS_LABELS } from '@shared/types'

const router = useRouter()
const alertStore = useAlertStore()

const showFilters = ref(false)
const showDetail = ref(false)
const selectedAlert = ref<Alert | null>(null)
const reviewComment = ref('')
const reviewAction = ref<'acknowledge' | 'dismiss' | 'escalate'>('acknowledge')
const reviewLoading = ref(false)

const filters = ref({
  level: undefined as AlertLevel | undefined,
  taskId: undefined as string | undefined,
  startDate: undefined as string | undefined,
  endDate: undefined as string | undefined,
  reviewed: undefined as boolean | undefined
})

const alerts = computed(() => alertStore.alerts)
const loading = computed(() => alertStore.loading)

const levelOptions = Object.values(AlertLevel).map(level => ({
  value: level,
  label: ALERT_LEVEL_LABELS[level]
}))

const mockTasks = [
  { id: 'task-1', name: 'EGFR 抑制剂 FEP 计算' },
  { id: 'task-2', name: 'BRD4 结合能预测' },
  { id: 'task-3', name: 'CDK2 配体优化' }
]

const loadAlerts = async () => {
  await alertStore.fetchAlerts({
    level: filters.value.level,
    reviewed: filters.value.reviewed,
    size: 50
  })
}

const handleFilterChange = () => {
  loadAlerts()
}

const clearFilters = () => {
  filters.value = {
    level: undefined,
    taskId: undefined,
    startDate: undefined,
    endDate: undefined,
    reviewed: undefined
  }
  loadAlerts()
}

const openDetail = (alert: Alert) => {
  selectedAlert.value = alert
  reviewComment.value = ''
  reviewAction.value = 'acknowledge'
  showDetail.value = true
}

const closeDetail = () => {
  showDetail.value = false
  selectedAlert.value = null
}

const handleReview = async () => {
  if (!selectedAlert.value) return
  reviewLoading.value = true
  try {
    await alertStore.reviewAlert(selectedAlert.value.id, {
      reviewComment: reviewComment.value,
      reviewAction: reviewAction.value
    })
    closeDetail()
  } finally {
    reviewLoading.value = false
  }
}

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getAlertIconColor = (level: AlertLevel) => {
  const colorMap = {
    [AlertLevel.INFO]: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
    [AlertLevel.WARNING]: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30',
    [AlertLevel.CRITICAL]: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30',
    [AlertLevel.FATAL]: 'text-red-500 bg-red-100 dark:bg-red-900/30'
  }
  return colorMap[level]
}

const getStatusLabel = (action?: string) => {
  if (!action) return { label: '待复核', color: 'bg-amber-500' }
  const map: Record<string, { label: string; color: string }> = {
    acknowledge: { label: '已确认', color: 'bg-blue-500' },
    dismiss: { label: '已忽略', color: 'bg-gray-500' },
    escalate: { label: '已升级', color: 'bg-red-500' }
  }
  return map[action] || { label: '已复核', color: 'bg-green-500' }
}

onMounted(() => {
  loadAlerts()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          预警中心
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          查看和处理系统预警信息
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
          <AlertTriangle class="w-4 h-4" />
          {{ alertStore.unreviewedCount }} 条待复核
        </span>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex flex-col lg:flex-row gap-4">
          <div class="flex-1 relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索预警信息..."
              class="input pl-10"
            />
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="showFilters = !showFilters"
              class="btn-secondary flex items-center gap-2"
              :class="{ 'ring-2 ring-primary-500': showFilters }"
            >
              <Filter class="w-4 h-4" />
              筛选
            </button>
          </div>
        </div>

        <transition
          enter-active-class="transition-all duration-200"
          enter-from-class="max-h-0 opacity-0"
          enter-to-class="max-h-48 opacity-100"
          leave-active-class="transition-all duration-200"
          leave-from-class="max-h-48 opacity-100"
          leave-to-class="max-h-0 opacity-0"
        >
          <div
            v-if="showFilters"
            class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">预警级别</label>
              <select
                v-model="filters.level"
                @change="handleFilterChange"
                class="input"
              >
                <option :value="undefined">全部级别</option>
                <option v-for="opt in levelOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">关联任务</label>
              <select
                v-model="filters.taskId"
                @change="handleFilterChange"
                class="input"
              >
                <option :value="undefined">全部任务</option>
                <option v-for="task in mockTasks" :key="task.id" :value="task.id">
                  {{ task.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">复核状态</label>
              <select
                v-model="filters.reviewed"
                @change="handleFilterChange"
                class="input"
              >
                <option :value="undefined">全部状态</option>
                <option :value="false">待复核</option>
                <option :value="true">已复核</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">开始日期</label>
              <div class="relative">
                <Calendar class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  v-model="filters.startDate"
                  @change="handleFilterChange"
                  type="date"
                  class="input pl-10"
                />
              </div>
            </div>
          </div>
        </transition>

        <div
          v-if="showFilters && (filters.level || filters.taskId || filters.reviewed !== undefined)"
          class="mt-3 flex items-center justify-between"
        >
          <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>已应用筛选条件</span>
          </div>
          <button
            @click="clearFilters"
            class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            清除筛选
          </button>
        </div>
      </div>

      <div class="p-4">
        <div v-if="loading" class="flex items-center justify-center py-12">
          <Loader2 class="w-8 h-8 text-primary-500 animate-spin" />
        </div>

        <div v-else-if="alerts.length === 0" class="py-12 text-center">
          <AlertTriangle class="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p class="text-gray-500 dark:text-gray-400">暂无预警信息</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="alert in alerts"
            :key="alert.id"
            @click="openDetail(alert)"
            class="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer"
          >
            <div class="flex items-start gap-4">
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                :class="getAlertIconColor(alert.level)"
              >
                <AlertTriangle class="w-6 h-6" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                        :class="ALERT_LEVEL_COLORS[alert.level as keyof typeof ALERT_LEVEL_COLORS]"
                      >
                        {{ ALERT_LEVEL_LABELS[alert.level as keyof typeof ALERT_LEVEL_LABELS] }}
                      </span>
                      <span
                        v-if="alert.reviewedAt"
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                        :class="getStatusLabel(alert.reviewAction).color"
                      >
                        {{ getStatusLabel(alert.reviewAction).label }}
                      </span>
                      <span v-else class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500 text-white">
                        待复核
                      </span>
                    </div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {{ alert.message }}
                    </p>
                  </div>
                  <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {{ formatDate(alert.timestamp) }}
                  </span>
                </div>
                <div class="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span class="flex items-center gap-1">
                    <Target class="w-3 h-3" />
                    {{ alert.task?.name || '未知任务' }}
                  </span>
                  <span v-if="alert.metric && alert.value !== undefined" class="flex items-center gap-1">
                    {{ alert.metric }}: <span class="font-medium text-gray-700 dark:text-gray-300">{{ alert.value.toFixed(2) }}</span>
                    <span v-if="alert.threshold !== undefined">
                      / 阈值: {{ alert.threshold.toFixed(2) }}
                    </span>
                  </span>
                  <span v-if="alert.reviewer" class="flex items-center gap-1">
                    <User class="w-3 h-3" />
                    {{ alert.reviewer.username }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <transition
      enter-active-class="transition-all duration-300"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-all duration-300"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="showDetail && selectedAlert"
        class="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700"
      >
        <div class="h-full flex flex-col">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">预警详情</h3>
            <button
              @click="closeDetail"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X class="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <div class="flex items-start gap-4">
              <div
                class="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                :class="getAlertIconColor(selectedAlert.level)"
              >
                <AlertTriangle class="w-7 h-7" />
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <span
                    class="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white"
                    :class="ALERT_LEVEL_COLORS[selectedAlert.level as keyof typeof ALERT_LEVEL_COLORS]"
                  >
                    {{ ALERT_LEVEL_LABELS[selectedAlert.level as keyof typeof ALERT_LEVEL_LABELS] }}
                  </span>
                </div>
                <p class="text-base font-medium text-gray-900 dark:text-gray-100">
                  {{ selectedAlert.message }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {{ formatDate(selectedAlert.timestamp) }}
                </p>
              </div>
            </div>

            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">预警类型</span>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedAlert.type }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">关联任务</span>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedAlert.task?.name || '--' }}</span>
              </div>
              <div v-if="selectedAlert.metric" class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">监控指标</span>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedAlert.metric }}</span>
              </div>
              <div v-if="selectedAlert.value !== undefined" class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">当前值</span>
                <span class="text-sm font-medium text-danger-600 dark:text-danger-400">{{ selectedAlert.value.toFixed(2) }}</span>
              </div>
              <div v-if="selectedAlert.threshold !== undefined" class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">阈值</span>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedAlert.threshold.toFixed(2) }}</span>
              </div>
              <div v-if="selectedAlert.task" class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">任务状态</span>
                <StatusBadge type="simulation" :status="selectedAlert.task.status" />
              </div>
            </div>

            <div v-if="selectedAlert.reviewedAt" class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">复核信息</h4>
              <div class="space-y-2">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">复核人</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedAlert.reviewer?.username || '--' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">处理结果</span>
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                    :class="getStatusLabel(selectedAlert.reviewAction).color"
                  >
                    {{ getStatusLabel(selectedAlert.reviewAction).label }}
                  </span>
                </div>
                <div v-if="selectedAlert.reviewComment" class="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span class="text-sm text-gray-500 dark:text-gray-400">复核意见</span>
                  <p class="text-sm text-gray-900 dark:text-gray-100 mt-1">{{ selectedAlert.reviewComment }}</p>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">复核时间</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formatDate(selectedAlert.reviewedAt) }}</span>
                </div>
              </div>
            </div>

            <div v-if="!selectedAlert.reviewedAt" class="space-y-4">
              <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">复核处理</h4>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">处理方式</label>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    @click="reviewAction = 'acknowledge'"
                    class="p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1"
                    :class="[
                      reviewAction === 'acknowledge'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    ]"
                  >
                    <CheckCircle2 class="w-5 h-5" />
                    <span class="text-xs font-medium">确认</span>
                  </button>
                  <button
                    @click="reviewAction = 'dismiss'"
                    class="p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1"
                    :class="[
                      reviewAction === 'dismiss'
                        ? 'border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    ]"
                  >
                    <XCircle class="w-5 h-5" />
                    <span class="text-xs font-medium">忽略</span>
                  </button>
                  <button
                    @click="reviewAction = 'escalate'"
                    class="p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1"
                    :class="[
                      reviewAction === 'escalate'
                        ? 'border-danger-500 bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    ]"
                  >
                    <AlertTriangle class="w-5 h-5" />
                    <span class="text-xs font-medium">升级</span>
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">复核意见</label>
                <textarea
                  v-model="reviewComment"
                  rows="3"
                  class="input"
                  placeholder="请输入复核意见（可选）"
                />
              </div>
            </div>
          </div>

          <div v-if="!selectedAlert.reviewedAt" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              @click="handleReview"
              :disabled="reviewLoading"
              class="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Loader2 v-if="reviewLoading" class="w-4 h-4 animate-spin" />
              {{ reviewLoading ? '提交中...' : '提交复核' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-300"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showDetail"
        class="fixed inset-0 z-40 bg-black/50"
        @click="closeDetail"
      />
    </transition>
  </div>
</template>
