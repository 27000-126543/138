<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Sparkles, Target as TargetIcon, TrendingUp, Clock, Layers, Zap, Lightbulb, CheckCircle, AlertCircle, Loader2, FlaskConical, Database } from 'lucide-vue-next'
import MethodComparisonRadar from '@/components/charts/MethodComparisonRadar.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import DataCard from '@/components/common/DataCard.vue'
import type { Target as TargetType, Recommendation, FEMethod } from '@shared/types'
import { FE_METHOD_LABELS, USER_ROLE_LABELS } from '@shared/types'
import { targetsApi } from '../api/targets'
import { recommendationsApi } from '../api/recommendations'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const targets = ref<TargetType[]>([])
const selectedTargetId = ref<string>('')
const loading = ref(false)
const recommendation = ref<Recommendation | null>(null)
const selectedTargetDetail = ref<TargetType | null>(null)

const selectedTarget = computed(() => {
  return targets.value.find(t => t.id === selectedTargetId.value)
})

const loadTargetDetail = async (target: TargetType) => {
  selectedTargetDetail.value = target
}

const radarData = computed(() => {
  if (!recommendation.value) return []
  
  return recommendation.value.historicalPerformance.map(hp => {
    const method = hp.method as FEMethod
    const accuracy = Math.max(0, 100 - hp.averageError * 10)
    const speed = Math.max(0, 100 - (hp.sampleSize > 50 ? 30 : hp.sampleSize > 20 ? 20 : 10))
    const stability = hp.successRate * 100
    const coverage = Math.min(100, hp.sampleSize * 2)
    const easeOfUse = method === 'fep' ? 60 : method === 'ti' ? 70 : 90
    const cost = Math.max(0, 100 - (hp.sampleSize > 50 ? 40 : hp.sampleSize > 20 ? 25 : 15))
    
    return {
      method,
      accuracy,
      speed,
      stability,
      coverage,
      easeOfUse,
      cost
    }
  })
})

const loadTargets = async () => {
  try {
    const response = await targetsApi.list({ size: 100 })
    targets.value = response.items
  } catch (error) {
    console.error('Failed to load targets:', error)
  }
}

const getRecommendation = async () => {
  if (!selectedTargetId.value) return
  
  loading.value = true
  try {
    const response = await recommendationsApi.getRecommendation({
      targetId: selectedTargetId.value
    })
    recommendation.value = response
  } catch (error) {
    console.error('Failed to get recommendation:', error)
  } finally {
    loading.value = false
  }
}

