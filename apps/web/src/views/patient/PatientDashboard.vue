<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Ola, {{ authStore.user?.name ?? 'Paciente' }}!</h1>
      <p class="text-sm text-gray-500">Bem-vindo ao seu painel.</p>
    </div>

    <LoadingSpinner v-if="loading" />

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <router-link
          to="/patient/appointments/book"
          class="flex items-center gap-3 rounded-xl border bg-blue-50 p-4 transition-colors hover:bg-blue-100"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p class="font-medium text-gray-900">Agendar Consulta</p>
            <p class="text-xs text-gray-500">Escolha especialidade e horario</p>
          </div>
        </router-link>

        <router-link
          to="/patient/appointments"
          class="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p class="font-medium text-gray-900">Minhas Consultas</p>
            <p class="text-xs text-gray-500">Ver todos os agendamentos</p>
          </div>
        </router-link>

        <router-link
          to="/patient/profile"
          class="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p class="font-medium text-gray-900">Meu Perfil</p>
            <p class="text-xs text-gray-500">Dados pessoais</p>
          </div>
        </router-link>
      </div>

      <AppCard title="Proximas Consultas">
        <EmptyState v-if="appointments.length === 0" message="Nenhuma consulta agendada." />
        <div v-else class="divide-y">
          <div
            v-for="(apt, idx) in appointments"
            :key="(apt as any).id ?? idx"
            class="flex items-center justify-between py-3 first:pt-0 last:pb-0"
          >
            <div>
              <p class="text-sm font-medium text-gray-900">
                Dr(a). {{ (apt as any).doctor?.profile?.name ?? '—' }}
              </p>
              <p class="text-xs text-gray-500">
                {{ formatDate(String((apt as any).date)) }} &middot;
                {{ (apt as any).schedule?.start_time?.slice(0, 5) }} &middot;
                {{ (apt as any).clinic?.name ?? '' }}
              </p>
            </div>
            <span
              :class="statusBadgeClass((apt as any).status as AppointmentStatus)"
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            >
              {{ statusLabel((apt as any).status as AppointmentStatus) }}
            </span>
          </div>
        </div>
      </AppCard>

      <AppCard v-if="healthPlan" title="Plano de Saude">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-900">{{ (healthPlan as any).health_plan?.name }}</p>
            <p class="text-sm text-gray-500">
              Cobertura: {{ (healthPlan as any).health_plan?.coverage_percentage }}%
            </p>
          </div>
          <p class="text-lg font-semibold text-gray-900">
            R$ {{ formatCurrency((healthPlan as any).health_plan?.monthly_price ?? 0) }}
          </p>
        </div>
      </AppCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import AppCard from '@/components/common/AppCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { AppointmentStatus } from '@clinica/shared'

const authStore = useAuthStore()
const loading = ref(true)
const appointments = ref<unknown[]>([])
const healthPlan = ref<unknown>(null)

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function statusLabel(status: AppointmentStatus): string {
  const map: Record<AppointmentStatus, string> = {
    scheduled: 'Agendada',
    confirmed: 'Confirmada',
    checked_in: 'Check-in',
    in_progress: 'Em andamento',
    completed: 'Concluida',
    cancelled: 'Cancelada',
    no_show: 'Nao compareceu',
  }
  return map[status] ?? status
}

function statusBadgeClass(status: AppointmentStatus): string {
  const map: Record<AppointmentStatus, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-green-100 text-green-700',
    checked_in: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-orange-100 text-orange-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

onMounted(async () => {
  try {
    const today = new Date().toISOString().slice(0, 10)

    const results = await Promise.all([
      supabase
        .from('appointments')
        .select('id, date, status, doctor:doctors(id, profile:profiles(name)), schedule:schedules(start_time), clinic:clinics(name)')
        .gte('date', today)
        .in('status', ['scheduled', 'confirmed'])
        .order('date', { ascending: true })
        .limit(5),
      supabase
        .from('patient_health_plans')
        .select('id, start_date, end_date, health_plan:health_plans(name, coverage_percentage, monthly_price)')
        .is('end_date', null)
        .limit(1)
        .single(),
    ])

    const aptResult = results[0] as { data: unknown[] | null }
    const hpResult = results[1] as { data: unknown | null }

    if (aptResult.data) appointments.value = aptResult.data as unknown[]
    if (hpResult.data) healthPlan.value = hpResult.data as unknown
  } finally {
    loading.value = false
  }
})
</script>
