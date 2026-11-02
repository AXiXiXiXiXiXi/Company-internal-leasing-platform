<script setup lang="ts">
import {
  Clock,
  RefreshRight,
  Search,
  UserFilled,
} from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElMessage,
  type FormInstance,
  type FormRules,
} from 'element-plus'
import { loansApi } from '@/api'
import { getApiErrorMessage } from '@/api/http'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { BorrowLoan, LoanView } from '@/types/api'
import { formatDateTime } from '@/utils/format'

type LoanTab = 'active' | 'overdue' | 'returned' | 'all'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const loading = ref(false)
const loans = ref<BorrowLoan[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const activeTab = ref<LoanTab>('active')
const filters = reactive({ q: '' })

const detailVisible = ref(false)
const selectedLoan = ref<BorrowLoan | null>(null)
const returnVisible = ref(false)
const returnSaving = ref(false)
const returnFormRef = ref<FormInstance>()
const returnForm = reactive<{
  returnedAt: Date | null
  returnNote: string
}>({
  returnedAt: new Date(),
  returnNote: '',
})
const returnRules: FormRules = {
  returnedAt: [
    { required: true, message: '请选择实际归还时间', trigger: 'change' },
  ],
}

const pageDescription = computed(() => (
  auth.isAdmin
    ? '查看当前借用、逾期与历史记录，在设备实际归还后完成登记。'
    : '查看你的设备借出时间、预计归还时间和历史记录。'
))

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await loansApi.list({
      page: page.value,
      pageSize: pageSize.value,
      view: tabView(),
      overdueOnly: activeTab.value === 'overdue',
      q: filters.q,
    })
    loans.value = result.items
    total.value = result.total
    if (typeof route.query.focus === 'string') {
      const focused = result.items.find((item) => item.id === route.query.focus)
      if (focused) {
        openDetail(focused)
      }
      const { focus: _focus, ...rest } = route.query
      void router.replace({ query: rest })
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '借还记录加载失败'))
  } finally {
    loading.value = false
  }
}

function tabView(): LoanView {
  if (activeTab.value === 'returned') return 'returned'
  if (activeTab.value === 'all') return 'all'
  return 'active'
}

function changeTab(): void {
  page.value = 1
  void load()
}

function search(): void {
  page.value = 1
  void load()
}

function isOverdue(row: unknown): boolean {
  const loan = row as BorrowLoan
  return !loan.returnedAt && new Date(loan.expectedReturnAt) < new Date()
}

function openDetail(row: unknown): void {
  const loan = row as BorrowLoan
  selectedLoan.value = loan
  detailVisible.value = true
}

function openReturn(row: unknown): void {
  const loan = row as BorrowLoan
  selectedLoan.value = loan
  returnForm.returnedAt = new Date()
  returnForm.returnNote = ''
  returnVisible.value = true
}

async function returnLoan(): Promise<void> {
  const valid = await returnFormRef.value?.validate().catch(() => false)
  if (!valid || !selectedLoan.value || !returnForm.returnedAt) return
  returnSaving.value = true
  try {
    await loansApi.returnLoan(selectedLoan.value.id, {
      returnedAt: returnForm.returnedAt.toISOString(),
      returnNote: returnForm.returnNote || undefined,
    })
    ElMessage.success('归还已登记，资产已恢复可借')
    returnVisible.value = false
    detailVisible.value = false
    await load()
    void notifications.refreshCounts()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '登记归还失败'))
  } finally {
    returnSaving.value = false
  }
}

function disabledFuture(date: Date): boolean {
  return date.getTime() > Date.now()
}

onMounted(load)
</script>

