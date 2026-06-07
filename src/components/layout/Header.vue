<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  Bell,
  CheckSquare,
  ChevronDown,
  Moon,
  Sun,
  User as UserIcon,
  LogOut,
  Settings,
  Home,
  Search,
  Menu,
  X,
  AlertTriangle,
  Clock
} from 'lucide-vue-next';
import type { User, Alert, Approval } from '@shared/types';
import { AlertLevel, ApprovalStatus, ALERT_LEVEL_LABELS, ALERT_LEVEL_COLORS } from '@shared/types';

interface Props {
  user?: User;
  alerts: Alert[];
  approvals: Approval[];
  isDark: boolean;
  sidebarCollapsed: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  toggleTheme: [];
  toggleSidebar: [];
  logout: [];
  viewProfile: [];
  viewAlert: [alertId: string];
  viewApproval: [approvalId: string];
}>();

const route = useRoute();
const userMenuOpen = ref(false);
const alertMenuOpen = ref(false);
const approvalMenuOpen = ref(false);

const breadcrumbs = computed(() => {
  const path = route.path;
  const crumbs: { label: string; path?: string }[] = [{ label: '首页', path: '/dashboard' }];
  
  const routeMap: Record<string, string> = {
    '/dashboard': '仪表盘',
    '/tasks': '模拟任务',
    '/targets': '靶点管理',
    '/monitoring': '实时监控',
    '/alerts': '预警通知',
    '/approvals': '审批中心',
    '/results': '结果分析',
    '/reports': '报告管理',
    '/statistics': '统计分析',
    '/methods': '方法管理',
    '/proteins': '蛋白库',
    '/users': '用户管理',
    '/settings': '系统设置'
  };

  const segments = path.split('/').filter(Boolean);
  let currentPath = '';
  
  for (const segment of segments) {
    currentPath += '/' + segment;
    const label = routeMap[currentPath];
    if (label) {
      crumbs.push({ label, path: currentPath });
    }
  }

  if (route.params.id) {
    crumbs.push({ label: `详情 #${route.params.id}` });
  }

  return crumbs;
});

const unreadAlerts = computed(() => {
  return props.alerts.filter(a => !a.reviewedBy);
});

const pendingApprovals = computed(() => {
  return props.approvals.filter(a => a.status === ApprovalStatus.PENDING);
});

const getAlertColor = (level: AlertLevel) => {
  return ALERT_LEVEL_COLORS[level];
};

const closeAllMenus = () => {
  userMenuOpen.value = false;
  alertMenuOpen.value = false;
  approvalMenuOpen.value = false;
};

const toggleUserMenu = (e: Event) => {
  e.stopPropagation();
  closeAllMenus();
  userMenuOpen.value = !userMenuOpen.value;
};

const toggleAlertMenu = (e: Event) => {
  e.stopPropagation();
  closeAllMenus();
  alertMenuOpen.value = !alertMenuOpen.value;
};

const toggleApprovalMenu = (e: Event) => {
  e.stopPropagation();
  closeAllMenus();
  approvalMenuOpen.value = !approvalMenuOpen.value;
};

const handleAlertClick = (alertId: string) => {
  closeAllMenus();
  emit('viewAlert', alertId);
};

const handleApprovalClick = (approvalId: string) => {
  closeAllMenus();
  emit('viewApproval', approvalId);
};

const formatTime = (timestamp: string) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = now.getTime() - time.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return time.toLocaleDateString('zh-CN');
};
</script>

