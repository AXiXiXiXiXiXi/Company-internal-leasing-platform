import type {
  AppNotification,
  ApplicationEvent,
  ApplicationQuery,
  Asset,
  AssetQuery,
  AssetStatus,
  AuthUser,
  BorrowApplication,
  BorrowLoan,
  LoginResponse,
  LoanQuery,
  NotificationQuery,
  PaginatedResult,
  SendNotificationResult,
  TodoItem,
  TodoQuery,
  User,
  UserQuery,
  UserRole,
  UserStatus,
} from '@/types/api'
import { http } from './http'

export const authApi = {
  async login(username: string, password: string) {
    const { data } = await http.post<LoginResponse>('/auth/login', {
      username,
      password,
    })
    return data
  },
  async me() {
    const { data } = await http.get<AuthUser>('/auth/me')
    return data
  },
}

export const usersApi = {
  async list(query: UserQuery) {
    const { data } = await http.get<PaginatedResult<User>>('/users', {
      params: compactParams(query),
    })
    return data
  },
  async get(id: string) {
    const { data } = await http.get<User>(`/users/${id}`)
    return data
  },
  async create(payload: {
    username: string
    employeeNo?: string | null
    fullName: string
    role: UserRole
    password: string
  }) {
    const { data } = await http.post<User>('/users', payload)
    return data
  },
  async update(
    id: string,
    payload: Partial<{
      fullName: string
      employeeNo: string | null
      role: UserRole
      status: UserStatus
    }>,
  ) {
    const { data } = await http.patch<User>(`/users/${id}`, payload)
    return data
  },
  async resetPassword(id: string, password: string) {
    await http.post(`/users/${id}/reset-password`, { password })
  },
}

export const assetsApi = {
  async list(query: AssetQuery) {
    const { data } = await http.get<PaginatedResult<Asset>>('/assets', {
      params: compactParams(query),
    })
    return data
  },
  async get(id: string) {
    const { data } = await http.get<Asset>(`/assets/${id}`)
    return data
  },
  async create(payload: {
    assetNo: string
    name: string
    category: string
    serialNo?: string | null
    storageLocation: string
    notes?: string | null
  }) {
    const { data } = await http.post<Asset>('/assets', payload)
    return data
  },
  async update(
    id: string,
    payload: Partial<{
      assetNo: string
      name: string
      category: string
      serialNo: string | null
      storageLocation: string
      notes: string | null
    }>,
  ) {
    const { data } = await http.patch<Asset>(`/assets/${id}`, payload)
    return data
  },
  async changeStatus(id: string, status: AssetStatus) {
    const { data } = await http.patch<Asset>(`/assets/${id}/status`, { status })
    return data
  },
}

export const applicationsApi = {
  async list(query: ApplicationQuery) {
    const { data } = await http.get<PaginatedResult<BorrowApplication>>(
      '/applications',
      { params: compactParams(query) },
    )
    return data
  },
  async get(id: string) {
    const { data } = await http.get<BorrowApplication>(`/applications/${id}`)
    return data
  },
  async events(id: string) {
    const { data } = await http.get<ApplicationEvent[]>(
      `/applications/${id}/events`,
    )
    return data
  },
  async create(payload: {
    assetId: string
    purpose: string
    expectedReturnAt: string
  }) {
    const { data } = await http.post<BorrowApplication>('/applications', payload)
    return data
  },
  async cancel(id: string) {
    const { data } = await http.post<BorrowApplication>(
      `/applications/${id}/cancel`,
    )
    return data
  },
  async approve(id: string, comment?: string) {
    const { data } = await http.post<BorrowApplication>(
      `/applications/${id}/approve`,
      { comment },
    )
    return data
  },
  async reject(id: string, reason: string) {
    const { data } = await http.post<BorrowApplication>(
      `/applications/${id}/reject`,
      { reason },
    )
    return data
  },
  async checkout(
    id: string,
    payload: { checkedOutAt?: string; handoverNote?: string },
  ) {
    const { data } = await http.post<BorrowLoan>(
      `/applications/${id}/checkout`,
      payload,
    )
    return data
  },
}

export const loansApi = {
  async list(query: LoanQuery) {
    const { data } = await http.get<PaginatedResult<BorrowLoan>>('/loans', {
      params: compactParams(query),
    })
    return data
  },
  async get(id: string) {
    const { data } = await http.get<BorrowLoan>(`/loans/${id}`)
    return data
  },
  async returnLoan(
    id: string,
    payload: { returnedAt?: string; returnNote?: string },
  ) {
    const { data } = await http.post<BorrowLoan>(`/loans/${id}/return`, payload)
    return data
  },
}

export const notificationsApi = {
  async list(query: NotificationQuery) {
    const { data } = await http.get<PaginatedResult<AppNotification>>(
      '/notifications',
      { params: compactParams(query) },
    )
    return data
  },
  async unreadCount() {
    const { data } = await http.get<{ count: number }>(
      '/notifications/unread-count',
    )
    return data.count
  },
  async send(payload: {
    title: string
    body: string
    sendToAll: boolean
    recipientUserIds?: string[]
  }) {
    const { data } = await http.post<SendNotificationResult>(
      '/notifications/send',
      payload,
    )
    return data
  },
  async markRead(id: string) {
    const { data } = await http.patch<AppNotification>(
      `/notifications/${id}/read`,
    )
    return data
  },
  async markAllRead() {
    const { data } = await http.patch<{ updated: number }>(
      '/notifications/read-all',
    )
    return data
  },
  async todos(query: TodoQuery) {
    const { data } = await http.get<PaginatedResult<TodoItem>>('/todos', {
      params: compactParams(query),
    })
    return data
  },
  async markTodoRead(id: string) {
    const { data } = await http.patch<TodoItem>(`/todos/${id}/read`)
    return data
  },
  async markAllTodosRead() {
    const { data } = await http.patch<{ updated: number }>('/todos/read-all')
    return data
  },
}

function compactParams<T extends object>(params: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      return value !== undefined && value !== null && value !== ''
    }),
  )
}
