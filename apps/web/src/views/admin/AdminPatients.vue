<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Gender, BloodType } from '@clinica/shared'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import AppTable from '@/components/common/AppTable.vue'
import AppModal from '@/components/common/AppModal.vue'
import AppPagination from '@/components/common/AppPagination.vue'
import AppConfirmModal from '@/components/common/AppConfirmModal.vue'

interface PatientRow {
  id: string
  profile_id: string
  date_of_birth: string
  gender: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  blood_type: string | null
  allergies: string | null
  created_at: string
  profile: { name: string; email: string; cpf: string; phone: string | null; is_active: boolean } | null
  patient_health_plans: { health_plan: { name: string } }[]
}

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const patients = ref<PatientRow[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 20
const totalPages = computed(() => Math.ceil(total.value / perPage))
const searchQuery = ref('')
const showModal = ref(false)
const showConfirm = ref(false)
const showRecordsModal = ref(false)
const showPlanModal = ref(false)
const editPatient = ref<PatientRow | null>(null)
const deleteTarget = ref<PatientRow | null>(null)
const recordsPatient = ref<PatientRow | null>(null)
const medicalRecords = ref<any[]>([])
const planPatient = ref<PatientRow | null>(null)

const healthPlans = ref<{ id: string; name: string }[]>([])
const planForm = ref({ health_plan_id: '', start_date: '', end_date: '' })

const genderOptions = [
  { label: 'Masculino', value: 'male' },
  { label: 'Feminino', value: 'female' },
  { label: 'Outro', value: 'other' },
]

const bloodOptions = [
  { label: 'A+', value: 'A+' },
  { label: 'A-', value: 'A-' },
  { label: 'B+', value: 'B+' },
  { label: 'B-', value: 'B-' },
  { label: 'AB+', value: 'AB+' },
  { label: 'AB-', value: 'AB-' },
  { label: 'O+', value: 'O+' },
  { label: 'O-', value: 'O-' },
]

const form = ref({
  name: '',
  email: '',
  cpf: '',
  phone: '',
  date_of_birth: '',
  gender: 'male',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  blood_type: '',
  allergies: '',
})

const columns = [
  { key: 'name', label: 'Nome' },
  { key: 'cpf', label: 'CPF' },
  { key: 'date_of_birth', label: 'Nasc.', sortable: true },
  { key: 'gender', label: 'Genero' },
  { key: 'health_plans', label: 'Plano' },
  { key: 'is_active', label: 'Status' },
  { key: 'actions', label: 'Acoes', class: 'text-right' },
]

async function fetchPatients() {
  loading.value = true
  error.value = ''
  try {
    const from = (page.value - 1) * perPage
    let query = supabase
      .from('patients')
      .select('*, profile:profiles(name, email, cpf, phone, is_active), patient_health_plans(health_plan:health_plans(name))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1)

    if (searchQuery.value) {
      query = query.or(`profile.name.ilike.%${searchQuery.value}%,profile.cpf.ilike.%${searchQuery.value}%,profile.email.ilike.%${searchQuery.value}%`)
    }

    const { data, count, error: err } = await query
    if (err) throw err
    patients.value = (data as any) ?? []
    total.value = count ?? 0
  } catch (e: any) {
    error.value = e.message || 'Erro ao carregar pacientes'
  } finally {
    loading.value = false
  }
}

async function fetchHealthPlans() {
  const { data } = await supabase.from('health_plans').select('id, name').eq('is_active', true)
  healthPlans.value = (data as any) ?? []
}

function openCreateModal() {
  editPatient.value = null
  form.value = { name: '', email: '', cpf: '', phone: '', date_of_birth: '', gender: 'male', address: '', city: '', state: '', zip_code: '', blood_type: '', allergies: '' }
  showModal.value = true
}

function openEditModal(p: PatientRow) {
  editPatient.value = p
  form.value = {
    name: p.profile?.name || '',
    email: p.profile?.email || '',
    cpf: p.profile?.cpf || '',
    phone: p.profile?.phone || '',
    date_of_birth: p.date_of_birth || '',
    gender: p.gender || 'male',
    address: p.address || '',
    city: p.city || '',
    state: p.state || '',
    zip_code: p.zip_code || '',
    blood_type: p.blood_type || '',
    allergies: p.allergies || '',
  }
  showModal.value = true
}

async function savePatient() {
  saving.value = true
  error.value = ''
  try {
    if (editPatient.value) {
      const { error: err } = await supabase
        .from('patients')
        .update({
          date_of_birth: form.value.date_of_birth,
          gender: form.value.gender as Gender,
          address: form.value.address || null,
          city: form.value.city || null,
          state: form.value.state || null,
          zip_code: form.value.zip_code || null,
          blood_type: (form.value.blood_type || null) as BloodType | null,
          allergies: form.value.allergies || null,
        })
        .eq('id', editPatient.value.id)
      if (err) throw err

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ name: form.value.name, phone: form.value.phone })
        .eq('id', editPatient.value.profile_id)
      if (profileErr) throw profileErr
    } else {
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: form.value.email,
        password: 'Temp1234!',
        email_confirm: true,
        user_metadata: { name: form.value.name, role: 'patient' },
      })
      if (authErr) throw authErr

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: authData.user.id,
        name: form.value.name,
        email: form.value.email,
        cpf: form.value.cpf,
        phone: form.value.phone,
        role: 'patient',
        is_active: true,
      })
      if (profileErr) throw profileErr

      const { error: patErr } = await supabase.from('patients').insert({
        profile_id: authData.user.id,
        date_of_birth: form.value.date_of_birth,
        gender: form.value.gender as Gender,
        address: form.value.address || null,
        city: form.value.city || null,
        state: form.value.state || null,
        zip_code: form.value.zip_code || null,
        blood_type: (form.value.blood_type || null) as BloodType | null,
        allergies: form.value.allergies || null,
      })
      if (patErr) throw patErr
    }
    showModal.value = false
    await fetchPatients()
  } catch (e: any) {
    error.value = e.message || 'Erro ao salvar paciente'
  } finally {
    saving.value = false
  }
}

