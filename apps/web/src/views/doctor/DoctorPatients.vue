<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()

const loading = ref(true)
const error = ref<string | null>(null)
const doctorId = ref<string | null>(null)

interface PatientListItem {
  id: string
  name: string
  cpf: string | null
  lastVisit: string | null
  healthPlans: { name: string }[]
}

const patients = ref<PatientListItem[]>([])
const searchQuery = ref('')

const selectedPatient = ref<any>(null)
const selectedPatientRecords = ref<any[]>([])
const patientDetailLoading = ref(false)
const showDetailModal = ref(false)

function formatCpf(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatDate(date: string | null) {
  if (!date) return '—'
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

async function loadPatients() {
  loading.value = true
  error.value = null

  try {
    if (!doctorId.value) {
      const ok = await loadDoctorId()
      if (!ok) return
    }

    const { data: appts, error: e1 } = await supabase
      .from('appointments')
      .select(`
        patient_id,
        date,
        patient:patients(
          id,
          profile:profiles(name, cpf)
        )
      `)
      .eq('doctor_id', doctorId.value!)
      .neq('status', 'cancelled')
      .order('date', { ascending: false })

    if (e1) throw e1

    const map = new Map<string, { name: string; cpf: string | null; lastVisit: string | null }>()

    for (const a of (appts ?? []) as Record<string, unknown>[]) {
      const patient = a.patient as Record<string, unknown> | null
      if (!patient) continue
      const profile = patient.profile as Record<string, string> | null
      if (!profile) continue
      const pid = patient.id as string
      if (!map.has(pid)) {
        map.set(pid, {
          name: profile.name,
          cpf: profile.cpf ?? null,
          lastVisit: a.date as string | null,
        })
      }
    }

    const patientIds = Array.from(map.keys())

    let planMap = new Map<string, { name: string }[]>()
    if (patientIds.length > 0) {
      const { data: plans, error: e2 } = await supabase
        .from('patient_health_plans')
        .select(`patient_id, health_plan:health_plans(name)`)
        .in('patient_id', patientIds)
        .is('end_date', null)

      if (!e2) {
        for (const p of (plans ?? []) as Record<string, unknown>[]) {
          const hp = p.health_plan as Record<string, string> | null
          const pid = p.patient_id as string
          if (!hp) continue
          if (!planMap.has(pid)) planMap.set(pid, [])
          planMap.get(pid)!.push({ name: hp.name })
        }
      }
    }

    const list: PatientListItem[] = []
    for (const [pid, info] of map) {
      list.push({
        id: pid,
        name: info.name,
        cpf: info.cpf,
        lastVisit: info.lastVisit,
        healthPlans: planMap.get(pid) ?? [],
      })
    }

    patients.value = list.sort((a, b) => a.name.localeCompare(b.name))
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar pacientes.'
  } finally {
    loading.value = false
  }
}

const filteredPatients = () => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return patients.value
  return patients.value.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.cpf ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
  )
}

async function openPatient(patient: PatientListItem) {
  selectedPatient.value = patient
  showDetailModal.value = true
  patientDetailLoading.value = true
  selectedPatientRecords.value = []

  try {
    const { data, error: e } = await supabase
      .from('medical_records')
      .select(`
        id,
        diagnosis,
        prescription,
        notes,
        next_appointment_date,
        created_at,
        appointment:appointments(date, status)
      `)
      .eq('patient_id', patient.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (e) throw e
    selectedPatientRecords.value = (data ?? []) as unknown as any[]
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Erro ao carregar histórico médico.')
  } finally {
    patientDetailLoading.value = false
  }
}

function closeDetail() {
  showDetailModal.value = false
  selectedPatient.value = null
  selectedPatientRecords.value = []
}

onMounted(loadPatients)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Meus Pacientes</h2>
      <div>
        <label for="patient-search" class="sr-only">Buscar paciente</label>
        <input
          id="patient-search"
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por nome ou CPF..."
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-72"
        />
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
        @click="loadPatients"
      >
        Tentar novamente
      </button>
    </div>

    <div v-else-if="filteredPatients().length === 0" class="rounded-lg border border-gray-200 bg-white p-10 text-center">
      <p class="text-gray-500">
        {{ searchQuery ? 'Nenhum paciente encontrado com a busca.' : 'Nenhum paciente ainda.' }}
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Nome</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">CPF</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Última Visita</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Plano de Saúde</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white">
            <tr v-for="p in filteredPatients()" :key="p.id" class="transition-colors hover:bg-gray-50">
              <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{{ p.name }}</td>
              <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{{ formatCpf(p.cpf) }}</td>
              <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{{ formatDate(p.lastVisit) }}</td>
              <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                <span
                  v-if="p.healthPlans.length > 0"
                  class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                >
                  {{ p.healthPlans[0].name }}
                </span>
                <span v-else class="text-gray-400">Sem plano</span>
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-right">
                <button
                  class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  @click="openPatient(p)"
                >
                  Ver detalhes
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="showDetailModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-detail-title"
    >
      <div class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 id="patient-detail-title" class="text-lg font-semibold text-gray-900">
            Detalhes do Paciente
          </h3>
          <button
            class="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fechar"
            @click="closeDetail"
          >
            ✕
          </button>
        </div>

        <div v-if="selectedPatient" class="px-6 py-5">
          <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-xs font-semibold uppercase text-gray-400">Nome</dt>
              <dd class="text-sm font-medium text-gray-900">{{ selectedPatient.name }}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase text-gray-400">CPF</dt>
              <dd class="text-sm text-gray-700">{{ formatCpf(selectedPatient.cpf) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase text-gray-400">Última Visita</dt>
              <dd class="text-sm text-gray-700">{{ formatDate(selectedPatient.lastVisit) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase text-gray-400">Plano de Saúde</dt>
              <dd class="text-sm text-gray-700">
                {{ selectedPatient.healthPlans.length > 0 ? selectedPatient.healthPlans.map((h: any) => h.name).join(', ') : 'Sem plano' }}
              </dd>
            </div>
          </div>

          <div class="border-t border-gray-200 pt-5">
            <h4 class="mb-3 text-base font-semibold text-gray-900">Histórico Médico</h4>

            <div v-if="patientDetailLoading" class="flex items-center justify-center py-8">
              <div class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>

            <div v-else-if="selectedPatientRecords.length === 0" class="py-6 text-center text-gray-500">
              Nenhum registro médico encontrado.
            </div>

            <ul v-else class="space-y-4">
              <li
                v-for="rec in selectedPatientRecords"
                :key="rec.id"
                class="rounded-lg border border-gray-200 p-4"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-gray-900">{{ formatDate(rec.created_at?.split('T')[0]) }}</span>
                  <span
                    v-if="rec.appointment"
                    class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
                  >
                    {{ (rec.appointment as any)?.status }}
                  </span>
                </div>
                <p class="mt-2 text-sm text-gray-800">
                  <span class="font-medium">Diagnóstico:</span> {{ rec.diagnosis }}
                </p>
                <p v-if="rec.prescription" class="mt-1 text-sm text-gray-700">
                  <span class="font-medium">Prescrição:</span> {{ rec.prescription }}
                </p>
                <p v-if="rec.next_appointment_date" class="mt-1 text-sm text-gray-500">
                  <span class="font-medium">Próxima consulta:</span> {{ formatDate(rec.next_appointment_date) }}
                </p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
