<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 class="text-2xl font-bold text-gray-900">Gerenciar Médicos</h1>
      <button
        @click="openCreateModal"
        class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Novo Médico
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

    <div v-else-if="doctors.length === 0" class="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
      Nenhum médico encontrado.
    </div>

    <div v-else class="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CRM</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Especialidades</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clínicas</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preço</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="doc in doctors" :key="doc.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-900">{{ doc.profile?.name ?? '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ doc.crm }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">
              {{ doc.doctor_specialties?.map((ds: any) => ds.specialty?.name).filter(Boolean).join(', ') || '—' }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-900">
              {{ doc.doctor_clinics?.map((dc: any) => dc.clinic?.name).filter(Boolean).join(', ') || '—' }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-900">
              {{ doc.consultation_price != null ? formatCurrency(doc.consultation_price) : '—' }}
            </td>
            <td class="px-4 py-3 text-sm">
              <span
                :class="doc.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              >
                {{ doc.is_active ? 'Ativo' : 'Inativo' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <div class="flex items-center gap-2">
                <button
                  @click="openEditModal(doc)"
                  class="text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  Editar
                </button>
                <button
                  @click="openAssignModal(doc)"
                  class="text-purple-600 hover:text-purple-800 text-xs font-medium"
                >
                  Atribuir
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
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Novo Médico</h2>
          <form @submit.prevent="createDoctor" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label for="doc-create-name" class="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                <input id="doc-create-name" v-model="createForm.name" required maxlength="200" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="doc-create-cpf" class="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
                <input id="doc-create-cpf" v-model="createForm.cpf" required placeholder="000.000.000-00" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="doc-create-email" class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input id="doc-create-email" v-model="createForm.email" type="email" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="doc-create-password" class="block text-sm font-medium text-gray-700 mb-1">Senha temporária *</label>
                <input id="doc-create-password" v-model="createForm.password" type="password" required minlength="8" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="doc-create-crm" class="block text-sm font-medium text-gray-700 mb-1">CRM *</label>
                <input id="doc-create-crm" v-model="createForm.crm" required maxlength="10" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="doc-create-price" class="block text-sm font-medium text-gray-700 mb-1">Preço da Consulta (R$)</label>
                <input id="doc-create-price" v-model.number="createForm.consultation_price" type="number" min="0" step="0.01" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div class="sm:col-span-2">
                <label for="doc-create-phone" class="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input id="doc-create-phone" v-model="createForm.phone" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div class="sm:col-span-2">
                <label for="doc-create-bio" class="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea id="doc-create-bio" v-model="createForm.bio" rows="3" maxlength="2000" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
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
                {{ submitting ? 'Salvando...' : 'Criar Médico' }}
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
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Editar Médico</h2>
          <form @submit.prevent="updateDoctor" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label for="doc-edit-bio" class="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea id="doc-edit-bio" v-model="editForm.bio" rows="3" maxlength="2000" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="doc-edit-price" class="block text-sm font-medium text-gray-700 mb-1">Preço da Consulta (R$)</label>
                <input id="doc-edit-price" v-model.number="editForm.consultation_price" type="number" min="0" step="0.01" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label for="doc-edit-phone" class="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input id="doc-edit-phone" v-model="editForm.phone" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
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
        v-if="showAssignModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
        @click.self="showAssignModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4 my-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">
            Atribuir Especialidades e Clínicas
            <span v-if="assignDoctor" class="text-sm font-normal text-gray-500">
              — {{ assignDoctor.profile?.name }}
            </span>
          </h2>
          <form @submit.prevent="saveAssignments" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Especialidades</label>
              <div class="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                <label
                  v-for="spec in allSpecialties"
                  :key="spec.id"
                  class="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :value="spec.id"
                    v-model="assignForm.specialtyIds"
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {{ spec.name }}
                </label>
                <p v-if="allSpecialties.length === 0" class="text-sm text-gray-400">Nenhuma especialidade disponível.</p>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Clínicas</label>
              <div class="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                <label
                  v-for="clinic in allClinics"
                  :key="clinic.id"
                  class="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :value="clinic.id"
                    v-model="assignForm.clinicIds"
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {{ clinic.name }}
                </label>
                <p v-if="allClinics.length === 0" class="text-sm text-gray-400">Nenhuma clínica disponível.</p>
              </div>
            </div>

            <div v-if="formError" class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {{ formError }}
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showAssignModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" :disabled="submitting" class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {{ submitting ? 'Salvando...' : 'Salvar Atribuições' }}
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
const doctors = ref<any[]>([])
const allSpecialties = ref<any[]>([])
const allClinics = ref<any[]>([])

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showAssignModal = ref(false)
const assignDoctor = ref<any>(null)

const createForm = reactive({
  name: '',
  cpf: '',
  email: '',
  password: '',
  crm: '',
  phone: '',
  bio: '',
  consultation_price: null as number | null,
})

const editForm = reactive({
  doctorId: '',
  profileId: '',
  bio: '',
  consultation_price: null as number | null,
  phone: '',
})

const assignForm = reactive({
  specialtyIds: [] as string[],
  clinicIds: [] as string[],
})

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function loadDoctors() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: err } = await supabase
      .from('doctors')
      .select(`
        id, profile_id, crm, bio, consultation_price, is_active, created_at,
        profile:profiles(name, cpf, email, phone),
        doctor_specialties(specialty_id, specialty:specialties(id, name)),
        doctor_clinics(clinic_id, clinic:clinics(id, name))
      `)
      .order('created_at', { ascending: false })

    if (err) throw err
    doctors.value = data ?? []
  } catch (e: any) {
    error.value = e.message ?? 'Erro ao carregar médicos.'
  } finally {
    loading.value = false
  }
}

async function loadSpecialtiesAndClinics() {
  const [specResult, clinicResult] = await Promise.all([
    supabase.from('specialties').select('id, name').eq('is_active', true),
    supabase.from('clinics').select('id, name').eq('is_active', true),
  ])
  allSpecialties.value = specResult.data ?? []
  allClinics.value = clinicResult.data ?? []
}

function openCreateModal() {
  Object.assign(createForm, { name: '', cpf: '', email: '', password: '', crm: '', phone: '', bio: '', consultation_price: null })
  formError.value = ''
  showCreateModal.value = true
}

async function createDoctor() {
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
          role: 'doctor',
        },
      },
    })

    if (authErr) throw authErr
    if (!authData.user) throw new Error('Falha ao criar usuário')

    const { error: doctorErr } = await supabase
      .from('doctors')
      .insert({
        profile_id: authData.user.id,
        crm: createForm.crm,
        bio: createForm.bio || null,
        consultation_price: createForm.consultation_price,
      })

    if (doctorErr) throw doctorErr

    showCreateModal.value = false
    await loadDoctors()
  } catch (e: any) {
    formError.value = e.message ?? 'Erro ao criar médico.'
  } finally {
    submitting.value = false
  }
}

