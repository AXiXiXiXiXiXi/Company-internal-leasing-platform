<script setup lang="ts">
import {
  Check,
  Close,
  Document,
  Search,
  Select,
} from '@element-plus/icons-vue'
import {
  computed,
  onMounted,
  reactive,
  ref,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
} from 'element-plus'
import { applicationsApi } from '@/api'
import { getApiErrorMessage } from '@/api/http'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type {
  ApplicationEvent,
  ApplicationStatus,
  BorrowApplication,
} from '@/types/api'
import { applicationStatusOptions } from '@/constants/status'
import { formatDateTime } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const loading = ref(false)
const applications = ref<BorrowApplication[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive<{
  status: ApplicationStatus | ''
  q: string
}>({
  status: typeof route.query.status === 'string'
    ? route.query.status as ApplicationStatus
    : '',
  q: '',
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const selectedApplication = ref<BorrowApplication | null>(null)
const events = ref<ApplicationEvent[]>([])

const approveVisible = ref(false)
const approveSaving = ref(false)
const approveComment = ref('')

const rejectVisible = ref(false)
const rejectSaving = ref(false)
const rejectFormRef = ref<FormInstance>()
const rejectForm = reactive({ reason: '' })
const rejectRules: FormRules = {
  reason: [
    { required: true, message: '请填写驳回原因', trigger: 'blur' },
    { min: 1, message: '请填写驳回原因', trigger: 'blur' },
  ],
}

const checkoutVisible = ref(false)
const checkoutSaving = ref(false)
const checkoutFormRef = ref<FormInstance>()
const checkoutForm = reactive<{
  checkedOutAt: Date | null
  handoverNote: string
}>({
  checkedOutAt: new Date(),
  handoverNote: '',
})
const checkoutRules: FormRules = {
  checkedOutAt: [
    { required: true, message: '请选择实际借出时间', trigger: 'change' },
  ],
}

const pageDescription = computed(() => (
  auth.isAdmin
    ? '处理团队借用申请，批准后资产将被预留，实际交接后再确认借出。'
    : '查看你的借用申请状态，待审批申请可以主动取消。'
))

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await applicationsApi.list({
      page: page.value,
      pageSize: pageSize.value,
      status: filters.status,
      q: filters.q,
    })
    applications.value = result.items
    total.value = result.total
    if (typeof route.query.focus === 'string') {
      const focused = result.items.find((item) => item.id === route.query.focus)
      if (focused) {
        await openDetail(focused)
      }
      const { focus: _focus, ...rest } = route.query
      void router.replace({ query: rest })
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '申请列表加载失败'))
  } finally {
    loading.value = false
  }
}

function search(): void {
  page.value = 1
  void load()
}

function resetFilters(): void {
  filters.status = ''
  filters.q = ''
  search()
}

async function openDetail(row: unknown): Promise<void> {
  const application = row as BorrowApplication
  selectedApplication.value = application
  detailVisible.value = true
  detailLoading.value = true
  try {
    const [detail, history] = await Promise.all([
      applicationsApi.get(application.id),
      applicationsApi.events(application.id),
    ])
    selectedApplication.value = detail
    events.value = history
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '申请详情加载失败'))
  } finally {
    detailLoading.value = false
  }
}

function openApprove(row: unknown): void {
  const application = row as BorrowApplication
  selectedApplication.value = application
  approveComment.value = ''
  approveVisible.value = true
}

async function approve(): Promise<void> {
  if (!selectedApplication.value) return
  approveSaving.value = true
  try {
    await applicationsApi.approve(
      selectedApplication.value.id,
      approveComment.value || undefined,
    )
    ElMessage.success('申请已批准，资产已预留')
    approveVisible.value = false
    await afterMutation()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '批准申请失败'))
  } finally {
    approveSaving.value = false
  }
}

function openReject(row: unknown): void {
  const application = row as BorrowApplication
  selectedApplication.value = application
  rejectForm.reason = ''
  rejectVisible.value = true
}

