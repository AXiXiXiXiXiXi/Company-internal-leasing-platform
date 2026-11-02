import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/api'
import { SESSION_TOKEN_KEY, SESSION_USER_KEY } from '@/api/http'
import type { AuthUser, UserRole } from '@/types/api'

function readStoredUser(): AuthUser | null {
  const value = sessionStorage.getItem(SESSION_USER_KEY)
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value) as AuthUser
  } catch {
    sessionStorage.removeItem(SESSION_USER_KEY)
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(sessionStorage.getItem(SESSION_TOKEN_KEY))
  const user = ref<AuthUser | null>(readStoredUser())
  const loading = ref(false)
  const hydrated = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value))
  const isAdmin = computed(() => user.value?.role === 'ADMIN')
  const role = computed<UserRole | null>(() => user.value?.role ?? null)

  async function login(username: string, password: string): Promise<void> {
    loading.value = true
    try {
      const result = await authApi.login(username, password)
      token.value = result.accessToken
      user.value = result.user
      sessionStorage.setItem(SESSION_TOKEN_KEY, result.accessToken)
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(result.user))
      hydrated.value = true
    } finally {
      loading.value = false
    }
  }

  async function hydrate(): Promise<boolean> {
    if (!token.value) {
      return false
    }
    if (hydrated.value) {
      return true
    }
    try {
      const profile = await authApi.me()
      user.value = profile
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(profile))
      hydrated.value = true
      return true
    } catch {
      logout()
      return false
    }
  }

  function logout(): void {
    token.value = null
    user.value = null
    hydrated.value = false
    sessionStorage.removeItem(SESSION_TOKEN_KEY)
    sessionStorage.removeItem(SESSION_USER_KEY)
  }

  return {
    token,
    user,
    loading,
    isAuthenticated,
    isAdmin,
    role,
    login,
    hydrate,
    logout,
  }
})
