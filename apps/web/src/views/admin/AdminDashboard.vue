<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import AppCard from '@/components/common/AppCard.vue'
import AppTable from '@/components/common/AppTable.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const stats = ref({
  users: 0,
  patients: 0,
  doctors: 0,
  appointments: 0,
})
const recentLogs = ref<any[]>([])

const logColumns = [
  { key: 'action', label: 'Acao' },
  { key: 'table_name', label: 'Tabela' },
  { key: 'record_id', label: 'Registro' },
  { key: 'created_at', label: 'Data' },
]

async function fetchDashboard() {
  loading.value = true
  error.value = ''
  try {
    const [profilesRes, patientsRes, doctorsRes, appointmentsRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('patients').select('id', { count: 'exact', head: true }),
      supabase.from('doctors').select('id', { count: 'exact', head: true }),
      supabase.from('appointments').select('id', { count: 'exact', head: true }),
      supabase
        .from('audit_logs')
        .select('id, action, table_name, record_id, created_at, user:profiles(name)')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (profilesRes.error) throw profilesRes.error
    if (patientsRes.error) throw patientsRes.error
    if (doctorsRes.error) throw doctorsRes.error
    if (appointmentsRes.error) throw appointmentsRes.error
    if (logsRes.error) throw logsRes.error

    stats.value.users = profilesRes.count ?? 0
    stats.value.patients = patientsRes.count ?? 0
    stats.value.doctors = doctorsRes.count ?? 0
    stats.value.appointments = appointmentsRes.count ?? 0
    recentLogs.value = logsRes.data ?? []
  } catch (e: any) {
    error.value = e.message || 'Erro ao carregar dashboard'
  } finally {
    loading.value = false
  }
}

function formatAction(action: string) {
  const map: Record<string, string> = { INSERT: 'Criou', UPDATE: 'Atualizou', DELETE: 'Removeu' }
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

const links = [
  { label: 'Usuarios', route: 'admin-users', color: 'bg-blue-500' },
  { label: 'Medicos', route: 'admin-doctors', color: 'bg-green-500' },
  { label: 'Funcionarios', route: 'admin-employees', color: 'bg-purple-500' },
  { label: 'Pacientes', route: 'admin-patients', color: 'bg-yellow-500' },
  { label: 'Especialidades', route: 'admin-specialties', color: 'bg-pink-500' },
  { label: 'Clinicas', route: 'admin-clinics', color: 'bg-indigo-500' },
  { label: 'Planos de Saude', route: 'admin-health-plans', color: 'bg-teal-500' },
  { label: 'Auditoria', route: 'admin-audit', color: 'bg-gray-600' },
]

onMounted(fetchDashboard)
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Dashboard Admin</h1>

    <div v-if="loading">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
      {{ error }}
      <button class="underline ml-2" @click="fetchDashboard">Tentar novamente</button>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AppCard>
          <div class="text-center">
            <p class="text-3xl font-bold text-blue-600">{{ stats.users }}</p>
            <p class="text-sm text-gray-600 mt-1">Usuarios</p>
          </div>
        </AppCard>
        <AppCard>
          <div class="text-center">
            <p class="text-3xl font-bold text-green-600">{{ stats.patients }}</p>
            <p class="text-sm text-gray-600 mt-1">Pacientes</p>
          </div>
        </AppCard>
        <AppCard>
          <div class="text-center">
            <p class="text-3xl font-bold text-purple-600">{{ stats.doctors }}</p>
            <p class="text-sm text-gray-600 mt-1">Medicos</p>
          </div>
        </AppCard>
        <AppCard>
          <div class="text-center">
            <p class="text-3xl font-bold text-yellow-600">{{ stats.appointments }}</p>
            <p class="text-sm text-gray-600 mt-1">Consultas</p>
          </div>
        </AppCard>
      </div>

      <div>
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Acesso Rapido</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            v-for="link in links"
            :key="link.route"
            :class="[
              'text-white rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity text-left',
              link.color,
            ]"
            @click="router.push({ name: link.route })"
          >
            {{ link.label }}
          </button>
        </div>
      </div>

      <AppCard>
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900">Atividade Recente</h2>
        </template>
        <AppTable
          v-if="recentLogs.length"
          :columns="logColumns"
          :data="recentLogs"
          empty-message="Nenhuma atividade registrada."
        >
          <template #cell-action="{ value }">
            <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', actionBadgeClass(value)]">
              {{ formatAction(value) }}
            </span>
          </template>
          <template #cell-record_id="{ value }">
            <span class="font-mono text-xs text-gray-400">{{ String(value).slice(0, 8) }}...</span>
          </template>
          <template #cell-created_at="{ value }">
            <span class="text-xs text-gray-400 whitespace-nowrap">{{ new Date(value).toLocaleString('pt-BR') }}</span>
          </template>
        </AppTable>
        <p v-else class="text-sm text-gray-500 py-4 text-center">Nenhuma atividade registrada.</p>
      </AppCard>
    </template>
  </div>
</template>
