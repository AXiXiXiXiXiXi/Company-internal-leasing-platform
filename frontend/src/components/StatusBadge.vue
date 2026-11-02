<script setup lang="ts">
import { computed } from 'vue'
import type { TagType } from '@/constants/status'
import {
  applicationStatusMeta,
  assetStatusMeta,
  todoStatusMeta,
  userStatusMeta,
} from '@/constants/status'

const props = defineProps<{
  status: string
  kind?: 'asset' | 'application' | 'user' | 'todo'
}>()

const meta = computed<{ label: string; type: TagType }>(() => {
  if (props.kind === 'asset') {
    return assetStatusMeta[props.status as keyof typeof assetStatusMeta]
      ?? { label: props.status, type: 'info' }
  }
  if (props.kind === 'user') {
    return userStatusMeta[props.status as keyof typeof userStatusMeta]
      ?? { label: props.status, type: 'info' }
  }
  if (props.kind === 'todo') {
    return todoStatusMeta[props.status as keyof typeof todoStatusMeta]
      ?? { label: props.status, type: 'info' }
  }
  return applicationStatusMeta[
    props.status as keyof typeof applicationStatusMeta
  ] ?? { label: props.status, type: 'info' }
})
</script>

<template>
  <el-tag :type="meta.type" effect="light" round class="status-badge">
    <span class="status-badge__dot" aria-hidden="true" />
    {{ meta.label }}
  </el-tag>
</template>

<style scoped>
.status-badge {
  gap: 6px;
  min-height: 26px;
  padding-inline: 9px;
  font-weight: 600;
}

.status-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}
</style>
