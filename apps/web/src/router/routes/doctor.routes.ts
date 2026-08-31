import type { RouteRecordRaw } from 'vue-router'

export const doctorRoutes: RouteRecordRaw[] = [
  {
    path: '/doctor',
    component: () => import('@/components/layout/DoctorLayout.vue'),
    meta: { requiresAuth: true, role: 'doctor' },
    children: [
      {
        path: '',
        name: 'doctor-dashboard',
        component: () => import('@/views/doctor/DoctorDashboard.vue'),
      },
      {
        path: 'appointments',
        name: 'doctor-appointments',
        component: () => import('@/views/doctor/DoctorAppointments.vue'),
      },
      {
        path: 'patients',
        name: 'doctor-patients',
        component: () => import('@/views/doctor/DoctorPatients.vue'),
      },
      {
        path: 'medical-records',
        name: 'doctor-medical-records',
        component: () => import('@/views/doctor/DoctorMedicalRecords.vue'),
      },
      {
        path: 'availability',
        name: 'doctor-availability',
        component: () => import('@/views/doctor/DoctorAvailability.vue'),
      },
    ],
  },
]
