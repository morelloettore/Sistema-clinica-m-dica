<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 class="text-2xl font-bold text-gray-900">Gerenciar Consultas</h1>
      <button
        @click="openCreateModal"
        class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Nova Consulta
      </button>
    </div>

    <div class="bg-white rounded-lg shadow border border-gray-200 p-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label for="filter-date-from" class="block text-xs font-medium text-gray-500 mb-1">Data Início</label>
          <input
            id="filter-date-from"
            v-model="filters.dateFrom"
            type="date"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label for="filter-date-to" class="block text-xs font-medium text-gray-500 mb-1">Data Fim</label>
          <input
            id="filter-date-to"
            v-model="filters.dateTo"
            type="date"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label for="filter-status" class="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            id="filter-status"
            v-model="filters.status"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos</option>
            <option value="scheduled">Agendada</option>
            <option value="confirmed">Confirmada</option>
            <option value="checked_in">Check-in</option>
            <option value="completed">Concluída</option>
            <option value="cancelled">Cancelada</option>
            <option value="no_show">Não compareceu</option>
          </select>
        </div>
        <div>
          <label for="filter-doctor" class="block text-xs font-medium text-gray-500 mb-1">Médico</label>
          <select
            id="filter-doctor"
            v-model="filters.doctorId"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos</option>
            <option v-for="doc in doctorsList" :key="doc.id" :value="doc.id">
              {{ doc.profile?.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      {{ error }}
    </div>

    <div v-else-if="appointments.length === 0" class="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
      Nenhuma consulta encontrada.
    </div>

    <div v-else class="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Horário</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paciente</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Médico</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clínica</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="apt in appointments" :key="apt.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-900">{{ formatDate(apt.date) }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">
              {{ apt.schedule?.start_time?.slice(0, 5) }} - {{ apt.schedule?.end_time?.slice(0, 5) }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ apt.patient?.profile?.name ?? '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ apt.doctor?.profile?.name ?? '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ apt.clinic?.name ?? '—' }}</td>
            <td class="px-4 py-3 text-sm">
              <span :class="statusBadgeClass(apt.status)" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                {{ statusLabel(apt.status) }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <div class="flex items-center gap-2">
                <button
                  v-if="apt.status === 'scheduled'"
                  @click="confirmAppointment(apt)"
                  :disabled="actingId === apt.id"
                  class="text-green-600 hover:text-green-800 disabled:opacity-50 text-xs font-medium"
                  title="Confirmar"
                >
                  Confirmar
                </button>
                <button
                  v-if="apt.status === 'confirmed'"
                  @click="checkInAppointment(apt)"
                  :disabled="actingId === apt.id"
                  class="text-yellow-600 hover:text-yellow-800 disabled:opacity-50 text-xs font-medium"
                  title="Check-in"
                >
                  Check-in
                </button>
                <button
                  v-if="apt.status === 'scheduled' || apt.status === 'confirmed'"
                  @click="openCancelModal(apt)"
                  :disabled="actingId === apt.id"
                  class="text-red-600 hover:text-red-800 disabled:opacity-50 text-xs font-medium"
                  title="Cancelar"
                >
                  Cancelar
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <p class="text-sm text-gray-500">
        Página {{ page }} de {{ totalPages }} ({{ total }} registros)
      </p>
      <div class="flex gap-2">
        <button
          @click="page--; loadAppointments()"
          :disabled="page <= 1"
          class="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          @click="page++; loadAppointments()"
          :disabled="page >= totalPages"
          class="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Próxima
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showCancelModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showCancelModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
          <h2 class="text-lg font-semibold text-gray-900 mb-2">Cancelar Consulta</h2>
          <p class="text-sm text-gray-600 mb-4">
            Tem certeza que deseja cancelar esta consulta?
          </p>
          <div class="mb-4">
            <label for="cancel-reason" class="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <textarea
              id="cancel-reason"
              v-model="cancelReason"
              rows="3"
              maxlength="500"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Informe o motivo do cancelamento..."
            />
          </div>
          <div class="flex justify-end gap-3">
            <button
              @click="showCancelModal = false"
              class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Voltar
            </button>
            <button
              @click="cancelAppointment"
              :disabled="actingId !== null"
              class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {{ actingId !== null ? 'Cancelando...' : 'Sim, Cancelar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4 my-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Nova Consulta</h2>

          <form @submit.prevent="createAppointment" class="space-y-4">
            <div>
              <label for="apt-patient" class="block text-sm font-medium text-gray-700 mb-1">Paciente *</label>
              <select
                id="apt-patient"
                v-model="createForm.patient_id"
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="" disabled>Selecione um paciente</option>
                <option v-for="p in patientsList" :key="p.id" :value="p.profile_id">
                  {{ p.profile?.name }} — {{ p.profile?.cpf }}
                </option>
              </select>
            </div>

            <div>
              <label for="apt-specialty" class="block text-sm font-medium text-gray-700 mb-1">Especialidade *</label>
              <select
                id="apt-specialty"
                v-model="createForm.specialty_id"
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                @change="loadDoctorsForSpecialty"
              >
                <option value="" disabled>Selecione uma especialidade</option>
                <option v-for="s in specialtiesList" :key="s.id" :value="s.id">
                  {{ s.name }}
                </option>
              </select>
            </div>

            <div>
              <label for="apt-doctor" class="block text-sm font-medium text-gray-700 mb-1">Médico *</label>
              <select
                id="apt-doctor"
                v-model="createForm.doctor_id"
                required
                :disabled="!createForm.specialty_id"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                @change="loadAvailableSchedules"
              >
                <option value="" disabled>Selecione um médico</option>
                <option v-for="d in filteredDoctors" :key="d.id" :value="d.id">
                  {{ d.profile?.name }}
                </option>
              </select>
            </div>

            <div>
              <label for="apt-schedule" class="block text-sm font-medium text-gray-700 mb-1">Horário disponível *</label>
              <select
                id="apt-schedule"
                v-model="createForm.schedule_id"
                required
                :disabled="!createForm.doctor_id"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                @change="fillClinicFromSchedule"
              >
                <option value="" disabled>Selecione um horário</option>
                <option v-for="s in availableSchedules" :key="s.id" :value="s.id">
                  {{ formatDate(s.date) }} — {{ s.start_time?.slice(0, 5) }} a {{ s.end_time?.slice(0, 5) }} ({{ s.available_slots }} vagas)
                </option>
              </select>
            </div>

            <div>
              <label for="apt-notes" class="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                id="apt-notes"
                v-model="createForm.notes"
                rows="2"
                maxlength="500"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div v-if="createError" class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {{ createError }}
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                @click="showCreateModal = false"
                class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="creating"
                class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {{ creating ? 'Criando...' : 'Criar Consulta' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const loading = ref(true)
const creating = ref(false)
const error = ref('')
const createError = ref('')
const appointments = ref<any[]>([])
const doctorsList = ref<any[]>([])
const patientsList = ref<any[]>([])
const specialtiesList = ref<any[]>([])
const filteredDoctors = ref<any[]>([])
const availableSchedules = ref<any[]>([])

const page = ref(1)
const total = ref(0)
const perPage = 20
const totalPages = computed(() => Math.ceil(total.value / perPage))
const actingId = ref<string | null>(null)

const showCancelModal = ref(false)
const cancelReason = ref('')
const cancelTarget = ref<any>(null)

const showCreateModal = ref(false)
const createForm = reactive({
  patient_id: '',
  doctor_id: '',
  schedule_id: '',
  clinic_id: '',
  specialty_id: '',
  notes: '',
})

const filters = reactive({
  dateFrom: '',
  dateTo: '',
  status: '' as '' | import('@clinica/shared').AppointmentStatus,
  doctorId: '',
})

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
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

async function loadAppointments() {
  loading.value = true
  error.value = ''
  try {
    let query = supabase
      .from('appointments')
      .select(
        `id, date, status, notes, cancellation_reason, created_at,
         patient:patients(id, profile:profiles(name)),
         doctor:doctors(id, profile:profiles(name)),
         schedule:schedules(id, start_time, end_time, clinic_id, date),
         clinic:clinics(name)`,
        { count: 'exact' },
      )

    if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('date', filters.dateTo)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.doctorId) query = query.eq('doctor_id', filters.doctorId)

    const offset = (page.value - 1) * perPage
    const { data, count, error: err } = await query
      .order('date', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (err) throw err
    appointments.value = data ?? []
    total.value = count ?? 0
  } catch (e: any) {
    error.value = e.message ?? 'Erro ao carregar consultas.'
  } finally {
    loading.value = false
  }
}

async function loadDoctors() {
  const { data } = await supabase
    .from('doctors')
    .select('id, profile:profiles(name, id), doctor_specialties(specialty_id)')
    .eq('is_active', true)
  doctorsList.value = data ?? []
}

async function loadPatients() {
  const { data } = await supabase
    .from('patients')
    .select('id, profile_id, profile:profiles(name, cpf)')
  patientsList.value = data ?? []
}

async function loadSpecialties() {
  const { data } = await supabase
    .from('specialties')
    .select('id, name')
    .eq('is_active', true)
  specialtiesList.value = data ?? []
}

function loadDoctorsForSpecialty() {
  const specId = createForm.specialty_id
  if (!specId) { filteredDoctors.value = []; return }
  filteredDoctors.value = doctorsList.value.filter((d: any) =>
    d.doctor_specialties?.some((ds: any) => ds.specialty_id === specId),
  )
  createForm.doctor_id = ''
  createForm.schedule_id = ''
  availableSchedules.value = []
}

async function loadAvailableSchedules() {
  const doctorId = createForm.doctor_id
  if (!doctorId) { availableSchedules.value = []; return }
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('schedules')
    .select('id, date, start_time, end_time, available_slots, clinic_id')
    .eq('doctor_id', doctorId)
    .gte('date', today)
    .gt('available_slots', 0)
    .eq('is_active', true)
    .order('date')
    .order('start_time')
  availableSchedules.value = data ?? []
  createForm.schedule_id = ''
}

function fillClinicFromSchedule() {
  const sched = availableSchedules.value.find((s: any) => s.id === createForm.schedule_id)
  createForm.clinic_id = sched?.clinic_id ?? ''
}

async function openCreateModal() {
  createForm.patient_id = ''
  createForm.doctor_id = ''
  createForm.schedule_id = ''
  createForm.clinic_id = ''
  createForm.specialty_id = ''
  createForm.notes = ''
  createError.value = ''
  filteredDoctors.value = []
  availableSchedules.value = []
  showCreateModal.value = true
  await Promise.all([loadDoctors(), loadPatients(), loadSpecialties()])
}

async function createAppointment() {
  creating.value = true
  createError.value = ''
  try {
    const sched = availableSchedules.value.find((s: any) => s.id === createForm.schedule_id)
    if (!sched) throw new Error('Horário inválido.')

    const { error: err } = await supabase.from('appointments').insert({
      patient_id: createForm.patient_id,
      doctor_id: createForm.doctor_id,
      schedule_id: createForm.schedule_id,
      clinic_id: sched.clinic_id,
      date: sched.date,
      status: 'scheduled',
      notes: createForm.notes || null,
    })
    if (err) throw err

    showCreateModal.value = false
    await loadAppointments()
  } catch (e: any) {
    createError.value = e.message ?? 'Erro ao criar consulta.'
  } finally {
    creating.value = false
  }
}

async function confirmAppointment(apt: any) {
  actingId.value = apt.id
  try {
    const { error: err } = await supabase
      .from('appointments')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', apt.id)
      .eq('status', 'scheduled')
    if (err) throw err
    await loadAppointments()
  } catch (e: any) {
    error.value = e.message ?? 'Erro ao confirmar consulta.'
  } finally {
    actingId.value = null
  }
}

async function checkInAppointment(apt: any) {
  actingId.value = apt.id
  try {
    const { error: err } = await supabase
      .from('appointments')
      .update({ status: 'checked_in', updated_at: new Date().toISOString() })
      .eq('id', apt.id)
      .eq('status', 'confirmed')
    if (err) throw err
    await loadAppointments()
  } catch (e: any) {
    error.value = e.message ?? 'Erro ao realizar check-in.'
  } finally {
    actingId.value = null
  }
}

function openCancelModal(apt: any) {
  cancelTarget.value = apt
  cancelReason.value = ''
  showCancelModal.value = true
}

async function cancelAppointment() {
  if (!cancelTarget.value) return
  actingId.value = cancelTarget.value.id
  try {
    const { error: err } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancellation_reason: cancelReason.value || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cancelTarget.value.id)
      .in('status', ['scheduled', 'confirmed'])
    if (err) throw err
    showCancelModal.value = false
    await loadAppointments()
  } catch (e: any) {
    error.value = e.message ?? 'Erro ao cancelar consulta.'
  } finally {
    actingId.value = null
    cancelTarget.value = null
  }
}

function watchFilters() {
  const deep = JSON.stringify(filters)
  let prev = deep
  setInterval(() => {
    const now = JSON.stringify(filters)
    if (now !== prev) {
      prev = now
      page.value = 1
      loadAppointments()
    }
  }, 500)
}

onMounted(async () => {
  await loadAppointments()
  watchFilters()
})
</script>
