<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/task'
import ProgressStep from '@/components/common/ProgressStep.vue'
import FileUpload from '@/components/common/FileUpload.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Settings,
  CheckCircle2,
  FlaskConical,
  FileText,
  Thermometer,
  Droplets,
  Calculator,
  Target,
  Sparkles,
  Loader2
} from 'lucide-vue-next'
import { FEMethod, FORCE_FIELD_OPTIONS, FE_METHOD_LABELS, SimulationStatus } from '@shared/types'

const feMethodLabels = FE_METHOD_LABELS
import type { SimulationTask } from '@shared/types'
import { recommendationsApi } from '@/api/recommendations'

const router = useRouter()
const taskStore = useTaskStore()

const currentStep = ref(1)
const loading = ref(false)
const showRecommendation = ref(false)
const recommendationLoading = ref(false)

const formData = ref({
  name: '',
  targetId: '',
  proteinFile: null as File | null,
  ligandFile: null as File | null,
  forceField: 'amber14SB',
  temperature: 300,
  saltConcentration: 0.15,
  feMethod: FEMethod.FEP,
  rmsdThreshold: 2.0
})

const mockTargets = [
  { id: 'target-1', name: 'EGFR', description: '表皮生长因子受体' },
  { id: 'target-2', name: 'BRD4', description: '溴结构域蛋白4' },
  { id: 'target-3', name: 'CDK2', description: '细胞周期蛋白依赖性激酶2' },
  { id: 'target-4', name: 'KRAS G12D', description: 'KRAS G12D突变体' },
  { id: 'target-5', name: 'HER2', description: '人表皮生长因子受体2' }
]

const recommendation = ref<{
  forceField: string
  temperature: number
  saltConcentration: number
  rmsdThreshold: number
  equilibrationTime: number
  productionTime: number
  replicaCount: number
  lambdaWindows: number
} | null>(null)

const methodPerformance = ref<{
  method: string
  averageError: number
  successRate: number
  sampleSize: number
}[]>([])

const steps = [
  { id: 1, title: '文件上传', description: '上传蛋白质和配体文件', status: SimulationStatus.PENDING_VALIDATION },
  { id: 2, title: '参数配置', description: '设置模拟参数', status: SimulationStatus.SYSTEM_BUILDING },
  { id: 3, title: '确认提交', description: '核对信息并提交', status: SimulationStatus.COMPLETED }
]

const stepToStatus = (stepId: number): SimulationStatus => {
  const step = steps.find(s => s.id === stepId)
  return step?.status || SimulationStatus.PENDING_VALIDATION
}

const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return formData.value.name && formData.value.targetId && formData.value.proteinFile && formData.value.ligandFile
  }
  if (currentStep.value === 2) {
    return formData.value.forceField && formData.value.temperature > 0 && formData.value.rmsdThreshold > 0
  }
  return true
})

const getRecommendation = async () => {
  if (!formData.value.targetId) return
  recommendationLoading.value = true
  try {
    const [rec, perf] = await Promise.all([
      recommendationsApi.getParameterSuggestions({
        targetId: formData.value.targetId,
        feMethod: formData.value.feMethod
      }),
      recommendationsApi.getMethodPerformance({
        targetId: formData.value.targetId
      })
    ])
    recommendation.value = rec
    methodPerformance.value = perf
    showRecommendation.value = true
  } finally {
    recommendationLoading.value = false
  }
}

const applyRecommendation = () => {
  if (recommendation.value) {
    formData.value.forceField = recommendation.value.forceField
    formData.value.temperature = recommendation.value.temperature
    formData.value.saltConcentration = recommendation.value.saltConcentration
    formData.value.rmsdThreshold = recommendation.value.rmsdThreshold
  }
}

watch(() => formData.value.targetId, () => {
  if (formData.value.targetId) {
    getRecommendation()
  }
})

watch(() => formData.value.feMethod, () => {
  if (formData.value.targetId) {
    getRecommendation()
  }
})

const handleProteinUpload = (files: File[]) => {
  if (files.length > 0) {
    formData.value.proteinFile = files[0]
  }
}

const handleLigandUpload = (files: File[]) => {
  if (files.length > 0) {
    formData.value.ligandFile = files[0]
  }
}

