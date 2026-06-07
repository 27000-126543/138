<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Target, Plus, Pause, Play, Trash2, Eye, Search, Filter, X, ChevronDown, AlertTriangle, CheckCircle, Clock, Database, TrendingUp, Activity, Loader2 } from 'lucide-vue-next'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { Target as TargetType, SimulationTask } from '@shared/types'
import { SIMULATION_STATUS_LABELS, SIMULATION_STATUS_COLORS, USER_ROLE_LABELS } from '@shared/types'
import { targetsApi } from '../api/targets'
import { tasksApi } from '../api/tasks'

const targets = ref<TargetType[]>([])
const loading = ref(false)
const searchQuery = ref('')
const filterPaused = ref<string>('all')
const selectedTarget = ref<TargetType | null>(null)
const showDetailDrawer = ref(false)
const showCreateForm = ref(false)
const showPauseDialog = ref(false)
const pauseReason = ref('')
const targetStats = ref<{
  totalTasks: number
  completedTasks: number
  runningTasks: number
  successRate: number
  averageAccuracy: number
  consecutiveDeviations: number
} | null>(null)
const targetTasks = ref<SimulationTask[]>([])
const loadingStats = ref(false)

const newTargetForm = ref({
  name: '',
  uniprotId: '',
  pdbId: '',
  description: ''
})

const filteredTargets = computed(() => {
  return targets.value.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                         (t.uniprotId?.toLowerCase() || '').includes(searchQuery.value.toLowerCase()) ||
                         (t.pdbId?.toLowerCase() || '').includes(searchQuery.value.toLowerCase())
    const matchesPaused = filterPaused.value === 'all' ||
                         (filterPaused.value === 'paused' && t.isPaused) ||
                         (filterPaused.value === 'active' && !t.isPaused)
    return matchesSearch && matchesPaused
  })
})

const loadTargets = async () => {
  loading.value = true
  try {
    const response = await targetsApi.list({ size: 100 })
    targets.value = response.items
  } catch (error) {
    console.error('Failed to load targets:', error)
  } finally {
    loading.value = false
  }
}

const loadTargetDetail = async (target: TargetType) => {
  selectedTarget.value = target
  showDetailDrawer.value = true
  loadingStats.value = true
  
  try {
    const [stats, tasks] = await Promise.all([
      targetsApi.getStats(target.id),
      tasksApi.list({ targetId: target.id, size: 10 })
    ])
    targetStats.value = stats
    targetTasks.value = tasks.items
  } catch (error) {
    console.error('Failed to load target detail:', error)
  } finally {
    loadingStats.value = false
  }
}

const createTarget = async () => {
  if (!newTargetForm.value.name.trim()) return
  
  try {
    await targetsApi.create(newTargetForm.value)
    showCreateForm.value = false
    newTargetForm.value = { name: '', uniprotId: '', pdbId: '', description: '' }
    await loadTargets()
  } catch (error) {
    console.error('Failed to create target:', error)
  }
}

const pauseTarget = async () => {
  if (!selectedTarget.value || !pauseReason.value.trim()) return
  
  try {
    await targetsApi.pause(selectedTarget.value.id, { pauseReason: pauseReason.value })
    showPauseDialog.value = false
    pauseReason.value = ''
    await loadTargets()
    if (selectedTarget.value) {
      await loadTargetDetail(selectedTarget.value)
    }
  } catch (error) {
    console.error('Failed to pause target:', error)
  }
}

const resumeTarget = async (target: TargetType) => {
  try {
    await targetsApi.resume(target.id)
    await loadTargets()
    if (selectedTarget.value?.id === target.id) {
      await loadTargetDetail(target)
    }
  } catch (error) {
    console.error('Failed to resume target:', error)
  }
}

const openPauseDialog = (target: TargetType) => {
  selectedTarget.value = target
  showPauseDialog.value = true
}

const closeDetailDrawer = () => {
  showDetailDrawer.value = false
  selectedTarget.value = null
  targetStats.value = null
  targetTasks.value = []
}

