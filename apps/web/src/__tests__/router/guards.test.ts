import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'

const mockAuthStore = vi.fn()

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => mockAuthStore(),
}))

import { authGuard } from '@/router/guards/auth'
import { roleGuard } from '@/router/guards/role'
import { getDashboardRoute } from '@/router/guards/getDashboardRoute'

function createTestRouter(
  _authMeta: Record<string, any> = {},
) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/login',
        name: 'login',
        component: { template: '<div>Login</div>' },
        meta: { requiresGuest: true },
      },
      {
        path: '/register',
        name: 'register',
        component: { template: '<div>Register</div>' },
        meta: { requiresGuest: true },
      },
      {
        path: '/patient',
        name: 'patient-dashboard',
        component: { template: '<div>Patient</div>' },
        meta: { requiresAuth: true, role: 'patient' },
      },
      {
        path: '/employee',
        name: 'employee-dashboard',
        component: { template: '<div>Employee</div>' },
        meta: { requiresAuth: true, role: 'employee' },
      },
      {
        path: '/doctor',
        name: 'doctor-dashboard',
        component: { template: '<div>Doctor</div>' },
        meta: { requiresAuth: true, role: 'doctor' },
      },
      {
        path: '/admin',
        name: 'admin-dashboard',
        component: { template: '<div>Admin</div>' },
        meta: { requiresAuth: true, role: 'admin' },
      },
    ],
  })
}

describe('authGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated user from protected route to /login', async () => {
    mockAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      userRole: null,
    })

    const router = createTestRouter()
    router.beforeEach(authGuard)

    await router.push('/patient')
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('allows authenticated user to access protected route', async () => {
    mockAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', role: 'patient', name: 'A', email: 'a@b.com' },
      userRole: 'patient',
    })

    const router = createTestRouter()
    router.beforeEach(authGuard)

    await router.push('/patient')
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/patient')
  })

  it('redirects authenticated user from /login to dashboard', async () => {
    mockAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', role: 'patient', name: 'A', email: 'a@b.com' },
      userRole: 'patient',
    })

    const router = createTestRouter()
    router.beforeEach(authGuard)

    await router.push('/login')
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/patient')
  })

  it('redirects authenticated patient from /register to patient dashboard', async () => {
    mockAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', role: 'patient', name: 'A', email: 'a@b.com' },
      userRole: 'patient',
    })

    const router = createTestRouter()
    router.beforeEach(authGuard)

    await router.push('/register')
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/patient')
  })

  it('allows unauthenticated user to access /login', async () => {
    mockAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      userRole: null,
    })

    const router = createTestRouter()
    router.beforeEach(authGuard)

    await router.push('/login')
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/login')
  })
})

describe('roleGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows correct role to access route', async () => {
    mockAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', role: 'patient', name: 'A', email: 'a@b.com' },
      userRole: 'patient',
    })

    const router = createTestRouter()
    router.beforeEach(authGuard)
    router.beforeEach(roleGuard)

    await router.push('/patient')
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/patient')
  })

  it('redirects patient from /admin to /patient', async () => {
    mockAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', role: 'patient', name: 'A', email: 'a@b.com' },
      userRole: 'patient',
    })

    const router = createTestRouter()
    router.beforeEach(authGuard)
    router.beforeEach(roleGuard)

    await router.push('/admin')
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/patient')
  })

  it('redirects doctor from /patient to /doctor', async () => {
    mockAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', role: 'doctor', name: 'Dr A', email: 'dr@b.com' },
      userRole: 'doctor',
    })

    const router = createTestRouter()
    router.beforeEach(authGuard)
    router.beforeEach(roleGuard)

    await router.push('/patient')
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/doctor')
  })

  it('redirects employee from /admin to /employee', async () => {
    mockAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', role: 'employee', name: 'E', email: 'e@b.com' },
      userRole: 'employee',
    })

    const router = createTestRouter()
    router.beforeEach(authGuard)
    router.beforeEach(roleGuard)

    await router.push('/admin')
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/employee')
  })

  it('allows admin to access /admin', async () => {
    mockAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', role: 'admin', name: 'Admin', email: 'admin@b.com' },
      userRole: 'admin',
    })

    const router = createTestRouter()
    router.beforeEach(authGuard)
    router.beforeEach(roleGuard)

    await router.push('/admin')
    await nextTick()

    expect(router.currentRoute.value.path).toBe('/admin')
  })
})

describe('getDashboardRoute', () => {
  it('returns /patient for patient role', () => {
    expect(getDashboardRoute('patient')).toBe('/patient')
  })

  it('returns /employee for employee role', () => {
    expect(getDashboardRoute('employee')).toBe('/employee')
  })

  it('returns /doctor for doctor role', () => {
    expect(getDashboardRoute('doctor')).toBe('/doctor')
  })

  it('returns /admin for admin role', () => {
    expect(getDashboardRoute('admin')).toBe('/admin')
  })

  it('returns /login when role is undefined', () => {
    expect(getDashboardRoute(undefined)).toBe('/login')
  })
})
