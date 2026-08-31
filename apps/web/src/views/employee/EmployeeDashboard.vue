<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Painel do Funcionário</h1>

    <div v-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Consultas Hoje</p>
              <p class="text-3xl font-bold text-gray-900">{{ todayAppointments }}</p>
            </div>
            <div class="p-3 bg-blue-100 rounded-full">
              <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Total de Pacientes</p>
              <p class="text-3xl font-bold text-gray-900">{{ totalPatients }}</p>
            </div>
            <div class="p-3 bg-green-100 rounded-full">
              <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Médicos Ativos</p>
              <p class="text-3xl font-bold text-gray-900">{{ activeDoctors }}</p>
            </div>
            <div class="p-3 bg-purple-100 rounded-full">
              <svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Ações Rápidas</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <router-link
            to="/employee/patients"
            class="block bg-white rounded-lg shadow p-4 border border-gray-200 hover:border-blue-400 hover:shadow-md transition"
          >
            <div class="flex items-center gap-3">
              <div class="p-2 bg-blue-100 rounded-lg">
                <svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span class="font-medium text-gray-900">Gerenciar Pacientes</span>
            </div>
          </router-link>

          <router-link
            to="/employee/appointments"
            class="block bg-white rounded-lg shadow p-4 border border-gray-200 hover:border-blue-400 hover:shadow-md transition"
          >
            <div class="flex items-center gap-3">
              <div class="p-2 bg-green-100 rounded-lg">
                <svg class="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span class="font-medium text-gray-900">Gerenciar Consultas</span>
            </div>
          </router-link>

          <router-link
            to="/employee/schedules"
            class="block bg-white rounded-lg shadow p-4 border border-gray-200 hover:border-blue-400 hover:shadow-md transition"
          >
            <div class="flex items-center gap-3">
              <div class="p-2 bg-purple-100 rounded-lg">
                <svg class="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span class="font-medium text-gray-900">Gerenciar Horários</span>
            </div>
          </router-link>
        </div>
      </div>

      <div>
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Consultas Recentes</h2>
        <div v-if="recentAppointments.length === 0" class="bg-white rounded-lg shadow p-8 border border-gray-200 text-center text-gray-500">
          Nenhuma consulta encontrada.
        </div>
        <div v-else class="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Horário</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paciente</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Médico</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="apt in recentAppointments" :key="apt.id" class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm text-gray-900">{{ formatDate(apt.date) }}</td>
                <td class="px-4 py-3 text-sm text-gray-900">{{ apt.schedule?.start_time?.slice(0, 5) }} - {{ apt.schedule?.end_time?.slice(0, 5) }}</td>
                <td class="px-4 py-3 text-sm text-gray-900">{{ apt.patient?.profile?.name ?? '—' }}</td>
                <td class="px-4 py-3 text-sm text-gray-900">{{ apt.doctor?.profile?.name ?? '—' }}</td>
                <td class="px-4 py-3 text-sm">
                  <span :class="statusBadgeClass(apt.status)" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {{ statusLabel(apt.status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {{ error }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const loading = ref(true)
const error = ref('')
const todayAppointments = ref(0)
const totalPatients = ref(0)
const activeDoctors = ref(0)
const recentAppointments = ref<any[]>([])

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    scheduled: 'Agendada',
    confirmed: 'Confirmada',
    checked_in: 'Check-in',
    in_progress: 'Em andamento',
    completed: 'Concluída',
    cancelled: 'Cancelada',
    no_show: 'Não compareceu',
  }
  return map[status] ?? status
}

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-100 text-green-800',
    checked_in: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-indigo-100 text-indigo-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
    no_show: 'bg-orange-100 text-orange-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-800'
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const today = new Date().toISOString().slice(0, 10)

    const [aptResult, patientResult, doctorResult, recentResult] = await Promise.all([
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('date', today)
        .not('status', 'eq', 'cancelled'),
      supabase
        .from('patients')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('doctors')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('appointments')
        .select(`
          id, date, status,
          patient:patients(id, profile:profiles(name)),
          doctor:doctors(id, profile:profiles(name)),
          schedule:schedules(start_time, end_time),
          clinic:clinics(name)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (aptResult.error) throw aptResult.error
    if (patientResult.error) throw patientResult.error
    if (doctorResult.error) throw doctorResult.error
    if (recentResult.error) throw recentResult.error

    todayAppointments.value = aptResult.count ?? 0
    totalPatients.value = patientResult.count ?? 0
    activeDoctors.value = doctorResult.count ?? 0
    recentAppointments.value = recentResult.data ?? []
  } catch (e: any) {
    error.value = e.message ?? 'Erro ao carregar dados do painel.'
  } finally {
    loading.value = false
  }
})
</script>
