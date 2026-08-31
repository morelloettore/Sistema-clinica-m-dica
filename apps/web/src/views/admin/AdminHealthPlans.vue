<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppTable from '@/components/common/AppTable.vue'
import AppModal from '@/components/common/AppModal.vue'
import AppPagination from '@/components/common/AppPagination.vue'

interface HealthPlan {
  id: string
  name: string
  description: string | null
  coverage_percentage: number
  monthly_price: number
  is_active: boolean
  created_at: string
}

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const plans = ref<HealthPlan[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 20
const totalPages = computed(() => Math.ceil(total.value / perPage))
const showModal = ref(false)
const editItem = ref<HealthPlan | null>(null)

const form = ref({ name: '', description: '', coverage_percentage: '', monthly_price: '' })

const columns = [
  { key: 'name', label: 'Nome', sortable: true },
  { key: 'description', label: 'Descricao' },
  { key: 'coverage_percentage', label: 'Cobertura' },
  { key: 'monthly_price', label: 'Mensal' },
  { key: 'is_active', label: 'Ativo' },
  { key: 'actions', label: 'Acoes', class: 'text-right' },
]

async function fetchPlans() {
  loading.value = true
  error.value = ''
  try {
    const from = (page.value - 1) * perPage
    const { data, count, error: err } = await supabase
      .from('health_plans')
      .select('*', { count: 'exact' })
      .order('name')
      .range(from, from + perPage - 1)
    if (err) throw err
    plans.value = (data as any) ?? []
    total.value = count ?? 0
  } catch (e: any) {
    error.value = e.message || 'Erro ao carregar planos'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editItem.value = null
  form.value = { name: '', description: '', coverage_percentage: '', monthly_price: '' }
  showModal.value = true
}

function openEdit(hp: HealthPlan) {
  editItem.value = hp
  form.value = {
    name: hp.name,
    description: hp.description || '',
    coverage_percentage: hp.coverage_percentage.toString(),
    monthly_price: hp.monthly_price.toString(),
  }
  showModal.value = true
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      name: form.value.name,
      description: form.value.description || null,
      coverage_percentage: Number(form.value.coverage_percentage),
      monthly_price: Number(form.value.monthly_price),
    }
    if (editItem.value) {
      const { error: err } = await supabase.from('health_plans').update(payload).eq('id', editItem.value.id)
      if (err) throw err
    } else {
      const { error: err } = await supabase.from('health_plans').insert({ ...payload, is_active: true })
      if (err) throw err
    }
    showModal.value = false
    await fetchPlans()
  } catch (e: any) {
    error.value = e.message || 'Erro ao salvar'
  } finally {
    saving.value = false
  }
}

async function toggleActive(hp: HealthPlan) {
  try {
    const { error: err } = await supabase
      .from('health_plans')
      .update({ is_active: !hp.is_active })
      .eq('id', hp.id)
    if (err) throw err
    await fetchPlans()
  } catch (e: any) {
    error.value = e.message || 'Erro ao alterar status'
  }
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

onMounted(fetchPlans)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Planos de Saude</h1>
      <AppButton @click="openCreate">Novo Plano</AppButton>
    </div>

    <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{{ error }}</div>

    <AppTable
      :columns="columns"
      :data="plans"
      :loading="loading"
      empty-message="Nenhum plano encontrado."
    >
      <template #cell-name="{ value }">
        <span class="font-medium text-gray-900">{{ value }}</span>
      </template>
      <template #cell-description="{ value }">
        <span class="text-gray-600">{{ value || '-' }}</span>
      </template>
      <template #cell-coverage_percentage="{ value }">
        <span class="text-gray-600">{{ value }}%</span>
      </template>
      <template #cell-monthly_price="{ value }">
        <span class="text-gray-600">{{ formatCurrency(value) }}</span>
      </template>
      <template #cell-is_active="{ value }">
        <button
          :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors', value ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200']"
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

    <AppPagination :page="page" :total-pages="totalPages" :total="total" @update:page="(p: number) => { page = p; fetchPlans() }" />

    <AppModal :show="showModal" :title="editItem ? 'Editar Plano' : 'Novo Plano'" max-width="md" @close="showModal = false">
      <form @submit.prevent="save" class="space-y-4">
        <AppInput v-model="form.name" label="Nome" required />
        <AppInput v-model="form.description" label="Descricao" />
        <AppInput v-model="form.coverage_percentage" label="Cobertura (%)" type="number" min="0" max="100" required />
        <AppInput v-model="form.monthly_price" label="Preco mensal (R$)" type="number" step="0.01" min="0" required />
      </form>
      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Cancelar</AppButton>
        <AppButton :loading="saving" @click="save">{{ editItem ? 'Salvar' : 'Criar' }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>
