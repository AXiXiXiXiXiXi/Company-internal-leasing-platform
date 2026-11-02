<script setup lang="ts">
import {
  Bell,
  Check,
  Clock,
  DocumentChecked,
  Promotion,
  UserFilled,
} from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ElMessage,
  type FormInstance,
  type FormRules,
} from 'element-plus'
import { notificationsApi, usersApi } from '@/api'
import { getApiErrorMessage } from '@/api/http'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type {
  AppNotification,
  TodoItem,
  TodoStatus,
  User,
} from '@/types/api'
import { fromNow } from '@/utils/format'

const auth = useAuthStore()
const notificationsStore = useNotificationsStore()
const router = useRouter()
const activeTab = ref<'notifications' | 'todos'>('notifications')
const unreadOnly = ref(false)
const notificationLoading = ref(false)
const todoLoading = ref(false)
const notifications = ref<AppNotification[]>([])
const todos = ref<TodoItem[]>([])
const notificationPage = ref(1)
const todoPage = ref(1)
const notificationTotal = ref(0)
const todoTotal = ref(0)
const pageSize = 10
const todoStatus = ref<TodoStatus | ''>('PENDING')
const sendVisible = ref(false)
const sending = ref(false)
const recipientLoading = ref(false)
const recipientUsers = ref<User[]>([])
const sendFormRef = ref<FormInstance>()
const audience = ref<'ALL' | 'SELECTED'>('ALL')
const sendForm = reactive<{
  title: string
  body: string
  recipientUserIds: string[]
}>({
  title: '',
  body: '',
  recipientUserIds: [],
})
const sendRules: FormRules = {
  title: [
    { required: true, message: '请输入通知标题', trigger: 'blur' },
    { max: 160, message: '通知标题不能超过 160 个字符', trigger: 'blur' },
  ],
  body: [
    { required: true, message: '请输入通知内容', trigger: 'blur' },
    { max: 2000, message: '通知内容不能超过 2000 个字符', trigger: 'blur' },
  ],
}

const currentUnread = computed(() => (
  activeTab.value === 'todos'
    ? notificationsStore.unreadTodos
    : notificationsStore.unreadNotifications
))

async function loadNotifications(): Promise<void> {
  notificationLoading.value = true
  try {
    const result = await notificationsApi.list({
      page: notificationPage.value,
      pageSize,
      unreadOnly: unreadOnly.value,
    })
    notifications.value = result.items
    notificationTotal.value = result.total
    await notificationsStore.refreshCounts()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '通知加载失败'))
  } finally {
    notificationLoading.value = false
  }
}

async function loadTodos(): Promise<void> {
  if (!auth.isAdmin) return
  todoLoading.value = true
  try {
    const result = await notificationsApi.todos({
      page: todoPage.value,
      pageSize,
      status: todoStatus.value,
      unreadOnly: unreadOnly.value,
    })
    todos.value = result.items
    todoTotal.value = result.total
    await notificationsStore.refreshCounts()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '待办加载失败'))
  } finally {
    todoLoading.value = false
  }
}

async function markRead(notification: AppNotification): Promise<void> {
  if (!notification.isRead) {
    try {
      const updated = await notificationsApi.markRead(notification.id)
      Object.assign(notification, updated)
      await notificationsStore.refreshCounts()
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, '标记已读失败'))
    }
  }
  if (notification.relatedApplicationId) {
    await router.push(
      `/applications?focus=${notification.relatedApplicationId}`,
    )
  }
}

async function markAllRead(): Promise<void> {
  try {
    if (activeTab.value === 'todos') {
      await notificationsApi.markAllTodosRead()
      await loadTodos()
    } else {
      await notificationsApi.markAllRead()
      await loadNotifications()
    }
    ElMessage.success('已全部标记为已读')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '操作失败'))
  }
}

async function openTodo(todo: TodoItem): Promise<void> {
  if (!todo.isRead) {
    try {
      const updated = await notificationsApi.markTodoRead(todo.id)
      Object.assign(todo, updated)
      await notificationsStore.refreshCounts()
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, '标记待办已读失败'))
    }
  }
  await router.push(`/applications?focus=${todo.relatedApplicationId}`)
}

