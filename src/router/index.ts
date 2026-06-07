import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { UserRole } from '@shared/types'
import AppLayout from '@/components/layout/AppLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/pages/DashboardPage.vue')
      },
      {
        path: 'tasks',
        name: 'tasks',
        component: () => import('@/pages/TaskListPage.vue')
      },
      {
        path: 'tasks/new',
        name: 'new-task',
        component: () => import('@/pages/NewTaskPage.vue')
      },
      {
        path: 'tasks/:id',
        name: 'task-detail',
        component: () => import('@/pages/TaskDetailPage.vue'),
        props: true
      },
      {
        path: 'alerts',
        name: 'alerts',
        component: () => import('@/pages/AlertCenterPage.vue')
      },
      {
        path: 'approvals',
        name: 'approvals',
        component: () => import('@/pages/ApprovalCenterPage.vue')
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('@/pages/ReportCenterPage.vue')
      },
      {
        path: 'recommendations',
        name: 'recommendations',
        component: () => import('@/pages/RecommendationPage.vue')
      },
      {
        path: 'targets',
        name: 'targets',
        component: () => import('@/pages/TargetManagementPage.vue')
      },
      {
        path: 'statistics',
        name: 'statistics',
        component: () => import('@/pages/StatisticsPage.vue')
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/pages/UserManagementPage.vue'),
        meta: { roles: [UserRole.ADMIN] }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth !== false)

  if (requiresAuth) {
    if (!authStore.token) {
      next({ name: 'login', query: { redirect: to.fullPath } })
      return
    }

    if (!authStore.user) {
      try {
        await authStore.getCurrentUser()
      } catch {
        next({ name: 'login', query: { redirect: to.fullPath } })
        return
      }
    }

    const requiredRoles = to.matched.flatMap(record => record.meta.roles as UserRole[] || [])
    if (requiredRoles.length > 0 && authStore.user) {
      const hasRequiredRole = requiredRoles.includes(authStore.user.role)
      if (!hasRequiredRole) {
        next('/dashboard')
        return
      }
    }
  } else if (to.name === 'login' && authStore.token) {
    next('/dashboard')
    return
  }

  next()
})

export default router
