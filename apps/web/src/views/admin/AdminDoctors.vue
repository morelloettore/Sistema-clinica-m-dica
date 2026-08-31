<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppTable from '@/components/common/AppTable.vue'
import AppModal from '@/components/common/AppModal.vue'
import AppPagination from '@/components/common/AppPagination.vue'
import AppConfirmModal from '@/components/common/AppConfirmModal.vue'

interface DoctorRow {
  id: string
  profile_id: string
  crm: string
  bio: string | null
  consultation_price: number | null
  is_active: boolean
  created_at: string
  profile: { name: string; email: string; cpf: string; phone: string | null } | null
  doctor_specialties: { specialty: { id: string; name: string } }[]
  doctor_clinics: { clinic: { id: string; name: string } }[]
}

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const doctors = ref<DoctorRow[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 20
const totalPages = computed(() => Math.ceil(total.value / perPage))

const searchQuery = ref('')
const showModal = ref(false)
const showAssignModal = ref(false)
const showConfirm = ref(false)
const editDoctor = ref<DoctorRow | null>(null)
const deleteTarget = ref<DoctorRow | null>(null)
const assignTarget = ref<DoctorRow | null>(null)

const specialties = ref<{ id: string; name: string }[]>([])
const clinics = ref<{ id: string; name: string }[]>([])
const assignType = ref<'specialties' | 'clinics'>('specialties')
const selectedIds = ref<string[]>([])

const form = ref({
  name: '',
  email: '',
  cpf: '',
  phone: '',
  crm: '',
  bio: '',
  consultation_price: '',
})

const columns = [
  { key: 'name', label: 'Nome' },
  { key: 'crm', label: 'CRM' },
  { key: 'specialties', label: 'Especialidades' },
  { key: 'clinics', label: 'Clinicas' },
  { key: 'consultation_price', label: 'Preco' },
  { key: 'is_active', label: 'Status' },
  { key: 'actions', label: 'Acoes', class: 'text-right' },
]

async function fetchDoctors() {
  loading.value = true
  error.value = ''
  try {
    const from = (page.value - 1) * perPage
    let query = supabase
      .from('doctors')
      .select('*, profile:profiles(name, email, cpf, phone), doctor_specialties(*, specialty:specialties(id, name)), doctor_clinics(*, clinic:clinics(id, name))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1)

    if (searchQuery.value) {
      query = query.or(`crm.ilike.%${searchQuery.value}%,profile.name.ilike.%${searchQuery.value}%`)
    }

    const { data, count, error: err } = await query
    if (err) throw err
    doctors.value = (data as any) ?? []
    total.value = count ?? 0
  } catch (e: any) {
    error.value = e.message || 'Erro ao carregar medicos'
  } finally {
    loading.value = false
  }
}

async function fetchMeta() {
  const [specRes, clinRes] = await Promise.all([
    supabase.from('specialties').select('id, name').eq('is_active', true),
    supabase.from('clinics').select('id, name').eq('is_active', true),
  ])
  specialties.value = (specRes.data as any) ?? []
  clinics.value = (clinRes.data as any) ?? []
}

function openCreateModal() {
  editDoctor.value = null
  form.value = { name: '', email: '', cpf: '', phone: '', crm: '', bio: '', consultation_price: '' }
  showModal.value = true
}

function openEditModal(d: DoctorRow) {
  editDoctor.value = d
  form.value = {
    name: d.profile?.name || '',
    email: d.profile?.email || '',
    cpf: d.profile?.cpf || '',
    phone: d.profile?.phone || '',
    crm: d.crm,
    bio: d.bio || '',
    consultation_price: d.consultation_price?.toString() || '',
  }
  showModal.value = true
}

async function saveDoctor() {
  saving.value = true
  error.value = ''
  try {
    if (editDoctor.value) {
      const { error: err } = await supabase
        .from('doctors')
        .update({
          crm: form.value.crm,
          bio: form.value.bio || null,
          consultation_price: form.value.consultation_price ? Number(form.value.consultation_price) : null,
        })
        .eq('id', editDoctor.value.id)
      if (err) throw err

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ name: form.value.name, phone: form.value.phone })
        .eq('id', editDoctor.value.profile_id)
      if (profileErr) throw profileErr
    } else {
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: form.value.email,
        password: 'Temp1234!',
        email_confirm: true,
        user_metadata: { name: form.value.name, role: 'doctor' },
      })
      if (authErr) throw authErr

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: authData.user.id,
        name: form.value.name,
        email: form.value.email,
        cpf: form.value.cpf,
        phone: form.value.phone,
        role: 'doctor',
        is_active: true,
      })
      if (profileErr) throw profileErr

      const { error: docErr } = await supabase.from('doctors').insert({
        profile_id: authData.user.id,
        crm: form.value.crm,
        bio: form.value.bio || null,
        consultation_price: form.value.consultation_price ? Number(form.value.consultation_price) : null,
        is_active: true,
      })
      if (docErr) throw docErr
    }
    showModal.value = false
    await fetchDoctors()
  } catch (e: any) {
    error.value = e.message || 'Erro ao salvar medico'
  } finally {
    saving.value = false
  }
}

