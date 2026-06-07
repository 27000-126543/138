<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/task'
import { useAlertStore } from '@/stores/alert'
import { useApprovalStore } from '@/stores/approval'
import { useStatisticsStore } from '@/stores/statistics'
import DataCard from '@/components/common/DataCard.vue'
import TaskCard from '@/components/tasks/TaskCard.vue'
import RealtimeChart from '@/components/monitoring/RealtimeChart.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import {
  FlaskConical,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Target,
  Plus,
  BarChart3,
  Settings,
  ChevronRight,
  Bell,
  FileCheck
} from 'lucide-vue-next'
import type { SimulationTask, Alert, Approval } from '@shared/types'
import { SimulationStatus, AlertLevel, ALERT_LEVEL_COLORS, ALERT_LEVEL_LABELS, SIMULATION_STATUS_LABELS, ApprovalStatus } from '@shared/types'

const router = useRouter()
const authStore = useAuthStore()
const taskStore = useTaskStore()
const alertStore = useAlertStore()
const approvalStore = useApprovalStore()
const statisticsStore = useStatisticsStore()

const loading = ref(true)
const activeChartTab = ref<'rmsd' | 'potentialEnergy' | 'temperature'>('rmsd')

const stats = computed(() => statisticsStore.dashboardStats)
const recentTasks = computed(() => taskStore.tasks.slice(0, 4))
const recentAlerts = computed(() => alertStore.alerts.slice(0, 5))
const pendingApprovals = computed(() => approvalStore.approvals.filter(a => a.status === ApprovalStatus.PENDING).slice(0, 3))

const totalTasks = computed(() => stats.value?.totalTasks ?? 0)
const runningTasks = computed(() => stats.value?.runningTasks ?? 0)
const completedToday = computed(() => stats.value?.completedTasks ?? 0)
const pendingApprovalsCount = computed(() => approvalStore.pendingCount)
const pendingAlertsCount = computed(() => alertStore.unreviewedCount)
const averageError = computed(() => stats.value?.averageAccuracy ?? 0)

