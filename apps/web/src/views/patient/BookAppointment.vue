<template>
  <div class="space-y-6">
    <div>
      <router-link to="/patient/appointments" class="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Voltar
      </router-link>
      <h1 class="text-2xl font-bold text-gray-900">Agendar Consulta</h1>
    </div>

    <div class="flex items-center gap-2">
      <template v-for="(s, i) in steps" :key="i">
        <div class="flex items-center gap-2">
          <div
            :class="[
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
              step > i + 1 ? 'bg-green-600 text-white' : step === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500',
            ]"
          >
            <svg v-if="step > i + 1" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>{{ i + 1 }}</span>
          </div>
          <span class="hidden text-xs text-gray-500 sm:inline">{{ s }}</span>
        </div>
        <div v-if="i < steps.length - 1" class="hidden h-px w-8 bg-gray-300 sm:block" />
      </template>
    </div>

    <LoadingSpinner v-if="stepLoading" />

    <AppCard v-else>
      <div v-if="stepError" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
        {{ stepError }}
      </div>

      <div v-if="bookingSuccess" class="py-8 text-center">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg class="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-gray-900">Consulta agendada com sucesso!</h2>
        <p class="mt-2 text-sm text-gray-500">Voce sera redirecionado para suas consultas.</p>
      </div>

      <template v-else>
        <!-- STEP 1: Select Specialty -->
        <div v-if="step === 1">
          <h2 class="mb-4 text-lg font-semibold text-gray-900">Selecione a Especialidade</h2>
          <div v-if="specialties.length === 0" class="text-sm text-gray-500">Nenhuma especialidade disponivel.</div>
          <div class="grid gap-3 sm:grid-cols-2">
            <button
              v-for="spec in specialties"
              :key="spec.id"
              :class="[
                'rounded-lg border p-4 text-left transition-colors',
                selectedSpecialty?.id === spec.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'hover:border-gray-400 hover:bg-gray-50',
              ]"
              @click="selectedSpecialty = spec"
            >
              <p class="font-medium text-gray-900">{{ spec.name }}</p>
              <p v-if="spec.description" class="mt-1 text-xs text-gray-500">{{ spec.description }}</p>
            </button>
          </div>
        </div>

        <!-- STEP 2: Select Clinic -->
        <div v-if="step === 2">
          <h2 class="mb-4 text-lg font-semibold text-gray-900">Selecione a Clinica</h2>
          <div v-if="clinics.length === 0" class="text-sm text-gray-500">
            Nenhuma clinica disponivel para esta especialidade.
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <button
              v-for="clinic in clinics"
              :key="clinic.id"
              :class="[
                'rounded-lg border p-4 text-left transition-colors',
                selectedClinic?.id === clinic.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'hover:border-gray-400 hover:bg-gray-50',
              ]"
              @click="selectedClinic = clinic"
            >
              <p class="font-medium text-gray-900">{{ clinic.name }}</p>
              <p v-if="clinic.address" class="mt-1 text-xs text-gray-500">{{ clinic.address }}</p>
            </button>
          </div>
        </div>

        <!-- STEP 3: Select Doctor (optional) -->
        <div v-if="step === 3">
          <h2 class="mb-4 text-lg font-semibold text-gray-900">Selecione o Medico</h2>
          <div v-if="doctors.length === 0" class="text-sm text-gray-500">
            Nenhum medico disponivel. Prossiga para escolher horario.
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <button
              v-for="doc in doctors"
              :key="doc.id"
              :class="[
                'rounded-lg border p-4 text-left transition-colors',
                selectedDoctor?.id === doc.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'hover:border-gray-400 hover:bg-gray-50',
              ]"
              @click="selectedDoctor = doc"
            >
              <p class="font-medium text-gray-900">Dr(a). {{ doc.name }}</p>
              <p v-if="doc.crm" class="mt-1 text-xs text-gray-500">CRM: {{ doc.crm }}</p>
            </button>
          </div>
        </div>

        <!-- STEP 4: Select Date & Time -->
        <div v-if="step === 4">
          <h2 class="mb-4 text-lg font-semibold text-gray-900">Selecione Data e Horario</h2>

          <div class="mb-4">
            <label class="mb-1 block text-sm font-medium text-gray-700">Data</label>
            <input
              v-model="selectedDate"
              type="date"
              :min="todayStr"
              class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 sm:w-64"
              @change="fetchAvailableSlots"
            />
          </div>

          <LoadingSpinner v-if="slotsLoading" />

          <div v-else-if="selectedDate && availableSlots.length === 0" class="text-sm text-gray-500">
            Nenhum horario disponivel para esta data.
          </div>

          <div v-else-if="availableSlots.length > 0" class="grid gap-3 sm:grid-cols-3">
            <button
              v-for="slot in availableSlots"
              :key="slot.id"
              :class="[
                'rounded-lg border p-4 text-center transition-colors',
                selectedSchedule?.id === slot.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'hover:border-gray-400 hover:bg-gray-50',
              ]"
              @click="selectedSchedule = slot"
            >
              <p class="text-lg font-semibold text-gray-900">{{ slot.start_time?.slice(0, 5) }}</p>
              <p class="mt-1 text-xs text-gray-500">{{ slot.available_slots }} vaga(s)</p>
            </button>
          </div>
        </div>

        <!-- STEP 5: Confirm -->
        <div v-if="step === 5">
          <h2 class="mb-4 text-lg font-semibold text-gray-900">Confirmar Agendamento</h2>

          <div class="space-y-3 rounded-lg border bg-gray-50 p-4">
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Especialidade</span>
              <span class="text-sm font-medium text-gray-900">{{ selectedSpecialty?.name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Clinica</span>
              <span class="text-sm font-medium text-gray-900">{{ selectedClinic?.name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Medico</span>
              <span class="text-sm font-medium text-gray-900">
                {{ selectedDoctor ? `Dr(a). ${selectedDoctor.name}` : 'A definir' }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Data</span>
              <span class="text-sm font-medium text-gray-900">{{ formatDateDisplay(selectedDate!) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Horario</span>
              <span class="text-sm font-medium text-gray-900">{{ selectedSchedule?.start_time?.slice(0, 5) }}</span>
            </div>
          </div>

          <div v-if="bookingError" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {{ bookingError }}
          </div>

          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700">Observacoes (opcional)</label>
            <textarea
              v-model="notes"
              rows="2"
              maxlength="500"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
            />
          </div>
        </div>
      </template>

      <div v-if="!bookingSuccess" class="mt-6 flex justify-between">
        <AppButton variant="secondary" :disabled="step <= 1 || bookingSubmitting" @click="prevStep">
          Anterior
        </AppButton>
        <AppButton
          v-if="step < 5"
          :disabled="!canProceed"
          @click="nextStep"
        >
          Proximo
        </AppButton>
        <AppButton
          v-if="step === 5"
          :loading="bookingSubmitting"
          :disabled="bookingSubmitting"
          @click="handleBooking"
        >
          Confirmar Agendamento
        </AppButton>
      </div>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/common/AppCard.vue'
import AppButton from '@/components/common/AppButton.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

interface Specialty { id: string; name: string; description: string | null }
interface Clinic { id: string; name: string; address: string | null }
interface Doctor { id: string; name: string; crm: string | null }
interface Schedule { id: string; start_time: string; end_time: string; available_slots: number; clinic_id: string; doctor_id: string }

const router = useRouter()
const steps = ['Especialidade', 'Clinica', 'Medico', 'Horario', 'Confirmar']

const step = ref(1)
const stepLoading = ref(false)
const stepError = ref('')

const specialties = ref<Specialty[]>([])
const clinics = ref<Clinic[]>([])
const doctors = ref<Doctor[]>([])
const availableSlots = ref<Schedule[]>([])
const slotsLoading = ref(false)

const selectedSpecialty = ref<Specialty | null>(null)
const selectedClinic = ref<Clinic | null>(null)
const selectedDoctor = ref<Doctor | null>(null)
const selectedDate = ref<string | null>(null)
const selectedSchedule = ref<Schedule | null>(null)
const notes = ref('')

const bookingSubmitting = ref(false)
const bookingError = ref('')
const bookingSuccess = ref(false)

const todayStr = computed(() => new Date().toISOString().slice(0, 10))

const canProceed = computed(() => {
  if (step.value === 1) return !!selectedSpecialty.value
  if (step.value === 2) return !!selectedClinic.value
  if (step.value === 3) return true
  if (step.value === 4) return !!selectedSchedule.value
  return false
})

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

async function fetchSpecialties() {
  stepLoading.value = true
  stepError.value = ''
  try {
    const { data, error } = await supabase
      .from('specialties')
      .select('id, name, description')
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    specialties.value = data ?? []
  } catch {
    stepError.value = 'Erro ao carregar especialidades.'
  } finally {
    stepLoading.value = false
  }
}

async function fetchClinics() {
  if (!selectedSpecialty.value) return
  stepLoading.value = true
  stepError.value = ''
  try {
    const { data: dsData, error: dsErr } = await supabase
      .from('doctor_specialties')
      .select('doctor_id')
      .eq('specialty_id', selectedSpecialty.value.id)
    if (dsErr) throw dsErr

    const doctorIds = (dsData ?? []).map((d: any) => d.doctor_id)
    if (doctorIds.length === 0) { clinics.value = []; return }

    const { data: dcData, error: dcErr } = await supabase
      .from('doctor_clinics')
      .select('clinic_id')
      .in('doctor_id', doctorIds)
    if (dcErr) throw dcErr

    const clinicIds = [...new Set((dcData ?? []).map((d: any) => d.clinic_id))]
    if (clinicIds.length === 0) { clinics.value = []; return }

    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, address')
      .in('id', clinicIds)
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    clinics.value = data ?? []
  } catch {
    stepError.value = 'Erro ao carregar clinicas.'
  } finally {
    stepLoading.value = false
  }
}

async function fetchDoctors() {
  if (!selectedSpecialty.value || !selectedClinic.value) return
  stepLoading.value = true
  stepError.value = ''
  try {
    const { data: dsData, error: dsErr } = await supabase
      .from('doctor_specialties')
      .select('doctor_id')
      .eq('specialty_id', selectedSpecialty.value.id)
    if (dsErr) throw dsErr

    const specDoctorIds = (dsData ?? []).map((d: any) => d.doctor_id)

    const { data: dcData, error: dcErr } = await supabase
      .from('doctor_clinics')
      .select('doctor_id')
      .eq('clinic_id', selectedClinic.value.id)
      .in('doctor_id', specDoctorIds)
    if (dcErr) throw dcErr

    const doctorIds = (dcData ?? []).map((d: any) => d.doctor_id)
    if (doctorIds.length === 0) { doctors.value = []; return }

    const { data, error } = await supabase
      .from('doctors')
      .select('id, crm, profile:profiles(name)')
      .in('id', doctorIds)
      .eq('is_active', true)
    if (error) throw error

    doctors.value = (data ?? []).map((d: any) => ({
      id: d.id as string,
      name: (d.profile?.name as string) ?? '',
      crm: d.crm as string | null,
    }))
  } catch {
    stepError.value = 'Erro ao carregar medicos.'
  } finally {
    stepLoading.value = false
  }
}

async function fetchAvailableSlots() {
  if (!selectedDate.value) return
  slotsLoading.value = true
  try {
    let query = supabase
      .from('schedules')
      .select('id, doctor_id, clinic_id, start_time, end_time, available_slots')
      .eq('date', selectedDate.value)
      .gt('available_slots', 0)
      .eq('is_active', true)

    if (selectedDoctor.value) {
      query = query.eq('doctor_id', selectedDoctor.value.id)
    } else if (selectedClinic.value) {
      const docIds = doctors.value.map(d => d.id)
      if (docIds.length > 0) {
        query = query.in('doctor_id', docIds)
      }
      query = query.eq('clinic_id', selectedClinic.value.id)
    }

    const { data, error } = await query.order('start_time')
    if (error) throw error
    availableSlots.value = data ?? []
    selectedSchedule.value = null
  } finally {
    slotsLoading.value = false
  }
}

async function nextStep() {
  stepError.value = ''
  step.value++
  if (step.value === 2) await fetchClinics()
  if (step.value === 3) await fetchDoctors()
}

function prevStep() {
  stepError.value = ''
  step.value--
}

async function handleBooking() {
  if (!selectedSchedule.value || !selectedSpecialty.value || !selectedClinic.value || !selectedDate.value) return
  bookingSubmitting.value = true
  bookingError.value = ''
  try {
    const payload = {
      doctor_id: selectedSchedule.value.doctor_id,
      schedule_id: selectedSchedule.value.id,
      clinic_id: selectedSchedule.value.clinic_id,
      date: selectedDate.value,
      notes: notes.value || undefined,
    }
    const { error } = await supabase.functions.invoke('book-appointment', { body: payload })
    if (error) {
      throw new Error((error as any).message || 'Erro ao agendar consulta.')
    }
    bookingSuccess.value = true
    setTimeout(() => router.push('/patient/appointments'), 2000)
  } catch (e: unknown) {
    bookingError.value = e instanceof Error ? e.message : 'Erro ao agendar consulta.'
  } finally {
    bookingSubmitting.value = false
  }
}

onMounted(() => fetchSpecialties())
</script>
