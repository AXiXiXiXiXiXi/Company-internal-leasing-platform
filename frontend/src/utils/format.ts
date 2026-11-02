import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export function formatDateTime(value?: string | null): string {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'
}

export function formatDate(value?: string | null): string {
  return value ? dayjs(value).format('YYYY-MM-DD') : '—'
}

export function fromNow(value: string): string {
  return dayjs(value).fromNow()
}

export function canModifyApplication(status: string): boolean {
  return status === 'PENDING'
}

export function downloadJson(filename: string, content: unknown): void {
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(href)
}
