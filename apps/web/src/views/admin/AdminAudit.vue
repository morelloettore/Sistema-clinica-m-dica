<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import AppCard from '@/components/common/AppCard.vue'
import AppTable from '@/components/common/AppTable.vue'
import AppPagination from '@/components/common/AppPagination.vue'

interface AuditLog {
  id: string
  user_id: string | null
  action: string
  table_name: string
  record_id: string
  old_data: Record<string, any> | null
  new_data: Record<string, any> | null
  ip_address: string | null
  created_at: string
  user: { name: string } | null
  user_name: string
}

const loading = ref(true)
const error = ref('')
const logs = ref<AuditLog[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 30
const totalPages = computed(() => Math.ceil(total.value / perPage))

const dateFrom = ref('')
const dateTo = ref('')
const userFilter = ref('')
const actionFilter = ref('')
const tableFilter = ref('')
const expandedId = ref<string | null>(null)

const actionOptions = [
  { label: 'Todas', value: '' },
  { label: 'INSERT', value: 'INSERT' },
  { label: 'UPDATE', value: 'UPDATE' },
  { label: 'DELETE', value: 'DELETE' },
]

const tableOptions = [
  { label: 'Todas', value: '' },
  { label: 'appointments', value: 'appointments' },
  { label: 'patients', value: 'patients' },
  { label: 'doctors', value: 'doctors' },
  { label: 'profiles', value: 'profiles' },
  { label: 'medical_records', value: 'medical_records' },
  { label: 'health_plans', value: 'health_plans' },
  { label: 'schedules', value: 'schedules' },
  { label: 'specialties', value: 'specialties' },
  { label: 'clinics', value: 'clinics' },
]

const columns = [
  { key: 'created_at', label: 'Data', sortable: true },
  { key: 'user_name', label: 'Usuario' },
  { key: 'action', label: 'Acao' },
  { key: 'table_name', label: 'Tabela' },
  { key: 'record_id', label: 'Record ID' },
  { key: 'expand', label: 'Detalhes' },
]

async function fetchLogs() {
  loading.value = true
  error.value = ''
  try {
    const from = (page.value - 1) * perPage
    let query = supabase
      .from('audit_logs')
      .select('*, user:profiles(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1)

    if (dateFrom.value) query = query.gte('created_at', dateFrom.value)
    if (dateTo.value) query = query.lte('created_at', dateTo.value + 'T23:59:59')
    if (actionFilter.value) query = query.eq('action', actionFilter.value as any)
    if (tableFilter.value) query = query.eq('table_name', tableFilter.value)
    if (userFilter.value) query = query.ilike('user.name', `%${userFilter.value}%`)

    const { data, count, error: err } = await query
    if (err) throw err

    const enriched: any[] = (data as any[] ?? []).map((log: any) => ({
      ...log,
      user_name: log.user?.name || 'Sistema',
    }))

    logs.value = enriched
    total.value = count ?? 0
  } catch (e: any) {
    error.value = e.message || 'Erro ao carregar auditoria'
  } finally {
    loading.value = false
  }
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function formatAction(action: string) {
  const map: Record<string, string> = { INSERT: 'Inseriu', UPDATE: 'Atualizou', DELETE: 'Removeu' }
  return map[action] || action
}

function actionBadgeClass(action: string) {
  const map: Record<string, string> = {
    INSERT: 'bg-green-100 text-green-800',
    UPDATE: 'bg-yellow-100 text-yellow-800',
    DELETE: 'bg-red-100 text-red-800',
  }
  return map[action] || 'bg-gray-100 text-gray-800'
}

function formatJson(obj: Record<string, any> | null) {
  if (!obj) return '-'
  return JSON.stringify(obj, null, 2)
}

function exportCsv() {
  const headers = ['Data', 'Usuario', 'Acao', 'Tabela', 'Record ID', 'IP']
  const rows = logs.value.map(log => [
    new Date(log.created_at).toLocaleString('pt-BR'),
    log.user_name || 'Sistema',
    log.action,
    log.table_name,
    log.record_id,
    log.ip_address || '',
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(fetchLogs)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Auditoria</h1>
      <AppButton variant="secondary" @click="exportCsv">Exportar CSV</AppButton>
    </div>

    <AppCard>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <AppInput v-model="dateFrom" label="Data inicio" type="date" />
        <AppInput v-model="dateTo" label="Data fim" type="date" />
        <AppInput v-model="userFilter" label="Usuario" placeholder="Nome do usuario..." />
        <AppSelect v-model="actionFilter" label="Acao" :options="actionOptions" />
        <AppSelect v-model="tableFilter" label="Tabela" :options="tableOptions" />
      </div>
      <div class="mt-3 flex gap-2">
        <AppButton size="sm" @click="page = 1; fetchLogs()">Filtrar</AppButton>
        <AppButton size="sm" variant="ghost" @click="dateFrom = ''; dateTo = ''; userFilter = ''; actionFilter = ''; tableFilter = ''; page = 1; fetchLogs()">Limpar</AppButton>
      </div>
    </AppCard>

    <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{{ error }}</div>

    <AppTable
      :columns="columns"
      :data="logs"
      :loading="loading"
      empty-message="Nenhum log de auditoria encontrado."
    >
      <template #cell-created_at="{ value }">
        <span class="whitespace-nowrap">{{ new Date(value).toLocaleString('pt-BR') }}</span>
      </template>
      <template #cell-user_name="{ value }">
        <span class="text-gray-900">{{ value }}</span>
      </template>
      <template #cell-action="{ value }">
        <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', actionBadgeClass(value)]">
          {{ formatAction(value) }}
        </span>
      </template>
      <template #cell-record_id="{ value }">
        <span class="font-mono text-xs text-gray-500">{{ String(value).slice(0, 8) }}...</span>
      </template>
      <template #cell-expand="{ row }">
        <button
          class="text-xs text-gray-400 hover:text-blue-600"
          @click="toggleExpand(row.id)"
        >
          {{ expandedId === row.id ? 'Recolher' : 'Expandir' }}
        </button>
      </template>
    </AppTable>

    <div v-for="log in logs" :key="'expand-' + log.id">
      <div v-if="expandedId === log.id" class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-2">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p class="font-medium text-gray-700 mb-1">Dados anteriores:</p>
            <pre class="bg-white border border-gray-200 rounded p-2 text-xs overflow-x-auto max-h-48">{{ formatJson(log.old_data) }}</pre>
          </div>
          <div>
            <p class="font-medium text-gray-700 mb-1">Dados novos:</p>
            <pre class="bg-white border border-gray-200 rounded p-2 text-xs overflow-x-auto max-h-48">{{ formatJson(log.new_data) }}</pre>
          </div>
        </div>
        <p v-if="log.ip_address" class="text-xs text-gray-400 mt-2">IP: {{ log.ip_address }}</p>
      </div>
    </div>

    <AppPagination :page="page" :total-pages="totalPages" :total="total" @update:page="(p: number) => { page = p; fetchLogs() }" />
  </div>
</template>
