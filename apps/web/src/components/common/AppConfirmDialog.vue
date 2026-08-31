<script setup lang="ts">
import { useConfirm } from '@/composables/useConfirm'

const { isVisible, options, handleConfirm, handleCancel } = useConfirm()

const variantClasses = {
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  warning: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500',
  info: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isVisible" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-black/50" @click="handleCancel" />

        <div class="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900">{{ options.title }}</h3>
          <p class="mt-2 text-sm text-gray-600">{{ options.message }}</p>

          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              @click="handleCancel"
            >
              {{ options.cancelText || 'Cancelar' }}
            </button>
            <button
              class="rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
              :class="variantClasses[options.variant || 'danger']"
              @click="handleConfirm"
            >
              {{ options.confirmText || 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
