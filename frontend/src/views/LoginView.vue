<script setup lang="ts">
import {
  Bell,
  Box,
  DocumentChecked,
  Lock,
  User,
} from '@element-plus/icons-vue'
import {
  computed,
  onMounted,
  reactive,
  ref,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { getApiErrorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const formRef = ref<FormInstance>()
const form = reactive({
  username: '',
  password: '',
})
const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
  ],
}
const expired = computed(() => route.query.expired === '1')

async function submit(): Promise<void> {
  if (!form.username.trim()) {
    ElMessage.warning('请输入用户名')
    return
  }
  if (!form.password) {
    ElMessage.warning('请输入密码')
    return
  }
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }
  try {
    await auth.login(form.username.trim(), form.password)
    const redirect = typeof route.query.redirect === 'string'
      && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/dashboard'
    ElMessage.success('登录成功')
    await router.replace(redirect)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '登录失败，请检查账号和密码'))
  }
}

onMounted(() => {
  if (auth.isAuthenticated) {
    void router.replace('/dashboard')
  }
})
</script>

<template>
  <main class="login-page">
    <section class="login-story" aria-labelledby="login-story-title">
      <div class="login-story__brand">
        <span><Box /></span>
        <strong>资产借还</strong>
      </div>
      <div class="login-story__content">
        <p class="eyebrow">EQUIPMENT DESK</p>
        <h1 id="login-story-title">
          让每一次设备交接
          <br>
          都有迹可循
        </h1>
        <p class="intro">
          从申请、审批到实际借出与归还，统一管理公司设备，
          状态清楚，记录完整。
        </p>
        <ul>
          <li>
            <span><DocumentChecked /></span>
            <div>
              <strong>清晰的审批流程</strong>
              <p>申请状态与资产预留始终一致</p>
            </div>
          </li>
          <li>
            <span><Bell /></span>
            <div>
              <strong>及时站内提醒</strong>
              <p>管理员在线时实时收到新申请</p>
            </div>
          </li>
        </ul>
      </div>
      <p class="login-story__foot">内部使用 · 请妥善保管账号信息</p>
    </section>

    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-card">
        <header>
          <p class="eyebrow">WELCOME BACK</p>
          <h2 id="login-title">登录设备管理平台</h2>
          <p>使用公司分配的账号继续</p>
        </header>

        <el-alert
          v-if="expired"
          title="登录状态已过期，请重新登录"
          type="warning"
          :closable="false"
          show-icon
          class="expired-alert"
        />

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
          @keyup.enter="submit"
        >
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              :prefix-icon="User"
              autocomplete="username"
              placeholder="请输入用户名"
              autofocus
            />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              :prefix-icon="Lock"
              type="password"
              autocomplete="current-password"
              placeholder="请输入密码"
              show-password
            />
          </el-form-item>
          <el-button
            class="login-button"
            type="primary"
            native-type="submit"
            :loading="auth.loading"
            @click="submit"
          >
            登录
          </el-button>
        </el-form>

        <p class="help-note">
          忘记密码请联系管理员重置。
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100dvh;
  background: #f8fafc;
  grid-template-columns: minmax(420px, 1.05fr) minmax(440px, 0.95fr);
}

.login-story {
  position: relative;
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  padding: 36px clamp(40px, 6vw, 88px);
  overflow: hidden;
  color: white;
  background: #10192b;
}

.login-story::before,
.login-story::after {
  position: absolute;
  border: 1px solid rgb(147 197 253 / 15%);
  border-radius: 999px;
  content: '';
}

.login-story::before {
  right: -170px;
  bottom: -160px;
  width: 460px;
  height: 460px;
}

.login-story::after {
  right: -60px;
  bottom: -50px;
  width: 240px;
  height: 240px;
}

.login-story__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  letter-spacing: 0.03em;
}

.login-story__brand span {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: #bfdbfe;
  background: rgb(37 99 235 / 22%);
  border-radius: 11px;
  font-size: 21px;
}

.login-story__content {
  width: min(570px, 100%);
  margin: auto 0;
  padding: 56px 0;
}

.eyebrow {
  margin: 0 0 14px;
  color: #7da7f9;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

h1 {
  margin: 0;
  font-size: clamp(38px, 5vw, 64px);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1.13;
}

.intro {
  max-width: 500px;
  margin: 24px 0 34px;
  color: #aebbd0;
  font-size: 16px;
  line-height: 1.8;
}

ul {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: rgb(255 255 255 / 4%);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 12px;
}

li > span {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  color: #93c5fd;
  background: rgb(37 99 235 / 18%);
  border-radius: 10px;
  font-size: 18px;
}

li strong {
  font-size: 14px;
}

li p {
  margin: 3px 0 0;
  color: #8fa0ba;
  font-size: 12px;
}

.login-story__foot {
  margin: 0;
  color: #73829a;
  font-size: 12px;
}

.login-panel {
  display: grid;
  min-height: 100dvh;
  padding: 32px;
  place-items: center;
}

.login-card {
  width: min(420px, 100%);
  padding: 36px;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  box-shadow: var(--shadow-soft);
}

.login-card header {
  margin-bottom: 26px;
}

.login-card h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 26px;
  letter-spacing: -0.025em;
}

.login-card header > p:last-child {
  margin: 8px 0 0;
  color: var(--color-text-muted);
  font-size: 14px;
}

.expired-alert {
  margin-bottom: 20px;
}

.login-button {
  width: 100%;
  min-height: 46px;
  margin-top: 4px;
}

.help-note {
  margin: 20px 0 0;
  color: var(--color-text-muted);
  text-align: center;
  font-size: 12px;
}

@media (max-width: 900px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .login-story {
    min-height: auto;
    padding: 24px 22px 30px;
  }

  .login-story__content {
    padding: 48px 0 20px;
  }

  h1 {
    font-size: clamp(32px, 8.2vw, 46px);
  }

  .intro {
    margin-bottom: 0;
  }

  ul,
  .login-story__foot {
    display: none;
  }

  .login-panel {
    min-height: auto;
    padding: 24px 16px 40px;
  }

  .login-card {
    padding: 26px 22px;
  }
}
</style>
