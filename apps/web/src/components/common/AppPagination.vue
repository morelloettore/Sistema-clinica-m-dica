<script setup lang="ts">
interface Props {
  page: number
  totalPages: number
  loading?: boolean
}

defineProps<Props>()
defineEmits<{ 'update:page': [value: number] }>()

function getVisiblePages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  if (total > 1) pages.push(total)

  return pages
}
</script>

<template>
  <nav v-if="totalPages > 1" class="flex items-center justify-between">
    <button
      :disabled="page <= 1 || loading"
      class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      @click="$emit('update:page', page - 1)"
    >
      Anterior
    </button>

    <div class="flex items-center gap-1">
      <button
        v-for="(p, i) in getVisiblePages(page, totalPages)"
        :key="i"
        :disabled="p === '...' || loading"
        class="min-w-[36px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        :class="
          p === page
            ? 'bg-blue-600 text-white'
            : p === '...'
            ? 'cursor-default text-gray-400'
            : 'text-gray-700 hover:bg-gray-100'
        "
        @click="p !== '...' && $emit('update:page', p)"
      >
        {{ p }}
      </button>
    </div>

    <button
      :disabled="page >= totalPages || loading"
      class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      @click="$emit('update:page', page + 1)"
    >
      Próximo
    </button>
  </nav>
</template>
