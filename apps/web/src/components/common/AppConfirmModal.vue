<script setup lang="ts">
import AppModal from './AppModal.vue'
import AppButton from './AppButton.vue'

defineProps<{
  show: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const buttonVariantMap = {
  danger: 'danger',
  warning: 'secondary',
  info: 'primary',
} as const
</script>

<template>
  <AppModal :show="show" :title="title" max-width="sm" @close="emit('cancel')">
    <p class="text-sm text-gray-600">{{ message }}</p>
    <template #footer>
      <AppButton variant="secondary" @click="emit('cancel')">
        {{ cancelText || 'Cancelar' }}
      </AppButton>
      <AppButton
        :variant="buttonVariantMap[variant || 'danger']"
        :loading="loading"
        @click="emit('confirm')"
      >
        {{ confirmText || 'Confirmar' }}
      </AppButton>
    </template>
  </AppModal>
</template>
