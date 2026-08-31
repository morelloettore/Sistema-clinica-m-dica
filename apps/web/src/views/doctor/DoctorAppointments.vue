<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import type { AppointmentStatus } from '@clinica/shared'

const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const loading = ref(true)
const error = ref<string | null>(null)
const doctorId = ref<string | null>(null)

const appointments = ref<Record<string, unknown>[]>([])
const dateFilter = ref('')
const statusFilter = ref<'all' | AppointmentStatus>('all')

const today = new Date().toISOString().split('T')[0]

const statusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'scheduled', label: 'Agendada' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'checked_in', label: 'Check-in' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'no_show', label: 'Não compareceu' },
]

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

const actionState: Record<string, string> = {}

function formatTime(time: string | undefined) {
  if (!time) return ''
  return time.substring(0, 5)
}

function formatDate(date: string) {
  if (!date) return ''
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

function canStart(apt: Record<string, unknown>) {
  return apt.status === 'confirmed'
}

function canComplete(apt: Record<string, unknown>) {
  return apt.status === 'in_progress'
}

function canNoShow(apt: Record<string, unknown>) {
  const date = apt.date as string
  return apt.status === 'confirmed' && !!date && date < today
}

function getPatientName(apt: Record<string, unknown>) {
  const patient = apt.patient as Record<string, unknown> | null
  const profile = patient?.profile as Record<string, string> | null
  return profile?.name ?? 'Paciente'
}

function getClinicName(apt: Record<string, unknown>) {
  const clinic = apt.clinic as Record<string, string> | null
  return clinic?.name ?? ''
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

async function loadAppointments() {
  loading.value = true
  error.value = null

  try {
    if (!doctorId.value) {
      const ok = await loadDoctorId()
      if (!ok) return
    }

    let query = supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        doctor_id,
        schedule_id,
        clinic_id,
        date,
        status,
        notes,
        cancellation_reason,
        updated_at,
        schedule:schedules(id, start_time, end_time),
        patient:patients(id, profile:profiles(name)),
        clinic:clinics(name)
      `)
      .eq('doctor_id', doctorId.value!)
      .neq('status', 'cancelled')

    if (dateFilter.value) {
      query = query.eq('date', dateFilter.value)
    }
    if (statusFilter.value !== 'all') {
      query = query.eq('status', statusFilter.value)
    }

    query = query.order('date', { ascending: true }).order('created_at', { ascending: true })

    const { data, error: e } = await query
    if (e) throw e
    appointments.value = (data ?? []) as Record<string, unknown>[]
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar consultas.'
  } finally {
    loading.value = false
  }
}

async function updateStatus(apt: Record<string, unknown>, status: AppointmentStatus, extra?: Record<string, unknown>) {
  const id = apt.id as string
  actionState[id] = status

  try {
    const { error: e } = await supabase
      .from('appointments')
      .update({ status, ...(extra ?? {}) })
      .eq('id', id)
      .eq('doctor_id', doctorId.value!)

    if (e) throw e

    toast.success(`Consulta ${statusLabels[status]}`)
    await loadAppointments()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível atualizar a consulta.')
  } finally {
    delete actionState[id]
  }
}

async function handleStart(apt: Record<string, unknown>) {
  await updateStatus(apt, 'in_progress')
}

async function handleComplete(apt: Record<string, unknown>) {
  const confirmed = await confirm.confirm({
    title: 'Concluir consulta',
    message: 'Deseja marcar esta consulta como concluída?',
    confirmText: 'Concluir',
    variant: 'info',
  })
  if (!confirmed) return
  await updateStatus(apt, 'completed')
}

async function handleNoShow(apt: Record<string, unknown>) {
  const patientName = getPatientName(apt)
  const confirmed = await confirm.confirm({
    title: 'Marcar como não comparecimento',
    message: `O paciente ${patientName} não compareceu à consulta?`,
    confirmText: 'Confirmar',
    variant: 'warning',
  })
  if (!confirmed) return
  await updateStatus(apt, 'no_show')
}

function isBusy(id: string) {
  return !!actionState[id]
}

onMounted(loadAppointments)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Minhas Consultas</h2>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div>
          <label for="date-filter" class="sr-only">Filtrar por data</label>
          <input
            id="date-filter"
            v-model="dateFilter"
            type="date"
            class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="status-filter" class="sr-only">Filtrar por status</label>
          <select
            id="status-filter"
            v-model="statusFilter"
            class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <button
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          @click="loadAppointments"
        >
          Aplicar filtros
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      <span class="ml-3 text-gray-600">Carregando...</span>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p class="text-red-700">{{ error }}</p>
      <button
        class="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        @click="loadAppointments"
      >
        Tentar novamente
      </button>
    </div>

    <div v-else-if="appointments.length === 0" class="rounded-lg border border-gray-200 bg-white p-10 text-center">
      <p class="text-gray-500">
        {{ dateFilter || statusFilter !== 'all' ? 'Nenhuma consulta encontrada com os filtros aplicados.' : 'Nenhuma consulta agendada.' }}
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Hora</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Paciente</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Clínica</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white">
            <tr v-for="apt in appointments" :key="apt.id as string" class="transition-colors hover:bg-gray-50">
              <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                {{ formatDate(apt.date as string) }}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                {{ formatTime((apt.schedule as Record<string, unknown> | undefined)?.start_time as string | undefined) }}
                {{ '–' }}
                {{ formatTime((apt.schedule as Record<string, unknown> | undefined)?.end_time as string | undefined) }}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                {{ getPatientName(apt) }}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                {{ getClinicName(apt) || '—' }}
              </td>
              <td class="whitespace-nowrap px-6 py-4">
                <span
                  class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="statusColors[apt.status as string] || 'bg-gray-100 text-gray-800'"
                >
                  {{ statusLabels[apt.status as string] || apt.status }}
                </span>
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    v-if="canStart(apt)"
                    class="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="isBusy(apt.id as string)"
                    @click="handleStart(apt)"
                  >
                    {{ isBusy(apt.id as string) ? '...' : 'Iniciar' }}
                  </button>
                  <button
                    v-if="canComplete(apt)"
                    class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="isBusy(apt.id as string)"
                    @click="handleComplete(apt)"
                  >
                    {{ isBusy(apt.id as string) ? '...' : 'Concluir' }}
                  </button>
                  <button
                    v-if="canNoShow(apt)"
                    class="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="isBusy(apt.id as string)"
                    @click="handleNoShow(apt)"
                  >
                    {{ isBusy(apt.id as string) ? '...' : 'Não compareceu' }}
                  </button>
                  <span v-if="!canStart(apt) && !canComplete(apt) && !canNoShow(apt)" class="text-xs text-gray-400">
                    Sem ações
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
