<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Users, Plus, Edit2, Trash2, Search, Filter, Shield, UserCheck, Clock, Eye, X, Loader2, AlertTriangle, CheckCircle, Database, TrendingUp } from 'lucide-vue-next'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { User, UserRole } from '@shared/types'
import { USER_ROLE_LABELS, UserRole as UserRoleEnum } from '@shared/types'
import { usersApi } from '../api/users'

const users = ref<User[]>([])
const loading = ref(false)
const searchQuery = ref('')
const filterRole = ref<string>('all')
const showUserForm = ref(false)
const showDetailDrawer = ref(false)
const showDeleteDialog = ref(false)
const selectedUser = ref<User | null>(null)
const isEditing = ref(false)
const userStats = ref<{
  totalTasks: number
  completedTasks: number
  runningTasks: number
  successRate: number
  totalComputeHours: number
  averageAccuracy: number
} | null>(null)
const loadingStats = ref(false)

const userForm = ref({
  id: '',
  username: '',
  email: '',
  password: '',
  role: UserRoleEnum.COMPUTATIONAL_CHEMIST
})

const rolePermissions: Record<UserRole, string[]> = {
  [UserRoleEnum.COMPUTATIONAL_CHEMIST]: [
    '创建任务', '查看任务', '编辑任务', '删除任务',
    '查看预警', '处理预警', '查看报告', '导出数据'
  ],
  [UserRoleEnum.MEDICINAL_CHEMIST]: [
    '查看任务', '查看报告', '导出数据', '提交审批'
  ],
  [UserRoleEnum.SYNTHESIS_TEAM]: [
    '查看任务', '查看报告', '导出数据'
  ],
  [UserRoleEnum.CHIEF_SCIENTIST]: [
    '查看任务', '查看报告', '审批任务', '查看统计',
    '管理靶标', '暂停/恢复靶标'
  ],
  [UserRoleEnum.ADMIN]: [
    '全部权限'
  ]
}

const filteredUsers = computed(() => {
  return users.value.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                         u.email.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesRole = filterRole.value === 'all' || u.role === filterRole.value
    return matchesSearch && matchesRole
  })
})

const loadUsers = async () => {
  loading.value = true
  try {
    const response = await usersApi.list({ size: 100 })
    users.value = response.items
  } catch (error) {
    console.error('Failed to load users:', error)
  } finally {
    loading.value = false
  }
}

const loadUserDetail = async (user: User) => {
  selectedUser.value = user
  showDetailDrawer.value = true
  loadingStats.value = true
  
  try {
    const stats = await usersApi.getStats(user.id)
    userStats.value = stats
  } catch (error) {
    console.error('Failed to load user stats:', error)
  } finally {
    loadingStats.value = false
  }
}

const openCreateForm = () => {
  isEditing.value = false
  userForm.value = {
    id: '',
    username: '',
    email: '',
    password: '',
    role: UserRoleEnum.COMPUTATIONAL_CHEMIST
  }
  showUserForm.value = true
}

const openEditForm = (user: User) => {
  isEditing.value = true
  selectedUser.value = user
  userForm.value = {
    id: user.id,
    username: user.username,
    email: user.email,
    password: '',
    role: user.role
  }
  showUserForm.value = true
}

const saveUser = async () => {
  if (!userForm.value.username.trim() || !userForm.value.email.trim()) return
  if (!isEditing.value && !userForm.value.password.trim()) return
  
  try {
    if (isEditing.value) {
      const updateData: any = {
        username: userForm.value.username,
        email: userForm.value.email,
        role: userForm.value.role
      }
      if (userForm.value.password.trim()) {
        updateData.password = userForm.value.password
      }
      await usersApi.update(userForm.value.id, updateData)
    } else {
      await usersApi.create({
        username: userForm.value.username,
        email: userForm.value.email,
        password: userForm.value.password,
        role: userForm.value.role
      })
    }
    showUserForm.value = false
    await loadUsers()
  } catch (error) {
    console.error('Failed to save user:', error)
  }
}

const openDeleteDialog = (user: User) => {
  selectedUser.value = user
  showDeleteDialog.value = true
}

const deleteUser = async () => {
  if (!selectedUser.value) return
  
  try {
    await usersApi.delete(selectedUser.value.id)
    showDeleteDialog.value = false
    selectedUser.value = null
    await loadUsers()
  } catch (error) {
    console.error('Failed to delete user:', error)
  }
}

