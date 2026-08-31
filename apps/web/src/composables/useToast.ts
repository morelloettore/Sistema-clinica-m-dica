import { useUiStore } from '@/stores/ui.store'

export function useToast() {
  const ui = useUiStore()

  function success(message: string, duration?: number) {
    ui.showToast(message, 'success', duration)
  }

  function error(message: string, duration?: number) {
    ui.showToast(message, 'error', duration)
  }

  function warning(message: string, duration?: number) {
    ui.showToast(message, 'warning', duration)
  }

  function info(message: string, duration?: number) {
    ui.showToast(message, 'info', duration)
  }

  function dismiss(id: string) {
    ui.removeToast(id)
  }

  return { success, error, warning, info, dismiss }
}