async function toggleActive(p: PatientRow) {
  try {
    const { error: err } = await supabase
      .from('profiles')
      .update({ is_active: !(p.profile?.is_active ?? true) })
      .eq('id', p.profile_id)
    if (err) throw err
    await fetchPatients()
  } catch (e: any) {
    error.value = e.message || 'Erro ao alterar status'
  }
}

function confirmDelete(p: PatientRow) {
  deleteTarget.value = p
  showConfirm.value = true
}

async function doDeactivate() {
  if (!deleteTarget.value) return
  await toggleActive(deleteTarget.value)
  showConfirm.value = false
  deleteTarget.value = null
}

async function viewRecords(p: PatientRow) {
  recordsPatient.value = p
  showRecordsModal.value = true
  try {
    const { data, error: err } = await supabase
      .from('medical_records')
      .select('*, doctor:doctors(profile:profiles(name))')
      .eq('patient_id', p.id)
      .order('created_at', { ascending: false })
    if (err) throw err
    medicalRecords.value = (data as any) ?? []
  } catch (e: any) {
    error.value = e.message
    medicalRecords.value = []
  }
}

function openPlanModal(p: PatientRow) {
  planPatient.value = p
  planForm.value = { health_plan_id: '', start_date: '', end_date: '' }
  showPlanModal.value = true
}