const createTask = () => {
  if (selectedTargetId.value) {
    router.push(`/tasks/new?targetId=${selectedTargetId.value}`)
  } else {
    router.push('/tasks/new')
  }
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
          智能推荐
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          基于历史数据的AI驱动参数推荐
        </p>
      </div>
      <button
        @click="createTask"
        class="btn-primary flex items-center gap-2"
      >
        <Zap class="w-4 h-4" />
        新建任务
      </button>
    </div>

    <div class="card p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <Sparkles class="w-6 h-6 text-white" />
        </div>
        <div class="flex-1">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            选择靶标获取推荐
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
            系统将基于该靶标的历史任务数据，推荐最优的计算方法和参数配置
          </p>
          <div class="max-w-md">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              靶标选择
            </label>
            <select
              v-model="selectedTargetId"
              @change="getRecommendation"
              class="input-field"
            >
              <option value="">请选择靶标...</option>
              <option
                v-for="target in targets"
                :key="target.id"
                :value="target.id"
                :disabled="target.isPaused"
              >
                {{ target.name }}
                {{ target.uniprotId ? `(${target.uniprotId})` : '' }}
                {{ target.isPaused ? ' - 已暂停' : '' }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <Loader2 class="w-10 h-10 text-primary-500 animate-spin mb-4" />
      <p class="text-gray-500 dark:text-gray-400">正在分析历史数据并生成推荐...</p>
    </div>

    <div v-else-if="recommendation" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DataCard
          title="推荐方法"
          :value="FE_METHOD_LABELS[recommendation.method].split(' ')[0]"
          :icon="FlaskConical"
          color="info"
          :subtitle="FE_METHOD_LABELS[recommendation.method].split(' ').slice(1).join(' ')"
        />
        <DataCard
          title="置信度"
          :value="`${(recommendation.confidence * 100).toFixed(0)}%`"
          :icon="TargetIcon"
          color="success"
          subtitle="基于历史性能评估"
        />
        <DataCard
          title="样本量"
          :value="recommendation.historicalPerformance[0]?.sampleSize || 0"
          :icon="Database"
          color="warning"
          subtitle="历史任务数量"
        />
        <DataCard
          title="预期误差"
          :value="`< ${recommendation.historicalPerformance[0]?.averageError.toFixed(2) || 'N/A'} kcal/mol`"
          :icon="TrendingUp"
          color="danger"
          subtitle="MAE预测值"
        />
      </div>

      <div class="card p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
            <Lightbulb class="w-4 h-4 text-success-600 dark:text-success-400" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">推荐理由</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">AI分析结果</p>
          </div>
        </div>
        <div class="p-4 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
          <p class="text-sm text-gray-700 dark:text-gray-300">
            {{ recommendation.reason }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MethodComparisonRadar :data="radarData" />

        <div class="card overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Layers class="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">历史性能对比</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">各方法在该靶标上的表现</p>
              </div>
            </div>
          </div>
          <div class="p-4">
            <div class="space-y-3">
              <div
                v-for="perf in recommendation.historicalPerformance"
                :key="perf.method"
                class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {{ FE_METHOD_LABELS[perf.method as FEMethod] }}
                  </span>
                  <span
                    class="text-xs px-2 py-0.5 rounded-full"
                    :class="{
                      'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400': perf.successRate >= 0.8,
                      'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400': perf.successRate >= 0.6 && perf.successRate < 0.8,
                      'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400': perf.successRate < 0.6
                    }"
                  >
                    成功率 {{ (perf.successRate * 100).toFixed(0) }}%
                  </span>
                </div>
                <div class="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p class="text-lg font-bold font-display text-gray-900 dark:text-gray-100">
                      {{ perf.averageError.toFixed(2) }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">平均误差 (kcal/mol)</p>
                  </div>
                  <div>
                    <p class="text-lg font-bold font-display text-gray-900 dark:text-gray-100">
                      {{ perf.sampleSize }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">样本数</p>
                  </div>
                  <div>
                    <p class="text-lg font-bold font-display text-gray-900 dark:text-gray-100">
                      {{ perf.successRate >= 0.8 ? '优秀' : perf.successRate >= 0.6 ? '良好' : '一般' }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">评价</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Clock class="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">采样策略建议</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">基于靶标特性的优化方案</p>
            </div>
          </div>
        </div>
        <div class="p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div class="flex items-center gap-2 mb-2">
                <Clock class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">平衡时间</span>
              </div>
              <p class="text-2xl font-bold font-display text-blue-600 dark:text-blue-400">
                {{ recommendation.samplingStrategy.equilibrationTime }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">纳秒 (ns)</p>
            </div>
            <div class="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div class="flex items-center gap-2 mb-2">
                <TrendingUp class="w-4 h-4 text-green-600 dark:text-green-400" />
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">生产时间</span>
              </div>
              <p class="text-2xl font-bold font-display text-green-600 dark:text-green-400">
                {{ recommendation.samplingStrategy.productionTime }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">纳秒 (ns)</p>
            </div>
            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div class="flex items-center gap-2 mb-2">
                <Layers class="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">复本数</span>
              </div>
              <p class="text-2xl font-bold font-display text-amber-600 dark:text-amber-400">
                {{ recommendation.samplingStrategy.replicaCount }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">个</p>
            </div>
            <div class="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div class="flex items-center gap-2 mb-2">
                <Zap class="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Lambda窗口</span>
              </div>
              <p class="text-2xl font-bold font-display text-purple-600 dark:text-purple-400">
                {{ recommendation.samplingStrategy.lambdaWindows }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">个</p>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <button
          @click="getRecommendation"
          class="btn-secondary flex items-center gap-2"
        >
          <Loader2 class="w-4 h-4" />
          刷新推荐
        </button>
        <button
          @click="createTask"
          class="btn-primary flex items-center gap-2"
        >
          <CheckCircle class="w-4 h-4" />
          使用推荐创建任务
        </button>
      </div>
    </div>

    <div v-else-if="!selectedTargetId" class="card p-12 text-center">
      <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
        <Target class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        选择靶标开始
      </h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        从上方下拉菜单中选择一个靶标，系统将基于该靶标的历史数据为您推荐最优的计算方法和参数配置
      </p>
    </div>
  </div>
</template>
