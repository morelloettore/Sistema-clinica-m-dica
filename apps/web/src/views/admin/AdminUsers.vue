<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import AppTable from '@/components/common/AppTable.vue'
import AppModal from '@/components/common/AppModal.vue'
import AppPagination from '@/components/common/AppPagination.vue'
import AppConfirmModal from '@/components/common/AppConfirmModal.vue'

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const users = ref<Profile[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 20
const totalPages = computed(() => Math.ceil(total.value / perPage))

const roleFilter = ref('')
const searchQuery = ref('')
const showModal = ref(false)
const showConfirm = ref(false)
const editUser = ref<Profile | null>(null)
const userToDelete = ref<Profile | null>(null)

const form = ref({
  name: '',
  email: '',
  cpf: '',
  phone: '',
  role: 'patient' as Profile['role'],
})

const roleOptions = [
  { label: 'Todos', value: '' },
  { label: 'Paciente', value: 'patient' },
  { label: 'Funcionario', value: 'employee' },
  { label: 'Medico', value: 'doctor' },
  { label: 'Admin', value: 'admin' },
]

const availableRoles = [
  { label: 'Paciente', value: 'patient' },
  { label: 'Funcionario', value: 'employee' },
  { label: 'Medico', value: 'doctor' },
  { label: 'Admin', value: 'admin' },
]

const currentUserId = ref('')

const columns = [
  { key: 'name', label: 'Nome', sortable: true },
  { key: 'email', label: 'Email' },
  { key: 'cpf', label: 'CPF' },
  { key: 'role', label: 'Papel' },
  { key: 'is_active', label: 'Status' },
  { key: 'created_at', label: 'Criado em', sortable: true },
  { key: 'actions', label: 'Acoes', class: 'text-right' },
]

async function fetchUsers() {
  loading.value = true
  error.value = ''
  try {
    const from = (page.value - 1) * perPage
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1)

    if (roleFilter.value) query = query.eq('role', roleFilter.value as any)
    if (searchQuery.value) {
      query = query.or(`name.ilike.%${searchQuery.value}%,email.ilike.%${searchQuery.value}%,cpf.ilike.%${searchQuery.value}%`)
    }

    const { data, count, error: err } = await query
    if (err) throw err
    users.value = data ?? []
    total.value = count ?? 0
  } catch (e: any) {
    error.value = e.message || 'Erro ao carregar usuarios'
  } finally {
    loading.value = false
  }
}

async function fetchCurrentUserId() {
  const { data } = await supabase.auth.getUser()
  currentUserId.value = data.user?.id || ''
}

function openCreateModal() {
  editUser.value = null
  form.value = { name: '', email: '', cpf: '', phone: '', role: 'patient' }
  showModal.value = true
}

function openEditModal(user: Profile) {
  editUser.value = user
  form.value = {
    name: user.name,
    email: user.email,
    cpf: user.cpf || '',
    phone: user.phone || '',
    role: user.role,
  }
  showModal.value = true
}

async function saveUser() {
  saving.value = true
  error.value = ''
  try {
    if (editUser.value) {
      const { error: err } = await supabase
        .from('profiles')
        .update({ name: form.value.name, phone: form.value.phone, role: form.value.role })
        .eq('id', editUser.value.id)
      if (err) throw err
    } else {
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: form.value.email,
        password: 'Temp1234!',
        email_confirm: true,
        user_metadata: { name: form.value.name, role: form.value.role },
      })
      if (authErr) throw authErr

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: authData.user.id,
        name: form.value.name,
        email: form.value.email,
        cpf: form.value.cpf,
        phone: form.value.phone,
        role: form.value.role,
        is_active: true,
      })
      if (profileErr) throw profileErr
    }
    showModal.value = false
    await fetchUsers()
  } catch (e: any) {
    error.value = e.message || 'Erro ao salvar usuario'
  } finally {
    saving.value = false
  }
}

async function toggleActive(user: Profile) {
  try {
    const { error: err } = await supabase
      .from('profiles')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)
    if (err) throw err
    await fetchUsers()
  } catch (e: any) {
    error.value = e.message || 'Erro ao alterar status'
  }
}

function confirmDeactivate(user: Profile) {
  userToDelete.value = user
  showConfirm.value = true
}

async function doDeactivate() {
  if (!userToDelete.value) return
  await toggleActive(userToDelete.value)
  showConfirm.value = false
  userToDelete.value = null
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function roleLabel(r: string) {
  const map: Record<string, string> = { patient: 'Paciente', employee: 'Funcionario', doctor: 'Medico', admin: 'Admin' }
  return map[r] || r
}

onMounted(() => {
  fetchCurrentUserId()
  fetchUsers()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Usuarios</h1>
      <AppButton @click="openCreateModal">Novo Usuario</AppButton>
    </div>

    <div class="flex flex-col sm:flex-row gap-3">
      <div class="flex-1">
        <AppInput v-model="searchQuery" placeholder="Buscar por nome, email ou CPF..." @keyup.enter="fetchUsers" />
      </div>
      <div class="w-full sm:w-48">
        <AppSelect v-model="roleFilter" :options="roleOptions" placeholder="Filtrar por papel" @change="page = 1; fetchUsers()" />
      </div>
    </div>

    <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{{ error }}</div>

    <AppTable
      :columns="columns"
      :data="users"
      :loading="loading"
      empty-message="Nenhum usuario encontrado."
    >
      <template #cell-role="{ value }">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {{ roleLabel(value) }}
        </span>
      </template>
      <template #cell-is_active="{ value }">
        <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800']">
          {{ value ? 'Ativo' : 'Inativo' }}
        </span>
      </template>
      <template #cell-created_at="{ value }">
        {{ formatDate(value) }}
      </template>
      <template #cell-actions="{ row }">
        <div class="space-x-2">
          <AppButton size="sm" variant="ghost" @click="openEditModal(row)">Editar</AppButton>
          <AppButton
            v-if="row.id !== currentUserId"
            size="sm"
            :variant="row.is_active ? 'danger' : 'secondary'"
            @click="row.is_active ? confirmDeactivate(row) : toggleActive(row)"
          >
            {{ row.is_active ? 'Desativar' : 'Ativar' }}
          </AppButton>
        </div>
      </template>
    </AppTable>

    <AppPagination :page="page" :total-pages="totalPages" :total="total" @update:page="(p: number) => { page = p; fetchUsers() }" />

    <AppModal :show="showModal" :title="editUser ? 'Editar Usuario' : 'Novo Usuario'" max-width="lg" @close="showModal = false">
      <form @submit.prevent="saveUser" class="space-y-4">
        <AppInput v-model="form.name" label="Nome" required />
        <AppInput v-if="!editUser" v-model="form.email" label="Email" type="email" required />
        <AppInput v-if="!editUser" v-model="form.cpf" label="CPF" placeholder="000.000.000-00" />
        <AppInput v-model="form.phone" label="Telefone" placeholder="(00) 00000-0000" />
        <AppSelect v-model="form.role" label="Papel" :options="availableRoles" required />
      </form>
      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Cancelar</AppButton>
        <AppButton :loading="saving" @click="saveUser">{{ editUser ? 'Salvar' : 'Criar' }}</AppButton>
      </template>
    </AppModal>

    <AppConfirmModal
      :show="showConfirm"
      title="Desativar usuario"
      :message="`Tem certeza que deseja desativar ${userToDelete?.name}? O usuario nao conseguira fazer login.`"
      confirm-text="Desativar"
      @confirm="doDeactivate"
      @cancel="showConfirm = false"
    />
  </div>
</template>
