<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 class="text-2xl font-bold text-gray-900">Gerenciar Pacientes</h1>
      <button
        @click="openCreateModal"
        class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Novo Paciente
      </button>
    </div>

    <div class="bg-white rounded-lg shadow border border-gray-200 p-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="search-name" class="block text-xs font-medium text-gray-500 mb-1">Buscar por nome</label>
          <input
            id="search-name"
            v-model="search"
            type="text"
            placeholder="Digite o nome do paciente..."
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label for="search-cpf" class="block text-xs font-medium text-gray-500 mb-1">Buscar por CPF</label>
          <input
            id="search-cpf"
            v-model="searchCpf"
            type="text"
            placeholder="Digite o CPF..."
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

    <div v-else-if="patients.length === 0" class="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
      Nenhum paciente encontrado.
    </div>

    <div v-else class="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPF</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="p in patients" :key="p.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-900">{{ p.profile?.name ?? '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ p.profile?.cpf ?? '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ p.profile?.phone ?? '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ p.profile?.email ?? '—' }}</td>
            <td class="px-4 py-3 text-sm">
              <span
                :class="p.profile?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              >
                {{ p.profile?.is_active ? 'Ativo' : 'Inativo' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <button
                @click="openEditModal(p)"
                class="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3"
              >
                Editar
              </button>
              <button
                @click="viewDetails(p)"
                class="text-gray-600 hover:text-gray-800 text-xs font-medium"
              >
                Detalhes
              </button>
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
        <button
          @click="page--; loadPatients()"
          :disabled="page <= 1"
          class="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          @click="page++; loadPatients()"
          :disabled="page >= totalPages"
          class="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Próxima
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4 my-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Novo Paciente</h2>
          <form @submit.prevent="createPatient" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label for="create-name" class="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                <input id="create-name" v-model="createForm.name" required maxlength="200" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="create-cpf" class="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
                <input id="create-cpf" v-model="createForm.cpf" required placeholder="000.000.000-00" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="create-email" class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input id="create-email" v-model="createForm.email" type="email" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="create-password" class="block text-sm font-medium text-gray-700 mb-1">Senha temporária *</label>
                <input id="create-password" v-model="createForm.password" type="password" required minlength="8" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="create-phone" class="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input id="create-phone" v-model="createForm.phone" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="create-dob" class="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento *</label>
                <input id="create-dob" v-model="createForm.date_of_birth" type="date" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="create-gender" class="block text-sm font-medium text-gray-700 mb-1">Gênero *</label>
                <select id="create-gender" v-model="createForm.gender" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="" disabled>Selecione</option>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label for="create-address" class="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input id="create-address" v-model="createForm.address" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>

            <div v-if="formError" class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {{ formError }}
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showCreateModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" :disabled="submitting" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {{ submitting ? 'Salvando...' : 'Criar Paciente' }}
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
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Editar Paciente</h2>
          <form @submit.prevent="updatePatient" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label for="edit-name" class="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                <input id="edit-name" v-model="editForm.name" maxlength="200" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="edit-phone" class="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input id="edit-phone" v-model="editForm.phone" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="edit-dob" class="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                <input id="edit-dob" v-model="editForm.date_of_birth" type="date" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="edit-gender" class="block text-sm font-medium text-gray-700 mb-1">Gênero</label>
                <select id="edit-gender" v-model="editForm.gender" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label for="edit-address" class="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input id="edit-address" v-model="editForm.address" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="edit-city" class="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                <input id="edit-city" v-model="editForm.city" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="edit-state" class="block text-sm font-medium text-gray-700 mb-1">UF</label>
                <input id="edit-state" v-model="editForm.state" maxlength="2" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="edit-zip" class="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                <input id="edit-zip" v-model="editForm.zip_code" maxlength="8" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
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

    <Teleport to="body">
      <div
        v-if="showDetailModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
        @click.self="showDetailModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4 my-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Detalhes do Paciente</h2>
          <div v-if="detailPatient" class="space-y-3 text-sm">
            <div class="grid grid-cols-2 gap-3">
              <div><span class="font-medium text-gray-500">Nome:</span> {{ detailPatient.profile?.name }}</div>
              <div><span class="font-medium text-gray-500">CPF:</span> {{ detailPatient.profile?.cpf }}</div>
              <div><span class="font-medium text-gray-500">Email:</span> {{ detailPatient.profile?.email }}</div>
              <div><span class="font-medium text-gray-500">Telefone:</span> {{ detailPatient.profile?.phone ?? '—' }}</div>
              <div><span class="font-medium text-gray-500">Nascimento:</span> {{ formatDate(detailPatient.date_of_birth) }}</div>
              <div><span class="font-medium text-gray-500">Gênero:</span> {{ genderLabel(detailPatient.gender) }}</div>
              <div class="col-span-2"><span class="font-medium text-gray-500">Endereço:</span> {{ detailPatient.address ?? '—' }}</div>
              <div><span class="font-medium text-gray-500">Cidade:</span> {{ detailPatient.city ?? '—' }}</div>
              <div><span class="font-medium text-gray-500">UF:</span> {{ detailPatient.state ?? '—' }}</div>
              <div><span class="font-medium text-gray-500">CEP:</span> {{ detailPatient.zip_code ?? '—' }}</div>
              <div><span class="font-medium text-gray-500">Tipo Sanguíneo:</span> {{ detailPatient.blood_type ?? '—' }}</div>
              <div class="col-span-2"><span class="font-medium text-gray-500">Alergias:</span> {{ detailPatient.allergies ?? '—' }}</div>
            </div>
          </div>
          <div class="flex justify-end pt-4">
            <button @click="showDetailModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Fechar
            </button>
          </div>
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
const error = ref('')
const formError = ref('')
const patients = ref<any[]>([])
const search = ref('')
const searchCpf = ref('')
const page = ref(1)
const total = ref(0)
const perPage = 20
const totalPages = computed(() => Math.ceil(total.value / perPage))

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDetailModal = ref(false)
const detailPatient = ref<any>(null)

const createForm = reactive({
  name: '',
  cpf: '',
  email: '',
  password: '',
  phone: '',
  date_of_birth: '',
  gender: '' as '' | 'male' | 'female' | 'other',
  address: '',
})

const editForm = reactive({
  patientId: '',
  profileId: '',
  name: '',
  phone: '',
  date_of_birth: '',
  gender: '' as '' | 'male' | 'female' | 'other',
  address: '',
  city: '',
  state: '',
  zip_code: '',
})

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function genderLabel(g: string) {
  const map: Record<string, string> = { male: 'Masculino', female: 'Feminino', other: 'Outro' }
  return map[g] ?? g
}

async function loadPatients() {
  loading.value = true
  error.value = ''
  try {
    let query = supabase
      .from('patients')
      .select(
        `id, profile_id, date_of_birth, gender, address, city, state, zip_code, blood_type, allergies, created_at,
         profile:profiles(id, name, cpf, email, phone, is_active)`,
        { count: 'exact' },
      )

    if (search.value) {
      query = query.ilike('profile.name', `%${search.value}%`)
    }
    if (searchCpf.value) {
      query = query.ilike('profile.cpf', `%${searchCpf.value}%`)
    }

    const offset = (page.value - 1) * perPage
    const { data, count, error: err } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (err) throw err
    patients.value = data ?? []
    total.value = count ?? 0
  } catch (e: any) {
    error.value = e.message ?? 'Erro ao carregar pacientes.'
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  Object.assign(createForm, { name: '', cpf: '', email: '', password: '', phone: '', date_of_birth: '', gender: '', address: '' })
  formError.value = ''
  showCreateModal.value = true
}

async function createPatient() {
  submitting.value = true
  formError.value = ''
  try {
    const cpfDigits = createForm.cpf.replace(/\D/g, '')
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: createForm.email,
      password: createForm.password,
      options: {
        data: {
          name: createForm.name,
          cpf: cpfDigits,
          role: 'patient',
        },
      },
    })

    if (authErr) throw authErr
    if (!authData.user) throw new Error('Falha ao criar usuário')

    const { error: patientErr } = await supabase
      .from('patients')
      .insert({
        profile_id: authData.user.id,
        date_of_birth: createForm.date_of_birth,
        gender: createForm.gender as 'male' | 'female' | 'other',
        address: createForm.address || null,
      })

    if (patientErr) throw patientErr

    showCreateModal.value = false
    await loadPatients()
  } catch (e: any) {
    formError.value = e.message ?? 'Erro ao criar paciente.'
  } finally {
    submitting.value = false
  }
}

function openEditModal(patient: any) {
  Object.assign(editForm, {
    patientId: patient.id,
    profileId: patient.profile_id,
    name: patient.profile?.name ?? '',
    phone: patient.profile?.phone ?? '',
    date_of_birth: patient.date_of_birth ?? '',
    gender: patient.gender ?? '',
    address: patient.address ?? '',
    city: patient.city ?? '',
    state: patient.state ?? '',
    zip_code: patient.zip_code ?? '',
  })
  formError.value = ''
  showEditModal.value = true
}

async function updatePatient() {
  submitting.value = true
  formError.value = ''
  try {
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        name: editForm.name,
        phone: editForm.phone || null,
      })
      .eq('id', editForm.profileId)

    if (profileErr) throw profileErr

    const { error: patientErr } = await supabase
      .from('patients')
      .update({
        date_of_birth: editForm.date_of_birth,
        gender: editForm.gender as 'male' | 'female' | 'other',
        address: editForm.address || null,
        city: editForm.city || null,
        state: editForm.state || null,
        zip_code: editForm.zip_code || null,
      })
      .eq('id', editForm.patientId)

    if (patientErr) throw patientErr

    showEditModal.value = false
    await loadPatients()
  } catch (e: any) {
    formError.value = e.message ?? 'Erro ao atualizar paciente.'
  } finally {
    submitting.value = false
  }
}

function viewDetails(patient: any) {
  detailPatient.value = patient
  showDetailModal.value = true
}

function watchSearch() {
  let prevSearch = search.value
  let prevCpf = searchCpf.value
  setInterval(() => {
    if (search.value !== prevSearch || searchCpf.value !== prevCpf) {
      prevSearch = search.value
      prevCpf = searchCpf.value
      page.value = 1
      loadPatients()
    }
  }, 500)
}

onMounted(async () => {
  await loadPatients()
  watchSearch()
})
</script>
