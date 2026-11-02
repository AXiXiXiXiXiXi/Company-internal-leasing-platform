<script setup lang="ts">
import {
  Box,
  Edit,
  Plus,
  Search,
  Setting,
  UserFilled,
} from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
} from 'element-plus'
import { applicationsApi, assetsApi } from '@/api'
import { getApiErrorMessage } from '@/api/http'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import type { Asset, AssetStatus } from '@/types/api'
import { assetStatusOptions } from '@/constants/status'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()
const router = useRouter()
const loading = ref(false)
const assets = ref<Asset[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive<{
  q: string
  status: AssetStatus | ''
  category: string
}>({
  q: '',
  status: '',
  category: '',
})

const formVisible = ref(false)
const formRef = ref<FormInstance>()
const editingId = ref<string | null>(null)
const saving = ref(false)
const assetForm = reactive({
  assetNo: '',
  name: '',
  category: '',
  serialNo: '',
  storageLocation: '',
  notes: '',
})
const formRules: FormRules = {
  assetNo: [{ required: true, message: '请输入资产编号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入资产名称', trigger: 'blur' }],
  category: [{ required: true, message: '请输入资产类别', trigger: 'blur' }],
  storageLocation: [{ required: true, message: '请输入存放位置', trigger: 'blur' }],
}

const detailVisible = ref(false)
const selectedAsset = ref<Asset | null>(null)

const applyVisible = ref(false)
const applySaving = ref(false)
const applyFormRef = ref<FormInstance>()
const applyForm = reactive<{
  purpose: string
  expectedReturnAt: Date | null
}>({
  purpose: '',
  expectedReturnAt: null,
})
const applyRules: FormRules = {
  purpose: [
    { required: true, message: '请填写借用用途', trigger: 'blur' },
    { min: 2, message: '借用用途至少 2 个字符', trigger: 'blur' },
  ],
  expectedReturnAt: [
    { required: true, message: '请选择预计归还时间', trigger: 'change' },
  ],
}

const dialogTitle = computed(() => (
  editingId.value ? '编辑资产信息' : '新增资产'
))

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await assetsApi.list({
      page: page.value,
      pageSize: pageSize.value,
      q: filters.q,
      status: filters.status,
      category: filters.category,
    })
    assets.value = result.items
    total.value = result.total
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '资产列表加载失败'))
  } finally {
    loading.value = false
  }
}

function search(): void {
  page.value = 1
  void load()
}

function resetFilters(): void {
  filters.q = ''
  filters.status = ''
  filters.category = ''
  search()
}

function openCreate(): void {
  editingId.value = null
  Object.assign(assetForm, {
    assetNo: '',
    name: '',
    category: '',
    serialNo: '',
    storageLocation: '',
    notes: '',
  })
  formVisible.value = true
}

function openEdit(row: unknown): void {
  const asset = row as Asset
  editingId.value = asset.id
  Object.assign(assetForm, {
    assetNo: asset.assetNo,
    name: asset.name,
    category: asset.category,
    serialNo: asset.serialNo ?? '',
    storageLocation: asset.storageLocation,
    notes: asset.notes ?? '',
  })
  formVisible.value = true
}

async function saveAsset(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    const payload = {
      assetNo: assetForm.assetNo,
      name: assetForm.name,
      category: assetForm.category,
      serialNo: assetForm.serialNo || null,
      storageLocation: assetForm.storageLocation,
      notes: assetForm.notes || null,
    }
    if (editingId.value) {
      await assetsApi.update(editingId.value, payload)
      ElMessage.success('资产信息已更新')
    } else {
      await assetsApi.create(payload)
      ElMessage.success('资产已创建')
    }
    formVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '资产保存失败'))
  } finally {
    saving.value = false
  }
}

function openDetail(row: unknown): void {
  const asset = row as Asset
  selectedAsset.value = asset
  detailVisible.value = true
}