async function reject(): Promise<void> {
  const valid = await rejectFormRef.value?.validate().catch(() => false)
  if (!valid || !selectedApplication.value) return
  rejectSaving.value = true
  try {
    await applicationsApi.reject(
      selectedApplication.value.id,
      rejectForm.reason,
    )
    ElMessage.success('申请已驳回')
    rejectVisible.value = false
    await afterMutation()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '驳回申请失败'))
  } finally {
    rejectSaving.value = false
  }
}

function openCheckout(row: unknown): void {
  const application = row as BorrowApplication
  selectedApplication.value = application
  checkoutForm.checkedOutAt = new Date()
  checkoutForm.handoverNote = ''
  checkoutVisible.value = true
}

async function checkout(): Promise<void> {
  const valid = await checkoutFormRef.value?.validate().catch(() => false)
  if (!valid || !selectedApplication.value || !checkoutForm.checkedOutAt) return
  checkoutSaving.value = true
  try {
    await applicationsApi.checkout(selectedApplication.value.id, {
      checkedOutAt: checkoutForm.checkedOutAt.toISOString(),
      handoverNote: checkoutForm.handoverNote || undefined,
    })
    ElMessage.success('已确认借出')
    checkoutVisible.value = false
    await afterMutation()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '确认借出失败'))
  } finally {
    checkoutSaving.value = false
  }
}

async function cancelApplication(row: unknown): Promise<void> {
  const application = row as BorrowApplication
  try {
    await ElMessageBox.confirm(
      `确定取消申请 ${application.applicationNo} 吗？取消后不可恢复。`,
      '取消申请',
      {
        type: 'warning',
        confirmButtonText: '确认取消',
        cancelButtonText: '保留申请',
      },
    )
    await applicationsApi.cancel(application.id)
    ElMessage.success('申请已取消')
    await afterMutation()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(getApiErrorMessage(error, '取消申请失败'))
  }
}

async function afterMutation(): Promise<void> {
  detailVisible.value = false
  await load()
  void notifications.refreshCounts()
}

function eventLabel(event: ApplicationEvent): string {
  const labels: Record<string, string> = {
    SUBMITTED: '提交申请',
    APPROVED: '批准申请',
    REJECTED: '驳回申请',
    CHECKED_OUT: '确认借出',
    RETURNED: '登记归还',
    CANCELLED: '取消申请',
  }
  return labels[event.eventType] ?? event.eventType
}

function disabledFuture(date: Date): boolean {
  return date.getTime() > Date.now()
}

onMounted(() => {
  if (filters.status) {
    void load()
  } else {
    void load()
  }
})
</script>

