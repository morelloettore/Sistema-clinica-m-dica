import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { getDashboardRoute } from './getDashboardRoute'

export async function authGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return next({ name: 'login' })
  }

  if (to.meta.requiresGuest && auth.isAuthenticated) {
    return next(getDashboardRoute(auth.user?.role))
  }

  next()
}