function openApply(row: unknown): void {
  const asset = row as Asset
  selectedAsset.value = asset
  applyForm.purpose = ''
  applyForm.expectedReturnAt = null
  applyVisible.value = true
}

async function submitApplication(): Promise<void> {
  const valid = await applyFormRef.value?.validate().catch(() => false)
  if (!valid || !selectedAsset.value || !applyForm.expectedReturnAt) return
  applySaving.value = true
  try {
    await applicationsApi.create({
      assetId: selectedAsset.value.id,
      purpose: applyForm.purpose,
      expectedReturnAt: applyForm.expectedReturnAt.toISOString(),
    })
    ElMessage.success('借用申请已提交')
    applyVisible.value = false
    await router.push('/applications')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '提交申请失败'))
  } finally {
    applySaving.value = false
  }
}

async function changeStatus(row: unknown, status: AssetStatus): Promise<void> {
  const asset = row as Asset
  const labels: Record<string, string> = {
    AVAILABLE: '恢复为可借',
    MAINTENANCE: '设为维修中',
    RETIRED: '设为已报废',
  }
  try {
    await ElMessageBox.confirm(
      `确定要将“${asset.name}”${labels[status]}吗？`,
      '确认状态变更',
      {
        type: status === 'RETIRED' ? 'warning' : 'info',
        confirmButtonText: '确认变更',
        cancelButtonText: '取消',
      },
    )
    await assetsApi.changeStatus(asset.id, status)
    ElMessage.success('资产状态已更新')
    await load()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(getApiErrorMessage(error, '状态变更失败'))
  }
}

function disabledDate(date: Date): boolean {
  return date.getTime() < Date.now() - 60_000
}

onMounted(load)
</script>

