<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import type { Appointment } from '@clinica/shared'

const auth = useAuthStore()

const loading = ref(true)
const error = ref<string | null>(null)
const doctorId = ref<string | null>(null)

const todayCount = ref(0)
const upcomingAppointments = ref<Appointment[]>([])
const recentPatients = ref<{ name: string; lastVisit: string; appointmentId: string }[]>([])

const today = computed(() => new Date().toISOString().split('T')[0])

const statusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  checked_in: 'Check-in',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  no_show: 'Não compareceu',
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-yellow-100 text-yellow-800',
  checked_in: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-orange-100 text-orange-800',
}

function formatTime(time: string) {
  if (!time) return ''
  return time.substring(0, 5)
}

function formatDate(date: string) {
  if (!date) return ''
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

async function loadDoctorId() {
  const { data, error: e } = await supabase
    .from('doctors')
    .select('id')
    .eq('profile_id', auth.user!.id)
    .single()

  if (e || !data) {
    error.value = 'Não foi possível carregar dados do médico.'
    return false
  }
  doctorId.value = data.id
  return true
}

async function loadDashboard() {
  loading.value = true
  error.value = null

  try {
    const ok = await loadDoctorId()
    if (!ok) return

    const [todayResult, upcomingResult, recentResult] = await Promise.all([
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('doctor_id', doctorId.value!)
        .eq('date', today.value)
        .in('status', ['scheduled', 'confirmed', 'checked_in', 'in_progress']),

      supabase
        .from('appointments')
        .select(`
          id,
          patient_id,
          date,
          status,
          schedule:schedules(id, start_time, end_time),
          patient:patients(id, profile:profiles(name)),
          clinic:clinics(name)
        `)
        .eq('doctor_id', doctorId.value!)
        .in('status', ['scheduled', 'confirmed', 'checked_in'])
        .gte('date', today.value)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(5),

      supabase
        .from('appointments')
        .select(`
          id,
          date,
          status,
          patient:patients(id, profile:profiles(name))
        `)
        .eq('doctor_id', doctorId.value!)
        .eq('status', 'completed')
        .order('date', { ascending: false })
        .limit(5),
    ])

    if (todayResult.error) throw todayResult.error
    if (upcomingResult.error) throw upcomingResult.error
    if (recentResult.error) throw recentResult.error

    todayCount.value = todayResult.count ?? 0
    upcomingAppointments.value = (upcomingResult.data ?? []) as unknown as Appointment[]

    const seen = new Set<string>()
    recentPatients.value = []
    for (const r of (recentResult.data ?? []) as Record<string, unknown>[]) {
      const patient = r.patient as Record<string, unknown> | null
      if (!patient) continue
      const profile = patient.profile as Record<string, string> | null
      const name = profile?.name ?? 'Desconhecido'
      const pid = patient.id as string
      if (!seen.has(pid)) {
        seen.add(pid)
        recentPatients.value.push({
          name,
          lastVisit: r.date as string,
          appointmentId: r.id as string,
        })
      }
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar dashboard.'
  } finally {
    loading.value = false
  }
}

function getNested(obj: Record<string, unknown>, ...keys: string[]): unknown {
  let current: unknown = obj
  for (const key of keys) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return current
}

onMounted(loadDashboard)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Dashboard</h2>
      <button
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        @click="loadDashboard"
      >
        Atualizar
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      <span class="ml-3 text-gray-600">Carregando...</span>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p class="text-red-700">{{ error }}</p>
      <button
        class="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        @click="loadDashboard"
      >
        Tentar novamente
      </button>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div class="text-sm font-medium text-gray-500">Consultas Hoje</div>
          <div class="mt-1 text-3xl font-bold text-gray-900">{{ todayCount }}</div>
          <div class="mt-1 text-xs text-gray-400">{{ formatDate(today) }}</div>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div class="text-sm font-medium text-gray-500">Próximas Consultas</div>
          <div class="mt-1 text-3xl font-bold text-gray-900">{{ upcomingAppointments.length }}</div>
          <div class="mt-1 text-xs text-gray-400">Na fila</div>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div class="text-sm font-medium text-gray-500">Pacientes Atendidos</div>
          <div class="mt-1 text-3xl font-bold text-gray-900">{{ recentPatients.length }}</div>
          <div class="mt-1 text-xs text-gray-400">Recentemente</div>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div class="text-sm font-medium text-gray-500">Taxa de Comparecimento</div>
          <div class="mt-1 text-3xl font-bold text-green-600">
            {{ todayCount > 0 ? '—' : '—' }}
          </div>
          <div class="mt-1 text-xs text-gray-400">Baseado nas consultas</div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div class="border-b border-gray-200 px-6 py-4">
            <h3 class="text-lg font-semibold text-gray-900">Próximas Consultas</h3>
          </div>
          <div v-if="upcomingAppointments.length === 0" class="p-6 text-center text-gray-500">
            Nenhuma consulta agendada.
          </div>
          <ul v-else class="divide-y divide-gray-100">
            <li
              v-for="apt in upcomingAppointments"
              :key="apt.id"
              class="flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50"
            >
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-gray-900">
                  {{ getNested(apt as unknown as Record<string, unknown>, 'patient', 'profile', 'name') || 'Paciente' }}
                </div>
                <div class="mt-0.5 text-xs text-gray-500">
                  {{ formatDate(apt.date) }} · {{ formatTime((apt as unknown as Record<string, unknown>).schedule ? ((apt as unknown as Record<string, unknown>).schedule as Record<string, string>).start_time : '') }}
                  — {{ formatTime((apt as unknown as Record<string, unknown>).schedule ? ((apt as unknown as Record<string, unknown>).schedule as Record<string, string>).end_time : '') }}
                </div>
                <div class="mt-0.5 text-xs text-gray-400">
                  {{ getNested(apt as unknown as Record<string, unknown>, 'clinic', 'name') || '' }}
                </div>
              </div>
              <span
                class="ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="statusColors[apt.status] || 'bg-gray-100 text-gray-800'"
              >
                {{ statusLabels[apt.status] || apt.status }}
              </span>
            </li>
          </ul>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div class="border-b border-gray-200 px-6 py-4">
            <h3 class="text-lg font-semibold text-gray-900">Pacientes Recentes</h3>
          </div>
          <div v-if="recentPatients.length === 0" class="p-6 text-center text-gray-500">
            Nenhum paciente atendido recentemente.
          </div>
          <ul v-else class="divide-y divide-gray-100">
            <li
              v-for="p in recentPatients"
              :key="p.appointmentId"
              class="flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50"
            >
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-gray-900">{{ p.name }}</div>
                <div class="mt-0.5 text-xs text-gray-500">Último atendimento: {{ formatDate(p.lastVisit) }}</div>
              </div>
              <span class="ml-4 shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                Atendido
              </span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>
