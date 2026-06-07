<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Home,
  FlaskConical,
  Target,
  Activity,
  FileText,
  Settings,
  Users,
  Bell,
  CheckSquare,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Dna,
  Beaker,
  PieChart
} from 'lucide-vue-next';
import { UserRole, USER_ROLE_LABELS } from '@shared/types';

interface Props {
  collapsed: boolean;
  userRole?: UserRole;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  toggle: [];
}>();

const route = useRoute();
const router = useRouter();

interface MenuItem {
  path: string;
  label: string;
  icon: typeof Home;
  roles: UserRole[];
  badge?: number;
}

const menuItems: MenuItem[] = [
  {
    path: '/dashboard',
    label: '仪表盘',
    icon: Home,
    roles: [UserRole.COMPUTATIONAL_CHEMIST, UserRole.MEDICINAL_CHEMIST, UserRole.SYNTHESIS_TEAM, UserRole.CHIEF_SCIENTIST, UserRole.ADMIN]
  },
  {
    path: '/tasks',
    label: '模拟任务',
    icon: FlaskConical,
    roles: [UserRole.COMPUTATIONAL_CHEMIST, UserRole.MEDICINAL_CHEMIST, UserRole.SYNTHESIS_TEAM, UserRole.CHIEF_SCIENTIST, UserRole.ADMIN]
  },
  {
    path: '/targets',
    label: '靶点管理',
    icon: Target,
    roles: [UserRole.COMPUTATIONAL_CHEMIST, UserRole.MEDICINAL_CHEMIST, UserRole.CHIEF_SCIENTIST, UserRole.ADMIN]
  },
  {
    path: '/monitoring',
    label: '实时监控',
    icon: Activity,
    roles: [UserRole.COMPUTATIONAL_CHEMIST, UserRole.CHIEF_SCIENTIST, UserRole.ADMIN]
  },
  {
    path: '/alerts',
    label: '预警通知',
    icon: Bell,
    roles: [UserRole.COMPUTATIONAL_CHEMIST, UserRole.MEDICINAL_CHEMIST, UserRole.CHIEF_SCIENTIST, UserRole.ADMIN],
    badge: 5
  },
  {
    path: '/approvals',
    label: '审批中心',
    icon: CheckSquare,
    roles: [UserRole.COMPUTATIONAL_CHEMIST, UserRole.CHIEF_SCIENTIST, UserRole.ADMIN],
    badge: 3
  },
  {
    path: '/results',
    label: '结果分析',
    icon: PieChart,
    roles: [UserRole.COMPUTATIONAL_CHEMIST, UserRole.MEDICINAL_CHEMIST, UserRole.SYNTHESIS_TEAM, UserRole.CHIEF_SCIENTIST, UserRole.ADMIN]
  },
  {
    path: '/reports',
    label: '报告管理',
    icon: FileText,
    roles: [UserRole.COMPUTATIONAL_CHEMIST, UserRole.MEDICINAL_CHEMIST, UserRole.CHIEF_SCIENTIST, UserRole.ADMIN]
  },
  {
    path: '/statistics',
    label: '统计分析',
    icon: BarChart3,
    roles: [UserRole.CHIEF_SCIENTIST, UserRole.ADMIN]
  },
  {
    path: '/methods',
    label: '方法管理',
    icon: Beaker,
    roles: [UserRole.COMPUTATIONAL_CHEMIST, UserRole.ADMIN]
  },
  {
    path: '/proteins',
    label: '蛋白库',
    icon: Dna,
    roles: [UserRole.COMPUTATIONAL_CHEMIST, UserRole.MEDICINAL_CHEMIST, UserRole.SYNTHESIS_TEAM, UserRole.CHIEF_SCIENTIST, UserRole.ADMIN]
  },
  {
    path: '/users',
    label: '用户管理',
    icon: Users,
    roles: [UserRole.ADMIN]
  },
  {
    path: '/settings',
    label: '系统设置',
    icon: Settings,
    roles: [UserRole.ADMIN]
  }
];

const filteredMenuItems = computed(() => {
  return menuItems.filter(item => props.userRole ? item.roles.includes(props.userRole) : true);
});

const isActive = (path: string) => {
  return route.path === path || route.path.startsWith(path + '/');
};

const navigateTo = (path: string) => {
  router.push(path);
};
</script>

<template>
  <aside
    class="h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out"
    :class="[collapsed ? 'w-16' : 'w-64']"
  >
    <div class="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-3 overflow-hidden">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center flex-shrink-0">
          <Dna class="w-5 h-5 text-white" />
        </div>
        <transition name="fade">
          <span v-if="!collapsed" class="font-bold text-lg bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent whitespace-nowrap">
            FE-Predict
          </span>
        </transition>
      </div>
      <button
        v-if="!collapsed"
        @click="emit('toggle')"
        class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <ChevronLeft class="w-5 h-5 text-gray-500" />
      </button>
      <button
        v-else
        @click="emit('toggle')"
        class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full justify-center"
      >
        <ChevronRight class="w-5 h-5 text-gray-500" />
      </button>
    </div>

    <div v-if="!collapsed" class="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
      <div class="text-xs text-gray-500 dark:text-gray-400">当前角色</div>
      <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
        {{ userRole ? USER_ROLE_LABELS[userRole] : '' }}
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
      <template v-for="item in filteredMenuItems" :key="item.path">
        <button
          @click="navigateTo(item.path)"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative group"
          :class="[
            isActive(item.path)
              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
          ]"
        >
          <component
            :is="item.icon"
            class="w-5 h-5 flex-shrink-0 transition-colors"
            :class="[isActive(item.path) ? 'text-primary-600 dark:text-primary-400' : '']"
          />
          <transition name="fade">
            <span v-if="!collapsed" class="text-sm font-medium whitespace-nowrap">
              {{ item.label }}
            </span>
          </transition>
          <span
            v-if="item.badge && !collapsed"
            class="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-medium bg-danger-500 text-white rounded-full"
          >
            {{ item.badge > 99 ? '99+' : item.badge }}
          </span>
          <span
            v-if="item.badge && collapsed"
            class="absolute top-2 right-2 w-2 h-2 bg-danger-500 rounded-full"
          />
          <div
            v-if="collapsed"
            class="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50"
          >
            {{ item.label }}
            <span v-if="item.badge" class="ml-1 text-danger-400">({{ item.badge }})</span>
          </div>
        </button>
      </template>
    </nav>

    <div v-if="!collapsed" class="p-4 border-t border-gray-200 dark:border-gray-800">
      <div class="bg-gradient-to-br from-primary-500/10 to-secondary-500/10 rounded-xl p-4 border border-primary-200/50 dark:border-primary-800/30">
        <div class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">系统状态</div>
        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span class="w-2 h-2 bg-success-500 rounded-full animate-pulse"></span>
          计算节点运行正常
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          队列任务: 12 个
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