<template>
  <div class="page-stack">
    <PageHeader
      title="资产台账"
      description="查询资产状态与存放位置。员工可直接对可借资产发起申请。"
    >
      <template #actions>
        <el-button
          v-if="auth.isAdmin"
          type="primary"
          :icon="Plus"
          @click="openCreate"
        >
          新增资产
        </el-button>
      </template>
    </PageHeader>

    <section class="filter-bar" aria-label="资产筛选">
      <el-input
        v-model="filters.q"
        class="filter-bar__search"
        :prefix-icon="Search"
        clearable
        placeholder="资产编号、名称或序列号"
        @keyup.enter="search"
      />
      <el-select v-model="filters.status" clearable placeholder="全部状态">
        <el-option
          v-for="option in assetStatusOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-input
        v-model="filters.category"
        clearable
        placeholder="类别"
        @keyup.enter="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="resetFilters">重置</el-button>
    </section>

    <section class="table-card">
      <el-table
        v-loading="loading"
        class="desktop-table"
        :data="assets"
        row-key="id"
        @row-click="openDetail"
      >
        <el-table-column label="资产" min-width="220">
          <template #default="{ row }">
            <div class="asset-cell">
              <span class="asset-cell__icon"><Box /></span>
              <div>
                <strong>{{ row.name }}</strong>
                <small class="mono">{{ row.assetNo }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="类别" min-width="120" />
        <el-table-column label="状态" width="112">
          <template #default="{ row }">
            <StatusBadge :status="row.status" kind="asset" />
          </template>
        </el-table-column>
        <el-table-column prop="storageLocation" label="存放位置" min-width="140" />
        <el-table-column label="序列号" min-width="160">
          <template #default="{ row }">
            <span class="mono">{{ row.serialNo || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="270" fixed="right">
          <template #default="{ row }">
            <div class="toolbar-actions" @click.stop>
              <el-button
                v-if="!auth.isAdmin && row.status === 'AVAILABLE'"
                type="primary"
                link
                @click="openApply(row)"
              >
                申请借用
              </el-button>
              <el-button link @click="openDetail(row)">详情</el-button>
              <template v-if="auth.isAdmin">
                <el-button link :icon="Edit" @click="openEdit(row)">编辑</el-button>
                <el-dropdown
                  v-if="['AVAILABLE', 'MAINTENANCE'].includes(row.status)"
                  trigger="click"
                >
                  <el-button link :icon="Setting">状态</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-if="row.status === 'AVAILABLE'"
                        @click="changeStatus(row, 'MAINTENANCE')"
                      >
                        设为维修中
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="row.status === 'MAINTENANCE'"
                        @click="changeStatus(row, 'AVAILABLE')"
                      >
                        恢复可借
                      </el-dropdown-item>
                      <el-dropdown-item
                        divided
                        @click="changeStatus(row, 'RETIRED')"
                      >
                        设为已报废
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-loading="loading" class="mobile-list asset-mobile-list">
        <article
          v-for="asset in assets"
          :key="asset.id"
          class="mobile-card"
        >
          <div class="mobile-card__head">
            <div class="mobile-card__title">
              <strong>{{ asset.name }}</strong>
              <span>{{ asset.assetNo }} · {{ asset.category }}</span>
            </div>
            <StatusBadge :status="asset.status" kind="asset" />
          </div>
          <div class="mobile-card__body">
            <div class="mobile-card__field">
              <span>存放位置</span>
              <strong>{{ asset.storageLocation }}</strong>
            </div>
            <div class="mobile-card__field">
              <span>序列号</span>
              <strong class="mono">{{ asset.serialNo || '—' }}</strong>
            </div>
          </div>
          <div class="mobile-card__actions">
            <el-button @click="openDetail(asset)">查看详情</el-button>
            <el-button
              v-if="!auth.isAdmin && asset.status === 'AVAILABLE'"
              type="primary"
              :icon="UserFilled"
              @click="openApply(asset)"
            >
              申请借用
            </el-button>
            <el-button
              v-if="auth.isAdmin"
              :icon="Edit"
              @click="openEdit(asset)"
            >
              编辑
            </el-button>
            <el-dropdown
              v-if="auth.isAdmin && ['AVAILABLE', 'MAINTENANCE'].includes(asset.status)"
              trigger="click"
            >
              <el-button :icon="Setting">变更状态</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-if="asset.status === 'AVAILABLE'"
                    @click="changeStatus(asset, 'MAINTENANCE')"
                  >
                    设为维修中
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="asset.status === 'MAINTENANCE'"
                    @click="changeStatus(asset, 'AVAILABLE')"
                  >
                    恢复可借
                  </el-dropdown-item>
                  <el-dropdown-item divided @click="changeStatus(asset, 'RETIRED')">
                    设为已报废
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </article>
        <el-empty
          v-if="!loading && !assets.length"
          description="没有找到符合条件的资产"
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

    <el-dialog
      v-model="formVisible"
      :title="dialogTitle"
      width="640px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="assetForm" :rules="formRules" label-position="top">
        <div class="form-grid">
          <el-form-item label="资产编号" prop="assetNo">
            <el-input v-model="assetForm.assetNo" placeholder="例如：A-1004" />
          </el-form-item>
          <el-form-item label="资产名称" prop="name">
            <el-input v-model="assetForm.name" placeholder="请输入设备名称" />
          </el-form-item>
          <el-form-item label="类别" prop="category">
            <el-input v-model="assetForm.category" placeholder="例如：笔记本电脑" />
          </el-form-item>
          <el-form-item label="序列号">
            <el-input v-model="assetForm.serialNo" placeholder="选填" />
          </el-form-item>
          <el-form-item label="存放位置" prop="storageLocation" class="form-grid__full">
            <el-input v-model="assetForm.storageLocation" placeholder="例如：A区-01柜" />
          </el-form-item>
          <el-form-item label="备注" class="form-grid__full">
            <el-input
              v-model="assetForm.notes"
              type="textarea"
              :rows="3"
              maxlength="1000"
              show-word-limit
              placeholder="选填，例如配件或使用说明"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAsset">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailVisible"
      title="资产详情"
      size="min(460px, 100vw)"
    >
      <template v-if="selectedAsset">
        <div class="detail-hero">
          <span><Box /></span>
          <div>
            <h2>{{ selectedAsset.name }}</h2>
            <p class="mono">{{ selectedAsset.assetNo }}</p>
          </div>
          <StatusBadge :status="selectedAsset.status" kind="asset" />
        </div>
        <dl class="detail-list">
          <div>
            <dt>资产类别</dt>
            <dd>{{ selectedAsset.category }}</dd>
          </div>
          <div>
            <dt>序列号</dt>
            <dd class="mono">{{ selectedAsset.serialNo || '—' }}</dd>
          </div>
          <div>
            <dt>存放位置</dt>
            <dd>{{ selectedAsset.storageLocation }}</dd>
          </div>
          <div>
            <dt>最后更新</dt>
            <dd>{{ formatDateTime(selectedAsset.updatedAt) }}</dd>
          </div>
          <div class="detail-list__full">
            <dt>备注</dt>
            <dd>{{ selectedAsset.notes || '无' }}</dd>
          </div>
        </dl>
        <div v-if="!auth.isAdmin && selectedAsset.status === 'AVAILABLE'" class="drawer-actions">
          <el-button type="primary" @click="openApply(selectedAsset)">
            申请借用此资产
          </el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog
      v-model="applyVisible"
      title="提交借用申请"
      width="540px"
      destroy-on-close
    >
      <div v-if="selectedAsset" class="apply-asset">
        <span><Box /></span>
        <div>
          <strong>{{ selectedAsset.name }}</strong>
          <small>{{ selectedAsset.assetNo }} · {{ selectedAsset.storageLocation }}</small>
        </div>
      </div>
      <el-form
        ref="applyFormRef"
        :model="applyForm"
        :rules="applyRules"
        label-position="top"
      >
        <el-form-item label="借用用途" prop="purpose">
          <el-input
            v-model="applyForm.purpose"
            type="textarea"
            :rows="4"
            maxlength="1000"
            show-word-limit
            placeholder="请说明使用场景和用途"
          />
        </el-form-item>
        <el-form-item label="预计归还时间" prop="expectedReturnAt">
          <el-date-picker
            v-model="applyForm.expectedReturnAt"
            type="datetime"
            placeholder="选择日期和时间"
            :disabled-date="disabledDate"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="applyVisible = false">取消</el-button>
        <el-button type="primary" :loading="applySaving" @click="submitApplication">
          提交申请
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.asset-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.asset-cell__icon {
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

.asset-cell strong,
.asset-cell small {
  display: block;
}

.asset-cell strong {
  font-size: 14px;
}

.asset-cell small {
  margin-top: 2px;
  color: var(--color-text-muted);
}

.asset-mobile-list {
  padding: 12px;
}

.detail-hero {
  display: grid;
  align-items: center;
  gap: 12px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--color-border);
  grid-template-columns: 48px minmax(0, 1fr) auto;
}

.detail-hero > span {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-radius: 12px;
  font-size: 23px;
}

.detail-hero h2 {
  margin: 0;
  font-size: 19px;
}

.detail-hero p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
}

.detail-list {
  margin-top: 24px;
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 28px;
}

.apply-asset {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 14px;
  background: var(--color-surface-muted);
  border-radius: var(--radius-md);
}

.apply-asset > span {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: var(--color-primary);
  background: white;
  border-radius: 9px;
  font-size: 19px;
}

.apply-asset strong,
.apply-asset small {
  display: block;
}

.apply-asset small {
  margin-top: 3px;
  color: var(--color-text-muted);
}

@media (max-width: 720px) {
  .detail-hero {
    align-items: flex-start;
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .detail-hero > :last-child {
    grid-column: 2;
  }
}
</style>
