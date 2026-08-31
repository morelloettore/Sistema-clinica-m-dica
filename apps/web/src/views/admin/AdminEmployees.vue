<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import AppTable from '@/components/common/AppTable.vue'
import AppModal from '@/components/common/AppModal.vue'
import AppPagination from '@/components/common/AppPagination.vue'
import AppConfirmModal from '@/components/common/AppConfirmModal.vue'

interface EmployeeRow {
  id: string
  profile_id: string
  clinic_id: string | null
  position: string | null
  created_at: string
  profile: { name: string; email: string; phone: string | null; is_active: boolean } | null
  clinic: { name: string } | null
}

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const employees = ref<EmployeeRow[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 20
const totalPages = computed(() => Math.ceil(total.value / perPage))
const searchQuery = ref('')
const showModal = ref(false)
const showConfirm = ref(false)
const editEmployee = ref<EmployeeRow | null>(null)
const deleteTarget = ref<EmployeeRow | null>(null)

const clinics = ref<{ id: string; name: string }[]>([])

const form = ref({
  name: '',
  email: '',
  cpf: '',
  phone: '',
  clinic_id: '',
  position: '',
})

const columns = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'Email' },
  { key: 'clinic', label: 'Clinica' },
  { key: 'position', label: 'Cargo' },
  { key: 'is_active', label: 'Status' },
  { key: 'actions', label: 'Acoes', class: 'text-right' },
]

async function fetchEmployees() {
  loading.value = true
  error.value = ''
  try {
    const from = (page.value - 1) * perPage
    let query = supabase
      .from('employees')
      .select('*, profile:profiles(name, email, phone, is_active), clinic:clinics(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1)

    if (searchQuery.value) {
      query = query.or(`profile.name.ilike.%${searchQuery.value}%,position.ilike.%${searchQuery.value}%`)
    }

    const { data, count, error: err } = await query
    if (err) throw err
    employees.value = (data as any) ?? []
    total.value = count ?? 0
  } catch (e: any) {
    error.value = e.message || 'Erro ao carregar funcionarios'
  } finally {
    loading.value = false
  }
}

async function fetchClinics() {
  const { data } = await supabase.from('clinics').select('id, name').eq('is_active', true)
  clinics.value = (data as any) ?? []
}

function openCreateModal() {
  editEmployee.value = null
  form.value = { name: '', email: '', cpf: '', phone: '', clinic_id: '', position: '' }
  showModal.value = true
}

function openEditModal(e: EmployeeRow) {
  editEmployee.value = e
  form.value = {
    name: e.profile?.name || '',
    email: e.profile?.email || '',
    cpf: '',
    phone: e.profile?.phone || '',
    clinic_id: e.clinic_id || '',
    position: e.position || '',
  }
  showModal.value = true
}

async function saveEmployee() {
  saving.value = true
  error.value = ''
  try {
    if (editEmployee.value) {
      const { error: err } = await (supabase as any)
        .from('employees')
        .update({ clinic_id: form.value.clinic_id || null, position: form.value.position || null })
        .eq('id', editEmployee.value.id)
      if (err) throw err

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ name: form.value.name, phone: form.value.phone })
        .eq('id', editEmployee.value.profile_id)
      if (profileErr) throw profileErr
    } else {
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: form.value.email,
        password: 'Temp1234!',
        email_confirm: true,
        user_metadata: { name: form.value.name, role: 'employee' },
      })
      if (authErr) throw authErr

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: authData.user.id,
        name: form.value.name,
        email: form.value.email,
        cpf: form.value.cpf,
        phone: form.value.phone,
        role: 'employee',
        is_active: true,
      })
      if (profileErr) throw profileErr

      const { error: empErr } = await (supabase as any).from('employees').insert({
        profile_id: authData.user.id,
        clinic_id: form.value.clinic_id || null,
        position: form.value.position || null,
      })
      if (empErr) throw empErr
    }
    showModal.value = false
    await fetchEmployees()
  } catch (e: any) {
    error.value = e.message || 'Erro ao salvar funcionario'
  } finally {
    saving.value = false
  }
}

