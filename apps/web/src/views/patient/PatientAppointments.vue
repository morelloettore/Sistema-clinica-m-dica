<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Minhas Consultas</h1>
      <router-link
        to="/patient/appointments/book"
        class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Agendar Consulta
      </router-link>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div class="sm:w-48">
        <label class="mb-1 block text-sm font-medium text-gray-700">Status</label>
        <select
          v-model="filterStatus"
          class="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Todos</option>
          <option value="scheduled">Agendada</option>
          <option value="confirmed">Confirmada</option>
          <option value="completed">Concluida</option>
          <option value="cancelled">Cancelada</option>
          <option value="no_show">Nao compareceu</option>
        </select>
      </div>
      <div class="sm:w-44">
        <label class="mb-1 block text-sm font-medium text-gray-700">Data inicial</label>
        <input
          v-model="filterDateFrom"
          type="date"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      <div class="sm:w-44">
        <label class="mb-1 block text-sm font-medium text-gray-700">Data final</label>
        <input
          v-model="filterDateTo"
          type="date"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
    </div>

    <AppTable
      :columns="columns"
      :data="appointments"
      :loading="loading"
      empty-message="Nenhuma consulta encontrada."
      row-key="id"
    >
      <template #cell-date="{ value }">
        {{ formatDate(value as string) }}
      </template>
      <template #cell-schedule_start="{ row }">
        {{ (row as AppointmentRow).schedule_start?.slice(0, 5) ?? '—' }}
      </template>
      <template #cell-doctor_name="{ value }">
        Dr(a). {{ value ?? '—' }}
      </template>
      <template #cell-specialty_name="{ value }">
        {{ value ?? '—' }}
      </template>
      <template #cell-clinic_name="{ value }">
        {{ value ?? '—' }}
      </template>
      <template #cell-status="{ value }">
        <span
          :class="statusBadgeClass(value as string)"
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
        >
          {{ statusLabel(value as string) }}
        </span>
      </template>
      <template #cell-actions="{ row }">
        <button
          v-if="canCancel(row as AppointmentRow)"
          class="text-sm font-medium text-red-600 hover:text-red-700"
          @click="handleCancel(row as AppointmentRow)"
        >
          Cancelar
        </button>
      </template>
    </AppTable>

    <AppPagination
      v-if="totalPages > 1"
      v-model:page="page"
      :total-pages="totalPages"
    />

    <Teleport to="body">
      <div v-if="cancelModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
          <h2 class="text-lg font-semibold text-gray-900">Cancelar Consulta</h2>
          <p class="mt-2 text-sm text-gray-500">Tem certeza que deseja cancelar esta consulta?</p>
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700">Motivo (opcional)</label>
            <textarea
              v-model="cancelReason"
              rows="3"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
            />
          </div>
          <div class="mt-4 flex justify-end gap-3">
            <AppButton variant="secondary" @click="cancelModalOpen = false">Voltar</AppButton>
            <AppButton variant="danger" :loading="cancelling" @click="confirmCancel">
              Sim, cancelar
            </AppButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import AppTable from '@/components/common/AppTable.vue'
import AppPagination from '@/components/common/AppPagination.vue'
import AppButton from '@/components/common/AppButton.vue'

interface AppointmentRow extends Record<string, any> {
  id: string
  date: string
  status: string
  schedule_start: string
  doctor_name: string
  specialty_name: string
  clinic_name: string
  schedule_id: string
}

const columns = [
  { key: 'date', label: 'Data' },
  { key: 'schedule_start', label: 'Horario' },
  { key: 'doctor_name', label: 'Medico' },
  { key: 'specialty_name', label: 'Especialidade' },
  { key: 'clinic_name', label: 'Clinica' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Acoes' },
]

const loading = ref(true)
const appointments = ref<AppointmentRow[]>([])
const page = ref(1)
const perPage = 20
const total = ref(0)
const totalPages = computed(() => Math.ceil(total.value / perPage))
const filterStatus = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')
const cancelModalOpen = ref(false)
const cancelling = ref(false)
const cancelReason = ref('')
const selectedAppointment = ref<AppointmentRow | null>(null)

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
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

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-orange-100 text-orange-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

function canCancel(row: AppointmentRow): boolean {
  return row.status === 'scheduled' || row.status === 'confirmed'
}

function handleCancel(row: AppointmentRow) {
  selectedAppointment.value = row
  cancelReason.value = ''
  cancelModalOpen.value = true
}

async function confirmCancel() {
  if (!selectedAppointment.value) return
  cancelling.value = true
  try {
    const { error } = await supabase.functions.invoke('cancel-appointment', {
      body: {
        appointment_id: selectedAppointment.value.id,
        cancellation_reason: cancelReason.value || undefined,
      },
    })
    if (error) throw error
    cancelModalOpen.value = false
    await fetchAppointments()
  } catch {
    cancelModalOpen.value = false
  } finally {
    cancelling.value = false
  }
}

async function fetchAppointments() {
  loading.value = true
  try {
    let query = supabase
      .from('appointments')
      .select(
        `id, date, status, schedule_id,
         doctor:doctors(id, profile:profiles(name), doctor_specialties(specialty:specialties(name))),
         schedule:schedules(start_time),
         clinic:clinics(name)`,
        { count: 'exact' },
      )

    if (filterStatus.value) query = query.eq('status', filterStatus.value as any)
    if (filterDateFrom.value) query = query.gte('date', filterDateFrom.value)
    if (filterDateTo.value) query = query.lte('date', filterDateTo.value)

    const offset = (page.value - 1) * perPage
    const { data, count } = await query
      .order('date', { ascending: false })
      .range(offset, offset + perPage - 1)

    total.value = count ?? 0
    appointments.value = (data ?? []).map((apt: any) => {
      const doctor = apt.doctor as any
      const profile = doctor?.profile as any
      const ds = doctor?.doctor_specialties as any[] | null
      const firstSpec = ds?.[0] as any | undefined
      const spec = firstSpec?.specialty as any | undefined
      const schedule = apt.schedule as any
      const clinic = apt.clinic as any
      return {
        id: String(apt.id),
        date: String(apt.date),
        status: String(apt.status),
        schedule_id: String(apt.schedule_id),
        schedule_start: (schedule?.start_time as string) ?? null,
        doctor_name: (profile?.name as string) ?? null,
        specialty_name: (spec?.name as string) ?? null,
        clinic_name: (clinic?.name as string) ?? null,
      }
    })
  } finally {
    loading.value = false
  }
}

watch([filterStatus, filterDateFrom, filterDateTo], () => {
  page.value = 1
  fetchAppointments()
})

watch(page, () => fetchAppointments())

onMounted(() => fetchAppointments())
</script>
