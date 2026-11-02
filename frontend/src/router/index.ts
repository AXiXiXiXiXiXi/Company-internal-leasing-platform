import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/types/api'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    roles?: UserRole[]
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '工作台', requiresAuth: true },
        },
        {
          path: 'assets',
          name: 'assets',
          component: () => import('@/views/AssetsView.vue'),
          meta: { title: '资产台账', requiresAuth: true },
        },
        {
          path: 'applications',
          name: 'applications',
          component: () => import('@/views/ApplicationsView.vue'),
          meta: {
            title: '借用申请',
            requiresAuth: true,
          },
        },
        {
          path: 'loans',
          name: 'loans',
          component: () => import('@/views/LoansView.vue'),
          meta: { title: '实际借还', requiresAuth: true },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: () => import('@/views/NotificationsView.vue'),
          meta: { title: '通知待办', requiresAuth: true },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/UsersView.vue'),
          meta: {
            title: '用户管理',
            requiresAuth: true,
            roles: ['ADMIN'],
          },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  document.title = to.meta.title
    ? `${to.meta.title} · 设备借还管理`
    : '设备借还管理'

  if (to.name === 'login' && auth.isAuthenticated) {
    if (await auth.hydrate()) {
      return { name: 'dashboard' }
    }
    return true
  }
  if (!to.meta.requiresAuth) {
    return true
  }
  if (!await auth.hydrate()) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }
  if (to.meta.roles?.length && auth.role && !to.meta.roles.includes(auth.role)) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
