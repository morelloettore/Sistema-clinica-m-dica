import type { RouteRecordRaw } from 'vue-router'

export const patientRoutes: RouteRecordRaw[] = [
  {
    path: '/patient',
    component: () => import('@/components/layout/PatientLayout.vue'),
    meta: { requiresAuth: true, role: 'patient' },
    children: [
      {
        path: '',
        name: 'patient-dashboard',
        component: () => import('@/views/patient/PatientDashboard.vue'),
      },
      {
        path: 'appointments',
        name: 'patient-appointments',
        component: () => import('@/views/patient/PatientAppointments.vue'),
      },
      {
        path: 'appointments/book',
        name: 'patient-book',
        component: () => import('@/views/patient/BookAppointment.vue'),
      },
      {
        path: 'profile',
        name: 'patient-profile',
        component: () => import('@/views/patient/PatientProfile.vue'),
      },
      {
        path: 'health-plans',
        name: 'patient-health-plans',
        component: () => import('@/views/patient/PatientHealthPlans.vue'),
      },
      {
        path: 'medical-records',
        name: 'patient-medical-records',
        component: () => import('@/views/patient/PatientMedicalRecords.vue'),
      },
    ],
  },
]
