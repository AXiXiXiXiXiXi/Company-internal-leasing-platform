<script setup lang="ts">
import {
  Edit,
  Key,
  Plus,
  Search,
  User,
} from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import {
  ElMessage,
  type FormInstance,
  type FormRules,
} from 'element-plus'
import { usersApi } from '@/api'
import { getApiErrorMessage } from '@/api/http'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { User as UserRecord, UserRole, UserStatus } from '@/types/api'
import { userStatusMeta } from '@/constants/status'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)
const users = ref<UserRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive<{
  q: string
  role: UserRole | ''
  status: UserStatus | ''
}>({
  q: '',
  role: '',
  status: '',
})

const formVisible = ref(false)
const formRef = ref<FormInstance>()
const editingId = ref<string | null>(null)
const saving = ref(false)
const userForm = reactive({
  username: '',
  employeeNo: '',
  fullName: '',
  role: 'EMPLOYEE' as UserRole,
  status: 'ACTIVE' as UserStatus,
  password: '',
})
const formRules: FormRules = {
  fullName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}
const createMode = computed(() => !editingId.value)
const dialogTitle = computed(() => (
  createMode.value ? '新增用户' : '编辑用户'
))

const passwordVisible = ref(false)
const passwordSaving = ref(false)
const passwordTarget = ref<UserRecord | null>(null)
const passwordFormRef = ref<FormInstance>()
const passwordForm = reactive({ password: '' })
const passwordRules: FormRules = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 个字符', trigger: 'blur' },
  ],
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await usersApi.list({
      page: page.value,
      pageSize: pageSize.value,
      q: filters.q,
      role: filters.role,
      status: filters.status,
    })
    users.value = result.items
    total.value = result.total
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '用户列表加载失败'))
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
  filters.role = ''
  filters.status = ''
  search()
}

function openCreate(): void {
  editingId.value = null
  Object.assign(userForm, {
    username: '',
    employeeNo: '',
    fullName: '',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    password: '',
  })
  formVisible.value = true
}

function openEdit(row: unknown): void {
  const user = row as UserRecord
  editingId.value = user.id
  Object.assign(userForm, {
    username: user.username,
    employeeNo: user.employeeNo ?? '',
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    password: '',
  })
  formVisible.value = true
}

async function saveUser(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (createMode.value && userForm.password.length < 8) {
    ElMessage.warning('初始密码至少 8 个字符')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await usersApi.update(editingId.value, {
        fullName: userForm.fullName,
        employeeNo: userForm.employeeNo || null,
        role: userForm.role,
        status: userForm.status,
      })
      ElMessage.success('用户信息已更新')
    } else {
      await usersApi.create({
        username: userForm.username,
        employeeNo: userForm.employeeNo || null,
        fullName: userForm.fullName,
        role: userForm.role,
        password: userForm.password,
      })
      ElMessage.success('用户已创建')
    }
    formVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '用户保存失败'))
  } finally {
    saving.value = false
  }
}

function openPassword(row: unknown): void {
  const user = row as UserRecord
  passwordTarget.value = user
  passwordForm.password = ''
  passwordVisible.value = true
}

