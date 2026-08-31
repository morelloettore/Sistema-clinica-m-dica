import type { UserRole } from '@/types'

const roleRoutes: Record<UserRole, string> = {
  patient: '/patient',
  employee: '/employee',
  doctor: '/doctor',
  admin: '/admin',
}

export function getDashboardRoute(role?: UserRole): string {
  return role ? roleRoutes[role] : '/login'
}
