<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__copy">
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.page-header__copy {
  min-width: 0;
}

h1 {
  margin: 0;
  color: var(--color-text);
  font-size: clamp(24px, 2.5vw, 32px);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

p {
  max-width: 720px;
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}

.page-header__actions {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 720px) {
  .page-header {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 18px;
  }

  .page-header__actions {
    justify-content: stretch;
  }

  .page-header__actions :deep(.el-button) {
    flex: 1;
    min-height: 44px;
  }
}
</style>
