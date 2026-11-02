<script setup lang="ts">
import {
  Bell,
  Box,
  Document,
  Fold,
  Menu as MenuIcon,
  Odometer,
  RefreshRight,
  SwitchButton,
  User,
} from '@element-plus/icons-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const mobileMenuOpen = ref(false)
const mainRef = ref<HTMLElement | null>(null)

const adminMenu = [
  { path: '/dashboard', label: '工作台', icon: Odometer },
  { path: '/assets', label: '资产台账', icon: Box },
  { path: '/applications', label: '借用申请', icon: Document },
  { path: '/loans', label: '实际借还', icon: RefreshRight },
  { path: '/notifications', label: '通知待办', icon: Bell },
  { path: '/users', label: '用户管理', icon: User },
]

const employeeMenu = [
  { path: '/dashboard', label: '工作台', icon: Odometer },
  { path: '/assets', label: '资产借用', icon: Box },
  { path: '/applications', label: '我的申请', icon: Document },
  { path: '/loans', label: '我的借用', icon: RefreshRight },
  { path: '/notifications', label: '消息通知', icon: Bell },
]

const menuItems = computed(() => (
  auth.isAdmin ? adminMenu : employeeMenu
))
const pageTitle = computed(() => String(route.meta.title ?? '设备借还管理'))
const initials = computed(() => auth.user?.fullName?.slice(-2) ?? '用户')
const unreadBadge = computed(() => (
  notifications.unreadNotifications
  + (auth.isAdmin ? notifications.unreadTodos : 0)
))

function navigate(path: string): void {
  mobileMenuOpen.value = false
  void router.push(path)
}

function logout(): void {
  notifications.stop()
  auth.logout()
  void router.replace('/login')
}

watch(
  () => route.fullPath,
  async () => {
    mobileMenuOpen.value = false
    await nextTick()
    mainRef.value?.focus()
  },
)

onMounted(() => {
  if (auth.token && auth.role) {
    notifications.start(auth.token, auth.role)
  }
})

onBeforeUnmount(() => {
  notifications.stop()
})
</script>

<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <div class="app-shell">
    <aside class="sidebar" aria-label="主导航">
      <button class="brand" type="button" @click="navigate('/dashboard')">
        <span class="brand__mark"><Box /></span>
        <span>
          <strong>资产借还</strong>
          <small>Equipment Desk</small>
        </span>
      </button>

      <el-menu
        class="nav-menu"
        :default-active="route.path"
        @select="navigate"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
          <el-badge
            v-if="item.path === '/notifications' && unreadBadge"
            :value="unreadBadge"
            :max="99"
            class="nav-menu__badge"
          />
        </el-menu-item>
      </el-menu>

      <div class="sidebar__footer">
        <span
          class="connection-dot"
          :class="{ 'connection-dot--online': notifications.connected }"
          aria-hidden="true"
        />
        {{ notifications.connected ? '实时通知已连接' : '等待实时连接' }}
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="topbar__left">
          <el-button
            class="mobile-menu-button"
            text
            :icon="MenuIcon"
            aria-label="打开导航"
            @click="mobileMenuOpen = true"
          />
          <div>
            <span class="topbar__eyebrow">内部设备管理</span>
            <strong>{{ pageTitle }}</strong>
          </div>
        </div>

        <div class="topbar__right">
          <el-tooltip content="通知与待办" placement="bottom">
            <el-badge
              :value="unreadBadge"
              :max="99"
              :hidden="!unreadBadge"
            >
              <el-button
                class="icon-button"
                circle
                :icon="Bell"
                aria-label="通知与待办"
                @click="navigate('/notifications')"
              />
            </el-badge>
          </el-tooltip>

          <el-dropdown trigger="click">
            <button class="account-button" type="button">
              <span class="avatar">{{ initials }}</span>
              <span class="account-button__copy">
                <strong>{{ auth.user?.fullName }}</strong>
                <small>{{ auth.isAdmin ? '管理员' : '员工' }}</small>
              </span>
              <el-icon><Fold /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  {{ auth.user?.username }}
                  <span v-if="auth.user?.employeeNo"> · {{ auth.user.employeeNo }}</span>
                </el-dropdown-item>
                <el-dropdown-item divided :icon="SwitchButton" @click="logout">
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main
        id="main-content"
        ref="mainRef"
        class="main-content"
        tabindex="-1"
      >
        <RouterView />
      </main>
    </div>

    <el-drawer
      v-model="mobileMenuOpen"
      direction="ltr"
      size="280px"
      :with-header="false"
      class="mobile-nav-drawer"
    >
      <button class="brand brand--mobile" type="button" @click="navigate('/dashboard')">
        <span class="brand__mark"><Box /></span>
        <span>
          <strong>资产借还</strong>
          <small>Equipment Desk</small>
        </span>
      </button>
      <el-menu
        class="nav-menu nav-menu--mobile"
        :default-active="route.path"
        @select="navigate"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
      <el-button class="mobile-logout" plain :icon="SwitchButton" @click="logout">
        退出登录
      </el-button>
    </el-drawer>
  </div>
</template>