function openEditModal(doc: any) {
  Object.assign(editForm, {
    doctorId: doc.id,
    profileId: doc.profile_id,
    bio: doc.bio ?? '',
    consultation_price: doc.consultation_price ?? null,
    phone: doc.profile?.phone ?? '',
  })
  formError.value = ''
  showEditModal.value = true
}

async function updateDoctor() {
  submitting.value = true
  formError.value = ''
  try {
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ phone: editForm.phone || null })
      .eq('id', editForm.profileId)

    if (profileErr) throw profileErr

    const { error: doctorErr } = await supabase
      .from('doctors')
      .update({
        bio: editForm.bio || null,
        consultation_price: editForm.consultation_price,
      })
      .eq('id', editForm.doctorId)

    if (doctorErr) throw doctorErr

    showEditModal.value = false
    await loadDoctors()
  } catch (e: any) {
    formError.value = e.message ?? 'Erro ao atualizar médico.'
  } finally {
    submitting.value = false
  }
}

async function openAssignModal(doc: any) {
  assignDoctor.value = doc
  await loadSpecialtiesAndClinics()
  assignForm.specialtyIds = doc.doctor_specialties?.map((ds: any) => ds.specialty_id) ?? []
  assignForm.clinicIds = doc.doctor_clinics?.map((dc: any) => dc.clinic_id) ?? []
  formError.value = ''
  showAssignModal.value = true
}

async function saveAssignments() {
  if (!assignDoctor.value) return
  submitting.value = true
  formError.value = ''
  try {
    const doctorId = assignDoctor.value.id

    const { error: delSpecErr } = await supabase
      .from('doctor_specialties')
      .delete()
      .eq('doctor_id', doctorId)
    if (delSpecErr) throw delSpecErr

    if (assignForm.specialtyIds.length > 0) {
      const specInserts = assignForm.specialtyIds.map((sid) => ({
        doctor_id: doctorId,
        specialty_id: sid,
      }))
      const { error: insSpecErr } = await supabase
        .from('doctor_specialties')
        .insert(specInserts)
      if (insSpecErr) throw insSpecErr
    }

    const { error: delClinicErr } = await supabase
      .from('doctor_clinics')
      .delete()
      .eq('doctor_id', doctorId)
    if (delClinicErr) throw delClinicErr

    if (assignForm.clinicIds.length > 0) {
      const clinicInserts = assignForm.clinicIds.map((cid) => ({
        doctor_id: doctorId,
        clinic_id: cid,
      }))
      const { error: insClinicErr } = await supabase
        .from('doctor_clinics')
        .insert(clinicInserts)
      if (insClinicErr) throw insClinicErr
    }

    showAssignModal.value = false
    await loadDoctors()
  } catch (e: any) {
    formError.value = e.message ?? 'Erro ao salvar atribuições.'
  } finally {
    submitting.value = false
  }
}

onMounted(loadDoctors)
</script>
