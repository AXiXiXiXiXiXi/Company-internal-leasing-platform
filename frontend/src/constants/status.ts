import type {
  ApplicationStatus,
  AssetStatus,
  TodoStatus,
  UserStatus,
} from '@/types/api'

export type TagType =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'

export const assetStatusMeta: Record<
  AssetStatus,
  { label: string; type: TagType }
> = {
  AVAILABLE: { label: '可借', type: 'success' },
  RESERVED: { label: '已预留', type: 'warning' },
  BORROWED: { label: '借出中', type: 'primary' },
  MAINTENANCE: { label: '维修中', type: 'warning' },
  RETIRED: { label: '已报废', type: 'info' },
}

export const applicationStatusMeta: Record<
  ApplicationStatus,
  { label: string; type: TagType }
> = {
  PENDING: { label: '待审批', type: 'warning' },
  APPROVED: { label: '已批准', type: 'primary' },
  REJECTED: { label: '已驳回', type: 'danger' },
  CHECKED_OUT: { label: '已借出', type: 'primary' },
  RETURNED: { label: '已归还', type: 'success' },
  CANCELLED: { label: '已取消', type: 'info' },
}

export const userStatusMeta: Record<
  UserStatus,
  { label: string; type: TagType }
> = {
  ACTIVE: { label: '启用', type: 'success' },
  DISABLED: { label: '停用', type: 'info' },
}

export const todoStatusMeta: Record<
  TodoStatus,
  { label: string; type: TagType }
> = {
  PENDING: { label: '待处理', type: 'warning' },
  COMPLETED: { label: '已完成', type: 'success' },
  CANCELLED: { label: '已取消', type: 'info' },
}

export const applicationStatusOptions = Object.entries(
  applicationStatusMeta,
).map(([value, meta]) => ({ value, label: meta.label }))

export const assetStatusOptions = Object.entries(assetStatusMeta).map(
  ([value, meta]) => ({ value, label: meta.label }),
)