async function savePlanAssignment() {
  if (!planPatient.value || !planForm.value.health_plan_id) return
  saving.value = true
  try {
    const { error: err } = await supabase.from('patient_health_plans').insert({
      patient_id: planPatient.value.id,
      health_plan_id: planForm.value.health_plan_id,
      start_date: planForm.value.start_date || new Date().toISOString().slice(0, 10),
      end_date: planForm.value.end_date || null,
    })
    if (err) throw err
    showPlanModal.value = false
    await fetchPatients()
  } catch (e: any) {
    error.value = e.message || 'Erro ao atribuir plano'
  } finally {
    saving.value = false
  }
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function genderLabel(g: string) {
  return { male: 'M', female: 'F', other: 'Outro' }[g] || g
}

onMounted(() => {
  fetchHealthPlans()
  fetchPatients()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Pacientes</h1>
      <AppButton @click="openCreateModal">Novo Paciente</AppButton>
    </div>

    <div class="flex gap-3">
      <div class="flex-1">
        <AppInput v-model="searchQuery" placeholder="Buscar por nome, CPF ou email..." @keyup.enter="fetchPatients" />
      </div>
    </div>

    <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{{ error }}</div>

    <AppTable
      :columns="columns"
      :data="patients"
      :loading="loading"
      empty-message="Nenhum paciente encontrado."
    >
      <template #cell-name="{ row }">
        <span class="text-gray-900">{{ row.profile?.name }}</span>
      </template>
      <template #cell-cpf="{ row }">
        <span class="text-gray-600">{{ row.profile?.cpf }}</span>
      </template>
      <template #cell-date_of_birth="{ value }">
        <span class="text-gray-600">{{ value ? formatDate(value) : '-' }}</span>
      </template>
      <template #cell-gender="{ value }">
        <span class="text-gray-600">{{ genderLabel(value) }}</span>
      </template>
      <template #cell-health_plans="{ row }">
        <div class="flex flex-wrap gap-1">
          <span v-for="(php, i) in row.patient_health_plans" :key="i" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
            {{ php.health_plan?.name }}
          </span>
          <button class="text-xs text-gray-400 hover:text-teal-600" @click="openPlanModal(row)">+ Atribuir</button>
        </div>
      </template>
      <template #cell-is_active="{ row }">
        <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', row.profile?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800']">
          {{ row.profile?.is_active ? 'Ativo' : 'Inativo' }}
        </span>
      </template>
      <template #cell-actions="{ row }">
        <div class="space-x-2">
          <AppButton size="sm" variant="ghost" @click="openEditModal(row)">Editar</AppButton>
          <AppButton size="sm" variant="ghost" @click="viewRecords(row)">Prontuarios</AppButton>
          <AppButton
            size="sm"
            :variant="row.profile?.is_active ? 'danger' : 'secondary'"
            @click="row.profile?.is_active ? confirmDelete(row) : toggleActive(row)"
          >
            {{ row.profile?.is_active ? 'Desativar' : 'Ativar' }}
          </AppButton>
        </div>
      </template>
    </AppTable>

    <AppPagination :page="page" :total-pages="totalPages" :total="total" @update:page="(p: number) => { page = p; fetchPatients() }" />

    <AppModal :show="showModal" :title="editPatient ? 'Editar Paciente' : 'Novo Paciente'" max-width="lg" @close="showModal = false">
      <form @submit.prevent="savePatient" class="space-y-4">
        <AppInput v-model="form.name" label="Nome" required />
        <AppInput v-if="!editPatient" v-model="form.email" label="Email" type="email" required />
        <AppInput v-if="!editPatient" v-model="form.cpf" label="CPF" placeholder="000.000.000-00" />
        <AppInput v-model="form.phone" label="Telefone" />
        <AppInput v-model="form.date_of_birth" label="Data de nascimento" type="date" required />
        <AppSelect v-model="form.gender" label="Genero" :options="genderOptions" required />
        <AppInput v-model="form.address" label="Endereco" />
        <div class="grid grid-cols-3 gap-3">
          <AppInput v-model="form.city" label="Cidade" />
          <AppInput v-model="form.state" label="UF" placeholder="SP" />
          <AppInput v-model="form.zip_code" label="CEP" placeholder="00000000" />
        </div>
        <AppSelect v-model="form.blood_type" label="Tipo sanguineo" :options="bloodOptions" />
        <AppInput v-model="form.allergies" label="Alergias" />
      </form>
      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Cancelar</AppButton>
        <AppButton :loading="saving" @click="savePatient">{{ editPatient ? 'Salvar' : 'Criar' }}</AppButton>
      </template>
    </AppModal>

    <AppModal :show="showRecordsModal" :title="`Prontuarios - ${recordsPatient?.profile?.name || ''}`" max-width="xl" @close="showRecordsModal = false">
      <div v-if="medicalRecords.length === 0" class="text-sm text-gray-500 py-4 text-center">Nenhum prontuario encontrado.</div>
      <div v-else class="space-y-3 max-h-96 overflow-y-auto">
        <div v-for="r in medicalRecords" :key="r.id" class="border border-gray-200 rounded-md p-3">
          <div class="flex justify-between text-xs text-gray-400 mb-2">
            <span>{{ new Date(r.created_at).toLocaleString('pt-BR') }}</span>
            <span>Md: {{ (r.doctor as any)?.profile?.name }}</span>
          </div>
          <p class="text-sm font-medium text-gray-900">Diagnostico: {{ r.diagnosis }}</p>
          <p v-if="r.notes" class="text-sm text-gray-600 mt-1">Notas: {{ r.notes }}</p>
          <p v-if="r.prescription" class="text-sm text-gray-600 mt-1">Receita: {{ r.prescription }}</p>
        </div>
      </div>
    </AppModal>

    <AppModal :show="showPlanModal" title="Atribuir Plano de Saude" max-width="sm" @close="showPlanModal = false">
      <form @submit.prevent="savePlanAssignment" class="space-y-4">
        <AppSelect v-model="planForm.health_plan_id" label="Plano" :options="healthPlans.map(h => ({ label: h.name, value: h.id }))" required />
        <AppInput v-model="planForm.start_date" label="Data inicio" type="date" />
        <AppInput v-model="planForm.end_date" label="Data fim (opcional)" type="date" />
      </form>
      <template #footer>
        <AppButton variant="secondary" @click="showPlanModal = false">Cancelar</AppButton>
        <AppButton :loading="saving" @click="savePlanAssignment">Atribuir</AppButton>
      </template>
    </AppModal>

    <AppConfirmModal
      :show="showConfirm"
      title="Desativar paciente"
      :message="`Tem certeza que deseja desativar ${deleteTarget?.profile?.name}?`"
      confirm-text="Desativar"
      @confirm="doDeactivate"
      @cancel="showConfirm = false"
    />
  </div>
</template>
