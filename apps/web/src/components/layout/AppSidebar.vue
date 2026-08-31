<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import type { UserRole } from '@/types'

const route = useRoute()
const auth = useAuthStore()

const menuItems = computed(() => {
  const role = auth.user?.role

  if (role === 'patient') {
    return [
      { label: 'Dashboard', to: '/patient', icon: 'home' },
      { label: 'Agendar Consulta', to: '/patient/appointments/book', icon: 'calendar-plus' },
      { label: 'Minhas Consultas', to: '/patient/appointments', icon: 'calendar' },
      { label: 'Prontuário', to: '/patient/medical-records', icon: 'document' },
      { label: 'Planos de Saúde', to: '/patient/health-plans', icon: 'shield' },
      { label: 'Meu Perfil', to: '/patient/profile', icon: 'user' },
    ]
  }

  if (role === 'employee') {
    return [
      { label: 'Dashboard', to: '/employee', icon: 'home' },
      { label: 'Consultas', to: '/employee/appointments', icon: 'calendar' },
      { label: 'Pacientes', to: '/employee/patients', icon: 'users' },
      { label: 'Médicos', to: '/employee/doctors', icon: 'stethoscope' },
      { label: 'Horários', to: '/employee/schedules', icon: 'clock' },
      { label: 'Planos de Saúde', to: '/employee/health-plans', icon: 'shield' },
    ]
  }

  if (role === 'doctor') {
    return [
      { label: 'Dashboard', to: '/doctor', icon: 'home' },
      { label: 'Consultas', to: '/doctor/appointments', icon: 'calendar' },
      { label: 'Pacientes', to: '/doctor/patients', icon: 'users' },
      { label: 'Prontuários', to: '/doctor/medical-records', icon: 'document' },
      { label: 'Disponibilidade', to: '/doctor/availability', icon: 'clock' },
    ]
  }

  if (role === 'admin') {
    return [
      { label: 'Dashboard', to: '/admin', icon: 'home' },
      { label: 'Usuários', to: '/admin/users', icon: 'users' },
      { label: 'Médicos', to: '/admin/doctors', icon: 'stethoscope' },
      { label: 'Funcionários', to: '/admin/employees', icon: 'briefcase' },
      { label: 'Pacientes', to: '/admin/patients', icon: 'heart' },
      { label: 'Especialidades', to: '/admin/specialties', icon: 'star' },
      { label: 'Clínicas', to: '/admin/clinics', icon: 'building' },
      { label: 'Planos de Saúde', to: '/admin/health-plans', icon: 'shield' },
      { label: 'Auditoria', to: '/admin/audit', icon: 'search' },
    ]
  }

  return []
})

const roleLabels: Record<UserRole, string> = {
  patient: 'Paciente',
  employee: 'Funcionário',
  doctor: 'Médico',
  admin: 'Administrador',
}

function isActive(to: string) {
  if (to === '/') return route.path === to
  return route.path.startsWith(to)
}
</script>

<template>
  <aside class="flex h-screen w-64 flex-col bg-gray-900 text-white">
    <div class="flex items-center gap-2 border-b border-gray-700 px-6 py-5">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">
        CM
      </div>
      <div>
        <div class="text-sm font-semibold">Clínica Médica</div>
        <div class="text-xs text-gray-400">{{ auth.user ? roleLabels[auth.user.role] : '' }}</div>
      </div>
    </div>

    <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      <router-link
        v-for="item in menuItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
        :class="
          isActive(item.to)
            ? 'bg-blue-600/20 text-blue-400'
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        "
      >
        <span class="text-base">{{ item.icon === 'home' ? '🏠' : item.icon === 'calendar' ? '📅' : item.icon === 'calendar-plus' ? '➕' : item.icon === 'users' ? '👥' : item.icon === 'user' ? '👤' : item.icon === 'stethoscope' ? '🩺' : item.icon === 'document' ? '📋' : item.icon === 'shield' ? '🛡️' : item.icon === 'clock' ? '🕐' : item.icon === 'briefcase' ? '💼' : item.icon === 'heart' ? '❤️' : item.icon === 'star' ? '⭐' : item.icon === 'building' ? '🏥' : item.icon === 'search' ? '🔍' : '📄' }}</span>
        {{ item.label }}
      </router-link>
    </nav>

    <div class="border-t border-gray-700 px-4 py-4">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 text-sm font-medium">
          {{ auth.user?.name?.charAt(0)?.toUpperCase() || '?' }}
        </div>
        <div class="flex-1 overflow-hidden">
          <div class="truncate text-sm font-medium">{{ auth.user?.name }}</div>
          <div class="truncate text-xs text-gray-400">{{ auth.user?.email }}</div>
        </div>
      </div>
    </div>
  </aside>
</template>
