<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApprovalStore } from '@/stores/approval'
import StatusBadge from '@/components/common/StatusBadge.vue'
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Target,
  FlaskConical,
  ChevronRight,
  X,
  Loader2
} from 'lucide-vue-next'
import type { Approval, FreeEnergyResult } from '@shared/types'
import { ApprovalStatus, APPROVAL_STATUS_COLORS, FE_METHOD_LABELS, SIMULATION_STATUS_LABELS } from '@shared/types'

const router = useRouter()
const approvalStore = useApprovalStore()

const activeTab = ref<'pending' | 'history'>('pending')
const showDetail = ref(false)
const selectedApproval = ref<Approval | null>(null)
const approvalComment = ref('')
const actionLoading = ref(false)

const pendingApprovals = computed(() => approvalStore.approvals.filter(a => a.status === ApprovalStatus.PENDING))
const historyApprovals = computed(() => approvalStore.approvals.filter(a => a.status !== ApprovalStatus.PENDING))
const loading = computed(() => approvalStore.loading)

const loadApprovals = async () => {
  await approvalStore.fetchApprovals({ size: 50 })
}

const openDetail = (approval: Approval) => {
  selectedApproval.value = approval
  approvalComment.value = ''
  showDetail.value = true
}

const closeDetail = () => {
  showDetail.value = false
  selectedApproval.value = null
}

const handleApprove = async () => {
  if (!selectedApproval.value) return
  actionLoading.value = true
  try {
    await approvalStore.processApproval(selectedApproval.value.id, {
      status: ApprovalStatus.APPROVED,
      comment: approvalComment.value
    })
    closeDetail()
  } finally {
    actionLoading.value = false
  }
}

