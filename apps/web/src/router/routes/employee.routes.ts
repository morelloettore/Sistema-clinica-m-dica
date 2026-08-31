import type { RouteRecordRaw } from 'vue-router'

export const employeeRoutes: RouteRecordRaw[] = [
  {
    path: '/employee',
    component: () => import('@/components/layout/EmployeeLayout.vue'),
    meta: { requiresAuth: true, role: 'employee' },
    children: [
      {
        path: '',
        name: 'employee-dashboard',
        component: () => import('@/views/employee/EmployeeDashboard.vue'),
      },
      {
        path: 'appointments',
        name: 'employee-appointments',
        component: () => import('@/views/employee/ManageAppointments.vue'),
      },
      {
        path: 'patients',
        name: 'employee-patients',
        component: () => import('@/views/employee/ManagePatients.vue'),
      },
      {
        path: 'doctors',
        name: 'employee-doctors',
        component: () => import('@/views/employee/ManageDoctors.vue'),
      },
      {
        path: 'schedules',
        name: 'employee-schedules',
        component: () => import('@/views/employee/ManageSchedules.vue'),
      },
      {
        path: 'health-plans',
        name: 'employee-health-plans',
        component: () => import('@/views/employee/ManageHealthPlans.vue'),
      },
    ],
  },
]
