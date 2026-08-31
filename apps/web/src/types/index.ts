import type { UserRole, Profile } from '@clinica/shared'

export type { UserRole, Profile }

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  name: string
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

export interface PaginationParams {
  page: number
  perPage: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

export interface MenuItem {
  label: string
  to: string
  icon?: string
  children?: MenuItem[]
}
