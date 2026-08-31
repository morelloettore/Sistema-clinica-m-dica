import { ref } from 'vue'
import type { ConfirmOptions } from '@/types'

const isVisible = ref(false)
const options = ref<ConfirmOptions>({ title: '', message: '' })
let resolvePromise: ((value: boolean) => void) | null = null

export function useConfirm() {
  function confirm(opts: ConfirmOptions): Promise<boolean> {
    options.value = opts
    isVisible.value = true

    return new Promise((resolve) => {
      resolvePromise = resolve
    })
  }

  function handleConfirm() {
    isVisible.value = false
    resolvePromise?.(true)
    resolvePromise = null
  }

  function handleCancel() {
    isVisible.value = false
    resolvePromise?.(false)
    resolvePromise = null
  }

  return {
    isVisible,
    options,
    confirm,
    handleConfirm,
    handleCancel,
  }
}
