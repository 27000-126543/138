<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide } from 'vue';
import { useRouter } from 'vue-router';
import Sidebar from './Sidebar.vue';
import Header from './Header.vue';
import { useAuthStore } from '@/stores/auth';
import type { User, Alert, Approval } from '@shared/types';
import { UserRole, AlertLevel, ApprovalStatus, SimulationStatus, FEMethod } from '@shared/types';

const router = useRouter();
const authStore = useAuthStore();

const user = computed(() => authStore.user);

const sidebarCollapsed = ref(false);
const mobileSidebarOpen = ref(false);
const isDark = ref(false);
const isMobile = ref(false);

const alerts: Alert[] = [
  {
    id: 'alert-1',
    taskId: 'task-1',
    task: {
      id: 'task-1',
      name: 'EGFR 抑制剂 FEP 计算',
      targetId: 'target-1',
      createdBy: 'user-1',
      status: SimulationStatus.FEP_CALCULATION,
      forceField: 'amber14SB',
      temperature: 300,
      saltConcentration: 0.15,
      feMethod: FEMethod.FEP,
      rmsdThreshold: 2.0,
      progress: 65,
      createdAt: '2024-01-15T10:30:00Z',
      retryCount: 0
    },
    level: AlertLevel.WARNING,
    type: 'rmsd_deviation',
    message: 'RMSD 超过阈值 2.0 Å，当前值为 2.5 Å，请检查体系稳定性',
    metric: 'rmsd',
    value: 2.5,
    threshold: 2.0,
    timestamp: new Date(Date.now() - 5 * 60000).toISOString()
  },
  {
    id: 'alert-2',
    taskId: 'task-2',
    task: {
      id: 'task-2',
      name: 'BRD4 结合能预测',
      targetId: 'target-2',
      createdBy: 'user-1',
      status: SimulationStatus.EQUILIBRATION,
      forceField: 'charmm36',
      temperature: 310,
      saltConcentration: 0.15,
      feMethod: FEMethod.TI,
      rmsdThreshold: 2.0,
      progress: 35,
      createdAt: '2024-01-15T11:00:00Z',
      retryCount: 0
    },
    level: AlertLevel.CRITICAL,
    type: 'temperature_fluctuation',
    message: '温度波动超过 ±5K，当前波动范围 298K-315K',
    metric: 'temperature',
    value: 315,
    threshold: 310,
    timestamp: new Date(Date.now() - 15 * 60000).toISOString()
  },
  {
    id: 'alert-3',
    taskId: 'task-3',
    task: {
      id: 'task-3',
      name: 'CDK2 配体优化',
      targetId: 'target-3',
      createdBy: 'user-1',
      status: SimulationStatus.ENERGY_MINIMIZATION,
      forceField: 'amber14SB',
      temperature: 300,
      saltConcentration: 0.15,
      feMethod: FEMethod.MMPBSA,
      rmsdThreshold: 2.0,
      progress: 15,
      createdAt: '2024-01-15T09:00:00Z',
      retryCount: 1
    },
    level: AlertLevel.INFO,
    type: 'task_started',
    message: '能量最小化步骤已开始，预计耗时 10 分钟',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString()
  }
];

const approvals: Approval[] = [
  {
    id: 'approval-1',
    taskId: 'task-4',
    task: {
      id: 'task-4',
      name: 'KRAS G12D 突变体研究',
      targetId: 'target-4',
      createdBy: 'user-2',
      status: SimulationStatus.PENDING_VALIDATION,
      forceField: 'amber14SB',
      temperature: 300,
      saltConcentration: 0.15,
      feMethod: FEMethod.FEP,
      rmsdThreshold: 2.0,
      progress: 0,
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      retryCount: 0
    },
    level: 1,
    status: ApprovalStatus.PENDING,
    approverId: 'user-1',
    approver: {
      id: 'user-1',
      username: '张三',
      email: 'zhangsan@example.com',
      role: UserRole.COMPUTATIONAL_CHEMIST,
      createdAt: '2024-01-01T00:00:00Z'
    }
  },
  {
    id: 'approval-2',
    taskId: 'task-5',
    task: {
      id: 'task-5',
      name: 'HER2 抗体模拟',
      targetId: 'target-5',
      createdBy: 'user-3',
      status: SimulationStatus.PENDING_VALIDATION,
      forceField: 'charmm36',
      temperature: 310,
      saltConcentration: 0.15,
      feMethod: FEMethod.FEP,
      rmsdThreshold: 2.0,
      progress: 0,
      createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      retryCount: 0
    },
    level: 2,
    status: ApprovalStatus.PENDING,
    approverId: 'user-1',
    approver: {
      id: 'user-1',
      username: '张三',
      email: 'zhangsan@example.com',
      role: UserRole.COMPUTATIONAL_CHEMIST,
      createdAt: '2024-01-01T00:00:00Z'
    }
  }
];

const toggleTheme = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};

const toggleSidebar = () => {
  if (isMobile.value) {
    mobileSidebarOpen.value = !mobileSidebarOpen.value;
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }
};

const handleResize = () => {
  isMobile.value = window.innerWidth < 1024;
  if (isMobile.value) {
    sidebarCollapsed.value = false;
  }
};

const handleClickOutside = (e: MouseEvent) => {
  if (mobileSidebarOpen.value) {
    const target = e.target as HTMLElement;
    if (!target.closest('.sidebar-container') && !target.closest('.mobile-menu-btn')) {
      mobileSidebarOpen.value = false;
    }
  }
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

const handleViewProfile = () => {
  console.log('View profile');
};

const handleViewAlert = (alertId: string) => {
  router.push('/alerts');
};

const handleViewApproval = (approvalId: string) => {
  router.push('/approvals');
};

onMounted(() => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true;
    document.documentElement.classList.add('dark');
  }

  handleResize();
  window.addEventListener('resize', handleResize);
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('click', handleClickOutside);
});

provide('currentUser', user.value);
provide('isDark', isDark);
</script>

<template>
  <div v-if="user" class="h-screen flex bg-gray-50 dark:bg-gray-950 overflow-hidden">
    <div
      class="sidebar-container h-full flex-shrink-0 z-50 transition-all duration-300"
      :class="[
        isMobile
          ? 'fixed inset-y-0 left-0 transform'
          : '',
        isMobile && mobileSidebarOpen
          ? 'translate-x-0'
          : isMobile
            ? '-translate-x-full'
            : ''
      ]"
    >
      <Sidebar
        :collapsed="isMobile ? false : sidebarCollapsed"
        :user-role="user?.role"
        @toggle="toggleSidebar"
      />
    </div>

    <transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobile && mobileSidebarOpen"
        class="fixed inset-0 bg-black/50 z-40 lg:hidden"
      />
    </transition>

    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <Header
        :user="user"
        :alerts="alerts"
        :approvals="approvals"
        :is-dark="isDark"
        :sidebar-collapsed="sidebarCollapsed || (isMobile && !mobileSidebarOpen)"
        @toggle-theme="toggleTheme"
        @toggle-sidebar="toggleSidebar"
        @logout="handleLogout"
        @view-profile="handleViewProfile"
        @view-alert="handleViewAlert"
        @view-approval="handleViewApproval"
      />

      <main class="flex-1 overflow-y-auto p-4 lg:p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>