async function openSendDialog(): Promise<void> {
  Object.assign(sendForm, {
    title: '',
    body: '',
    recipientUserIds: [],
  })
  audience.value = 'ALL'
  sendVisible.value = true
  await loadRecipientUsers()
}

async function loadRecipientUsers(): Promise<void> {
  if (recipientUsers.value.length) return
  recipientLoading.value = true
  try {
    const result = await usersApi.list({
      page: 1,
      pageSize: 100,
      status: 'ACTIVE',
    })
    recipientUsers.value = result.items
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '接收人列表加载失败'))
  } finally {
    recipientLoading.value = false
  }
}

async function sendNotification(): Promise<void> {
  const valid = await sendFormRef.value?.validate().catch(() => false)
  if (!valid) return
  if (audience.value === 'SELECTED' && sendForm.recipientUserIds.length === 0) {
    ElMessage.warning('请至少选择一名接收人')
    return
  }
  sending.value = true
  try {
    const result = await notificationsApi.send({
      title: sendForm.title,
      body: sendForm.body,
      sendToAll: audience.value === 'ALL',
      recipientUserIds: audience.value === 'SELECTED'
        ? sendForm.recipientUserIds
        : undefined,
    })
    sendVisible.value = false
    ElMessage.success(`通知已发送给 ${result.sentCount} 个账号`)
    notificationPage.value = 1
    await loadNotifications()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '通知发送失败'))
  } finally {
    sending.value = false
  }
}

function changeTab(name: string | number): void {
  activeTab.value = name as 'notifications' | 'todos'
  unreadOnly.value = false
  if (activeTab.value === 'todos') {
    void loadTodos()
  } else {
    void loadNotifications()
  }
}

function changeFilter(): void {
  if (activeTab.value === 'todos') {
    todoPage.value = 1
    void loadTodos()
  } else {
    notificationPage.value = 1
    void loadNotifications()
  }
}

watch(unreadOnly, changeFilter)

onMounted(() => {
  void loadNotifications()
})
</script>

