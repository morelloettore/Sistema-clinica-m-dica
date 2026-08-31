<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()

const loading = ref(true)
const error = ref<string | null>(null)
const doctorId = ref<string | null>(null)
const profileId = ref<string | null>(null)

interface PatientOption {
  id: string
  name: string
}

interface MedicalRecordListItem {
  id: string
  patient_id: string
  patient_name: string
  date: string
  diagnosis: string
  next_appointment_date: string | null
}

const records = ref<MedicalRecordListItem[]>([])
const patientOptions = ref<PatientOption[]>([])

const showForm = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const formSubmitting = ref(false)

const recordSchema = z.object({
  patient_id: z.string().min(1, 'Selecione um paciente.'),
  diagnosis: z.string().min(1, 'Diagnóstico é obrigatório.').max(5000, 'Diagnóstico deve ter no máximo 5000 caracteres.'),
  notes: z.string().max(10000, 'Notas devem ter no máximo 10000 caracteres.').optional().nullable(),
  examination: z.string().max(10000, 'Exame físico deve ter no máximo 10000 caracteres.').optional().nullable(),
  complaint: z.string().max(5000, 'Queixa principal deve ter no máximo 5000 caracteres.').optional().nullable(),
  history: z.string().max(10000, 'História deve ter no máximo 10000 caracteres.').optional().nullable(),
  treatment_plan: z.string().max(10000, 'Plano de tratamento deve ter no máximo 10000 caracteres.').optional().nullable(),
  prescription: z.string().max(5000, 'Prescrição deve ter no máximo 5000 caracteres.').optional().nullable(),
  next_appointment_date: z.string().optional().nullable(),
})

const form = ref({
  patient_id: '',
  complaint: '',
  history: '',
  examination: '',
  diagnosis: '',
  treatment_plan: '',
  prescription: '',
  notes: '',
  next_appointment_date: '',
})

const formErrors = ref<Record<string, string>>({})

function resetForm() {
  form.value = {
    patient_id: '',
    complaint: '',
    history: '',
    examination: '',
    diagnosis: '',
    treatment_plan: '',
    prescription: '',
    notes: '',
    next_appointment_date: '',
  }
  formErrors.value = {}
  isEditing.value = false
  editingId.value = null
}

