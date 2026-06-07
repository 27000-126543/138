<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/task'
import TaskCard from '@/components/tasks/TaskCard.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import {
  Plus,
  Search,
  Filter,
  Grid3X3,
  List,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Target,
  FlaskConical,
  Loader2
} from 'lucide-vue-next'
import type { SimulationTask, TaskListFilters } from '@shared/types'
import { SimulationStatus, SIMULATION_STATUS_LABELS, FE_METHOD_LABELS } from '@shared/types'

const router = useRouter()
const taskStore = useTaskStore()

const viewMode = ref<'grid' | 'table'>('grid')
const showFilters = ref(false)
const selectedTasks = ref<Set<string>>(new Set())
const showBulkActions = ref(false)

const filters = ref<TaskListFilters>({
  status: undefined,
  targetId: undefined,
  startDate: undefined,
  endDate: undefined,
  search: ''
})

const statusOptions = Object.values(SimulationStatus).map(status => ({
  value: status,
  label: SIMULATION_STATUS_LABELS[status]
}))

const mockTargets = [
  { id: 'target-1', name: 'EGFR' },
  { id: 'target-2', name: 'BRD4' },
  { id: 'target-3', name: 'CDK2' },
  { id: 'target-4', name: 'KRAS G12D' },
  { id: 'target-5', name: 'HER2' }
]

const tasks = computed(() => taskStore.tasks)
const loading = computed(() => taskStore.loading)
const pagination = computed(() => taskStore.pagination)

const allSelected = computed(() => {
  return tasks.value.length > 0 && tasks.value.every(t => selectedTasks.value.has(t.id))
})

const loadTasks = async () => {
  const params: TaskListFilters & { page?: number; size?: number } = {
    ...filters.value,
    page: pagination.value.page,
    size: pagination.value.size
  }
  await taskStore.fetchTasks(params)
}

const handlePageChange = (page: number) => {
  taskStore.pagination.page = page
  loadTasks()
}

const handleSearch = () => {
  taskStore.pagination.page = 1
  loadTasks()
}

const handleFilterChange = () => {
  taskStore.pagination.page = 1
  loadTasks()
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

const toggleTaskSelection = (taskId: string) => {
  if (selectedTasks.value.has(taskId)) {
    selectedTasks.value.delete(taskId)
  } else {
    selectedTasks.value.add(taskId)
  }
  showBulkActions.value = selectedTasks.value.size > 0
}

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedTasks.value.clear()
  } else {
    tasks.value.forEach(t => selectedTasks.value.add(t.id))
  }
  showBulkActions.value = selectedTasks.value.size > 0
}

const handleBulkDelete = () => {
  alert(`删除 ${selectedTasks.value.size} 个任务`)
  selectedTasks.value.clear()
  showBulkActions.value = false
}

const handleBulkExport = () => {
  alert(`导出 ${selectedTasks.value.size} 个任务`)
}