<template>
  <div class="page-stack">
    <PageHeader
      title="通知待办"
      description="实时提醒用于及时反馈，完整记录始终保存在这里；重新打开页面后仍可查看。"
    >
      <template #actions>
        <el-button
          v-if="auth.isAdmin"
          type="primary"
          :icon="Promotion"
          @click="openSendDialog"
        >
          发送通知
        </el-button>
        <el-button
          :disabled="currentUnread === 0"
          :icon="Check"
          @click="markAllRead"
        >
          全部标记已读
        </el-button>
      </template>
    </PageHeader>

    <section class="notification-shell surface">
      <el-tabs
        v-model="activeTab"
        class="notification-tabs"
        @tab-change="changeTab"
      >
        <el-tab-pane name="notifications">
          <template #label>
            <span class="tab-label">
              站内通知
              <el-badge
                v-if="notificationsStore.unreadNotifications"
                :value="notificationsStore.unreadNotifications"
                :max="99"
              />
            </span>
          </template>
          <div class="notification-toolbar">
            <el-checkbox v-model="unreadOnly">只看未读</el-checkbox>
            <span class="muted">共 {{ notificationTotal }} 条通知</span>
          </div>

          <div v-loading="notificationLoading" class="notification-list">
            <button
              v-for="notification in notifications"
              :key="notification.id"
              type="button"
              class="notification-item"
              :class="{ 'notification-item--unread': !notification.isRead }"
              @click="markRead(notification)"
            >
              <span class="notification-item__icon">
                <Promotion v-if="notification.notificationType === 'ADMIN_MESSAGE'" />
                <Bell v-else-if="notification.notificationType.includes('SUBMITTED')" />
                <DocumentChecked v-else />
              </span>
              <span class="notification-item__copy">
                <strong>
                  {{ notification.title }}
                  <span
                    v-if="!notification.isRead"
                    class="unread-dot"
                    aria-label="未读"
                  />
                </strong>
                <span>{{ notification.body }}</span>
                <small>
                  {{ fromNow(notification.createdAt) }} ·
                  <template v-if="notification.notificationType === 'ADMIN_MESSAGE'">
                    管理员 {{ notification.sender?.fullName || '系统' }} 发送
                  </template>
                  <template v-else>
                    {{ notification.relatedApplication?.applicationNo || '系统消息' }}
                  </template>
                </small>
              </span>
              <el-tag
                v-if="!notification.isRead"
                type="primary"
                effect="plain"
                round
              >
                未读
              </el-tag>
            </button>
            <el-empty
              v-if="!notificationLoading && !notifications.length"
              description="暂无通知"
            />
          </div>

          <div class="notification-pagination">
            <el-pagination
              v-model:current-page="notificationPage"
              :page-size="pageSize"
              :total="notificationTotal"
              layout="prev, pager, next"
              background
              @change="loadNotifications"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="auth.isAdmin" name="todos">
          <template #label>
            <span class="tab-label">
              管理员待办
              <el-badge
                v-if="notificationsStore.unreadTodos"
                :value="notificationsStore.unreadTodos"
                :max="99"
              />
            </span>
          </template>
          <div class="notification-toolbar">
            <div class="toolbar-filters">
              <el-checkbox v-model="unreadOnly">只看未读</el-checkbox>
              <el-select v-model="todoStatus" placeholder="全部状态" @change="changeFilter">
                <el-option label="全部状态" value="" />
                <el-option label="待处理" value="PENDING" />
                <el-option label="已完成" value="COMPLETED" />
                <el-option label="已取消" value="CANCELLED" />
              </el-select>
            </div>
            <span class="muted">共 {{ todoTotal }} 条待办</span>
          </div>

          <div v-loading="todoLoading" class="notification-list">
            <button
              v-for="todo in todos"
              :key="todo.id"
              type="button"
              class="notification-item"
              :class="{ 'notification-item--unread': !todo.isRead }"
              @click="openTodo(todo)"
            >
              <span class="notification-item__icon notification-item__icon--orange">
                <Clock />
              </span>
              <span class="notification-item__copy">
                <strong>
                  {{ todo.title }}
                  <span
                    v-if="!todo.isRead"
                    class="unread-dot"
                    aria-label="未读"
                  />
                </strong>
                <span>
                  {{ todo.relatedApplication.applicant.fullName }}
                  · {{ todo.relatedApplication.asset.name }}
                </span>
                <small>
                  {{ fromNow(todo.createdAt) }}
                  · {{ todo.relatedApplication.applicationNo }}
                </small>
              </span>
              <StatusBadge :status="todo.status" kind="todo" />
            </button>
            <el-empty
              v-if="!todoLoading && !todos.length"
              description="暂无待办"
            />
          </div>

          <div class="notification-pagination">
            <el-pagination
              v-model:current-page="todoPage"
              :page-size="pageSize"
              :total="todoTotal"
              layout="prev, pager, next"
              background
              @change="loadTodos"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="sendVisible"
      title="发送站内通知"
      width="600px"
      destroy-on-close
    >
      <p class="send-description">
        通知会立即推送给在线用户，并持久化保存。离线用户下次打开页面后仍可查看。
      </p>
      <el-form
        ref="sendFormRef"
        :model="sendForm"
        :rules="sendRules"
        label-position="top"
      >
        <el-form-item label="接收范围">
          <el-radio-group v-model="audience" class="audience-group">
            <el-radio-button value="ALL">
              全部启用账号（含管理员）
            </el-radio-button>
            <el-radio-button value="SELECTED">
              指定用户
            </el-radio-button>
          </el-radio-group>
          <p class="audience-hint">
            <template v-if="audience === 'ALL'">
              将发送给所有启用账号（包括当前管理员），共 {{ recipientUsers.length }} 人。
            </template>
            <template v-else>
              可选择一名或多名接收人。
            </template>
          </p>
        </el-form-item>

        <el-form-item v-if="audience === 'SELECTED'" label="指定接收人">
          <el-select
            v-model="sendForm.recipientUserIds"
            :loading="recipientLoading"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择用户"
            style="width: 100%"
          >
            <el-option
              v-for="user in recipientUsers"
              :key="user.id"
              :label="`${user.fullName}（${user.username}）`"
              :value="user.id"
            >
              <div class="recipient-option">
                <span><UserFilled /></span>
                <strong>{{ user.fullName }}</strong>
                <small>{{ user.employeeNo || user.username }}</small>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="通知标题" prop="title">
          <el-input
            v-model="sendForm.title"
            maxlength="160"
            show-word-limit
            placeholder="例如：周五设备盘点提醒"
          />
        </el-form-item>
        <el-form-item label="通知内容" prop="body">
          <el-input
            v-model="sendForm.body"
            type="textarea"
            :rows="5"
            maxlength="2000"
            show-word-limit
            placeholder="请输入要发送给用户的通知内容"
          />
        </el-form-item>
      </el-form>

      <div v-if="sendForm.title || sendForm.body" class="message-preview">
        <span><Promotion /></span>
        <div>
          <small>通知预览</small>
          <strong>{{ sendForm.title || '通知标题' }}</strong>
          <p>{{ sendForm.body || '通知内容' }}</p>
        </div>
      </div>

      <template #footer>
        <el-button @click="sendVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="sending"
          :icon="Promotion"
          @click="sendNotification"
        >
          发送通知
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.notification-shell {
  overflow: hidden;
}