async function toggleActive(e: EmployeeRow) {
  try {
    const { error: err } = await supabase
      .from('profiles')
      .update({ is_active: !(e.profile?.is_active ?? true) })
      .eq('id', e.profile_id)
    if (err) throw err
    await fetchEmployees()
  } catch (e2: any) {
    error.value = e2.message || 'Erro ao alterar status'
  }
}

function confirmDelete(e: EmployeeRow) {
  deleteTarget.value = e
  showConfirm.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  try {
    const { error: err } = await supabase.from('employees').delete().eq('id', deleteTarget.value.id)
    if (err) throw err
    showConfirm.value = false
    deleteTarget.value = null
    await fetchEmployees()
  } catch (e: any) {
    error.value = e.message || 'Erro ao excluir'
    showConfirm.value = false
  }
}

onMounted(() => {
  fetchClinics()
  fetchEmployees()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Funcionarios</h1>
      <AppButton @click="openCreateModal">Novo Funcionario</AppButton>
    </div>

    <div class="flex gap-3">
      <div class="flex-1">
        <AppInput v-model="searchQuery" placeholder="Buscar por nome ou cargo..." @keyup.enter="fetchEmployees" />
      </div>
    </div>

    <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{{ error }}</div>

    <AppTable
      :columns="columns"
      :data="employees"
      :loading="loading"
      empty-message="Nenhum funcionario encontrado."
    >
      <template #cell-name="{ row }">
        <span class="text-gray-900">{{ row.profile?.name }}</span>
      </template>
      <template #cell-email="{ row }">
        <span class="text-gray-600">{{ row.profile?.email }}</span>
      </template>
      <template #cell-clinic="{ row }">
        <span class="text-gray-600">{{ row.clinic?.name || '-' }}</span>
      </template>
      <template #cell-position="{ value }">
        <span class="text-gray-600">{{ value || '-' }}</span>
      </template>
      <template #cell-is_active="{ row }">
        <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', row.profile?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800']">
          {{ row.profile?.is_active ? 'Ativo' : 'Inativo' }}
        </span>
      </template>
      <template #cell-actions="{ row }">
        <div class="space-x-2">
          <AppButton size="sm" variant="ghost" @click="openEditModal(row)">Editar</AppButton>
          <AppButton size="sm" :variant="row.profile?.is_active ? 'danger' : 'secondary'" @click="toggleActive(row)">
            {{ row.profile?.is_active ? 'Desativar' : 'Ativar' }}
          </AppButton>
          <AppButton size="sm" variant="danger" @click="confirmDelete(row)">Excluir</AppButton>
        </div>
      </template>
    </AppTable>

    <AppPagination :page="page" :total-pages="totalPages" :total="total" @update:page="(p: number) => { page = p; fetchEmployees() }" />

    <AppModal :show="showModal" :title="editEmployee ? 'Editar Funcionario' : 'Novo Funcionario'" max-width="lg" @close="showModal = false">
      <form @submit.prevent="saveEmployee" class="space-y-4">
        <AppInput v-model="form.name" label="Nome" required />
        <AppInput v-if="!editEmployee" v-model="form.email" label="Email" type="email" required />
        <AppInput v-if="!editEmployee" v-model="form.cpf" label="CPF" placeholder="000.000.000-00" />
        <AppInput v-model="form.phone" label="Telefone" />
        <AppSelect v-model="form.clinic_id" label="Clinica" :options="clinics.map(c => ({ label: c.name, value: c.id }))" />
        <AppInput v-model="form.position" label="Cargo" />
      </form>
      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Cancelar</AppButton>
        <AppButton :loading="saving" @click="saveEmployee">{{ editEmployee ? 'Salvar' : 'Criar' }}</AppButton>
      </template>
    </AppModal>

    <AppConfirmModal
      :show="showConfirm"
      title="Excluir funcionario"
      :message="`Tem certeza que deseja excluir ${deleteTarget?.profile?.name}?`"
      confirm-text="Excluir"
      @confirm="doDelete"
      @cancel="showConfirm = false"
    />
  </div>
</template>