const closeDetailDrawer = () => {
  showDetailDrawer.value = false
  selectedUser.value = null
  userStats.value = null
}

const getRoleColor = (role: UserRole) => {
  const colors: Record<UserRole, string> = {
    [UserRoleEnum.COMPUTATIONAL_CHEMIST]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    [UserRoleEnum.MEDICINAL_CHEMIST]: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    [UserRoleEnum.SYNTHESIS_TEAM]: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    [UserRoleEnum.CHIEF_SCIENTIST]: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    [UserRoleEnum.ADMIN]: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  return colors[role]
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          用户管理
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          管理平台用户、角色和权限
        </p>
      </div>
      <button
        @click="openCreateForm"
        class="btn-primary flex items-center gap-2"
      >
        <Plus class="w-4 h-4" />
        新建用户
      </button>
    </div>

    <div class="card p-4">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1 relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索用户名或邮箱..."
            class="input-field pl-10"
          />
        </div>
        <div class="flex items-center gap-2">
          <Filter class="w-4 h-4 text-gray-400" />
          <select
            v-model="filterRole"
            class="input-field w-48"
          >
            <option value="all">全部角色</option>
            <option :value="role" v-for="(label, role) in USER_ROLE_LABELS" :key="role">
              {{ label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <Loader2 class="w-10 h-10 text-primary-500 animate-spin mb-4" />
      <p class="text-gray-500 dark:text-gray-400">加载中...</p>
    </div>

    <div v-else class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">用户</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">邮箱</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">角色</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">创建时间</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">最近登录</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="user in filteredUsers"
              :key="user.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                    {{ user.username.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ user.username }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">ID: {{ user.id }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{{ user.email }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="getRoleColor(user.role)"
                >
                  {{ USER_ROLE_LABELS[user.role] }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {{ new Date(user.createdAt).toLocaleDateString() }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {{ user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '从未登录' }}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-center gap-1">
                  <button
                    @click="loadUserDetail(user)"
                    class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="查看详情"
                  >
                    <Eye class="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    @click="openEditForm(user)"
                    class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Edit2 class="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    @click="openDeleteDialog(user)"
                    class="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 class="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="filteredUsers.length === 0" class="px-4 py-12 text-center">
        <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <Users class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          暂无用户
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
          {{ searchQuery || filterRole !== 'all' ? '没有符合条件的用户，请尝试调整筛选条件' : '点击上方按钮创建第一个用户' }}
        </p>
        <button
          v-if="!searchQuery && filterRole === 'all'"
          @click="openCreateForm"
          class="btn-primary inline-flex items-center gap-2"
        >
          <Plus class="w-4 h-4" />
          新建用户
        </button>
      </div>
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
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xl">
                  {{ selectedUser?.username.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {{ selectedUser?.username }}
                  </h2>
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1"
                    :class="selectedUser ? getRoleColor(selectedUser.role) : ''"
                  >
                    {{ selectedUser ? USER_ROLE_LABELS[selectedUser.role] : '' }}
                  </span>
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

            <template v-else-if="userStats">
              <div class="grid grid-cols-2 gap-4">
                <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div class="flex items-center gap-2 mb-2">
                    <Database class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">总任务数</span>
                  </div>
                  <p class="text-2xl font-bold font-display text-blue-600 dark:text-blue-400">
                    {{ userStats.totalTasks }}
                  </p>
                </div>
                <div class="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div class="flex items-center gap-2 mb-2">
                    <CheckCircle class="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">成功率</span>
                  </div>
                  <p class="text-2xl font-bold font-display text-green-600 dark:text-green-400">
                    {{ (userStats.successRate * 100).toFixed(1) }}%
                  </p>
                </div>
                <div class="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <div class="flex items-center gap-2 mb-2">
                    <TrendingUp class="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">平均精度</span>
                  </div>
                  <p class="text-2xl font-bold font-display text-purple-600 dark:text-purple-400">
                    {{ userStats.averageAccuracy.toFixed(2) }}
                  </p>
                </div>
                <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div class="flex items-center gap-2 mb-2">
                    <Clock class="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">计算耗时</span>
                  </div>
                  <p class="text-2xl font-bold font-display text-amber-600 dark:text-amber-400">
                    {{ userStats.totalComputeHours.toFixed(1) }}h
                  </p>
                </div>
              </div>

              <div class="card overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <Shield class="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">基本信息</h3>
                    </div>
                  </div>
                </div>
                <div class="p-4 space-y-3">
                  <div class="flex items-center justify-between py-2">
                    <span class="text-sm text-gray-600 dark:text-gray-400">邮箱</span>
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedUser?.email }}</span>
                  </div>
                  <div class="flex items-center justify-between py-2">
                    <span class="text-sm text-gray-600 dark:text-gray-400">创建时间</span>
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedUser?.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'N/A' }}</span>
                  </div>
                  <div class="flex items-center justify-between py-2">
                    <span class="text-sm text-gray-600 dark:text-gray-400">最近登录</span>
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedUser?.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : '从未登录' }}</span>
                  </div>
                </div>
              </div>

              <div class="card overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-info-100 dark:bg-info-900/30 flex items-center justify-center">
                      <UserCheck class="w-4 h-4 text-info-600 dark:text-info-400" />
                    </div>
                    <div>
                      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">权限配置</h3>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ selectedUser ? USER_ROLE_LABELS[selectedUser.role] : '' }} 角色权限</p>
                    </div>
                  </div>
                </div>
                <div class="p-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div
                      v-for="(permission, index) in (selectedUser ? rolePermissions[selectedUser.role] : [])"
                      :key="index"
                      class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                    >
                      <CheckCircle class="w-4 h-4 text-success-500 flex-shrink-0" />
                      <span class="text-sm text-gray-700 dark:text-gray-300">{{ permission }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex gap-3">
                <button
                  @click="selectedUser && openEditForm(selectedUser)"
                  class="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Edit2 class="w-4 h-4" />
                  编辑用户
                </button>
                <button
                  @click="selectedUser && openDeleteDialog(selectedUser)"
                  class="btn-danger flex items-center justify-center gap-2 px-6"
                >
                  <Trash2 class="w-4 h-4" />
                  删除
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      v-model="showUserForm"
      :title="isEditing ? '编辑用户' : '新建用户'"
      message=""
      confirm-label="保存"
      @confirm="saveUser"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            用户名 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="userForm.username"
            type="text"
            placeholder="请输入用户名"
            class="input-field"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            邮箱 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="userForm.email"
            type="email"
            placeholder="请输入邮箱地址"
            class="input-field"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            密码 <span v-if="!isEditing" class="text-red-500">*</span>
            <span v-else class="text-gray-400 text-xs ml-2">（留空则不修改）</span>
          </label>
          <input
            v-model="userForm.password"
            type="password"
            :placeholder="isEditing ? '请输入新密码' : '请输入密码'"
            class="input-field"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            角色 <span class="text-red-500">*</span>
          </label>
          <select
            v-model="userForm.role"
            class="input-field"
          >
            <option :value="role" v-for="(label, role) in USER_ROLE_LABELS" :key="role">
              {{ label }}
            </option>
          </select>
        </div>
        <div
          v-if="userForm.role"
          class="p-4 bg-info-50 dark:bg-info-900/20 rounded-lg border border-info-200 dark:border-info-800"
        >
          <div class="flex items-start gap-2">
            <Shield class="w-4 h-4 text-info-600 dark:text-info-400 flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-xs font-medium text-info-800 dark:text-info-300 mb-1">角色权限</p>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="(perm, idx) in rolePermissions[userForm.role]"
                  :key="idx"
                  class="text-xs px-2 py-0.5 rounded bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300"
                >
                  {{ perm }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ConfirmDialog>

    <ConfirmDialog
      v-model="showDeleteDialog"
      title="删除用户"
      message=""
      confirm-label="确认删除"
      type="danger"
      @confirm="deleteUser"
    >
      <div class="space-y-4">
        <div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div class="flex items-start gap-3">
            <AlertTriangle class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-red-800 dark:text-red-300">
                确定要删除用户「{{ selectedUser?.username }}」吗？
              </p>
              <p class="text-xs text-red-700 dark:text-red-400 mt-1">
                此操作不可撤销。用户的所有数据将被永久删除。
              </p>
            </div>
          </div>
        </div>
      </div>
    </ConfirmDialog>
  </div>
</template>
