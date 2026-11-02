<script setup lang="ts">
import { Back, House } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="not-found">
    <div class="not-found__code">404</div>
    <h1>页面不存在</h1>
    <p>你访问的地址可能已经变更，或者没有访问该页面的入口。</p>
    <div>
      <el-button :icon="Back" @click="router.back()">返回上一页</el-button>
      <el-button type="primary" :icon="House" @click="router.push('/dashboard')">
        返回工作台
      </el-button>
    </div>
  </main>
</template>

<style scoped>
.not-found {
  display: grid;
  min-height: 100dvh;
  padding: 24px;
  place-content: center;
  text-align: center;
}

.not-found__code {
  color: var(--color-primary);
  font-size: clamp(80px, 18vw, 160px);
  font-weight: 800;
  letter-spacing: -0.08em;
  line-height: 1;
}

h1 {
  margin: 12px 0 0;
  font-size: 28px;
}

p {
  margin: 10px 0 24px;
  color: var(--color-text-muted);
}

div:last-child {
  display: flex;
  justify-content: center;
  gap: 10px;
}
</style>
