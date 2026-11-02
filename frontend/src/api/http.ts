import axios, { type AxiosError } from 'axios'
import { ElMessage } from 'element-plus'

export const SESSION_TOKEN_KEY = 'asset-loan-token'
export const SESSION_USER_KEY = 'asset-loan-user'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

export const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
})

http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status
    const isLoginRequest = error.config?.url?.includes('/auth/login')
    const isAuthProbe = error.config?.url?.includes('/auth/me')

    if (status === 401 && !isLoginRequest) {
      sessionStorage.removeItem(SESSION_TOKEN_KEY)
      sessionStorage.removeItem(SESSION_USER_KEY)
      ElMessage.warning('登录已过期，请重新登录')
      if (!isAuthProbe && window.location.pathname !== '/login') {
        window.location.replace(
          `/login?expired=1&redirect=${encodeURIComponent(window.location.pathname)}`,
        )
      }
    }

    return Promise.reject(error)
  },
)

interface ApiErrorResponse {
  statusCode?: number
  message?: string | string[]
  error?: string
}

export function getApiErrorMessage(
  error: unknown,
  fallback = '请求失败，请稍后重试',
): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const message = error.response?.data?.message
    if (Array.isArray(message)) {
      return message.join('；')
    }
    if (typeof message === 'string' && message) {
      return message
    }
    if (error.code === 'ECONNABORTED') {
      return '请求超时，请检查网络后重试'
    }
    if (!error.response) {
      return '无法连接服务器，请检查后端服务是否运行'
    }
  }
  return fallback
}