async function resetPassword(): Promise<void> {
  const valid = await passwordFormRef.value?.validate().catch(() => false)
  if (!valid || !passwordTarget.value) return
  passwordSaving.value = true
  try {
    await usersApi.resetPassword(
      passwordTarget.value.id,
      passwordForm.password,
    )
    ElMessage.success('密码已重置，请通知用户使用新密码登录')
    passwordVisible.value = false
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '密码重置失败'))
  } finally {
    passwordSaving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page-stack">
    <PageHeader
      title="用户管理"
      description="维护员工与管理员账号。停用账号后，该用户将无法继续访问系统。"
    >
      <template #actions>
        <el-button type="primary" :icon="Plus" @click="openCreate">
          新增用户
        </el-button>
      </template>
    </PageHeader>

    <section class="filter-bar" aria-label="用户筛选">
      <el-input
        v-model="filters.q"
        class="filter-bar__search"
        :prefix-icon="Search"
        clearable
        placeholder="用户名、姓名或工号"
        @keyup.enter="search"
      />
      <el-select v-model="filters.role" clearable placeholder="全部角色">
        <el-option label="管理员" value="ADMIN" />
        <el-option label="员工" value="EMPLOYEE" />
      </el-select>
      <el-select v-model="filters.status" clearable placeholder="全部状态">
        <el-option
          v-for="(meta, status) in userStatusMeta"
          :key="status"
          :label="meta.label"
          :value="status"
        />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="resetFilters">重置</el-button>
    </section>

    <section class="table-card">
      <el-table
        v-loading="loading"
        class="desktop-table"
        :data="users"
        row-key="id"
      >
        <el-table-column label="用户" min-width="210">
          <template #default="{ row }">
            <div class="user-cell">
              <span>{{ row.fullName.slice(-2) }}</span>
              <div>
                <strong>{{ row.fullName }}</strong>
                <small>{{ row.username }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="employeeNo" label="工号" min-width="120">
          <template #default="{ row }">{{ row.employeeNo || '—' }}</template>
        </el-table-column>
        <el-table-column label="角色" width="110">
          <template #default="{ row }">
            <el-tag :type="row.role === 'ADMIN' ? 'primary' : 'info'" effect="light">
              {{ row.role === 'ADMIN' ? '管理员' : '员工' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusBadge :status="row.status" kind="user" />
          </template>
        </el-table-column>
        <el-table-column label="最后登录" min-width="155">
          <template #default="{ row }">{{ formatDateTime(row.lastLoginAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="toolbar-actions">
              <el-button link :icon="Edit" @click="openEdit(row)">编辑</el-button>
              <el-button link :icon="Key" @click="openPassword(row)">重置密码</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-loading="loading" class="mobile-list users-mobile-list">
        <article v-for="user in users" :key="user.id" class="mobile-card">
          <div class="mobile-card__head">
            <div class="user-cell">
              <span>{{ user.fullName.slice(-2) }}</span>
              <div>
                <strong>{{ user.fullName }}</strong>
                <small>{{ user.username }} · {{ user.employeeNo || '无工号' }}</small>
              </div>
            </div>
            <StatusBadge :status="user.status" kind="user" />
          </div>
          <div class="mobile-card__body">
            <div class="mobile-card__field">
              <span>角色</span>
              <strong>{{ user.role === 'ADMIN' ? '管理员' : '员工' }}</strong>
            </div>
            <div class="mobile-card__field">
              <span>最后登录</span>
              <strong>{{ formatDateTime(user.lastLoginAt) }}</strong>
            </div>
          </div>
          <div class="mobile-card__actions">
            <el-button :icon="Edit" @click="openEdit(user)">编辑</el-button>
            <el-button :icon="Key" @click="openPassword(user)">重置密码</el-button>
          </div>
        </article>
        <el-empty
          v-if="!loading && !users.length"
          description="没有找到符合条件的用户"
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
      <el-form ref="formRef" :model="userForm" :rules="formRules" label-position="top">
        <div class="form-grid">
          <el-form-item v-if="createMode" label="用户名">
            <el-input
              v-model="userForm.username"
              placeholder="3-64 位字母、数字或 ._-"
              autocomplete="off"
            />
          </el-form-item>
          <el-form-item label="姓名" prop="fullName">
            <el-input v-model="userForm.fullName" placeholder="请输入真实姓名" />
          </el-form-item>
          <el-form-item label="工号">
            <el-input v-model="userForm.employeeNo" placeholder="选填" />
          </el-form-item>
          <el-form-item label="角色" prop="role">
            <el-select v-model="userForm.role" style="width: 100%">
              <el-option label="员工" value="EMPLOYEE" />
              <el-option label="管理员" value="ADMIN" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="!createMode" label="账号状态">
            <el-select v-model="userForm.status" style="width: 100%">
              <el-option label="启用" value="ACTIVE" />
              <el-option label="停用" value="DISABLED" />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="createMode"
            label="初始密码"
            class="form-grid__full"
          >
            <el-input
              v-model="userForm.password"
              type="password"
              show-password
              autocomplete="new-password"
              placeholder="至少 8 个字符"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUser">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="passwordVisible"
      title="重置用户密码"
      width="460px"
    >
      <p class="dialog-description">
        正在为 <strong>{{ passwordTarget?.fullName }}</strong> 重置密码。
        重置后请通过安全方式通知本人。
      </p>
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-position="top"
      >
        <el-form-item label="新密码" prop="password">
          <el-input
            v-model="passwordForm.password"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="至少 8 个字符"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordVisible = false">取消</el-button>
        <el-button type="primary" :loading="passwordSaving" @click="resetPassword">
          确认重置
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-cell > span {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  color: #1d4ed8;
  background: #dbeafe;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
}

.user-cell strong,
.user-cell small {
  display: block;
}

.user-cell strong {
  font-size: 14px;
}

.user-cell small {
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.users-mobile-list {
  padding: 12px;
}

.dialog-description {
  margin: 0 0 20px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}
</style>