const nextStep = () => {
  if (currentStep.value < 3 && canProceed.value) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const submitTask = async () => {
  loading.value = true
  try {
    await taskStore.createTask({
      name: formData.value.name,
      targetId: formData.value.targetId,
      forceField: formData.value.forceField,
      temperature: formData.value.temperature,
      saltConcentration: formData.value.saltConcentration,
      feMethod: formData.value.feMethod,
      rmsdThreshold: formData.value.rmsdThreshold
    })
    router.push('/tasks')
  } finally {
    loading.value = false
  }
}

const getMethodColor = (method: string) => {
  const colors: Record<string, string> = {
    fep: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ti: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    mmpbsa: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
  }
  return colors[method] || 'bg-gray-100 text-gray-700'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <button
        @click="router.back()"
        class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <ArrowLeft class="w-5 h-5 text-gray-500" />
      </button>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          新建任务
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          创建新的分子动力学模拟任务
        </p>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-8">
            <div
              v-for="(step, index) in steps"
              :key="step.id"
              class="flex items-center gap-3"
            >
              <div class="flex items-center justify-center">
                <ProgressStep
                  :currentStatus="stepToStatus(currentStep)"
                />
              </div>
              <div
                v-if="index < steps.length - 1"
                class="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
              >
                <div
                  class="h-full bg-primary-500 transition-all duration-300"
                  :style="{ width: currentStep > step.id ? '100%' : '0%' }"
                />
              </div>
            </div>
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            步骤 {{ currentStep }} / 3
          </div>
        </div>
      </div>

      <div class="p-6">
        <div v-show="currentStep === 1" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                任务名称 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="formData.name"
                type="text"
                placeholder="请输入任务名称"
                class="input"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                靶标选择 <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <Target class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  v-model="formData.targetId"
                  class="input pl-10"
                >
                  <option value="">请选择靶标</option>
                  <option
                    v-for="target in mockTargets"
                    :key="target.id"
                    :value="target.id"
                  >
                    {{ target.name }} - {{ target.description }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                蛋白质结构文件 (PDB) <span class="text-red-500">*</span>
              </label>
              <FileUpload
                :multiple="false"
                accept=".pdb"
                @upload="handleProteinUpload"
              >
                <template #default>
                  <div class="flex flex-col items-center gap-2 py-8">
                    <Upload class="w-10 h-10 text-gray-400" />
                    <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ formData.proteinFile ? formData.proteinFile.name : '点击或拖拽上传 PDB 文件' }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      支持 .pdb 格式
                    </p>
                  </div>
                </template>
              </FileUpload>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                配体文件 (SDF) <span class="text-red-500">*</span>
              </label>
              <FileUpload
                :multiple="false"
                accept=".sdf,.mol2"
                @upload="handleLigandUpload"
              >
                <template #default>
                  <div class="flex flex-col items-center gap-2 py-8">
                    <Upload class="w-10 h-10 text-gray-400" />
                    <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ formData.ligandFile ? formData.ligandFile.name : '点击或拖拽上传 SDF 文件' }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      支持 .sdf, .mol2 格式
                    </p>
                  </div>
                </template>
              </FileUpload>
            </div>
          </div>
        </div>

        <div v-show="currentStep === 2" class="space-y-6">
          <div v-if="showRecommendation" class="mb-6">
            <div class="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-5">
              <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
                    <Sparkles class="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100">智能参数推荐</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">基于该靶标的历史数据，为您推荐最优参数</p>
                  </div>
                </div>
                <button
                  v-if="recommendation"
                  @click="applyRecommendation"
                  class="btn-primary btn-sm"
                  :disabled="recommendationLoading"
                >
                  <CheckCircle2 class="w-4 h-4" />
                  应用推荐
                </button>
              </div>

              <div v-if="recommendationLoading" class="flex items-center justify-center py-8">
                <Loader2 class="w-6 h-6 text-primary-500 animate-spin" />
              </div>

              <div v-else-if="recommendation" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p class="text-xs text-gray-500 dark:text-gray-400">推荐力场</p>
                  <p class="font-semibold text-gray-900 dark:text-gray-100">{{ recommendation.forceField }}</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p class="text-xs text-gray-500 dark:text-gray-400">推荐温度</p>
                  <p class="font-semibold text-gray-900 dark:text-gray-100">{{ recommendation.temperature }}K</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p class="text-xs text-gray-500 dark:text-gray-400">盐浓度</p>
                  <p class="font-semibold text-gray-900 dark:text-gray-100">{{ recommendation.saltConcentration }}M</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p class="text-xs text-gray-500 dark:text-gray-400">RMSD 阈值</p>
                  <p class="font-semibold text-gray-900 dark:text-gray-100">{{ recommendation.rmsdThreshold }}Å</p>
                </div>
              </div>

              <div v-if="methodPerformance.length > 0" class="mt-4 pt-4 border-t border-primary-200 dark:border-primary-800">
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">各方法历史性能对比</p>
                <div class="grid grid-cols-3 gap-3">
                  <div
                    v-for="perf in methodPerformance"
                    :key="perf.method"
                    class="bg-white dark:bg-gray-800 rounded-lg p-3"
                  >
                    <div class="flex items-center gap-2 mb-2">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="getMethodColor(perf.method)"
                      >
                        {{ perf.method.toUpperCase() }}
                      </span>
                    </div>
                    <div class="space-y-1 text-xs">
                      <div class="flex justify-between">
                        <span class="text-gray-500">平均误差</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">{{ perf.averageError.toFixed(2) }} kcal/mol</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-500">成功率</span>
                        <span class="font-medium text-success-600">{{ (perf.successRate * 100).toFixed(0) }}%</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-500">样本量</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">{{ perf.sampleSize }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <span class="flex items-center gap-2">
                  <Settings class="w-4 h-4" />
                  力场选择
                </span>
              </label>
              <select
                v-model="formData.forceField"
                class="input"
              >
                <option
                  v-for="opt in FORCE_FIELD_OPTIONS"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <span class="flex items-center gap-2">
                  <Calculator class="w-4 h-4" />
                  计算方法
                </span>
              </label>
              <select
                v-model="formData.feMethod"
                class="input"
              >
                <option
                  v-for="(label, key) in FE_METHOD_LABELS"
                  :key="key"
                  :value="key"
                >
                  {{ label }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <span class="flex items-center gap-2">
                  <Thermometer class="w-4 h-4" />
                  温度 (K)
                </span>
              </label>
              <input
                v-model.number="formData.temperature"
                type="number"
                step="1"
                min="0"
                class="input"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <span class="flex items-center gap-2">
                  <Droplets class="w-4 h-4" />
                  盐浓度 (M)
                </span>
              </label>
              <input
                v-model.number="formData.saltConcentration"
                type="number"
                step="0.05"
                min="0"
                class="input"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <span class="flex items-center gap-2">
                  <Target class="w-4 h-4" />
                  RMSD 阈值 (Å)
                </span>
              </label>
              <input
                v-model.number="formData.rmsdThreshold"
                type="number"
                step="0.1"
                min="0"
                class="input"
              />
            </div>
          </div>
        </div>

        <div v-show="currentStep === 3" class="space-y-6">
          <div class="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-xl p-5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-success-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 class="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 class="font-semibold text-success-800 dark:text-success-300">配置已就绪</h3>
              <p class="text-sm text-success-700 dark:text-success-400">请确认以下信息，确认无误后提交任务</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="card">
              <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 class="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FileText class="w-4 h-4" />
                  基本信息
                </h3>
              </div>
              <div class="p-4 space-y-3">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">任务名称</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formData.name }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">靶标</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {{ mockTargets.find(t => t.id === formData.targetId)?.name || '--' }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">蛋白质文件</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-40">
                    {{ formData.proteinFile?.name || '--' }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">配体文件</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-40">
                    {{ formData.ligandFile?.name || '--' }}
                  </span>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 class="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FlaskConical class="w-4 h-4" />
                  模拟参数
                </h3>
              </div>
              <div class="p-4 space-y-3">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">力场</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formData.forceField }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">计算方法</span>
                  <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {{ feMethodLabels[formData.feMethod] }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">温度</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formData.temperature }}K</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">盐浓度</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formData.saltConcentration }}M</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">RMSD 阈值</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formData.rmsdThreshold }}Å</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
        <button
          v-if="currentStep > 1"
          @click="prevStep"
          class="btn-secondary flex items-center gap-2"
        >
          <ArrowLeft class="w-4 h-4" />
          上一步
        </button>
        <div v-else />

        <div class="flex items-center gap-3">
          <button
            @click="router.back()"
            class="btn-ghost"
          >
            取消
          </button>
          <button
            v-if="currentStep < 3"
            @click="nextStep"
            :disabled="!canProceed"
            class="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一步
            <ArrowRight class="w-4 h-4" />
          </button>
          <button
            v-else
            @click="submitTask"
            :disabled="loading"
            class="btn-success flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
            {{ loading ? '提交中...' : '提交任务' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