<template>
  <div class="page-stack">
    <PageHeader title="借用申请" :description="pageDescription" />

    <section class="filter-bar" aria-label="申请筛选">
      <el-input
        v-model="filters.q"
        class="filter-bar__search"
        :prefix-icon="Search"
        clearable
        placeholder="搜索申请编号"
        @keyup.enter="search"
      />
      <el-select v-model="filters.status" clearable placeholder="全部状态">
        <el-option
          v-for="option in applicationStatusOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="resetFilters">重置</el-button>
    </section>

    <section class="table-card">
      <el-table
        v-loading="loading"
        class="desktop-table"
        :data="applications"
        row-key="id"
        @row-click="openDetail"
      >
        <el-table-column label="申请" min-width="220">
          <template #default="{ row }">
            <div class="application-cell">
              <span><Document /></span>
              <div>
                <strong>{{ row.asset?.name ?? '借用申请' }}</strong>
                <small class="mono">{{ row.applicationNo }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="auth.isAdmin" label="申请人" min-width="130">
          <template #default="{ row }">
            <div>
              <strong class="plain-strong">{{ row.applicant?.fullName }}</strong>
              <small class="cell-sub">{{ row.applicant?.employeeNo || '—' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="112">
          <template #default="{ row }">
            <StatusBadge :status="row.status" kind="application" />
          </template>
        </el-table-column>
        <el-table-column label="预计归还" min-width="155">
          <template #default="{ row }">
            {{ formatDateTime(row.expectedReturnAt) }}
          </template>
        </el-table-column>
        <el-table-column label="提交时间" min-width="155">
          <template #default="{ row }">
            {{ formatDateTime(row.submittedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <div class="toolbar-actions" @click.stop>
              <el-button link @click="openDetail(row)">详情</el-button>
              <template v-if="auth.isAdmin">
                <template v-if="row.status === 'PENDING'">
                  <el-button type="primary" link :icon="Check" @click="openApprove(row)">
                    批准
                  </el-button>
                  <el-button type="danger" link :icon="Close" @click="openReject(row)">
                    驳回
                  </el-button>
                </template>
                <el-button
                  v-if="row.status === 'APPROVED'"
                  type="primary"
                  link
                  :icon="Select"
                  @click="openCheckout(row)"
                >
                  确认借出
                </el-button>
              </template>
              <el-button
                v-if="!auth.isAdmin && row.status === 'PENDING'"
                type="danger"
                link
                @click="cancelApplication(row)"
              >
                取消
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-loading="loading" class="mobile-list application-mobile-list">
        <article
          v-for="application in applications"
          :key="application.id"
          class="mobile-card"
        >
          <div class="mobile-card__head">
            <div class="mobile-card__title">
              <strong>{{ application.asset?.name ?? '借用申请' }}</strong>
              <span>{{ auth.isAdmin ? application.applicant?.fullName : application.applicationNo }}</span>
            </div>
            <StatusBadge :status="application.status" kind="application" />
          </div>
          <div class="mobile-card__body">
            <div class="mobile-card__field">
              <span>预计归还</span>
              <strong>{{ formatDateTime(application.expectedReturnAt) }}</strong>
            </div>
            <div class="mobile-card__field">
              <span>提交时间</span>
              <strong>{{ formatDateTime(application.submittedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-card__actions">
            <el-button @click="openDetail(application)">详情</el-button>
            <template v-if="auth.isAdmin && application.status === 'PENDING'">
              <el-button type="primary" @click="openApprove(application)">批准</el-button>
              <el-button type="danger" plain @click="openReject(application)">驳回</el-button>
            </template>
            <el-button
              v-if="auth.isAdmin && application.status === 'APPROVED'"
              type="primary"
              @click="openCheckout(application)"
            >
              确认借出
            </el-button>
            <el-button
              v-if="!auth.isAdmin && application.status === 'PENDING'"
              type="danger"
              plain
              @click="cancelApplication(application)"
            >
              取消申请
            </el-button>
          </div>
        </article>
        <el-empty
          v-if="!loading && !applications.length"
          description="没有找到符合条件的申请"
        />
      </div>

      <div class="table-card__footer">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @change="load"
        />
      </div>
    </section>

    <el-drawer
      v-model="detailVisible"
      title="申请详情"
      size="min(560px, 100vw)"
    >
      <div v-loading="detailLoading">
        <template v-if="selectedApplication">
          <div class="application-detail__head">
            <div>
              <span class="mono">{{ selectedApplication.applicationNo }}</span>
              <h2>{{ selectedApplication.asset?.name }}</h2>
              <p>{{ selectedApplication.asset?.assetNo }} · {{ selectedApplication.asset?.storageLocation }}</p>
            </div>
            <StatusBadge :status="selectedApplication.status" kind="application" />
          </div>

          <dl class="detail-list application-detail__list">
            <div v-if="auth.isAdmin">
              <dt>申请人</dt>
              <dd>{{ selectedApplication.applicant?.fullName }}</dd>
            </div>
            <div>
              <dt>预计归还</dt>
              <dd>{{ formatDateTime(selectedApplication.expectedReturnAt) }}</dd>
            </div>
            <div class="detail-list__full">
              <dt>借用用途</dt>
              <dd class="multiline">{{ selectedApplication.purpose }}</dd>
            </div>
            <template v-if="selectedApplication.decisionAt">
              <div>
                <dt>审批人</dt>
                <dd>{{ selectedApplication.decisionBy?.fullName || '—' }}</dd>
              </div>
              <div>
                <dt>审批时间</dt>
                <dd>{{ formatDateTime(selectedApplication.decisionAt) }}</dd>
              </div>
              <div
                v-if="selectedApplication.decisionComment"
                class="detail-list__full"
              >
                <dt>审批意见</dt>
                <dd class="multiline">{{ selectedApplication.decisionComment }}</dd>
              </div>
            </template>
          </dl>

          <h3 class="section-title">操作轨迹</h3>
          <el-timeline>
            <el-timeline-item
              v-for="event in events"
              :key="event.id"
              :timestamp="formatDateTime(event.occurredAt)"
              placement="top"
              :type="event.eventType === 'REJECTED' ? 'danger' : 'primary'"
            >
              <strong>{{ eventLabel(event) }}</strong>
              <p class="timeline-note">
                {{ event.actor?.fullName }} · {{ event.note || '无备注' }}
              </p>
            </el-timeline-item>
          </el-timeline>

          <div class="drawer-actions">
            <template v-if="auth.isAdmin">
              <el-button
                v-if="selectedApplication.status === 'PENDING'"
                type="primary"
                @click="openApprove(selectedApplication)"
              >
                批准申请
              </el-button>
              <el-button
                v-if="selectedApplication.status === 'PENDING'"
                type="danger"
                plain
                @click="openReject(selectedApplication)"
              >
                驳回
              </el-button>
              <el-button
                v-if="selectedApplication.status === 'APPROVED'"
                type="primary"
                @click="openCheckout(selectedApplication)"
              >
                确认借出
              </el-button>
            </template>
            <el-button
              v-if="!auth.isAdmin && selectedApplication.status === 'PENDING'"
              type="danger"
              plain
              @click="cancelApplication(selectedApplication)"
            >
              取消申请
            </el-button>
          </div>
        </template>
      </div>
    </el-drawer>

    <el-dialog
      v-model="approveVisible"
      title="批准借用申请"
      width="500px"
    >
      <p class="dialog-description">
        批准后资产将被预留，员工不能重复借用。请在完成实际交接后再确认借出。
      </p>
      <el-form label-position="top">
        <el-form-item label="审批意见（选填）">
          <el-input
            v-model="approveComment"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="例如：请到 A 区完成交接"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveVisible = false">取消</el-button>
        <el-button type="primary" :loading="approveSaving" @click="approve">
          确认批准
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="rejectVisible"
      title="驳回借用申请"
      width="500px"
    >
      <el-form
        ref="rejectFormRef"
        :model="rejectForm"
        :rules="rejectRules"
        label-position="top"
      >
        <el-form-item label="驳回原因" prop="reason">
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="4"
            maxlength="1000"
            show-word-limit
            placeholder="请说明驳回原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="rejectSaving" @click="reject">
          确认驳回
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="checkoutVisible"
      title="确认资产借出"
      width="520px"
    >
      <p class="dialog-description">
        确认后资产将变为借出中。请确保设备已经实际交给申请人。
      </p>
      <el-form
        ref="checkoutFormRef"
        :model="checkoutForm"
        :rules="checkoutRules"
        label-position="top"
      >
        <el-form-item label="实际借出时间" prop="checkedOutAt">
          <el-date-picker
            v-model="checkoutForm.checkedOutAt"
            type="datetime"
            placeholder="选择实际借出时间"
            :disabled-date="disabledFuture"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="交接备注（选填）">
          <el-input
            v-model="checkoutForm.handoverNote"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="例如：已交付电源和收纳包"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="checkoutVisible = false">取消</el-button>
        <el-button type="primary" :loading="checkoutSaving" @click="checkout">
          确认借出
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.application-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.application-cell > span {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-radius: 9px;
  font-size: 17px;
}

.application-cell strong,
.application-cell small,
.plain-strong,
.cell-sub {
  display: block;
}

.application-cell small,
.cell-sub {
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.application-mobile-list {
  padding: 12px;
}

.application-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--color-border);
}

.application-detail__head > div {
  min-width: 0;
}

.application-detail__head h2 {
  margin: 6px 0 0;
  font-size: 21px;
}

.application-detail__head p {
  margin: 5px 0 0;
  color: var(--color-text-muted);
}

.application-detail__list {
  margin: 22px 0 30px;
}

.multiline {
  line-height: 1.7;
  white-space: pre-wrap;
}

.timeline-note {
  margin: 5px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}

.drawer-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 26px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.dialog-description {
  margin: 0 0 20px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

@media (max-width: 720px) {
  .drawer-actions .el-button {
    min-height: 44px;
    flex: 1;
  }
}
</style>