const loadData = async () => {
  loading.value = true
  try {
    await Promise.all([
      statisticsStore.fetchDashboardStats(),
      taskStore.fetchTasks({ size: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
      alertStore.fetchAlerts({ size: 10, sortBy: 'timestamp', sortOrder: 'desc' }),
      approvalStore.fetchApprovals({ size: 10, sortBy: 'createdAt', sortOrder: 'desc' })
    ])
  } finally {
    loading.value = false
  }
}

const handleViewTask = (taskId: string) => {
  router.push(`/tasks/${taskId}`)
}

const handleStartTask = async (taskId: string) => {
  await taskStore.startTask(taskId)
}

const handlePauseTask = async (taskId: string) => {
  await taskStore.pauseTask(taskId)
}

const handleRetryTask = async (taskId: string) => {
  await taskStore.restartTask(taskId)
}

const handleViewAlert = (alertId: string) => {
  router.push('/alerts')
}

const handleViewApproval = (approvalId: string) => {
  router.push('/approvals')
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
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

type ActionColor = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
const quickActions: { label: string; icon: typeof Plus; color: ActionColor; action: () => void }[] = [
  { label: '新建任务', icon: Plus, color: 'primary', action: () => router.push('/tasks/new') },
  { label: '统计分析', icon: BarChart3, color: 'secondary', action: () => router.push('/statistics') },
  { label: '智能推荐', icon: Settings, color: 'success', action: () => router.push('/recommendations') },
  { label: '靶标管理', icon: Target, color: 'info', action: () => router.push('/targets') }
]

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          欢迎回来，{{ authStore.user?.username }}
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          这是您的工作台概览
        </p>
      </div>
      <button
        @click="router.push('/tasks/new')"
        class="btn-primary flex items-center gap-2"
      >
        <Plus class="w-4 h-4" />
        新建任务
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <DataCard
        title="任务总数"
        :value="totalTasks"
        :icon="FlaskConical"
        color="primary"
        :trend="12.5"
        trend-label="较上周"
      />
      <DataCard
        title="运行中"
        :value="runningTasks"
        :icon="Play"
        color="info"
        subtitle="实时监控中"
      />
      <DataCard
        title="今日完成"
        :value="completedToday"
        :icon="CheckCircle2"
        color="success"
        :trend="8.2"
        trend-label="较昨日"
      />
      <DataCard
        title="待审批"
        :value="pendingApprovalsCount"
        :icon="FileCheck"
        color="warning"
      />
      <DataCard
        title="待预警"
        :value="pendingAlertsCount"
        :icon="Bell"
        color="danger"
      />
      <DataCard
        title="平均误差"
        :value="`${averageError.toFixed(2)} kcal/mol`"
        :icon="Target"
        color="secondary"
        :trend="-3.1"
        trend-label="较上月"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <div class="card">
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              实时监控
            </h2>
            <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                v-for="tab in (['rmsd', 'potentialEnergy', 'temperature'] as const)"
                :key="tab"
                @click="activeChartTab = tab"
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                :class="[
                  activeChartTab === tab
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                ]"
              >
                {{ tab === 'rmsd' ? 'RMSD' : tab === 'potentialEnergy' ? '势能' : '温度' }}
              </button>
            </div>
          </div>
          <div class="p-4">
            <RealtimeChart
              task-id="dashboard-monitor"
              :metric="activeChartTab"
              :auto-refresh="true"
              :refresh-interval="3000"
            />
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="card overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              最近预警
            </h2>
            <button
              @click="router.push('/alerts')"
              class="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              查看全部
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
          <div class="divide-y divide-gray-100 dark:divide-gray-800 max-h-80 overflow-y-auto">
            <div
              v-for="alert in recentAlerts"
              :key="alert.id"
              @click="handleViewAlert(alert.id)"
              class="px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
            >
              <div class="flex items-start gap-3">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  :class="getAlertIconColor(alert.level)"
                >
                  <AlertTriangle class="w-4 h-4" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      :class="[ALERT_LEVEL_COLORS[alert.level], 'text-white']"
                    >
                      {{ ALERT_LEVEL_LABELS[alert.level] }}
                    </span>
                    <span class="text-xs text-gray-400">{{ formatDate(alert.timestamp) }}</span>
                  </div>
                  <p class="mt-1 text-sm text-gray-900 dark:text-gray-100 line-clamp-1">
                    {{ alert.message }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ alert.task?.name || '未知任务' }}
                  </p>
                </div>
              </div>
            </div>
            <div
              v-if="recentAlerts.length === 0"
              class="px-5 py-8 text-center text-gray-500 dark:text-gray-400"
            >
              暂无预警
            </div>
          </div>
        </div>

        <div class="card overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              待我审批
            </h2>
            <button
              @click="router.push('/approvals')"
              class="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              查看全部
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
          <div class="divide-y divide-gray-100 dark:divide-gray-800 max-h-60 overflow-y-auto">
            <div
              v-for="approval in pendingApprovals"
              :key="approval.id"
              @click="handleViewApproval(approval.id)"
              class="px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
            >
              <div class="flex items-center justify-between">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {{ approval.task?.name || '未知任务' }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    第 {{ approval.level }} 级审批
                  </p>
                </div>
                <StatusBadge type="approval" :status="approval.status" />
              </div>
            </div>
            <div
              v-if="pendingApprovals.length === 0"
              class="px-5 py-8 text-center text-gray-500 dark:text-gray-400"
            >
              暂无待审批
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div class="lg:col-span-3">
        <div class="card">
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              最近任务
            </h2>
            <button
              @click="router.push('/tasks')"
              class="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              查看全部
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
          <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <TaskCard
              v-for="task in recentTasks"
              :key="task.id"
              :task="task"
              @view="handleViewTask"
              @start="handleStartTask"
              @pause="handlePauseTask"
              @retry="handleRetryTask"
            />
            <div
              v-if="recentTasks.length === 0"
              class="col-span-full py-12 text-center text-gray-500 dark:text-gray-400"
            >
              <FlaskConical class="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无任务</p>
              <button
                @click="router.push('/tasks/new')"
                class="mt-3 btn-primary btn-sm"
              >
                <Plus class="w-4 h-4" />
                创建第一个任务
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            快速操作
          </h2>
        </div>
        <div class="p-5 space-y-3">
          <button
            v-for="action in quickActions"
            :key="action.label"
            @click="action.action"
            class="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
          >
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center"
              :class="[
                action.color === 'primary' && 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
                action.color === 'secondary' && 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400',
                action.color === 'success' && 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400',
                action.color === 'warning' && 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
                action.color === 'danger' && 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400',
                action.color === 'info' && 'bg-info-100 dark:bg-info-900/30 text-info-600 dark:text-info-400'
              ]"
            >
              <component :is="action.icon" class="w-5 h-5" />
            </div>
            <span class="flex-1 text-left font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
              {{ action.label }}
            </span>
            <ChevronRight class="w-5 h-5 text-gray-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