<template>
  <header class="h-16 flex items-center justify-between px-4 lg:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
    <div class="flex items-center gap-4">
      <button
        @click="emit('toggleSidebar')"
        class="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Menu v-if="sidebarCollapsed" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <X v-else class="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>

      <nav class="hidden sm:flex items-center gap-2 text-sm">
        <template v-for="(crumb, index) in breadcrumbs" :key="index">
          <span
            v-if="index > 0"
            class="text-gray-400"
          >
            /
          </span>
          <span
            v-if="index === breadcrumbs.length - 1"
            class="text-gray-900 dark:text-gray-100 font-medium"
          >
            {{ crumb.label }}
          </span>
          <a
            v-else
            :href="crumb.path"
            class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            <Home v-if="index === 0" class="w-4 h-4" />
            {{ crumb.label }}
          </a>
        </template>
      </nav>
    </div>

    <div class="hidden md:flex items-center gap-2 flex-1 max-w-md mx-8">
      <div class="relative w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="搜索任务、靶点..."
          class="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-0 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
        />
      </div>
    </div>

    <div class="flex items-center gap-1 sm:gap-2">
      <button
        @click="emit('toggleTheme')"
        class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        :title="isDark ? '切换到亮色模式' : '切换到暗色模式'"
      >
        <Moon v-if="!isDark" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <Sun v-else class="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>

      <div class="relative">
        <button
          @click="toggleAlertMenu"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
          title="预警通知"
        >
          <Bell class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span
            v-if="unreadAlerts.length > 0"
            class="absolute -top-0.5 -right-0.5 w-5 h-5 bg-danger-500 text-white text-xs font-medium rounded-full flex items-center justify-center"
          >
            {{ unreadAlerts.length > 9 ? '9+' : unreadAlerts.length }}
          </span>
        </button>

        <transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <div
            v-if="alertMenuOpen"
            class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-dropdown border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">预警通知</h3>
              <span class="badge bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400">
                {{ unreadAlerts.length }} 条未读
              </span>
            </div>
            <div class="max-h-80 overflow-y-auto">
              <div
                v-for="alert in alerts.slice(0, 5)"
                :key="alert.id"
                @click="handleAlertClick(alert.id)"
                class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 last:border-0"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    :class="getAlertColor(alert.level) + ' text-white'"
                  >
                    <AlertTriangle class="w-4 h-4" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span
                        class="text-xs font-medium px-1.5 py-0.5 rounded"
                        :class="getAlertColor(alert.level) + ' text-white'"
                      >
                        {{ ALERT_LEVEL_LABELS[alert.level] }}
                      </span>
                      <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock class="w-3 h-3" />
                        {{ formatTime(alert.timestamp) }}
                      </span>
                    </div>
                    <p class="text-sm text-gray-900 dark:text-gray-100 mt-1 line-clamp-2">
                      {{ alert.message }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      任务: {{ alert.task?.name || '未知任务' }}
                    </p>
                  </div>
                  <div
                    v-if="!alert.reviewedBy"
                    class="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0"
                  />
                </div>
              </div>
              <div v-if="alerts.length === 0" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                暂无预警通知
              </div>
            </div>
            <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button class="w-full text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
                查看全部预警
              </button>
            </div>
          </div>
        </transition>
      </div>

      <div class="relative">
        <button
          @click="toggleApprovalMenu"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
          title="待审批"
        >
          <CheckSquare class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span
            v-if="pendingApprovals.length > 0"
            class="absolute -top-0.5 -right-0.5 w-5 h-5 bg-warning-500 text-white text-xs font-medium rounded-full flex items-center justify-center"
          >
            {{ pendingApprovals.length > 9 ? '9+' : pendingApprovals.length }}
          </span>
        </button>

        <transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <div
            v-if="approvalMenuOpen"
            class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-dropdown border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">待审批事项</h3>
              <span class="badge bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400">
                {{ pendingApprovals.length }} 条待处理
              </span>
            </div>
            <div class="max-h-80 overflow-y-auto">
              <div
                v-for="approval in approvals.slice(0, 5)"
                :key="approval.id"
                @click="handleApprovalClick(approval.id)"
                class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 last:border-0"
              >
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-full bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center flex-shrink-0">
                    <CheckSquare class="w-4 h-4 text-warning-600 dark:text-warning-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock class="w-3 h-3" />
                        {{ formatTime(approval.task?.createdAt || new Date().toISOString()) }}
                      </span>
                    </div>
                    <p class="text-sm text-gray-900 dark:text-gray-100 mt-1">
                      {{ approval.task?.name || '未知任务' }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      第 {{ approval.level }} 级审批 · {{ approval.approver?.username || '未知审批人' }}
                    </p>
                  </div>
                </div>
              </div>
              <div v-if="approvals.length === 0" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                暂无待审批事项
              </div>
            </div>
            <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button class="w-full text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
                查看全部审批
              </button>
            </div>
          </div>
        </transition>
      </div>

      <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 sm:mx-2" />

      <div class="relative">
        <button
          @click="toggleUserMenu"
          class="flex items-center gap-2 sm:gap-3 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center text-white font-medium text-sm">
            {{ user?.username?.charAt(0).toUpperCase() }}
          </div>
          <div class="hidden sm:block text-left">
            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ user?.username }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ user?.email }}
            </div>
          </div>
          <ChevronDown class="w-4 h-4 text-gray-400 hidden sm:block" />
        </button>

        <transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <div
            v-if="userMenuOpen"
            class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-dropdown border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div class="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center text-white font-medium">
                  {{ user?.username?.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <div class="font-medium text-gray-900 dark:text-gray-100">
                    {{ user?.username }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {{ user?.email }}
                  </div>
                </div>
              </div>
            </div>
            <div class="py-1">
              <button
                @click="emit('viewProfile'); closeAllMenus()"
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
              >
                <UserIcon class="w-4 h-4" />
                个人资料
              </button>
              <button
                @click="closeAllMenus()"
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
              >
                <Settings class="w-4 h-4" />
                账户设置
              </button>
            </div>
            <div class="border-t border-gray-200 dark:border-gray-700 py-1">
              <button
                @click="emit('logout'); closeAllMenus()"
                class="w-full px-4 py-2 text-left text-sm text-danger-600 dark:text-danger-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
              >
                <LogOut class="w-4 h-4" />
                退出登录
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </header>
</template>