const handleReject = async () => {
  if (!selectedApproval.value) return
  actionLoading.value = true
  try {
    await approvalStore.processApproval(selectedApproval.value.id, {
      status: ApprovalStatus.REJECTED,
      comment: approvalComment.value
    })
    closeDetail()
  } finally {
    actionLoading.value = false
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

onMounted(() => {
  loadApprovals()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          审批中心
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          处理任务审批请求
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
          <FileCheck class="w-4 h-4" />
          {{ approvalStore.pendingCount }} 条待审批
        </span>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="border-b border-gray-200 dark:border-gray-700">
        <div class="flex">
          <button
            @click="activeTab = 'pending'"
            class="px-6 py-4 text-sm font-medium border-b-2 transition-colors"
            :class="[
              activeTab === 'pending'
                ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            待审批
            <span
              v-if="approvalStore.pendingCount > 0"
              class="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs"
            >
              {{ approvalStore.pendingCount }}
            </span>
          </button>
          <button
            @click="activeTab = 'history'"
            class="px-6 py-4 text-sm font-medium border-b-2 transition-colors"
            :class="[
              activeTab === 'history'
                ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            审批历史
          </button>
        </div>
      </div>

      <div class="p-4">
        <div v-if="loading" class="flex items-center justify-center py-12">
          <Loader2 class="w-8 h-8 text-primary-500 animate-spin" />
        </div>

        <div v-else-if="(activeTab === 'pending' ? pendingApprovals : historyApprovals).length === 0" class="py-12 text-center">
          <FileCheck class="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p class="text-gray-500 dark:text-gray-400">
            {{ activeTab === 'pending' ? '暂无待审批请求' : '暂无审批历史' }}
          </p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="approval in (activeTab === 'pending' ? pendingApprovals : historyApprovals)"
            :key="approval.id"
            @click="openDetail(approval)"
            class="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer"
          >
            <div class="flex items-start gap-4">
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                :class="[
                  approval.status === ApprovalStatus.PENDING
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    : approval.status === ApprovalStatus.APPROVED
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                ]"
              >
                <FileCheck class="w-6 h-6" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <StatusBadge type="approval" :status="approval.status" />
                      <span class="text-xs text-gray-500 dark:text-gray-400">第 {{ approval.level }} 级审批</span>
                    </div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {{ approval.task?.name || '未知任务' }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {{ formatDate(approval.task?.createdAt) }}
                    </span>
                    <ChevronRight class="w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div class="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span class="flex items-center gap-1">
                    <Target class="w-3 h-3" />
                    {{ approval.task?.target?.name || '--' }}
                  </span>
                  <span class="flex items-center gap-1">
                    <User class="w-3 h-3" />
                    {{ approval.task?.creator?.username || '--' }}
                  </span>
                  <span v-if="approval.approver" class="flex items-center gap-1">
                    <Clock class="w-3 h-3" />
                    审批人: {{ approval.approver.username }}
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
        v-if="showDetail && selectedApproval"
        class="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700"
      >
        <div class="h-full flex flex-col">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">审批详情</h3>
            <button
              @click="closeDetail"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X class="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <div class="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl p-5">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">任务名称</p>
                  <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {{ selectedApproval.task?.name || '--' }}
                  </p>
                </div>
                <StatusBadge type="approval" :status="selectedApproval.status" />
              </div>
              <div class="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">靶标</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedApproval.task?.target?.name || '--' }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">计算方法</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {{ selectedApproval.task ? FE_METHOD_LABELS[selectedApproval.task.feMethod]?.split(' ')[0] : '--' }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">创建人</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedApproval.task?.creator?.username || '--' }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">创建时间</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formatDate(selectedApproval.task?.createdAt) }}</p>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h4 class="font-semibold text-gray-900 dark:text-gray-100">计算结果</h4>
              </div>
              <div class="p-4">
                <div v-if="selectedApproval?.task?.status === 'completed'" class="text-center py-6">
                  <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">结合自由能</p>
                  <p class="text-4xl font-bold text-gray-900 dark:text-gray-100 font-display">
                    --
                    <span class="text-xl text-gray-500">kcal/mol</span>
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    标准误差: -- kcal/mol
                  </p>
                </div>
                <div v-else class="text-center py-6">
                  <FlaskConical class="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p class="text-sm text-gray-500 dark:text-gray-400">任务尚未完成，暂无计算结果</p>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h4 class="font-semibold text-gray-900 dark:text-gray-100">结果对比</h4>
              </div>
              <div class="p-4">
                <div class="overflow-x-auto">
                  <table class="w-full">
                    <thead>
                      <tr class="border-b border-gray-200 dark:border-gray-700">
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">方法</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">结合能 (kcal/mol)</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">实验值</th>
                        <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">偏差</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td class="px-3 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">本次计算 (FEP)</td>
                        <td class="px-3 py-3 text-center text-sm font-medium text-primary-600 dark:text-primary-400">-12.5</td>
                        <td class="px-3 py-3 text-center text-sm text-gray-600 dark:text-gray-400">-11.8</td>
                        <td class="px-3 py-3 text-center text-sm font-medium text-success-600">+0.7</td>
                      </tr>
                      <tr>
                        <td class="px-3 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">MM-PBSA</td>
                        <td class="px-3 py-3 text-center text-sm text-gray-600 dark:text-gray-400">-9.8</td>
                        <td class="px-3 py-3 text-center text-sm text-gray-600 dark:text-gray-400">-11.8</td>
                        <td class="px-3 py-3 text-center text-sm font-medium text-danger-600">-2.0</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div v-if="selectedApproval.status === ApprovalStatus.PENDING" class="space-y-4">
              <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">审批意见</h4>
              <textarea
                v-model="approvalComment"
                rows="4"
                class="input"
                placeholder="请输入审批意见（通过时可选，驳回时必填）"
              />
            </div>

            <div v-if="selectedApproval.status !== ApprovalStatus.PENDING" class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">审批结果</h4>
              <div class="space-y-2">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">审批人</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedApproval.approver?.username || '--' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">审批结果</span>
                  <StatusBadge type="approval" :status="selectedApproval.status" />
                </div>
                <div v-if="selectedApproval.comment" class="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span class="text-sm text-gray-500 dark:text-gray-400">审批意见</span>
                  <p class="text-sm text-gray-900 dark:text-gray-100 mt-1">{{ selectedApproval.comment }}</p>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">审批时间</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formatDate(selectedApproval.signedAt) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedApproval.status === ApprovalStatus.PENDING" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
            <button
              @click="closeDetail"
              class="btn-ghost"
            >
              取消
            </button>
            <div class="flex items-center gap-3">
              <button
                @click="handleReject"
                :disabled="actionLoading"
                class="btn-danger flex items-center gap-2 disabled:opacity-50"
              >
                <XCircle class="w-4 h-4" />
                驳回
              </button>
              <button
                @click="handleApprove"
                :disabled="actionLoading"
                class="btn-success flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 class="w-4 h-4" />
                通过
              </button>
            </div>
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
