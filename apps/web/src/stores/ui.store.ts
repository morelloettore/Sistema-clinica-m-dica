import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Toast } from '@/types'

let toastCounter = 0

export const useUiStore = defineStore('ui', () => {
  const loading = ref(false)
  const toasts = ref<Toast[]>([])

  function showToast(message: string, type: Toast['type'] = 'info', duration = 4000) {
    const id = `toast-${++toastCounter}`
    const toast: Toast = { id, message, type, duration }
    toasts.value.push(toast)

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }

  function removeToast(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function setLoading(value: boolean) {
    loading.value = value
  }

  function $reset() {
    loading.value = false
    toasts.value = []
  }

  return { loading, toasts, showToast, removeToast, setLoading, $reset }
})