function formatDate(date: string | null) {
  if (!date) return '—'
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

async function loadDoctor() {
  const { data, error: e } = await supabase
    .from('doctors')
    .select('id, profile_id')
    .eq('profile_id', auth.user!.id)
    .single()

  if (e || !data) {
    error.value = 'Não foi possível carregar dados do médico.'
    return false
  }
  doctorId.value = data.id
  profileId.value = data.profile_id
  return true
}

async function loadPatientOptions() {
  const { data, error: e } = await supabase
    .from('appointments')
    .select('patient_id, patient:patients(id, profile:profiles(name))')
    .eq('doctor_id', doctorId.value!)
    .neq('status', 'cancelled')

  if (e) throw e

  const map = new Map<string, string>()
  for (const a of (data ?? []) as Record<string, unknown>[]) {
    const patient = a.patient as Record<string, unknown> | null
    const profile = patient?.profile as Record<string, string> | null
    if (!profile || !patient) continue
    const pid = patient.id as string
    if (!map.has(pid)) map.set(pid, profile.name)
  }

  patientOptions.value = Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

async function loadRecords() {
  loading.value = true
  error.value = null

  try {
    if (!doctorId.value) {
      const ok = await loadDoctor()
      if (!ok) return
    }

    const { data, error: e } = await supabase
      .from('medical_records')
      .select(`
        id,
        patient_id,
        diagnosis,
        next_appointment_date,
        created_at,
        patient:patients(id, profile:profiles(name))
      `)
      .eq('doctor_id', doctorId.value!)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (e) throw e

    records.value = ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const patient = r.patient as Record<string, unknown> | null
      const profile = patient?.profile as Record<string, string> | null
      const createdAt = (r.created_at as string) || ''
      return {
        id: r.id as string,
        patient_id: r.patient_id as string,
        patient_name: profile?.name ?? 'Paciente',
        date: createdAt.split('T')[0],
        diagnosis: r.diagnosis as string,
        next_appointment_date: (r.next_appointment_date as string | null) ?? null,
      }
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar prontuários.'
  } finally {
    loading.value = false
  }
}

async function openCreateForm() {
  resetForm()
  try {
    await loadPatientOptions()
    showForm.value = true
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Erro ao carregar pacientes.')
  }
}

async function openEditForm(record: MedicalRecordListItem) {
  resetForm()
  isEditing.value = true
  editingId.value = record.id

  try {
    await loadPatientOptions()

    const { data, error: e } = await supabase
      .from('medical_records')
      .select('*')
      .eq('id', record.id)
      .eq('doctor_id', doctorId.value!)
      .single()

    if (e) throw e
    if (!data) {
      toast.error('Prontuário não encontrado.')
      return
    }

    form.value = {
      patient_id: data.patient_id,
      complaint: (data as any).complaint ?? '',
      history: (data as any).history ?? '',
      examination: (data as any).examination ?? '',
      diagnosis: data.diagnosis,
      treatment_plan: (data as any).treatment_plan ?? '',
      prescription: data.prescription ?? '',
      notes: data.notes ?? '',
      next_appointment_date: data.next_appointment_date ?? '',
    }

    showForm.value = true
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Erro ao carregar prontuário.')
  }
}

function closeForm() {
  if (formSubmitting.value) return
  showForm.value = false
  resetForm()
}

async function submitForm() {
  formErrors.value = {}

  const result = recordSchema.safeParse(form.value)
  if (!result.success) {
    const errs: Record<string, string> = {}
    for (const issue of result.error.issues) {
      errs[issue.path[0]] = issue.message
    }
    formErrors.value = errs
    return
  }

  formSubmitting.value = true

  try {
    const payload = {
      patient_id: form.value.patient_id,
      chief_complaint: form.value.complaint || null,
      history: form.value.history || null,
      examination: form.value.examination || null,
      diagnosis: form.value.diagnosis,
      treatment_plan: form.value.treatment_plan || null,
      prescription: form.value.prescription || null,
      notes: form.value.notes || null,
      next_appointment_date: form.value.next_appointment_date || null,
    }

    if (isEditing.value && editingId.value) {
      const { error: e } = await supabase
        .from('medical_records')
        .update(payload)
        .eq('id', editingId.value)
        .eq('doctor_id', doctorId.value!)

      if (e) throw e
      toast.success('Prontuário atualizado com sucesso.')
    } else {
      const { error: e } = await supabase.from('medical_records').insert({
        ...payload,
        // doctor_id and created_by are set server-side via RLS/triggers.
        // NEVER set these fields manually.
      })

      if (e) throw e
      toast.success('Prontuário criado com sucesso.')
    }

    showForm.value = false
    resetForm()
    await loadRecords()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível salvar o prontuário.')
  } finally {
    formSubmitting.value = false
  }
}

const selectedPatientName = computed(() => {
  const p = patientOptions.value.find((o) => o.id === form.value.patient_id)
  return p ? p.name : ''
})

onMounted(loadRecords)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Prontuários</h2>
      <div class="flex items-center gap-3">
        <button
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          @click="loadRecords"
        >
          Atualizar
        </button>
        <button
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          @click="openCreateForm"
        >
          + Novo Prontuário
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
        @click="loadRecords"
      >
        Tentar novamente
      </button>
    </div>

    <div v-else-if="records.length === 0" class="rounded-lg border border-gray-200 bg-white p-10 text-center">
      <p class="text-gray-500">Nenhum prontuário criado ainda.</p>
      <p class="mt-1 text-sm text-gray-400">Crie seu primeiro prontuário clicando em "Novo Prontuário".</p>
    </div>

    <div v-else class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Paciente</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Diagnóstico</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white">
            <tr v-for="rec in records" :key="rec.id" class="transition-colors hover:bg-gray-50">
              <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{{ rec.patient_name }}</td>
              <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{{ formatDate(rec.date) }}</td>
              <td class="max-w-md truncate px-6 py-4 text-sm text-gray-700">{{ rec.diagnosis }}</td>
              <td class="whitespace-nowrap px-6 py-4 text-right">
                <button
                  class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  @click="openEditForm(rec)"
                >
                  Editar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-form-title"
    >
      <div class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 id="record-form-title" class="text-lg font-semibold text-gray-900">
            {{ isEditing ? 'Editar Prontuário' : 'Novo Prontuário' }}
          </h3>
          <button
            class="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fechar"
            @click="closeForm"
          >
            ✕
          </button>
        </div>

        <form class="space-y-5 px-6 py-6" novalidate @submit.prevent="submitForm">
          <div>
            <label for="record-patient" class="mb-1 block text-sm font-medium text-gray-700">
              Paciente <span class="text-red-500">*</span>
            </label>
            <select
              id="record-patient"
              v-model="form.patient_id"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              :disabled="isEditing"
            >
              <option value="" disabled>Selecione um paciente</option>
              <option v-for="p in patientOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <p v-if="formErrors.patient_id" class="mt-1 text-xs text-red-600">{{ formErrors.patient_id }}</p>
          </div>

          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label for="record-complaint" class="mb-1 block text-sm font-medium text-gray-700">
                Queixa Principal
              </label>
              <textarea
                id="record-complaint"
                v-model="form.complaint"
                rows="2"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Motivo da consulta"
              />
            </div>
            <div>
              <label for="record-history" class="mb-1 block text-sm font-medium text-gray-700">
                História da Doença Atual
              </label>
              <textarea
                id="record-history"
                v-model="form.history"
                rows="2"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="História e antecedentes"
              />
            </div>
          </div>

          <div>
            <label for="record-exam" class="mb-1 block text-sm font-medium text-gray-700">
              Exame Físico
            </label>
            <textarea
              id="record-exam"
              v-model="form.examination"
              rows="3"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Achados do exame físico"
            />
          </div>

          <div>
            <label for="record-diagnosis" class="mb-1 block text-sm font-medium text-gray-700">
              Diagnóstico <span class="text-red-500">*</span>
            </label>
            <input
              id="record-diagnosis"
              v-model="form.diagnosis"
              type="text"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Diagnóstico clínico"
            />
            <p v-if="formErrors.diagnosis" class="mt-1 text-xs text-red-600">{{ formErrors.diagnosis }}</p>
          </div>

          <div>
            <label for="record-treatment" class="mb-1 block text-sm font-medium text-gray-700">
              Plano de Tratamento
            </label>
            <textarea
              id="record-treatment"
              v-model="form.treatment_plan"
              rows="3"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Conduta e plano terapêutico"
            />
          </div>

          <div>
            <label for="record-prescription" class="mb-1 block text-sm font-medium text-gray-700">
              Prescrição
            </label>
            <textarea
              id="record-prescription"
              v-model="form.prescription"
              rows="3"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Medicamentos, dosagem e posologia"
            />
          </div>

          <div>
            <label for="record-notes" class="mb-1 block text-sm font-medium text-gray-700">
              Observações
            </label>
            <textarea
              id="record-notes"
              v-model="form.notes"
              rows="3"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Informações adicionais"
            />
          </div>

          <div>
            <label for="record-next-date" class="mb-1 block text-sm font-medium text-gray-700">
              Próxima Consulta (opcional)
            </label>
            <input
              id="record-next-date"
              v-model="form.next_appointment_date"
              type="date"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div v-if="selectedPatientName" class="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span class="font-medium">Paciente selecionado:</span> {{ selectedPatientName }}
            <span class="ml-2 text-xs text-blue-600">O prontuário será associado ao paciente selecionado.</span>
          </div>

          <div class="flex items-center justify-end gap-3 border-t border-gray-200 pt-5">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="formSubmitting"
              @click="closeForm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="formSubmitting"
            >
              {{ formSubmitting ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Prontuário' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
