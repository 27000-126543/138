<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/task'
import { useAlertStore } from '@/stores/alert'
import { useApprovalStore } from '@/stores/approval'
import RealtimeChart from '@/components/monitoring/RealtimeChart.vue'
import TaskStatusTimeline from '@/components/tasks/TaskStatusTimeline.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import EnergyDecompositionChart from '@/components/charts/EnergyDecompositionChart.vue'
import InteractionFingerprintChart from '@/components/charts/InteractionFingerprintChart.vue'
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  FileText,
  Send,
  AlertTriangle,
  Thermometer,
  FlaskConical,
  Target,
  User,
  Clock,
  Settings,
  ChevronRight,
  Activity,
  Zap,
  BarChart2,
  Fingerprint,
  History,
  Loader2,
  FastForward
} from 'lucide-vue-next'
import type {
  SimulationTask,
  MonitoringData,
  Alert,
  FreeEnergyResult,
  ParameterAdjustment
} from '@shared/types'
import {
  SimulationStatus,
  AlertLevel,
  ALERT_LEVEL_COLORS,
  ALERT_LEVEL_LABELS,
  SIMULATION_STATUS_LABELS,
  FE_METHOD_LABELS
} from '@shared/types'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const alertStore = useAlertStore()
const approvalStore = useApprovalStore()

const taskId = computed(() => route.params.id as string)
const activeChartTab = ref<'rmsd' | 'potentialEnergy' | 'temperature'>('rmsd')
const resultTab = ref<'energy' | 'decomposition' | 'residue' | 'fingerprint'>('energy')
const showApprovalModal = ref(false)
const approvalComment = ref('')

const loading = ref(true)
const actionLoading = ref('')

const task = computed(() => taskStore.currentTask)
const monitoringData = computed(() => taskStore.monitoringData)
const alerts = computed(() => taskStore.alerts)
const result = ref<FreeEnergyResult | null>(null)
const adjustments = ref<ParameterAdjustment[]>([])

const isRunning = computed(() => {
  if (!task.value) return false
  return [
    SimulationStatus.SYSTEM_BUILDING,
    SimulationStatus.ENERGY_MINIMIZATION,
    SimulationStatus.EQUILIBRATION,
    SimulationStatus.FEP_CALCULATION
  ].includes(task.value.status)
})

const canStart = computed(() => task.value?.status === SimulationStatus.PENDING_VALIDATION)
const canPause = computed(() => isRunning.value)
const canRestart = computed(() => task.value?.status === SimulationStatus.ERROR_ROLLBACK)
const canGenerateReport = computed(() => task.value?.status === SimulationStatus.COMPLETED)
const canSubmitApproval = computed(() => task.value?.status === SimulationStatus.COMPLETED)

const loadData = async () => {
  loading.value = true
  try {
    await Promise.all([
      taskStore.fetchTask(taskId.value),
      taskStore.fetchMonitoringData(taskId.value),
      taskStore.fetchAlerts(taskId.value),
      taskStore.fetchResult(taskId.value).then(r => { result.value = r })
    ])
  } finally {
    loading.value = false
  }
}

const handleStart = async () => {
  actionLoading.value = 'start'
  try {
    await taskStore.startTask(taskId.value)
  } finally {
    actionLoading.value = ''
  }
}

const handlePause = async () => {
  actionLoading.value = 'pause'
  try {
    await taskStore.pauseTask(taskId.value)
  } finally {
    actionLoading.value = ''
  }
}

const handleRestart = async () => {
  actionLoading.value = 'restart'
  try {
    await taskStore.restartTask(taskId.value)
  } finally {
    actionLoading.value = ''
  }
}

const handleGenerateReport = async () => {
  actionLoading.value = 'report'
  try {
    await taskStore.generateReport(taskId.value)
    alert('报告生成成功')
  } finally {
    actionLoading.value = ''
  }
}

const handleAdvanceState = async () => {
  actionLoading.value = 'advance'
  try {
    const result = await taskStore.advanceState(taskId.value)
    if (result?.advanced) {
      alert(`状态已推进到: ${result.currentState}`)
    } else {
      alert('状态无法推进')
    }
  } catch (error: any) {
    alert(`推进失败: ${error?.message || '未知错误'}`)
  } finally {
    actionLoading.value = ''
  }
}

