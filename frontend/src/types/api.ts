export type UserRole = 'ADMIN' | 'EMPLOYEE'
export type UserStatus = 'ACTIVE' | 'DISABLED'
export type AssetStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'BORROWED'
  | 'MAINTENANCE'
  | 'RETIRED'
export type ApplicationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHECKED_OUT'
  | 'RETURNED'
  | 'CANCELLED'
export type ApplicationEventType =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHECKED_OUT'
  | 'RETURNED'
  | 'CANCELLED'
export type TodoStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'
export type TodoType = 'APPROVAL' | 'HANDOVER'
export type LoanView = 'all' | 'active' | 'returned'

export interface PaginatedResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface User {
  id: string
  username: string
  employeeNo: string | null
  fullName: string
  role: UserRole
  status: UserStatus
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthUser {
  id: string
  username: string
  employeeNo: string | null
  fullName: string
  role: UserRole
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  user: AuthUser
}

export interface Asset {
  id: string
  assetNo: string
  name: string
  category: string
  serialNo: string | null
  storageLocation: string
  status: AssetStatus
  notes: string | null
  createdByUserId: string
  updatedByUserId: string
  createdAt: string
  updatedAt: string
  version: number
}

export interface BorrowApplication {
  id: string
  applicationNo: string
  assetId: string
  applicantUserId: string
  purpose: string
  expectedReturnAt: string
  status: ApplicationStatus
  submittedAt: string
  decisionByUserId: string | null
  decisionAt: string | null
  decisionComment: string | null
  createdAt: string
  updatedAt: string
  version: number
  asset?: Asset
  applicant?: User
  decisionBy?: User | null
}

export interface BorrowLoan {
  id: string
  applicationId: string
  checkedOutAt: string
  expectedReturnAt: string
  handoverHandledByUserId: string
  handoverNote: string | null
  returnedAt: string | null
  returnHandledByUserId: string | null
  returnNote: string | null
  createdAt: string
  updatedAt: string
  version: number
  application: BorrowApplication & {
    asset: Asset
    applicant: User
  }
  handoverHandledBy: User
  returnHandledBy: User | null
}

export interface ApplicationEvent {
  id: string
  applicationId: string
  eventType: ApplicationEventType
  actorUserId: string
  fromStatus: ApplicationStatus | null
  toStatus: ApplicationStatus
  note: string | null
  occurredAt: string
  actor: User
}

export type NotificationType =
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'APPLICATION_CANCELLED'
  | 'HANDOVER_REQUIRED'
  | 'ASSET_CHECKED_OUT'
  | 'ASSET_RETURNED'
  | 'ADMIN_MESSAGE'

export interface AppNotification {
  id: string
  recipientUserId: string
  senderUserId: string | null
  notificationType: NotificationType
  title: string
  body: string
  relatedApplicationId: string | null
  dedupeKey: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
  sender?: User | null
  relatedApplication?: BorrowApplication & { asset?: Asset }
}

export interface SendNotificationResult {
  sentCount: number
  recipientUserIds: string[]
}

export interface TodoItem {
  id: string
  assigneeUserId: string
  todoType: TodoType
  title: string
  relatedApplicationId: string
  dedupeKey: string
  status: TodoStatus
  isRead: boolean
  readAt: string | null
  dueAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  relatedApplication: BorrowApplication & {
    asset: Asset
    applicant: User
  }
}

export interface UnreadCounts {
  unreadNotifications: number
  unreadTodos: number
}

export interface PageQuery {
  page: number
  pageSize: number
}

export interface AssetQuery extends PageQuery {
  status?: AssetStatus | ''
  category?: string
  q?: string
}

export interface ApplicationQuery extends PageQuery {
  status?: ApplicationStatus | ''
  assetId?: string
  applicantId?: string
  q?: string
}

export interface LoanQuery extends PageQuery {
  view?: LoanView
  overdueOnly?: boolean
  assetId?: string
  applicantId?: string
  q?: string
}

export interface UserQuery extends PageQuery {
  role?: UserRole | ''
  status?: UserStatus | ''
  q?: string
}

export interface NotificationQuery extends PageQuery {
  unreadOnly?: boolean
}

export interface TodoQuery extends PageQuery {
  status?: TodoStatus | ''
  unreadOnly?: boolean
}