onMounted(() => {
  loadTargets()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          靶标管理
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          管理所有研究靶标及其状态
        </p>
      </div>
      <button
        @click="showCreateForm = true"
        class="btn-primary flex items-center gap-2"
      >
        <Plus class="w-4 h-4" />
        新建靶标
      </button>
    </div>

    <div class="card p-4">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1 relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索靶标名称、UniProt ID 或 PDB ID..."
            class="input-field pl-10"
          />
        </div>
        <div class="flex items-center gap-2">
          <Filter class="w-4 h-4 text-gray-400" />
          <select
            v-model="filterPaused"
            class="input-field w-40"
          >
            <option value="all">全部状态</option>
            <option value="active">运行中</option>
            <option value="paused">已暂停</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <Loader2 class="w-10 h-10 text-primary-500 animate-spin mb-4" />
      <p class="text-gray-500 dark:text-gray-400">加载中...</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="target in filteredTargets"
        :key="target.id"
        class="card overflow-hidden hover:shadow-lg transition-shadow"
      >
        <div class="p-4">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                :class="target.isPaused ? 'bg-gray-100 dark:bg-gray-800' : 'bg-primary-100 dark:bg-primary-900/30'"
              >
                <Target
                  class="w-5 h-5"
                  :class="target.isPaused ? 'text-gray-400' : 'text-primary-600 dark:text-primary-400'"
                />
              </div>
              <div>
                <h3 class="font-semibold text-gray-900 dark:text-gray-100">
                  {{ target.name }}
                </h3>
                <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span v-if="target.uniprotId">{{ target.uniprotId }}</span>
                  <span v-if="target.uniprotId && target.pdbId">·</span>
                  <span v-if="target.pdbId">{{ target.pdbId }}</span>
                </div>
              </div>
            </div>
            <span
              class="text-xs px-2 py-1 rounded-full"
              :class="target.isPaused
                ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                : 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'"
            >
              {{ target.isPaused ? '已暂停' : '运行中' }}
            </span>
          </div>

          <p v-if="target.description" class="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
            {{ target.description }}
          </p>

          <div v-if="target.isPaused && target.pauseReason" class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div class="flex items-start gap-2">
              <AlertTriangle class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-xs font-medium text-amber-800 dark:text-amber-300">暂停原因</p>
                <p class="text-xs text-amber-700 dark:text-amber-400">{{ target.pauseReason }}</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              <p class="text-lg font-bold font-display text-gray-900 dark:text-gray-100">
                {{ target.consecutiveDeviations }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">连续偏差</p>
            </div>
            <div class="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              <p class="text-lg font-bold font-display text-gray-900 dark:text-gray-100">
                {{ target.lastDeviationCheck ? new Date(target.lastDeviationCheck).toLocaleDateString() : 'N/A' }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">最近检查</p>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              @click="loadTargetDetail(target)"
              class="btn-secondary flex-1 flex items-center justify-center gap-1 text-sm"
            >
              <Eye class="w-4 h-4" />
              详情
            </button>
            <button
              v-if="!target.isPaused"
              @click="openPauseDialog(target)"
              class="btn-secondary flex items-center justify-center gap-1 text-sm px-3"
            >
              <Pause class="w-4 h-4" />
            </button>
            <button
              v-else
              @click="resumeTarget(target)"
              class="btn-success flex items-center justify-center gap-1 text-sm px-3"
            >
              <Play class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="filteredTargets.length === 0 && !loading" class="card p-12 text-center">
      <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
        <Target class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        暂无靶标
      </h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
        {{ searchQuery || filterPaused !== 'all' ? '没有符合条件的靶标，请尝试调整筛选条件' : '点击上方按钮创建第一个靶标' }}
      </p>
      <button
        v-if="!searchQuery && filterPaused === 'all'"
        @click="showCreateForm = true"
        class="btn-primary inline-flex items-center gap-2"
      >
        <Plus class="w-4 h-4" />
        新建靶标
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="showDetailDrawer"
        class="fixed inset-0 z-50 flex"
      >
        <div
          class="absolute inset-0 bg-black/50"
          @click="closeDetailDrawer"
        />
        <div class="relative ml-auto w-full max-w-2xl h-full bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto">
          <div class="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center"
                  :class="selectedTarget?.isPaused ? 'bg-gray-100 dark:bg-gray-800' : 'bg-primary-100 dark:bg-primary-900/30'"
                >
                  <Target
                    class="w-5 h-5"
                    :class="selectedTarget?.isPaused ? 'text-gray-400' : 'text-primary-600 dark:text-primary-400'"
                  />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {{ selectedTarget?.name }}
                  </h2>
                  <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span v-if="selectedTarget?.uniprotId">{{ selectedTarget.uniprotId }}</span>
                    <span v-if="selectedTarget?.uniprotId && selectedTarget?.pdbId">·</span>
                    <span v-if="selectedTarget?.pdbId">{{ selectedTarget.pdbId }}</span>
                  </div>
                </div>
              </div>
              <button
                @click="closeDetailDrawer"
                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X class="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div class="p-6 space-y-6">
            <div v-if="loadingStats" class="flex items-center justify-center py-12">
              <Loader2 class="w-8 h-8 text-primary-500 animate-spin" />
            </div>

            <template v-else-if="targetStats">
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div class="flex items-center gap-2 mb-2">
                    <Database class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">总任务数</span>
                  </div>
                  <p class="text-2xl font-bold font-display text-blue-600 dark:text-blue-400">
                    {{ targetStats.totalTasks }}
                  </p>
                </div>
                <div class="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div class="flex items-center gap-2 mb-2">
                    <CheckCircle class="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">成功率</span>
                  </div>
                  <p class="text-2xl font-bold font-display text-green-600 dark:text-green-400">
                    {{ (targetStats.successRate * 100).toFixed(1) }}%
                  </p>
                </div>
                <div class="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <div class="flex items-center gap-2 mb-2">
                    <TrendingUp class="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">平均精度</span>
                  </div>
                  <p class="text-2xl font-bold font-display text-purple-600 dark:text-purple-400">
                    {{ targetStats.averageAccuracy.toFixed(2) }}
                  </p>
                </div>
                <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div class="flex items-center gap-2 mb-2">
                    <AlertTriangle class="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">连续偏差</span>
                  </div>
                  <p class="text-2xl font-bold font-display text-amber-600 dark:text-amber-400">
                    {{ targetStats.consecutiveDeviations }}
                  </p>
                </div>
              </div>

              <div class="card overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">偏差统计</h3>
                </div>
                <div class="p-4">
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-gray-600 dark:text-gray-400">已完成任务</span>
                      <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ targetStats.completedTasks }} 个</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-gray-600 dark:text-gray-400">运行中任务</span>
                      <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ targetStats.runningTasks }} 个</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-gray-600 dark:text-gray-400">失败任务</span>
                      <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ targetStats.totalTasks - targetStats.completedTasks - targetStats.runningTasks }} 个</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="card overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">历史任务</h3>
                </div>
                <div class="divide-y divide-gray-200 dark:divide-gray-700">
                  <div
                    v-for="task in targetTasks"
                    :key="task.id"
                    class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ task.name }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ new Date(task.createdAt).toLocaleString() }}</p>
                      </div>
                      <span
                        class="text-xs px-2 py-1 rounded-full text-white"
                        :class="SIMULATION_STATUS_COLORS[task.status]"
                      >
                        {{ SIMULATION_STATUS_LABELS[task.status] }}
                      </span>
                    </div>
                  </div>
                  <div v-if="targetTasks.length === 0" class="px-4 py-8 text-center">
                    <p class="text-sm text-gray-500 dark:text-gray-400">暂无任务记录</p>
                  </div>
                </div>
              </div>

              <div class="flex gap-3">
                <button
                  v-if="!selectedTarget?.isPaused"
                  @click="openPauseDialog(selectedTarget!)"
                  class="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Pause class="w-4 h-4" />
                  暂停靶标
                </button>
                <button
                  v-else
                  @click="resumeTarget(selectedTarget!)"
                  class="btn-success flex-1 flex items-center justify-center gap-2"
                >
                  <Play class="w-4 h-4" />
                  恢复靶标
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      v-model="showCreateForm"
      title="新建靶标"
      message=""
      confirm-label="创建"
      @confirm="createTarget"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            靶标名称 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="newTargetForm.name"
            type="text"
            placeholder="例如：EGFR、BRD4"
            class="input-field"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            UniProt ID
          </label>
          <input
            v-model="newTargetForm.uniprotId"
            type="text"
            placeholder="例如：P04637"
            class="input-field"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            PDB ID
          </label>
          <input
            v-model="newTargetForm.pdbId"
            type="text"
            placeholder="例如：1TUP"
            class="input-field"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            描述
          </label>
          <textarea
            v-model="newTargetForm.description"
            placeholder="靶标描述信息..."
            rows="3"
            class="input-field resize-none"
          />
        </div>
      </div>
    </ConfirmDialog>

    <ConfirmDialog
      v-model="showPauseDialog"
      title="暂停靶标"
      message=""
      confirm-label="确认暂停"
      type="danger"
      @confirm="pauseTarget"
    >
      <div class="space-y-4">
        <div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div class="flex items-start gap-3">
            <AlertTriangle class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-amber-800 dark:text-amber-300">
                确定要暂停靶标「{{ selectedTarget?.name }}」吗？
              </p>
              <p class="text-xs text-amber-700 dark:text-amber-400 mt-1">
                暂停后，该靶标的所有新任务创建将被阻止，直到恢复。
              </p>
            </div>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            暂停原因 <span class="text-red-500">*</span>
          </label>
          <textarea
            v-model="pauseReason"
            placeholder="请输入暂停原因..."
            rows="3"
            class="input-field resize-none"
          />
        </div>
      </div>
    </ConfirmDialog>
  </div>
</template>
