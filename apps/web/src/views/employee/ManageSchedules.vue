<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 class="text-2xl font-bold text-gray-900">Gerenciar Horários</h1>
      <div class="flex gap-2">
        <button
          @click="openBulkModal"
          class="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Criar em Lote
        </button>
        <button
          @click="openCreateModal"
          class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Novo Horário
        </button>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow border border-gray-200 p-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label for="sch-filter-doctor" class="block text-xs font-medium text-gray-500 mb-1">Médico</label>
          <select
            id="sch-filter-doctor"
            v-model="filters.doctorId"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos</option>
            <option v-for="doc in doctorsList" :key="doc.id" :value="doc.id">
              {{ doc.profile?.name }}
            </option>
          </select>
        </div>
        <div>
          <label for="sch-filter-clinic" class="block text-xs font-medium text-gray-500 mb-1">Clínica</label>
          <select
            id="sch-filter-clinic"
            v-model="filters.clinicId"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todas</option>
            <option v-for="c in clinicsList" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </div>
        <div>
          <label for="sch-filter-date-from" class="block text-xs font-medium text-gray-500 mb-1">Data Início</label>
          <input
            id="sch-filter-date-from"
            v-model="filters.dateFrom"
            type="date"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label for="sch-filter-date-to" class="block text-xs font-medium text-gray-500 mb-1">Data Fim</label>
          <input
            id="sch-filter-date-to"
            v-model="filters.dateTo"
            type="date"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
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

    <div v-else-if="schedules.length === 0" class="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
      Nenhum horário encontrado.
    </div>

    <div v-else class="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Médico</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clínica</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Início</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fim</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Máx.</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disponível</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="sch in schedules" :key="sch.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-900">{{ sch.doctor?.profile?.name ?? '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ sch.clinic?.name ?? '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ formatDate(sch.date) }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ sch.start_time?.slice(0, 5) }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ sch.end_time?.slice(0, 5) }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ sch.max_slots }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">
              <span :class="sch.available_slots === 0 ? 'text-red-600 font-medium' : ''">
                {{ sch.available_slots }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <span
                :class="sch.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              >
                {{ sch.is_active ? 'Ativo' : 'Inativo' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <div class="flex items-center gap-2">
                <button
                  @click="openEditModal(sch)"
                  class="text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  Editar
                </button>
                <button
                  v-if="sch.available_slots === sch.max_slots"
                  @click="openDeleteModal(sch)"
                  class="text-red-600 hover:text-red-800 text-xs font-medium"
                >
                  Excluir
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <p class="text-sm text-gray-500">
        Página {{ page }} de {{ totalPages }} ({{ total }} registros)
      </p>
      <div class="flex gap-2">
        <button @click="page--; loadSchedules()" :disabled="page <= 1" class="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Anterior</button>
        <button @click="page++; loadSchedules()" :disabled="page >= totalPages" class="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Próxima</button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4 my-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Novo Horário</h2>
          <form @submit.prevent="createSchedule" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label for="sch-create-doctor" class="block text-sm font-medium text-gray-700 mb-1">Médico *</label>
                <select id="sch-create-doctor" v-model="createForm.doctor_id" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="" disabled>Selecione</option>
                  <option v-for="doc in doctorsList" :key="doc.id" :value="doc.id">{{ doc.profile?.name }}</option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label for="sch-create-clinic" class="block text-sm font-medium text-gray-700 mb-1">Clínica *</label>
                <select id="sch-create-clinic" v-model="createForm.clinic_id" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="" disabled>Selecione</option>
                  <option v-for="c in clinicsList" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
              <div>
                <label for="sch-create-date" class="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                <input id="sch-create-date" v-model="createForm.date" type="date" required :min="todayStr" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="sch-create-max" class="block text-sm font-medium text-gray-700 mb-1">Vagas Máximas *</label>
                <input id="sch-create-max" v-model.number="createForm.max_slots" type="number" min="1" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="sch-create-start" class="block text-sm font-medium text-gray-700 mb-1">Horário Início *</label>
                <input id="sch-create-start" v-model="createForm.start_time" type="time" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="sch-create-end" class="block text-sm font-medium text-gray-700 mb-1">Horário Fim *</label>
                <input id="sch-create-end" v-model="createForm.end_time" type="time" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>

            <div v-if="formError" class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{{ formError }}</div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showCreateModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" :disabled="submitting" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {{ submitting ? 'Salvando...' : 'Criar Horário' }}
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
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Editar Horário</h2>
          <form @submit.prevent="updateSchedule" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="sch-edit-date" class="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input id="sch-edit-date" v-model="editForm.date" type="date" :min="todayStr" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="sch-edit-max" class="block text-sm font-medium text-gray-700 mb-1">Vagas Máximas</label>
                <input id="sch-edit-max" v-model.number="editForm.max_slots" type="number" min="1" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="sch-edit-start" class="block text-sm font-medium text-gray-700 mb-1">Horário Início</label>
                <input id="sch-edit-start" v-model="editForm.start_time" type="time" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="sch-edit-end" class="block text-sm font-medium text-gray-700 mb-1">Horário Fim</label>
                <input id="sch-edit-end" v-model="editForm.end_time" type="time" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div class="sm:col-span-2">
                <label for="sch-edit-active" class="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input id="sch-edit-active" type="checkbox" v-model="editForm.is_active" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Ativo
                </label>
              </div>
            </div>
            <p v-if="editForm.bookedCount > 0" class="text-xs text-amber-600">
              {{ editForm.bookedCount }} consulta(s) já agendada(s) neste horário. A capacidade mínima é {{ editForm.bookedCount }}.
            </p>

            <div v-if="formError" class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{{ formError }}</div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showEditModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" :disabled="submitting" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {{ submitting ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showDeleteModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
          <h2 class="text-lg font-semibold text-gray-900 mb-2">Excluir Horário</h2>
          <p class="text-sm text-gray-600 mb-4">
            Tem certeza que deseja excluir este horário? Esta ação não pode ser desfeita.
          </p>
          <div class="flex justify-end gap-3">
            <button @click="showDeleteModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Voltar</button>
            <button
              @click="deleteSchedule"
              :disabled="actingId !== null"
              class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {{ actingId ? 'Excluindo...' : 'Sim, Excluir' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showBulkModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
        @click.self="showBulkModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4 my-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Criar Horários em Lote</h2>
          <form @submit.prevent="createBulkSchedules" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label for="bulk-doctor" class="block text-sm font-medium text-gray-700 mb-1">Médico *</label>
                <select id="bulk-doctor" v-model="bulkForm.doctor_id" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="" disabled>Selecione</option>
                  <option v-for="doc in doctorsList" :key="doc.id" :value="doc.id">{{ doc.profile?.name }}</option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label for="bulk-clinic" class="block text-sm font-medium text-gray-700 mb-1">Clínica *</label>
                <select id="bulk-clinic" v-model="bulkForm.clinic_id" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="" disabled>Selecione</option>
                  <option v-for="c in clinicsList" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
              <div>
                <label for="bulk-start" class="block text-sm font-medium text-gray-700 mb-1">Data Início *</label>
                <input id="bulk-start" v-model="bulkForm.dateStart" type="date" required :min="todayStr" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="bulk-end-date" class="block text-sm font-medium text-gray-700 mb-1">Data Fim *</label>
                <input id="bulk-end-date" v-model="bulkForm.dateEnd" type="date" required :min="bulkForm.dateStart || todayStr" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="bulk-time-start" class="block text-sm font-medium text-gray-700 mb-1">Horário Início *</label>
                <input id="bulk-time-start" v-model="bulkForm.start_time" type="time" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="bulk-time-end" class="block text-sm font-medium text-gray-700 mb-1">Horário Fim *</label>
                <input id="bulk-time-end" v-model="bulkForm.end_time" type="time" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="bulk-max" class="block text-sm font-medium text-gray-700 mb-1">Vagas Máximas *</label>
                <input id="bulk-max" v-model.number="bulkForm.max_slots" type="number" min="1" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="bulk-weekdays" class="block text-sm font-medium text-gray-700 mb-1">Dias da Semana</label>
                <div class="flex flex-wrap gap-2 mt-1">
                  <label v-for="(day, idx) in weekdayLabels" :key="idx" class="flex items-center gap-1 text-xs">
                    <input type="checkbox" :value="idx" v-model="bulkForm.weekdays" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    {{ day }}
                  </label>
                </div>
              </div>
            </div>

            <p v-if="bulkDateCount > 0" class="text-xs text-gray-500">
              Serão criados {{ bulkDateCount }} horário(s).
            </p>

            <div v-if="formError" class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{{ formError }}</div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showBulkModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" :disabled="submitting || bulkDateCount === 0" class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {{ creating ? 'Criando...' : 'Criar em Lote' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const loading = ref(true)
const submitting = ref(false)
const creating = ref(false)
const error = ref('')
const formError = ref('')
const schedules = ref<any[]>([])
const doctorsList = ref<any[]>([])
const clinicsList = ref<any[]>([])
const page = ref(1)
const total = ref(0)
const perPage = 20
const totalPages = computed(() => Math.ceil(total.value / perPage))
const actingId = ref<string | null>(null)

const todayStr = new Date().toISOString().slice(0, 10)

const filters = reactive({ doctorId: '', clinicId: '', dateFrom: '', dateTo: '' })

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const showBulkModal = ref(false)
const deleteTarget = ref<any>(null)

const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const createForm = reactive({
  doctor_id: '',
  clinic_id: '',
  date: '',
  start_time: '',
  end_time: '',
  max_slots: 10,
})

const editForm = reactive({
  scheduleId: '',
  date: '',
  start_time: '',
  end_time: '',
  max_slots: 10,
  is_active: true,
  bookedCount: 0,
})

const bulkForm = reactive({
  doctor_id: '',
  clinic_id: '',
  dateStart: '',
  dateEnd: '',
  start_time: '',
  end_time: '',
  max_slots: 10,
  weekdays: [1, 2, 3, 4, 5],
})

const bulkDateCount = computed(() => {
  if (!bulkForm.dateStart || !bulkForm.dateEnd) return 0
  const start = new Date(bulkForm.dateStart + 'T00:00:00')
  const end = new Date(bulkForm.dateEnd + 'T00:00:00')
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    if (bulkForm.weekdays.includes(d.getDay())) count++
    d.setDate(d.getDate() + 1)
  }
  return count
})

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

async function loadSchedules() {
  loading.value = true
  error.value = ''
  try {
    let query = supabase
      .from('schedules')
      .select(
        `id, doctor_id, clinic_id, date, start_time, end_time, max_slots, available_slots, is_active, created_at,
         doctor:doctors(id, profile:profiles(name)),
         clinic:clinics(id, name)`,
        { count: 'exact' },
      )

    if (filters.doctorId) query = query.eq('doctor_id', filters.doctorId)
    if (filters.clinicId) query = query.eq('clinic_id', filters.clinicId)
    if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('date', filters.dateTo)

    const offset = (page.value - 1) * perPage
    const { data, count, error: err } = await query
      .order('date', { ascending: false })
      .order('start_time')
      .range(offset, offset + perPage - 1)

    if (err) throw err
    schedules.value = data ?? []
    total.value = count ?? 0
  } catch (e: any) {
    error.value = e.message ?? 'Erro ao carregar horários.'
  } finally {
    loading.value = false
  }
}

async function loadDoctorsAndClinics() {
  const [docResult, clinResult] = await Promise.all([
    supabase
      .from('doctors')
      .select('id, profile:profiles(name)')
      .eq('is_active', true),
    supabase
      .from('clinics')
      .select('id, name')
      .eq('is_active', true),
  ])
  doctorsList.value = docResult.data ?? []
  clinicsList.value = clinResult.data ?? []
}

function openCreateModal() {
  Object.assign(createForm, { doctor_id: '', clinic_id: '', date: '', start_time: '', end_time: '', max_slots: 10 })
  formError.value = ''
  showCreateModal.value = true
}

async function createSchedule() {
  submitting.value = true
  formError.value = ''
  try {
    if (createForm.start_time >= createForm.end_time) {
      throw new Error('Horário de término deve ser após o horário de início.')
    }
    if (createForm.date < todayStr) {
      throw new Error('Não é possível criar agenda para datas passadas.')
    }

    const { error: err } = await supabase.from('schedules').insert({
      doctor_id: createForm.doctor_id,
      clinic_id: createForm.clinic_id,
      date: createForm.date,
      start_time: createForm.start_time,
      end_time: createForm.end_time,
      max_slots: createForm.max_slots,
    })
    if (err) throw err

    showCreateModal.value = false
    await loadSchedules()
  } catch (e: any) {
    formError.value = e.message ?? 'Erro ao criar horário.'
  } finally {
    submitting.value = false
  }
}

function openEditModal(sch: any) {
  const booked = sch.max_slots - sch.available_slots
  Object.assign(editForm, {
    scheduleId: sch.id,
    date: sch.date,
    start_time: sch.start_time?.slice(0, 5),
    end_time: sch.end_time?.slice(0, 5),
    max_slots: sch.max_slots,
    is_active: sch.is_active,
    bookedCount: booked,
  })
  formError.value = ''
  showEditModal.value = true
}

async function updateSchedule() {
  submitting.value = true
  formError.value = ''
  try {
    if (editForm.max_slots < editForm.bookedCount) {
      throw new Error(`Não é possível reduzir a capacidade. ${editForm.bookedCount} consulta(s) já estão agendadas.`)
    }
    if (editForm.start_time >= editForm.end_time) {
      throw new Error('Horário de término deve ser após o horário de início.')
    }

    const { error: err } = await supabase
      .from('schedules')
      .update({
        date: editForm.date,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        max_slots: editForm.max_slots,
        is_active: editForm.is_active,
      })
      .eq('id', editForm.scheduleId)
    if (err) throw err

    showEditModal.value = false
    await loadSchedules()
  } catch (e: any) {
    formError.value = e.message ?? 'Erro ao atualizar horário.'
  } finally {
    submitting.value = false
  }
}

function openDeleteModal(sch: any) {
  deleteTarget.value = sch
  showDeleteModal.value = true
}

async function deleteSchedule() {
  if (!deleteTarget.value) return
  actingId.value = deleteTarget.value.id
  try {
    const { error: err } = await supabase
      .from('schedules')
      .delete()
      .eq('id', deleteTarget.value.id)
    if (err) throw err

    showDeleteModal.value = false
    await loadSchedules()
  } catch (e: any) {
    error.value = e.message ?? 'Erro ao excluir horário.'
  } finally {
    actingId.value = null
    deleteTarget.value = null
  }
}

function openBulkModal() {
  Object.assign(bulkForm, {
    doctor_id: '',
    clinic_id: '',
    dateStart: '',
    dateEnd: '',
    start_time: '',
    end_time: '',
    max_slots: 10,
    weekdays: [1, 2, 3, 4, 5],
  })
  formError.value = ''
  showBulkModal.value = true
}

async function createBulkSchedules() {
  creating.value = true
  submitting.value = true
  formError.value = ''
  try {
    if (bulkForm.start_time >= bulkForm.end_time) {
      throw new Error('Horário de término deve ser após o horário de início.')
    }
    if (bulkForm.dateStart < todayStr) {
      throw new Error('Não é possível criar agenda para datas passadas.')
    }

    const dates: string[] = []
    const start = new Date(bulkForm.dateStart + 'T00:00:00')
    const end = new Date(bulkForm.dateEnd + 'T00:00:00')
    const d = new Date(start)
    while (d <= end) {
      if (bulkForm.weekdays.includes(d.getDay())) {
        dates.push(d.toISOString().slice(0, 10))
      }
      d.setDate(d.getDate() + 1)
    }

    if (dates.length === 0) {
      throw new Error('Nenhum dia selecionado no intervalo.')
    }

    const rows = dates.map((date) => ({
      doctor_id: bulkForm.doctor_id,
      clinic_id: bulkForm.clinic_id,
      date,
      start_time: bulkForm.start_time,
      end_time: bulkForm.end_time,
      max_slots: bulkForm.max_slots,
    }))

    const { error: err } = await supabase.from('schedules').insert(rows)
    if (err) throw err

    showBulkModal.value = false
    await loadSchedules()
  } catch (e: any) {
    formError.value = e.message ?? 'Erro ao criar horários em lote.'
  } finally {
    creating.value = false
    submitting.value = false
  }
}

function watchFilters() {
  const deep = JSON.stringify(filters)
  let prev = deep
  setInterval(() => {
    const now = JSON.stringify(filters)
    if (now !== prev) {
      prev = now
      page.value = 1
      loadSchedules()
    }
  }, 500)
}

onMounted(async () => {
  await Promise.all([loadSchedules(), loadDoctorsAndClinics()])
  watchFilters()
})
</script>