.notification-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 20px;
}

.notification-tabs :deep(.el-tabs__content) {
  padding: 0 20px 20px;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.notification-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border);
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 16px;
}

.notification-list {
  min-height: 220px;
}

.notification-item {
  display: grid;
  width: 100%;
  align-items: center;
  gap: 14px;
  padding: 18px 0;
  color: var(--color-text);
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  grid-template-columns: 42px minmax(0, 1fr) auto;
}

.notification-item:hover .notification-item__copy strong {
  color: var(--color-primary);
}

.notification-item--unread {
  background: #f8fbff;
}

.notification-item__icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-radius: 12px;
  font-size: 20px;
}

.notification-item__icon--orange {
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

.notification-item__copy {
  min-width: 0;
}

.notification-item__copy strong,
.notification-item__copy > span,
.notification-item__copy small {
  display: block;
}

.notification-item__copy strong {
  font-size: 14px;
}

.notification-item__copy > span {
  margin-top: 4px;
  color: var(--color-text-secondary);
  line-height: 1.55;
}

.notification-item__copy small {
  margin-top: 6px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.unread-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-left: 6px;
  vertical-align: 1px;
  background: var(--color-primary);
  border-radius: 999px;
}

.notification-pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 18px;
}

.send-description {
  margin: 0 0 20px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.audience-group {
  width: 100%;
}

.audience-group :deep(.el-radio-button) {
  flex: 1;
}

.audience-group :deep(.el-radio-button__inner) {
  width: 100%;
  min-height: 42px;
}

.audience-hint {
  width: 100%;
  margin: 8px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

.recipient-option {
  display: grid;
  align-items: center;
  gap: 8px;
  grid-template-columns: 25px minmax(0, 1fr) auto;
}

.recipient-option > span {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-radius: 7px;
}

.recipient-option strong {
  font-size: 13px;
}

.recipient-option small {
  color: var(--color-text-muted);
}

.message-preview {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--color-surface-muted);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}

.message-preview > span {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  color: var(--color-primary);
  background: white;
  border-radius: 10px;
  font-size: 18px;
}

.message-preview small,
.message-preview strong,
.message-preview p {
  display: block;
}

.message-preview small {
  color: var(--color-text-muted);
  font-size: 11px;
}

.message-preview strong {
  margin-top: 3px;
  font-size: 14px;
}

.message-preview p {
  margin: 5px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

@media (max-width: 620px) {
  .notification-tabs :deep(.el-tabs__header) {
    padding: 0 14px;
  }

  .notification-tabs :deep(.el-tabs__content) {
    padding: 0 14px 18px;
  }

  .notification-toolbar,
  .toolbar-filters {
    align-items: flex-start;
    flex-direction: column;
  }

  .notification-item {
    align-items: flex-start;
    grid-template-columns: 40px minmax(0, 1fr);
  }

  .notification-item > :last-child {
    grid-column: 2;
    justify-self: start;
  }

  .notification-pagination {
    justify-content: center;
  }
}
</style>
