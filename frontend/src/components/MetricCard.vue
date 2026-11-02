<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    tone?: 'blue' | 'orange' | 'green' | 'red'
  }>(),
  {
    hint: '',
    tone: 'blue',
  },
)
</script>

<template>
  <article class="metric-card" :class="`metric-card--${tone}`">
    <div class="metric-card__top">
      <span>{{ label }}</span>
      <span class="metric-card__icon" aria-hidden="true">
        <slot name="icon" />
      </span>
    </div>
    <strong>{{ value }}</strong>
    <p v-if="hint">{{ hint }}</p>
  </article>
</template>

<style scoped>
.metric-card {
  --tone: var(--color-primary);
  --tone-soft: var(--color-primary-soft);
  position: relative;
  min-height: 142px;
  padding: 20px;
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.metric-card::after {
  position: absolute;
  right: -18px;
  bottom: -44px;
  width: 108px;
  height: 108px;
  border-radius: 999px;
  background: var(--tone-soft);
  content: '';
}

.metric-card--orange {
  --tone: #d97706;
  --tone-soft: #fff7ed;
}

.metric-card--green {
  --tone: #059669;
  --tone-soft: #ecfdf5;
}

.metric-card--red {
  --tone: #dc2626;
  --tone-soft: #fef2f2;
}

.metric-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.metric-card__icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: var(--tone);
  background: var(--tone-soft);
  border-radius: 10px;
  font-size: 18px;
}

strong {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 16px;
  color: var(--color-text);
  font-size: 32px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

p {
  position: relative;
  z-index: 1;
  margin: 10px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
