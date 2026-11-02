import { ref } from 'vue'
import { defineStore } from 'pinia'
import { ElNotification } from 'element-plus'
import { io, type Socket } from 'socket.io-client'
import { notificationsApi } from '@/api'
import type {
  AppNotification,
  TodoItem,
  UnreadCounts,
  UserRole,
} from '@/types/api'

function socketUrl(): string {
  const configured = import.meta.env.VITE_SOCKET_URL || '/notifications'
  return new URL(configured, window.location.origin).toString()
}

export const useNotificationsStore = defineStore('notifications', () => {
  const unreadNotifications = ref(0)
  const unreadTodos = ref(0)
  const connected = ref(false)
  let socket: Socket | null = null
  let currentToken: string | null = null
  let currentRole: UserRole | null = null

  async function refreshCounts(): Promise<void> {
    if (!currentToken) {
      unreadNotifications.value = 0
      unreadTodos.value = 0
      return
    }
    try {
      const notificationCount = await notificationsApi.unreadCount()
      unreadNotifications.value = notificationCount
      if (currentRole === 'ADMIN') {
        const todos = await notificationsApi.todos({
          page: 1,
          pageSize: 1,
          status: 'PENDING',
          unreadOnly: true,
        })
        unreadTodos.value = todos.total
      } else {
        unreadTodos.value = 0
      }
    } catch {
      // Authentication errors are handled by the HTTP interceptor.
    }
  }

  function start(token: string, role: UserRole): void {
    if (socket?.connected && currentToken === token) {
      return
    }
    stop()
    currentToken = token
    currentRole = role
    socket = io(socketUrl(), {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
    })

    socket.on('connect', () => {
      connected.value = true
      void refreshCounts()
    })
    socket.on('disconnect', () => {
      connected.value = false
    })
    socket.on('authenticated', () => {
      connected.value = true
      void refreshCounts()
    })
    socket.on('notification.created', (notification: AppNotification) => {
      void refreshCounts()
      ElNotification({
        title: notification.title,
        message: notification.body,
        type: 'info',
        duration: 4500,
        position: 'bottom-right',
      })
    })
    socket.on('todo.created', (todo: TodoItem) => {
      void refreshCounts()
      if (currentRole === 'ADMIN') {
        ElNotification({
          title: '新待办',
          message: todo.title,
          type: 'warning',
          duration: 4500,
          position: 'bottom-right',
        })
      }
    })
    socket.on('todos.changed', () => {
      void refreshCounts()
    })
    socket.on('unread.updated', (counts: UnreadCounts) => {
      unreadNotifications.value = counts.unreadNotifications
      unreadTodos.value = counts.unreadTodos
    })
  }

  function stop(): void {
    socket?.disconnect()
    socket = null
    connected.value = false
    currentToken = null
    currentRole = null
  }

  return {
    unreadNotifications,
    unreadTodos,
    connected,
    refreshCounts,
    start,
    stop,
  }
})
