<script setup lang="ts">
import {
  Box,
  Calendar,
  Checked,
  Clock,
  Document,
  Right,
  Warning,
} from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { applicationsApi, assetsApi, loansApi } from '@/api'
import { getApiErrorMessage } from '@/api/http'
import MetricCard from '@/components/MetricCard.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { BorrowApplication, BorrowLoan } from '@/types/api'
import { formatDateTime } from '@/utils/format'
import { ElMessage } from 'element-plus'

const auth = useAuthStore()
const notifications = useNotificationsStore()
const router = useRouter()
const loading = ref(true)
const numbers = ref({
  availableAssets: 0,
  pendingApplications: 0,
  approvedApplications: 0,
  activeLoans: 0,
  overdueLoans: 0,
  returnedLoans: 0,
})
const recentApplications = ref<BorrowApplication[]>([])
const recentLoans = ref<BorrowLoan[]>([])

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '上午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const summary = computed(() => {
  if (auth.isAdmin) {
    return `${numbers.value.pendingApplications} 笔待审批，${numbers.value.overdueLoans} 笔已逾期`
  }
  return `你有 ${numbers.value.pendingApplications} 笔待审批申请，${numbers.value.activeLoans} 件设备尚未归还`
})

async function load(): Promise<void> {
  loading.value = true
  try {
    const [
      available,
      pending,
      approved,
      active,
      overdue,
      returned,
      recentApps,
      loans,
    ] = await Promise.all([
      assetsApi.list({ page: 1, pageSize: 1, status: 'AVAILABLE' }),
      applicationsApi.list({ page: 1, pageSize: 1, status: 'PENDING' }),
      applicationsApi.list({ page: 1, pageSize: 1, status: 'APPROVED' }),
      loansApi.list({ page: 1, pageSize: 1, view: 'active' }),
      loansApi.list({
        page: 1,
        pageSize: 1,
        view: 'active',
        overdueOnly: true,
      }),
      loansApi.list({ page: 1, pageSize: 1, view: 'returned' }),
      applicationsApi.list({ page: 1, pageSize: 5 }),
      loansApi.list({ page: 1, pageSize: 5, view: 'active' }),
    ])
    numbers.value = {
      availableAssets: available.total,
      pendingApplications: pending.total,
      approvedApplications: approved.total,
      activeLoans: active.total,
      overdueLoans: overdue.total,
      returnedLoans: returned.total,
    }
    recentApplications.value = recentApps.items
    recentLoans.value = loans.items
    void notifications.refreshCounts()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '工作台数据加载失败'))
  } finally {
    loading.value = false
  }
}

function go(path: string): void {
  void router.push(path)
}

onMounted(load)
</script>

