import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { getDashboardRoute } from './getDashboardRoute'

export function roleGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) {
  const auth = useAuthStore()

  if (to.meta.role && auth.user?.role !== to.meta.role) {
    return next(getDashboardRoute(auth.user?.role))
  }

  next()
}
