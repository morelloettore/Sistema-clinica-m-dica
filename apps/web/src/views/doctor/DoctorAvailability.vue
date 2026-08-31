<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'

const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const loading = ref(true)
const error = ref<string | null>(null)
const doctorId = ref<string | null>(null)

interface ScheduleRow {
  id: string
  date: string
  start_time: string
  end_time: string
  max_slots: number
  available_slots: number
  clinic: { name: string } | null
}

const schedules = ref<ScheduleRow[]>([])
const showUpcomingOnly = ref(true)

const actionId = ref<string | null>(null)

function formatDate(date: string) {
  if (!date) return ''
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

function formatTime(time: string) {
  if (!time) return ''
  return time.substring(0, 5)
}

async function loadDoctorId() {
  const { data, error: e } = await supabase
    .from('doctors')
    .select('id')
    .eq('profile_id', auth.user!.id)
    .single()

  if (e || !data) {
    error.value = 'Não foi possível carregar dados do médico.'
    return false
  }
  doctorId.value = data.id
  return true
}

async function loadSchedules() {
  loading.value = true
  error.value = null

  try {
    if (!doctorId.value) {
      const ok = await loadDoctorId()
      if (!ok) return
    }

    let query = supabase
      .from('schedules')
      .select(`
        id,
        date,
        start_time,
        end_time,
        max_slots,
        available_slots,
        clinic:clinics(name)
      `)
      .eq('doctor_id', doctorId.value!)
      .eq('is_active', true)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    const { data, error: e } = await query
    if (e) throw e
    schedules.value = (data ?? []) as unknown as ScheduleRow[]
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar disponibilidade.'
  } finally {
    loading.value = false
  }
}

async function markUnavailable(record: ScheduleRow) {
  const confirmed = await confirm.confirm({
    title: 'Marcar data como indisponível',
    message: `Confirmar que você não estará disponível em ${formatDate(record.date)}? Esta ação não pode ser desfeita através desta tela.`,
    confirmText: 'Confirmar',
    variant: 'warning',
  })
  if (!confirmed) return

  actionId.value = record.id
  try {
    const { error: e } = await supabase
      .from('schedules')
      .update({ available_slots: 0 })
      .eq('id', record.id)
      .eq('doctor_id', doctorId.value!)

    if (e) throw e
    toast.success('Data marcada como indisponível.')
    await loadSchedules()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível atualizar a disponibilidade.')
  } finally {
    actionId.value = null
  }
}

const visibleSchedules = () => {
  if (!showUpcomingOnly.value) return schedules.value
  const today = new Date().toISOString().split('T')[0]
  return schedules.value.filter((s) => s.date >= today && s.available_slots > 0)
}

onMounted(loadSchedules)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Minha Disponibilidade</h2>
        <p class="mt-1 text-sm text-gray-500">
          Horários gerenciados pela equipe administrativa. Você pode marcar datas específicas como indisponíveis.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-gray-700">
          <input
            v-model="showUpcomingOnly"
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Somente horários disponíveis
        </label>
        <button
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          @click="loadSchedules"
        >
          Atualizar
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      <span class="ml-3 text-gray-600">Carregando...</span>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p class="text-red-700">{{ error }}</p>
      <button
        class="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        @click="loadSchedules"
      >
        Tentar novamente
      </button>
    </div>

    <div v-else-if="visibleSchedules().length === 0" class="rounded-lg border border-gray-200 bg-white p-10 text-center">
      <p class="text-gray-500">
        {{ showUpcomingOnly ? 'Nenhum horário disponível no momento.' : 'Nenhum horário configurado.' }}
      </p>
      <p class="mt-1 text-sm text-gray-400">
        Contate a equipe administrativa para configurar novos horários.
      </p>
    </div>

    <div v-else class="rounded-lg border border-gray-200 bg-white shadow-sm">
      <ul class="divide-y divide-gray-100">
        <li
          v-for="s in visibleSchedules()"
          :key="s.id"
          class="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex items-center gap-4">
            <div class="flex flex-col">
              <span class="text-sm font-semibold text-gray-900">{{ formatDate(s.date) }}</span>
              <span class="text-xs text-gray-500">
                {{ formatTime(s.start_time) }} – {{ formatTime(s.end_time) }}
              </span>
            </div>
            <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {{ s.clinic?.name || 'Clínica' }}
            </span>
          </div>

          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-sm text-gray-700">
                <span
                  class="font-medium"
                  :class="s.available_slots === 0 ? 'text-red-600' : 'text-green-600'"
                >
                  {{ s.available_slots }}
                </span>
                /
                {{ s.max_slots }}
                vagas
              </div>
              <div class="text-xs text-gray-400">
                {{ s.available_slots === 0 ? 'Indisponível' : 'Disponível para agendamento' }}
              </div>
            </div>

            <button
              v-if="s.available_slots > 0"
              class="rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="actionId === s.id"
              @click="markUnavailable(s)"
            >
              {{ actionId === s.id ? '...' : 'Marcar indisponível' }}
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
      <p>
        <span class="font-medium">Observação:</span> Os horários são criados e gerenciados pela equipe administrativa.
        Você pode marcar uma data específica como indisponível (definindo zero vagas disponíveis) para gerenciar sua agenda.
        Para restaurar a disponibilidade, a equipe administrativa precisa reabrir o horário.
      </p>
    </div>
  </div>
</template>