async function toggleActive(d: DoctorRow) {
  try {
    const { error: err } = await supabase
      .from('doctors')
      .update({ is_active: !d.is_active })
      .eq('id', d.id)
    if (err) throw err
    await fetchDoctors()
  } catch (e: any) {
    error.value = e.message || 'Erro ao alterar status'
  }
}

function confirmDelete(d: DoctorRow) {
  deleteTarget.value = d
  showConfirm.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  try {
    const { error: err } = await supabase.from('doctors').delete().eq('id', deleteTarget.value.id)
    if (err) throw err
    showConfirm.value = false
    deleteTarget.value = null
    await fetchDoctors()
  } catch (e: any) {
    error.value = e.message || 'Erro ao excluir medico'
    showConfirm.value = false
  }
}

function openAssignModal(d: DoctorRow, type: 'specialties' | 'clinics') {
  assignTarget.value = d
  assignType.value = type
  if (type === 'specialties') {
    selectedIds.value = d.doctor_specialties?.map((ds: any) => ds.specialty?.id).filter(Boolean) ?? []
  } else {
    selectedIds.value = d.doctor_clinics?.map((dc: any) => dc.clinic?.id).filter(Boolean) ?? []
  }
  showAssignModal.value = true
}

async function saveAssignments() {
  if (!assignTarget.value) return
  saving.value = true
  try {
    if (assignType.value === 'specialties') {
      await supabase.from('doctor_specialties').delete().eq('doctor_id', assignTarget.value.id)
      if (selectedIds.value.length) {
        const rows = selectedIds.value.map(sid => ({ doctor_id: assignTarget.value!.id, specialty_id: sid }))
        const { error: err } = await supabase.from('doctor_specialties').insert(rows as any)
        if (err) throw err
      }
    } else {
      await supabase.from('doctor_clinics').delete().eq('doctor_id', assignTarget.value.id)
      if (selectedIds.value.length) {
        const rows = selectedIds.value.map(cid => ({ doctor_id: assignTarget.value!.id, clinic_id: cid }))
        const { error: err } = await supabase.from('doctor_clinics').insert(rows as any)
        if (err) throw err
      }
    }
    showAssignModal.value = false
    await fetchDoctors()
  } catch (e: any) {
    error.value = e.message || 'Erro ao salvar atribuicoes'
  } finally {
    saving.value = false
  }
}

