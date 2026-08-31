<script setup lang="ts">
import { useUiStore } from '@/stores/ui.store'

const ui = useUiStore()

const typeStyles = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
}

const iconBg = {
  success: 'bg-green-100',
  error: 'bg-red-100',
  warning: 'bg-yellow-100',
  info: 'bg-blue-100',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed right-4 top-4 z-[100] flex flex-col gap-3">
      <TransitionGroup
        enter-active-class="duration-300 ease-out"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="duration-200 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0"
      >
        <div
          v-for="toast in ui.toasts"
          :key="toast.id"
          class="flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm"
          :class="typeStyles[toast.type]"
        >
          <div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs" :class="iconBg[toast.type]">
            <span v-if="toast.type === 'success'">✓</span>
            <span v-else-if="toast.type === 'error'">✕</span>
            <span v-else-if="toast.type === 'warning'">!</span>
            <span v-else>i</span>
          </div>
          <p class="flex-1 text-sm font-medium">{{ toast.message }}</p>
          <button
            class="flex-shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
            @click="ui.removeToast(toast.id)"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