<template>
  <div class="page-stack">
    <PageHeader title="实际借还" :description="pageDescription" />

    <section class="loan-toolbar">
      <el-radio-group v-model="activeTab" @change="changeTab">
        <el-radio-button value="active">当前借用</el-radio-button>
        <el-radio-button value="overdue">已逾期</el-radio-button>
        <el-radio-button value="returned">历史归还</el-radio-button>
        <el-radio-button value="all">全部记录</el-radio-button>
      </el-radio-group>
      <div class="loan-toolbar__search">
        <el-input
          v-model="filters.q"
          :prefix-icon="Search"
          clearable
          :placeholder="auth.isAdmin ? '申请编号、资产或借用人' : '搜索资产或申请编号'"
          @keyup.enter="search"
        />
        <el-button type="primary" @click="search">查询</el-button>
      </div>
    </section>

    <section class="table-card">
      <el-table
        v-loading="loading"
        class="desktop-table"
        :data="loans"
        row-key="id"
        @row-click="openDetail"
      >
        <el-table-column label="借用资产" min-width="220">
          <template #default="{ row }">
            <div class="loan-asset">
              <span><RefreshRight /></span>
              <div>
                <strong>{{ row.application.asset.name }}</strong>
                <small>{{ row.application.asset.assetNo }} · {{ row.application.applicationNo }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="auth.isAdmin" label="借用人" min-width="130">
          <template #default="{ row }">
            <div>
              <strong class="plain-strong">{{ row.application.applicant.fullName }}</strong>
              <small class="cell-sub">{{ row.application.applicant.employeeNo || '—' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="借出时间" min-width="155">
          <template #default="{ row }">{{ formatDateTime(row.checkedOutAt) }}</template>
        </el-table-column>
        <el-table-column label="预计归还" min-width="155">
          <template #default="{ row }">
            <span :class="{ 'danger-text': isOverdue(row) }">
              {{ formatDateTime(row.expectedReturnAt) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="112">
          <template #default="{ row }">
            <el-tag
              v-if="isOverdue(row)"
              type="danger"
              effect="light"
              round
            >
              已逾期
            </el-tag>
            <StatusBadge
              v-else
              :status="row.returnedAt ? 'RETURNED' : 'CHECKED_OUT'"
              kind="application"
            />
          </template>
        </el-table-column>
        <el-table-column label="归还时间" min-width="155">
          <template #default="{ row }">{{ formatDateTime(row.returnedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="toolbar-actions" @click.stop>
              <el-button link @click="openDetail(row)">详情</el-button>
              <el-button
                v-if="auth.isAdmin && !row.returnedAt"
                type="primary"
                link
                @click="openReturn(row)"
              >
                登记归还
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-loading="loading" class="mobile-list loan-mobile-list">
        <article
          v-for="loan in loans"
          :key="loan.id"
          class="mobile-card"
        >
          <div class="mobile-card__head">
            <div class="mobile-card__title">
              <strong>{{ loan.application.asset.name }}</strong>
              <span>{{ auth.isAdmin ? loan.application.applicant.fullName : loan.application.applicationNo }}</span>
            </div>
            <el-tag
              v-if="isOverdue(loan)"
              type="danger"
              effect="light"
              round
            >
              已逾期
            </el-tag>
            <StatusBadge
              v-else
              :status="loan.returnedAt ? 'RETURNED' : 'CHECKED_OUT'"
              kind="application"
            />
          </div>
          <div class="mobile-card__body">
            <div class="mobile-card__field">
              <span>借出时间</span>
              <strong>{{ formatDateTime(loan.checkedOutAt) }}</strong>
            </div>
            <div class="mobile-card__field">
              <span>预计归还</span>
              <strong :class="{ 'danger-text': isOverdue(loan) }">
                {{ formatDateTime(loan.expectedReturnAt) }}
              </strong>
            </div>
            <div v-if="loan.returnedAt" class="mobile-card__field">
              <span>实际归还</span>
              <strong>{{ formatDateTime(loan.returnedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-card__actions">
            <el-button @click="openDetail(loan)">查看详情</el-button>
            <el-button
              v-if="auth.isAdmin && !loan.returnedAt"
              type="primary"
              @click="openReturn(loan)"
            >
              登记归还
            </el-button>
          </div>
        </article>
        <el-empty
          v-if="!loading && !loans.length"
          description="当前分类暂无借还记录"
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
      title="借用记录详情"
      size="min(520px, 100vw)"
    >
      <template v-if="selectedLoan">
        <div class="loan-detail__hero">
          <span><RefreshRight /></span>
          <div>
            <h2>{{ selectedLoan.application.asset.name }}</h2>
            <p>{{ selectedLoan.application.asset.assetNo }} · {{ selectedLoan.application.applicationNo }}</p>
          </div>
          <el-tag
            :type="selectedLoan.returnedAt ? 'success' : isOverdue(selectedLoan) ? 'danger' : 'primary'"
            effect="light"
            round
          >
            {{ selectedLoan.returnedAt ? '已归还' : isOverdue(selectedLoan) ? '已逾期' : '借出中' }}
          </el-tag>
        </div>
        <dl class="detail-list loan-detail__list">
          <div v-if="auth.isAdmin">
            <dt>借用人</dt>
            <dd>{{ selectedLoan.application.applicant.fullName }}</dd>
          </div>
          <div>
            <dt>借出经办人</dt>
            <dd>{{ selectedLoan.handoverHandledBy.fullName }}</dd>
          </div>
          <div>
            <dt>实际借出时间</dt>
            <dd>{{ formatDateTime(selectedLoan.checkedOutAt) }}</dd>
          </div>
          <div>
            <dt>预计归还时间</dt>
            <dd :class="{ 'danger-text': isOverdue(selectedLoan) }">
              {{ formatDateTime(selectedLoan.expectedReturnAt) }}
            </dd>
          </div>
          <template v-if="selectedLoan.returnedAt">
            <div>
              <dt>实际归还时间</dt>
              <dd>{{ formatDateTime(selectedLoan.returnedAt) }}</dd>
            </div>
            <div>
              <dt>归还经办人</dt>
              <dd>{{ selectedLoan.returnHandledBy?.fullName || '—' }}</dd>
            </div>
          </template>
          <div class="detail-list__full">
            <dt>借用用途</dt>
            <dd>{{ selectedLoan.application.purpose }}</dd>
          </div>
          <div v-if="selectedLoan.handoverNote" class="detail-list__full">
            <dt>交接备注</dt>
            <dd>{{ selectedLoan.handoverNote }}</dd>
          </div>
          <div v-if="selectedLoan.returnNote" class="detail-list__full">
            <dt>归还备注</dt>
            <dd>{{ selectedLoan.returnNote }}</dd>
          </div>
        </dl>
        <div
          v-if="auth.isAdmin && !selectedLoan.returnedAt"
          class="drawer-actions"
        >
          <el-button type="primary" @click="openReturn(selectedLoan)">
            登记实际归还
          </el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog
      v-model="returnVisible"
      title="登记设备归还"
      width="520px"
    >
      <p class="dialog-description">
        登记后资产将恢复为可借状态，请确认设备已经实际收回。
      </p>
      <el-form
        ref="returnFormRef"
        :model="returnForm"
        :rules="returnRules"
        label-position="top"
      >
        <el-form-item label="实际归还时间" prop="returnedAt">
          <el-date-picker
            v-model="returnForm.returnedAt"
            type="datetime"
            placeholder="选择实际归还时间"
            :disabled-date="disabledFuture"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="归还备注（选填）">
          <el-input
            v-model="returnForm.returnNote"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="例如：设备完好，配件齐全"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnVisible = false">取消</el-button>
        <el-button type="primary" :loading="returnSaving" @click="returnLoan">
          确认归还
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.loan-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.loan-toolbar__search {
  display: flex;
  gap: 8px;
  width: min(420px, 100%);
}

.loan-asset {
  display: flex;
  align-items: center;
  gap: 10px;
}

.loan-asset > span {
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

.loan-asset strong,
.loan-asset small,
.plain-strong,
.cell-sub {
  display: block;
}

.loan-asset small,
.cell-sub {
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.danger-text {
  color: var(--color-danger);
  font-weight: 600;
}

.loan-mobile-list {
  padding: 12px;
}

.loan-detail__hero {
  display: grid;
  align-items: center;
  gap: 12px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--color-border);
  grid-template-columns: 48px minmax(0, 1fr) auto;
}

.loan-detail__hero > span {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-radius: 12px;
  font-size: 23px;
}

.loan-detail__hero h2 {
  margin: 0;
  font-size: 19px;
}

.loan-detail__hero p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
}

.loan-detail__list {
  margin-top: 24px;
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 28px;
}

.dialog-description {
  margin: 0 0 20px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

@media (max-width: 860px) {
  .loan-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .loan-toolbar__search {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .loan-toolbar :deep(.el-radio-group) {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .loan-toolbar :deep(.el-radio-button__inner) {
    width: 100%;
    min-height: 44px;
  }

  .loan-detail__hero {
    align-items: flex-start;
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .loan-detail__hero > :last-child {
    grid-column: 2;
  }
}
</style>