const handleSubmitApproval = async () => {
  try {
    await approvalStore.submitApproval(taskId.value)
    showApprovalModal.value = false
    approvalComment.value = ''
    alert('已提交审批')
  } catch (error: any) {
    alert(`提交失败: ${error?.message || '未知错误'}`)
  }
}

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '--'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}小时${minutes}分钟`
  return `${minutes}分钟`
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <button
        @click="router.push('/tasks')"
        class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <ArrowLeft class="w-5 h-5 text-gray-500" />
      </button>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {{ task?.name || '任务详情' }}
          </h1>
          <StatusBadge
            v-if="task"
            type="simulation"
            :status="task.status"
            show-icon
          />
        </div>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          ID: {{ taskId }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="canStart"
          @click="handleStart"
          :disabled="!!actionLoading"
          class="btn-success flex items-center gap-2 disabled:opacity-50"
        >
          <Loader2 v-if="actionLoading === 'start'" class="w-4 h-4 animate-spin" />
          <Play v-else class="w-4 h-4" />
          启动
        </button>
        <button
          v-if="canPause"
          @click="handlePause"
          :disabled="!!actionLoading"
          class="btn-secondary flex items-center gap-2 disabled:opacity-50"
        >
          <Loader2 v-if="actionLoading === 'pause'" class="w-4 h-4 animate-spin" />
          <Pause v-else class="w-4 h-4" />
          暂停
        </button>
        <button
          v-if="canRestart"
          @click="handleRestart"
          :disabled="!!actionLoading"
          class="btn-warning flex items-center gap-2 disabled:opacity-50"
        >
          <Loader2 v-if="actionLoading === 'restart'" class="w-4 h-4 animate-spin" />
          <RotateCcw v-else class="w-4 h-4" />
          重启
        </button>
        <button
          v-if="task?.status !== 'completed' && task?.status !== 'error_rollback'"
          @click="handleAdvanceState"
          :disabled="!!actionLoading"
          class="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Loader2 v-if="actionLoading === 'advance'" class="w-4 h-4 animate-spin" />
          <FastForward v-else class="w-4 h-4" />
          推进状态
        </button>
        <button
          v-if="canGenerateReport"
          @click="handleGenerateReport"
          :disabled="!!actionLoading"
          class="btn-secondary flex items-center gap-2 disabled:opacity-50"
        >
          <Loader2 v-if="actionLoading === 'report'" class="w-4 h-4 animate-spin" />
          <FileText v-else class="w-4 h-4" />
          生成报告
        </button>
        <button
          v-if="canSubmitApproval"
          @click="showApprovalModal = true"
          class="btn-primary flex items-center gap-2"
        >
          <Send class="w-4 h-4" />
          提交审批
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 class="w-8 h-8 text-primary-500 animate-spin" />
    </div>

    <div v-else-if="!task" class="card p-12 text-center">
      <FlaskConical class="w-16 h-16 mx-auto mb-4 text-gray-300" />
      <p class="text-gray-500 dark:text-gray-400">任务不存在</p>
    </div>

    <div v-else class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="card overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">基本信息</h2>
            </div>
            <div class="p-5">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">靶标</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                    <Target class="w-3 h-3" />
                    {{ task.target?.name || '--' }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">创建者</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                    <User class="w-3 h-3" />
                    {{ task.creator?.username || '--' }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">计算方法</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                    <Zap class="w-3 h-3" />
                    {{ FE_METHOD_LABELS[task.feMethod]?.split(' ')[0] || '--' }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">预计耗时</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                    <Clock class="w-3 h-3" />
                    {{ formatDuration(task.estimatedTime) }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">力场</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ task.forceField }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">温度</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ task.temperature }}K</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">盐浓度</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ task.saltConcentration }}M</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">RMSD 阈值</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ task.rmsdThreshold }}Å</p>
                </div>
              </div>
              <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p class="text-gray-500 dark:text-gray-400">创建时间</p>
                  <p class="font-medium text-gray-900 dark:text-gray-100 mt-1">{{ formatDate(task.createdAt) }}</p>
                </div>
                <div>
                  <p class="text-gray-500 dark:text-gray-400">开始时间</p>
                  <p class="font-medium text-gray-900 dark:text-gray-100 mt-1">{{ formatDate(task.startedAt) }}</p>
                </div>
                <div>
                  <p class="text-gray-500 dark:text-gray-400">完成时间</p>
                  <p class="font-medium text-gray-900 dark:text-gray-100 mt-1">{{ formatDate(task.completedAt) }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="card overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">状态流转</h2>
            </div>
            <div class="p-5">
              <TaskStatusTimeline :currentStatus="task.status" />
            </div>
          </div>

          <div class="card overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">实时监控</h2>
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
                :task-id="taskId"
                :metric="activeChartTab"
                :threshold="task.rmsdThreshold"
              />
            </div>
          </div>

          <div v-if="result" class="card overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">计算结果</h2>
            </div>
            <div class="p-5">
              <div class="mb-6 p-6 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl text-center">
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">结合自由能</p>
                <p class="text-5xl font-bold text-gray-900 dark:text-gray-100 font-display">
                  {{ result.totalBindingEnergy.toFixed(2) }}
                  <span class="text-2xl text-gray-500">kcal/mol</span>
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  标准误差: ±{{ result.standardError.toFixed(3) }} kcal/mol
                </p>
              </div>

              <div class="flex items-center gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
                <button
                  v-for="tab in [
                    { key: 'energy', label: '能量分量', icon: BarChart2 },
                    { key: 'decomposition', label: '能量分解', icon: Activity },
                    { key: 'residue', label: '残基贡献', icon: Target },
                    { key: 'fingerprint', label: '相互作用指纹', icon: Fingerprint }
                  ]"
                  :key="tab.key"
                  @click="resultTab = tab.key as any"
                  class="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent transition-colors flex items-center gap-2"
                  :class="[
                    resultTab === tab.key
                      ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  ]"
                >
                  <component :is="tab.icon" class="w-4 h-4" />
                  {{ tab.label }}
                </button>
              </div>

              <div v-show="resultTab === 'energy'" class="space-y-3">
                <EnergyDecompositionChart :data="result.energyComponents" />
              </div>

              <div v-show="resultTab === 'decomposition'" class="space-y-3">
                <EnergyDecompositionChart :data="result.energyComponents" />
              </div>

              <div v-show="resultTab === 'residue'" class="space-y-3">
                <div class="overflow-x-auto">
                  <table class="w-full">
                    <thead>
                      <tr class="border-b border-gray-200 dark:border-gray-700">
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">残基编号</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">残基名称</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">能量贡献 (kcal/mol)</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">相互作用类型</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                      <tr
                        v-for="(res, idx) in result.decompositionPerResidue.slice(0, 10)"
                        :key="idx"
                        class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{{ res.residueNumber }}</td>
                        <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{{ res.residueName }}</td>
                        <td class="px-4 py-2 text-sm font-medium" :class="res.energyContribution < 0 ? 'text-success-600' : 'text-danger-600'">
                          {{ res.energyContribution.toFixed(3) }}
                        </td>
                        <td class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{{ res.interactionType || '--' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div v-show="resultTab === 'fingerprint'">
                <InteractionFingerprintChart :data="result.interactionFingerprint" title="配体-残基相互作用指纹" />
              </div>
            </div>
          </div>

          <div class="card overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">参数调整日志</h2>
            </div>
            <div class="p-5">
              <div v-if="adjustments.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
                <History class="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无参数调整记录</p>
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="adj in adjustments"
                  :key="adj.id"
                  class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="font-medium text-gray-900 dark:text-gray-100">
                        {{ adj.parameterName }}
                      </p>
                      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <span class="text-danger-600">{{ adj.oldValue }}</span>
                        <ChevronRight class="w-4 h-4 inline mx-1" />
                        <span class="text-success-600">{{ adj.newValue }}</span>
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">原因: {{ adj.reason }}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ adj.adjuster?.username }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(adj.adjustedAt) }}</p>
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
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">预警时间线</h2>
            </div>
            <div class="max-h-96 overflow-y-auto">
              <div v-if="alerts.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
                <AlertTriangle class="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>暂无预警</p>
              </div>
              <div v-else class="relative">
                <div class="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
                <div class="space-y-0">
                  <div
                    v-for="(alert, idx) in alerts"
                    :key="alert.id"
                    class="relative pl-12 pr-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div
                      class="absolute left-3 top-4 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900"
                      :class="ALERT_LEVEL_COLORS[alert.level]"
                    />
                    <div class="flex items-start justify-between">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <span
                            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                            :class="ALERT_LEVEL_COLORS[alert.level]"
                          >
                            {{ ALERT_LEVEL_LABELS[alert.level] }}
                          </span>
                        </div>
                        <p class="text-sm text-gray-900 dark:text-gray-100">{{ alert.message }}</p>
                        <p v-if="alert.metric && alert.value !== undefined" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {{ alert.metric }}: {{ alert.value.toFixed(2) }} / 阈值: {{ alert.threshold?.toFixed(2) }}
                        </p>
                      </div>
                    </div>
                    <p class="text-xs text-gray-400 mt-1">{{ formatDate(alert.timestamp) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showApprovalModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="showApprovalModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">提交审批</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">审批意见</label>
            <textarea
              v-model="approvalComment"
              rows="3"
              class="input"
              placeholder="请输入审批意见（可选）"
            />
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showApprovalModal = false"
            class="btn-ghost"
          >
            取消
          </button>
          <button
            @click="handleSubmitApproval"
            class="btn-primary"
          >
            提交
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
