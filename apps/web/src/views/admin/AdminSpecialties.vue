<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppTable from '@/components/common/AppTable.vue'
import AppModal from '@/components/common/AppModal.vue'
import AppPagination from '@/components/common/AppPagination.vue'

interface Specialty {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const specialties = ref<Specialty[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 20
const totalPages = computed(() => Math.ceil(total.value / perPage))
const showModal = ref(false)
const editItem = ref<Specialty | null>(null)

const form = ref({ name: '', description: '' })

const columns = [
  { key: 'name', label: 'Nome', sortable: true },
  { key: 'description', label: 'Descricao' },
  { key: 'is_active', label: 'Ativa' },
  { key: 'actions', label: 'Acoes', class: 'text-right' },
]

async function fetchSpecialties() {
  loading.value = true
  error.value = ''
  try {
    const from = (page.value - 1) * perPage
    const { data, count, error: err } = await supabase
      .from('specialties')
      .select('*', { count: 'exact' })
      .order('name')
      .range(from, from + perPage - 1)
    if (err) throw err
    specialties.value = (data as any) ?? []
    total.value = count ?? 0
  } catch (e: any) {
    error.value = e.message || 'Erro ao carregar especialidades'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editItem.value = null
  form.value = { name: '', description: '' }
  showModal.value = true
}

function openEdit(s: Specialty) {
  editItem.value = s
  form.value = { name: s.name, description: s.description || '' }
  showModal.value = true
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    if (editItem.value) {
      const { error: err } = await supabase
        .from('specialties')
        .update({ name: form.value.name, description: form.value.description || null })
        .eq('id', editItem.value.id)
      if (err) throw err
    } else {
      const { error: err } = await supabase.from('specialties').insert({
        name: form.value.name,
        description: form.value.description || null,
        is_active: true,
      })
      if (err) throw err
    }
    showModal.value = false
    await fetchSpecialties()
  } catch (e: any) {
    error.value = e.message || 'Erro ao salvar'
  } finally {
    saving.value = false
  }
}

async function toggleActive(s: Specialty) {
  try {
    const { error: err } = await supabase
      .from('specialties')
      .update({ is_active: !s.is_active })
      .eq('id', s.id)
    if (err) throw err
    await fetchSpecialties()
  } catch (e: any) {
    error.value = e.message || 'Erro ao alterar status'
  }
}

onMounted(fetchSpecialties)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Especialidades</h1>
      <AppButton @click="openCreate">Nova Especialidade</AppButton>
    </div>

    <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{{ error }}</div>

    <AppTable
      :columns="columns"
      :data="specialties"
      :loading="loading"
      empty-message="Nenhuma especialidade encontrada."
    >
      <template #cell-name="{ value }">
        <span class="font-medium text-gray-900">{{ value }}</span>
      </template>
      <template #cell-description="{ value }">
        <span class="text-gray-600">{{ value || '-' }}</span>
      </template>
      <template #cell-is_active="{ value }">
        <button
          :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors', value ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200']"
          @click="toggleActive(specialties.find(s => s.is_active === value) || specialties[0])"
        >
          {{ value ? 'Sim' : 'Nao' }}
        </button>
      </template>
      <template #cell-actions="{ row }">
        <div class="space-x-2">
          <AppButton size="sm" variant="ghost" @click="openEdit(row)">Editar</AppButton>
          <AppButton size="sm" :variant="row.is_active ? 'danger' : 'secondary'" @click="toggleActive(row)">
            {{ row.is_active ? 'Desativar' : 'Ativar' }}
          </AppButton>
        </div>
      </template>
    </AppTable>

    <AppPagination :page="page" :total-pages="totalPages" :total="total" @update:page="(p: number) => { page = p; fetchSpecialties() }" />

    <AppModal :show="showModal" :title="editItem ? 'Editar Especialidade' : 'Nova Especialidade'" max-width="md" @close="showModal = false">
      <form @submit.prevent="save" class="space-y-4">
        <AppInput v-model="form.name" label="Nome" required />
        <AppInput v-model="form.description" label="Descricao" />
      </form>
      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Cancelar</AppButton>
        <AppButton :loading="saving" @click="save">{{ editItem ? 'Salvar' : 'Criar' }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>
