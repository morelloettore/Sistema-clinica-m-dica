<script setup lang="ts">
defineProps<{
  message?: string
  icon?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-gray-500">
    <div class="mb-4 text-4xl">{{ icon || '📭' }}</div>
    <p class="text-sm">{{ message || 'Nenhum registro encontrado' }}</p>
    <div class="mt-4">
      <slot />
    </div>
  </div>
</template>
