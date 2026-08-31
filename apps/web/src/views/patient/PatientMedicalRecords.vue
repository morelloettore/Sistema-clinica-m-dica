<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Meus Prontuarios</h1>

    <LoadingSpinner v-if="loading" />

    <template v-else>
      <div v-if="records.length === 0">
        <AppCard>
          <EmptyState message="Nenhum prontuario encontrado." />
        </AppCard>
      </div>

      <template v-else>
        <div class="space-y-3">
          <div
            v-for="record in records"
            :key="record.id"
            class="rounded-xl border bg-white shadow-sm"
          >
            <button
              class="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
              @click="toggleExpand(record.id)"
            >
              <div>
                <p class="text-sm font-medium text-gray-900">{{ formatDate(record.created_at) }}</p>
                <p class="text-xs text-gray-500">Dr(a). {{ record.doctor_name }}</p>
              </div>
              <div class="flex items-center gap-3">
                <p class="hidden text-sm text-gray-700 sm:inline">{{ truncate(record.diagnosis, 60) }}</p>
                <svg
                  :class="['h-5 w-5 text-gray-400 transition-transform', expandedId === record.id ? 'rotate-180' : '']"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            <div v-if="expandedId === record.id" class="border-t px-4 py-4 space-y-3">
              <div>
                <p class="text-xs font-medium uppercase text-gray-500">Diagnostico</p>
                <p class="mt-1 text-sm text-gray-900">{{ record.diagnosis }}</p>
              </div>
              <div v-if="record.notes">
                <p class="text-xs font-medium uppercase text-gray-500">Observacoes</p>
                <p class="mt-1 text-sm text-gray-700">{{ record.notes }}</p>
              </div>
              <div v-if="record.prescription">
                <p class="text-xs font-medium uppercase text-gray-500">Receita</p>
                <p class="mt-1 text-sm text-gray-700">{{ record.prescription }}</p>
              </div>
              <div v-if="record.next_appointment_date">
                <p class="text-xs font-medium uppercase text-gray-500">Proxima Consulta</p>
                <p class="mt-1 text-sm text-gray-700">{{ formatDate(record.next_appointment_date) }}</p>
              </div>
            </div>
          </div>
        </div>

        <AppPagination
          v-if="totalPages > 1"
          v-model:page="page"
          :total-pages="totalPages"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import AppPagination from '@/components/common/AppPagination.vue'
import AppCard from '@/components/common/AppCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

interface MedicalRecordRow {
  id: string
  created_at: string
  doctor_name: string
  diagnosis: string
  notes: string | null
  prescription: string | null
  next_appointment_date: string | null
}

const loading = ref(true)
const records = ref<MedicalRecordRow[]>([])
const page = ref(1)
const perPage = 20
const total = ref(0)
const totalPages = computed(() => Math.ceil(total.value / perPage))
const expandedId = ref<string | null>(null)

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR')
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

async function fetchRecords() {
  loading.value = true
  try {
    const offset = (page.value - 1) * perPage
    const { data, count } = await supabase
      .from('medical_records')
      .select(
        `id, created_at, diagnosis, notes, prescription, next_appointment_date,
         doctor:doctors(profile:profiles(name))`,
        { count: 'exact' },
      )
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    total.value = count ?? 0
    records.value = (data ?? []).map((r: any) => ({
      id: r.id as string,
      created_at: r.created_at as string,
      doctor_name: (r.doctor?.profile?.name as string) ?? '—',
      diagnosis: (r.diagnosis as string) ?? '',
      notes: (r.notes as string) ?? null,
      prescription: (r.prescription as string) ?? null,
      next_appointment_date: (r.next_appointment_date as string) ?? null,
    }))
  } finally {
    loading.value = false
  }
}

watch(page, () => fetchRecords())
onMounted(() => fetchRecords())
</script>
