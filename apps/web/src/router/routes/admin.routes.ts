import type { RouteRecordRaw } from 'vue-router'

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    component: () => import('@/components/layout/AdminLayout.vue'),
    meta: { requiresAuth: true, role: 'admin' },
    children: [
      {
        path: '',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/AdminDashboard.vue'),
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('@/views/admin/AdminUsers.vue'),
      },
      {
        path: 'doctors',
        name: 'admin-doctors',
        component: () => import('@/views/admin/AdminDoctors.vue'),
      },
      {
        path: 'employees',
        name: 'admin-employees',
        component: () => import('@/views/admin/AdminEmployees.vue'),
      },
      {
        path: 'patients',
        name: 'admin-patients',
        component: () => import('@/views/admin/AdminPatients.vue'),
      },
      {
        path: 'specialties',
        name: 'admin-specialties',
        component: () => import('@/views/admin/AdminSpecialties.vue'),
      },
      {
        path: 'clinics',
        name: 'admin-clinics',
        component: () => import('@/views/admin/AdminClinics.vue'),
      },
      {
        path: 'health-plans',
        name: 'admin-health-plans',
        component: () => import('@/views/admin/AdminHealthPlans.vue'),
      },
      {
        path: 'audit',
        name: 'admin-audit',
        component: () => import('@/views/admin/AdminAudit.vue'),
      },
    ],
  },
]