const clearFilters = () => {
  filters.value = {
    status: undefined,
    targetId: undefined,
    startDate: undefined,
    endDate: undefined,
    search: ''
  }
  handleFilterChange()
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

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '--'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

onMounted(() => {
  loadTasks()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          任务列表
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          管理所有分子动力学模拟任务
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

    <div class="card overflow-hidden">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex flex-col lg:flex-row gap-4">
          <div class="flex-1 relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="filters.search"
              @keyup.enter="handleSearch"
              type="text"
              placeholder="搜索任务名称、创建者..."
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
            <div class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                @click="viewMode = 'grid'"
                class="p-2 rounded-md transition-colors"
                :class="[
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                ]"
              >
                <Grid3X3 class="w-4 h-4" />
              </button>
              <button
                @click="viewMode = 'table'"
                class="p-2 rounded-md transition-colors"
                :class="[
                  viewMode === 'table'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                ]"
              >
                <List class="w-4 h-4" />
              </button>
            </div>
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
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                状态
              </label>
              <select
                v-model="filters.status"
                @change="handleFilterChange"
                class="input"
              >
                <option :value="undefined">全部状态</option>
                <option
                  v-for="opt in statusOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                靶标
              </label>
              <select
                v-model="filters.targetId"
                @change="handleFilterChange"
                class="input"
              >
                <option :value="undefined">全部靶标</option>
                <option
                  v-for="target in mockTargets"
                  :key="target.id"
                  :value="target.id"
                >
                  {{ target.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                开始日期
              </label>
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
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                结束日期
              </label>
              <div class="relative">
                <Calendar class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  v-model="filters.endDate"
                  @change="handleFilterChange"
                  type="date"
                  class="input pl-10"
                />
              </div>
            </div>
          </div>
        </transition>

        <div
          v-if="showFilters && (filters.status || filters.targetId || filters.startDate || filters.endDate)"
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

      <transition
        enter-active-class="transition-all duration-200"
        enter-from-class="max-h-0 opacity-0"
        enter-to-class="max-h-16 opacity-100"
        leave-active-class="transition-all duration-200"
        leave-from-class="max-h-16 opacity-100"
        leave-to-class="max-h-0 opacity-0"
      >
        <div
          v-if="showBulkActions"
          class="px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-800 flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-primary-700 dark:text-primary-300">
              已选择 {{ selectedTasks.size }} 个任务
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="handleBulkExport"
              class="btn-secondary btn-sm flex items-center gap-1"
            >
              <Download class="w-4 h-4" />
              导出
            </button>
            <button
              @click="handleBulkDelete"
              class="btn-danger btn-sm flex items-center gap-1"
            >
              <Trash2 class="w-4 h-4" />
              删除
            </button>
          </div>
        </div>
      </transition>

      <div class="p-4">
        <div v-if="loading" class="flex items-center justify-center py-12">
          <Loader2 class="w-8 h-8 text-primary-500 animate-spin" />
        </div>

        <div
          v-else-if="tasks.length === 0"
          class="py-12"
        >
          <EmptyState
            :icon="FlaskConical"
            title="暂无任务"
            description="开始创建您的第一个分子动力学模拟任务"
          >
            <button
              @click="router.push('/tasks/new')"
              class="btn-primary flex items-center gap-2"
            >
              <Plus class="w-4 h-4" />
              新建任务
            </button>
          </EmptyState>
        </div>

        <div v-else-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="task in tasks"
            :key="task.id"
            class="relative"
          >
            <div class="absolute top-3 left-3 z-10">
              <input
                type="checkbox"
                :checked="selectedTasks.has(task.id)"
                @change="toggleTaskSelection(task.id)"
                class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </div>
            <TaskCard
              :task="task"
              @view="handleViewTask"
              @start="handleStartTask"
              @pause="handlePauseTask"
              @retry="handleRetryTask"
            />
          </div>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    :checked="allSelected"
                    @change="toggleSelectAll"
                    class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  任务名称
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  靶标
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  方法
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  状态
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  进度
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  创建时间
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  预计耗时
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="task in tasks"
                :key="task.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td class="px-4 py-4">
                  <input
                    type="checkbox"
                    :checked="selectedTasks.has(task.id)"
                    @change="toggleTaskSelection(task.id)"
                    class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </td>
                <td class="px-4 py-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      <FlaskConical class="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div class="min-w-0">
                      <p
                        @click="handleViewTask(task.id)"
                        class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {{ task.name }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ task.creator?.username || '未知' }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <span class="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                    <Target class="w-3 h-3" />
                    {{ task.target?.name || '--' }}
                  </span>
                </td>
                <td class="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                  {{ FE_METHOD_LABELS[task.feMethod as keyof typeof FE_METHOD_LABELS]?.split(' ')[0] || '--' }}
                </td>
                <td class="px-4 py-4">
                  <StatusBadge type="simulation" :status="task.status" />
                </td>
                <td class="px-4 py-4">
                  <div class="flex items-center gap-2">
                    <div class="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-primary-500 rounded-full transition-all"
                        :style="{ width: `${task.progress}%` }"
                      />
                    </div>
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{ task.progress }}%</span>
                  </div>
                </td>
                <td class="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {{ formatDate(task.createdAt) }}
                </td>
                <td class="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {{ formatDuration(task.estimatedTime) }}
                </td>
                <td class="px-4 py-4 text-right">
                  <button
                    @click="handleViewTask(task.id)"
                    class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    查看
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        v-if="pagination.totalPages > 1"
        class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between"
      >
        <div class="text-sm text-gray-500 dark:text-gray-400">
          显示 {{ (pagination.page - 1) * pagination.size + 1 }} - {{ Math.min(pagination.page * pagination.size, pagination.total) }} 条，共 {{ pagination.total }} 条
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="handlePageChange(pagination.page - 1)"
            :disabled="pagination.page === 1"
            class="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          <div class="flex items-center gap-1">
            <button
              v-for="page in Math.min(5, pagination.totalPages)"
              :key="page"
              @click="handlePageChange(page)"
              class="w-9 h-9 rounded-lg text-sm font-medium transition-colors"
              :class="[
                pagination.page === page
                  ? 'bg-primary-500 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              ]"
            >
              {{ page }}
            </button>
            <span v-if="pagination.totalPages > 5" class="px-2 text-gray-500">...</span>
          </div>
          <button
            @click="handlePageChange(pagination.page + 1)"
            :disabled="pagination.page === pagination.totalPages"
            class="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
