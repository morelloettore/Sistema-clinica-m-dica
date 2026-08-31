<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 class="text-2xl font-bold text-gray-900">Gerenciar Planos de Saúde</h1>
      <button
        @click="openCreateModal"
        class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Novo Plano
      </button>
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

    <div v-else-if="plans.length === 0" class="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
      Nenhum plano de saúde encontrado.
    </div>

    <div v-else class="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cobertura</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preço Mensal</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="plan in plans" :key="plan.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-900 font-medium">{{ plan.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{{ plan.description ?? '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ plan.coverage_percentage }}%</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ formatCurrency(plan.monthly_price) }}</td>
            <td class="px-4 py-3 text-sm">
              <span
                :class="plan.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              >
                {{ plan.is_active ? 'Ativo' : 'Inativo' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <div class="flex items-center gap-3">
                <button
                  @click="openEditModal(plan)"
                  class="text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  Editar
                </button>
                <button
                  @click="toggleActive(plan)"
                  :disabled="actingId === plan.id"
                  :class="plan.is_active ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'"
                  class="text-xs font-medium disabled:opacity-50"
                >
                  {{ plan.is_active ? 'Desativar' : 'Ativar' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4 my-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Novo Plano de Saúde</h2>
          <form @submit.prevent="createPlan" class="space-y-4">
            <div>
              <label for="plan-create-name" class="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                id="plan-create-name"
                v-model="createForm.name"
                required
                maxlength="200"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label for="plan-create-desc" class="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea
                id="plan-create-desc"
                v-model="createForm.description"
                rows="3"
                maxlength="2000"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="plan-create-coverage" class="block text-sm font-medium text-gray-700 mb-1">Cobertura (%) *</label>
                <input
                  id="plan-create-coverage"
                  v-model.number="createForm.coverage_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label for="plan-create-price" class="block text-sm font-medium text-gray-700 mb-1">Preço Mensal (R$) *</label>
                <input
                  id="plan-create-price"
                  v-model.number="createForm.monthly_price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label for="plan-create-active" class="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  id="plan-create-active"
                  type="checkbox"
                  v-model="createForm.is_active"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Ativo
              </label>
            </div>

            <div v-if="formError" class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {{ formError }}
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showCreateModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" :disabled="submitting" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {{ submitting ? 'Salvando...' : 'Criar Plano' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showEditModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
        @click.self="showEditModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4 my-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Editar Plano de Saúde</h2>
          <form @submit.prevent="updatePlan" class="space-y-4">
            <div>
              <label for="plan-edit-name" class="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                id="plan-edit-name"
                v-model="editForm.name"
                maxlength="200"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label for="plan-edit-desc" class="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea
                id="plan-edit-desc"
                v-model="editForm.description"
                rows="3"
                maxlength="2000"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="plan-edit-coverage" class="block text-sm font-medium text-gray-700 mb-1">Cobertura (%)</label>
                <input
                  id="plan-edit-coverage"
                  v-model.number="editForm.coverage_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label for="plan-edit-price" class="block text-sm font-medium text-gray-700 mb-1">Preço Mensal (R$)</label>
                <input
                  id="plan-edit-price"
                  v-model.number="editForm.monthly_price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div v-if="formError" class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {{ formError }}
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showEditModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" :disabled="submitting" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {{ submitting ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const formError = ref('')
const plans = ref<any[]>([])
const actingId = ref<string | null>(null)

const showCreateModal = ref(false)
const showEditModal = ref(false)

const createForm = reactive({
  name: '',
  description: '',
  coverage_percentage: 0,
  monthly_price: 0,
  is_active: true,
})

const editForm = reactive({
  planId: '',
  name: '',
  description: '',
  coverage_percentage: 0,
  monthly_price: 0,
})

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function loadPlans() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: err } = await supabase
      .from('health_plans')
      .select('*')
      .order('name')

    if (err) throw err
    plans.value = data ?? []
  } catch (e: any) {
    error.value = e.message ?? 'Erro ao carregar planos de saúde.'
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  Object.assign(createForm, { name: '', description: '', coverage_percentage: 0, monthly_price: 0, is_active: true })
  formError.value = ''
  showCreateModal.value = true
}

async function createPlan() {
  submitting.value = true
  formError.value = ''
  try {
    if (createForm.coverage_percentage < 0 || createForm.coverage_percentage > 100) {
      throw new Error('Percentual de cobertura deve estar entre 0 e 100.')
    }
    if (createForm.monthly_price < 0) {
      throw new Error('Preço deve ser positivo.')
    }

    const { error: err } = await supabase.from('health_plans').insert({
      name: createForm.name,
      description: createForm.description || null,
      coverage_percentage: createForm.coverage_percentage,
      monthly_price: createForm.monthly_price,
      is_active: createForm.is_active,
    })
    if (err) throw err

    showCreateModal.value = false
    await loadPlans()
  } catch (e: any) {
    formError.value = e.message ?? 'Erro ao criar plano de saúde.'
  } finally {
    submitting.value = false
  }
}

function openEditModal(plan: any) {
  Object.assign(editForm, {
    planId: plan.id,
    name: plan.name,
    description: plan.description ?? '',
    coverage_percentage: plan.coverage_percentage,
    monthly_price: plan.monthly_price,
  })
  formError.value = ''
  showEditModal.value = true
}

async function updatePlan() {
  submitting.value = true
  formError.value = ''
  try {
    if (editForm.coverage_percentage < 0 || editForm.coverage_percentage > 100) {
      throw new Error('Percentual de cobertura deve estar entre 0 e 100.')
    }
    if (editForm.monthly_price < 0) {
      throw new Error('Preço deve ser positivo.')
    }

    const { error: err } = await supabase
      .from('health_plans')
      .update({
        name: editForm.name,
        description: editForm.description || null,
        coverage_percentage: editForm.coverage_percentage,
        monthly_price: editForm.monthly_price,
      })
      .eq('id', editForm.planId)
    if (err) throw err

    showEditModal.value = false
    await loadPlans()
  } catch (e: any) {
    formError.value = e.message ?? 'Erro ao atualizar plano de saúde.'
  } finally {
    submitting.value = false
  }
}

async function toggleActive(plan: any) {
  actingId.value = plan.id
  try {
    const { error: err } = await supabase
      .from('health_plans')
      .update({ is_active: !plan.is_active })
      .eq('id', plan.id)
    if (err) throw err
    await loadPlans()
  } catch (e: any) {
    error.value = e.message ?? 'Erro ao alterar status do plano.'
  } finally {
    actingId.value = null
  }
}

onMounted(loadPlans)
</script>
