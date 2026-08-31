import { createRouter, createWebHistory } from 'vue-router'
import { authGuard } from './guards/auth'
import { roleGuard } from './guards/role'
import { authRoutes } from './routes/auth.routes'
import { patientRoutes } from './routes/patient.routes'
import { employeeRoutes } from './routes/employee.routes'
import { doctorRoutes } from './routes/doctor.routes'
import { adminRoutes } from './routes/admin.routes'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    ...authRoutes,
    ...patientRoutes,
    ...employeeRoutes,
    ...doctorRoutes,
    ...adminRoutes,
    {
      path: '/:pathMatch(.*)*',
      redirect: '/login',
    },
  ],
})

router.beforeEach(authGuard)
router.beforeEach(roleGuard)

export default router