function formatPrice(v: number | null) {
  if (v == null) return '-'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

onMounted(() => {
  fetchMeta()
  fetchDoctors()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Medicos</h1>
      <AppButton @click="openCreateModal">Novo Medico</AppButton>
    </div>

    <div class="flex gap-3">
      <div class="flex-1">
        <AppInput v-model="searchQuery" placeholder="Buscar por nome ou CRM..." @keyup.enter="fetchDoctors" />
      </div>
    </div>

    <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{{ error }}</div>

    <AppTable
      :columns="columns"
      :data="doctors"
      :loading="loading"
      empty-message="Nenhum medico encontrado."
    >
      <template #cell-name="{ row }">
        <span class="text-gray-900 font-medium">{{ row.profile?.name }}</span>
      </template>
      <template #cell-specialties="{ row }">
        <div class="flex flex-wrap gap-1">
          <span v-for="ds in row.doctor_specialties" :key="ds.specialty?.id" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {{ ds.specialty?.name }}
          </span>
          <button class="text-xs text-gray-400 hover:text-blue-600" @click="openAssignModal(row, 'specialties')">+ Editar</button>
        </div>
      </template>
      <template #cell-clinics="{ row }">
        <div class="flex flex-wrap gap-1">
          <span v-for="dc in row.doctor_clinics" :key="dc.clinic?.id" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            {{ dc.clinic?.name }}
          </span>
          <button class="text-xs text-gray-400 hover:text-green-600" @click="openAssignModal(row, 'clinics')">+ Editar</button>
        </div>
      </template>
      <template #cell-consultation_price="{ value }">
        {{ formatPrice(value) }}
      </template>
      <template #cell-is_active="{ value }">
        <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800']">
          {{ value ? 'Ativo' : 'Inativo' }}
        </span>
      </template>
      <template #cell-actions="{ row }">
        <div class="space-x-2">
          <AppButton size="sm" variant="ghost" @click="openEditModal(row)">Editar</AppButton>
          <AppButton size="sm" :variant="row.is_active ? 'danger' : 'secondary'" @click="toggleActive(row)">
            {{ row.is_active ? 'Desativar' : 'Ativar' }}
          </AppButton>
          <AppButton size="sm" variant="danger" @click="confirmDelete(row)">Excluir</AppButton>
        </div>
      </template>
    </AppTable>

    <AppPagination :page="page" :total-pages="totalPages" :total="total" @update:page="(p: number) => { page = p; fetchDoctors() }" />

    <AppModal :show="showModal" :title="editDoctor ? 'Editar Medico' : 'Novo Medico'" max-width="lg" @close="showModal = false">
      <form @submit.prevent="saveDoctor" class="space-y-4">
        <AppInput v-model="form.name" label="Nome" required />
        <AppInput v-if="!editDoctor" v-model="form.email" label="Email" type="email" required />
        <AppInput v-if="!editDoctor" v-model="form.cpf" label="CPF" placeholder="000.000.000-00" />
        <AppInput v-model="form.phone" label="Telefone" />
        <AppInput v-model="form.crm" label="CRM" required placeholder="12345-SP" />
        <AppInput v-model="form.bio" label="Biografia" />
        <AppInput v-model="form.consultation_price" label="Preco da consulta (R$)" type="number" step="0.01" min="0" />
      </form>
      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Cancelar</AppButton>
        <AppButton :loading="saving" @click="saveDoctor">{{ editDoctor ? 'Salvar' : 'Criar' }}</AppButton>
      </template>
    </AppModal>

    <AppModal :show="showAssignModal" :title="assignType === 'specialties' ? 'Especialidades' : 'Clinicas'" max-width="lg" @close="showAssignModal = false">
      <div class="space-y-2 max-h-64 overflow-y-auto">
        <label
          v-for="item in (assignType === 'specialties' ? specialties : clinics)"
          :key="item.id"
          class="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
        >
          <input
            type="checkbox"
            :value="item.id"
            v-model="selectedIds"
            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span class="text-sm text-gray-700">{{ item.name }}</span>
        </label>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="showAssignModal = false">Cancelar</AppButton>
        <AppButton :loading="saving" @click="saveAssignments">Salvar</AppButton>
      </template>
    </AppModal>

    <AppConfirmModal
      :show="showConfirm"
      title="Excluir medico"
      :message="`Tem certeza que deseja excluir o medico ${deleteTarget?.profile?.name}? Esta acao nao pode ser desfeita.`"
      confirm-text="Excluir"
      @confirm="doDelete"
      @cancel="showConfirm = false"
    />
  </div>
</template>