<template>
  <div class="page-stack">
    <PageHeader
      :title="`${greeting}，${auth.user?.fullName ?? ''}`"
      :description="summary"
    >
      <template #actions>
        <el-button :icon="Calendar" @click="load">刷新数据</el-button>
        <el-button
          v-if="!auth.isAdmin"
          type="primary"
          :icon="Box"
          @click="go('/assets')"
        >
          申请借用
        </el-button>
        <el-button
          v-else
          type="primary"
          :icon="Document"
          @click="go('/applications?status=PENDING')"
        >
          处理待审批
        </el-button>
      </template>
    </PageHeader>

    <section class="metric-grid" :aria-busy="loading">
      <MetricCard
        label="可借资产"
        :value="numbers.availableAssets"
        hint="当前可提交申请的设备"
        tone="green"
      >
        <template #icon><Box /></template>
      </MetricCard>
      <MetricCard
        label="待审批"
        :value="numbers.pendingApplications"
        hint="等待管理员处理的申请"
        tone="orange"
      >
        <template #icon><Clock /></template>
      </MetricCard>
      <MetricCard
        label="当前借出"
        :value="numbers.activeLoans"
        hint="尚未登记归还的设备"
      >
        <template #icon><Checked /></template>
      </MetricCard>
      <MetricCard
        label="已逾期"
        :value="numbers.overdueLoans"
        hint="超过预计归还时间的设备"
        tone="red"
      >
        <template #icon><Warning /></template>
      </MetricCard>
    </section>

    <section v-if="auth.isAdmin" class="workflow-strip surface surface--padded">
      <div>
        <span>流程提醒</span>
        <strong>{{ numbers.approvedApplications }} 笔申请等待实际交接</strong>
      </div>
      <el-button text type="primary" @click="go('/applications?status=APPROVED')">
        查看待交接
        <el-icon><Right /></el-icon>
      </el-button>
    </section>

    <div class="dashboard-columns">
      <section class="surface surface--padded recent-panel">
        <div class="panel-heading">
          <div>
            <h2>最近申请</h2>
            <p>{{ auth.isAdmin ? '团队最新借用需求' : '你的申请处理进度' }}</p>
          </div>
          <el-button text type="primary" @click="go('/applications')">
            全部申请
          </el-button>
        </div>
        <div v-loading="loading" class="activity-list">
          <button
            v-for="application in recentApplications"
            :key="application.id"
            class="activity-row"
            type="button"
            @click="go(`/applications?focus=${application.id}`)"
          >
            <span class="activity-row__icon"><Document /></span>
            <span class="activity-row__copy">
              <strong>{{ application.asset?.name ?? '借用申请' }}</strong>
              <small>
                {{ auth.isAdmin ? application.applicant?.fullName : application.applicationNo }}
                · {{ formatDateTime(application.submittedAt) }}
              </small>
            </span>
            <StatusBadge :status="application.status" kind="application" />
          </button>
          <el-empty
            v-if="!loading && !recentApplications.length"
            description="暂无申请记录"
            :image-size="80"
          />
        </div>
      </section>

      <section class="surface surface--padded recent-panel">
        <div class="panel-heading">
          <div>
            <h2>{{ auth.isAdmin ? '当前借用' : '我的设备' }}</h2>
            <p>{{ auth.isAdmin ? '尚未归还的设备' : '你当前还未归还的设备' }}</p>
          </div>
          <el-button text type="primary" @click="go('/loans')">
            查看借还
          </el-button>
        </div>
        <div v-loading="loading" class="activity-list">
          <button
            v-for="loan in recentLoans"
            :key="loan.id"
            class="activity-row"
            type="button"
            @click="go(`/loans?focus=${loan.id}`)"
          >
            <span class="activity-row__icon activity-row__icon--green"><Box /></span>
            <span class="activity-row__copy">
              <strong>{{ loan.application.asset.name }}</strong>
              <small>
                {{ loan.application.applicant.fullName }}
                · {{ formatDateTime(loan.expectedReturnAt) }} 应还
              </small>
            </span>
            <el-tag
              :type="new Date(loan.expectedReturnAt) < new Date() ? 'danger' : 'primary'"
              effect="light"
              round
            >
              {{ new Date(loan.expectedReturnAt) < new Date() ? '已逾期' : '借出中' }}
            </el-tag>
          </button>
          <el-empty
            v-if="!loading && !recentLoans.length"
            description="暂无未归还设备"
            :image-size="80"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.metric-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.workflow-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-left: 3px solid var(--color-accent);
}

.workflow-strip span,
.workflow-strip strong {
  display: block;
}

.workflow-strip span {
  margin-bottom: 4px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.workflow-strip strong {
  font-size: 15px;
}

.dashboard-columns {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-heading h2 {
  margin: 0;
  font-size: 17px;
}

.panel-heading p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}

.activity-list {
  min-height: 140px;
}

.activity-row {
  display: grid;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 13px 4px;
  color: var(--color-text);
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  grid-template-columns: 36px minmax(0, 1fr) auto;
}

.activity-row:last-of-type {
  border-bottom: 0;
}

.activity-row:hover .activity-row__copy strong {
  color: var(--color-primary);
}

.activity-row__icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-radius: 10px;
  font-size: 17px;
}

.activity-row__icon--green {
  color: var(--color-success);
  background: #ecfdf5;
}

.activity-row__copy {
  min-width: 0;
}

.activity-row__copy strong,
.activity-row__copy small {
  display: block;
}

.activity-row__copy strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-row__copy small {
  margin-top: 3px;
  color: var(--color-text-muted);
  font-size: 12px;
}

@media (max-width: 1100px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 840px) {
  .dashboard-columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .metric-grid {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .workflow-strip {
    align-items: flex-start;
    flex-direction: column;
  }

  .activity-row {
    grid-template-columns: 36px minmax(0, 1fr);
  }

  .activity-row > :last-child {
    justify-self: start;
    grid-column: 2;
  }
}
</style>
