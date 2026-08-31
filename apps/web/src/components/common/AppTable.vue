<script setup lang="ts" generic="T extends Record<string, any>">
import { ref, computed } from 'vue'

export interface Column {
  key: string
  label: string
  sortable?: boolean
  class?: string
}

type AppTableProps = {
  columns: Column[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  rowKey?: string
}

const props = withDefaults(defineProps<AppTableProps>(), {
  loading: false,
  emptyMessage: 'Nenhum registro encontrado',
  rowKey: 'id',
})

const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const sortedData = computed(() => {
  if (!sortKey.value) return props.data
  return [...props.data].sort((a, b) => {
    const aVal = a[sortKey.value]
    const bVal = b[sortKey.value]
    const mod = sortDir.value === 'asc' ? 1 : -1
    if (aVal < bVal) return -1 * mod
    if (aVal > bVal) return 1 * mod
    return 0
  })
})
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>

    <div v-else-if="data.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-500">
      <svg class="mb-3 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p class="text-sm">{{ emptyMessage }}</p>
    </div>

    <table v-else class="w-full">
      <thead class="border-b border-gray-200 bg-gray-50">
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
            :class="[col.sortable ? 'cursor-pointer select-none hover:text-gray-700' : '', col.class]"
            @click="col.sortable && toggleSort(col.key)"
          >
            <div class="flex items-center gap-1">
              {{ col.label }}
              <span v-if="col.sortable && sortKey === col.key" class="text-gray-400">
                {{ sortDir === 'asc' ? '▲' : '▼' }}
              </span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        <tr
          v-for="(row, idx) in sortedData"
          :key="String(row[rowKey])"
          class="transition-colors hover:bg-gray-50"
          :class="{ 'bg-gray-50/50': idx % 2 === 1 }"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            class="whitespace-nowrap px-6 py-4 text-sm text-gray-700"
            :class="col.class"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
