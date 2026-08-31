<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Meus Planos de Saude</h1>

    <LoadingSpinner v-if="loading" />

    <template v-else>
      <div v-if="plans.length === 0">
        <AppCard>
          <EmptyState message="Nenhum plano de saude atribuido." />
        </AppCard>
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2">
        <AppCard v-for="item in plans" :key="item.id">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-gray-900">{{ item.health_plan_name }}</h3>
              <span class="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Ativo
              </span>
            </div>
            <p v-if="item.health_plan_description" class="text-sm text-gray-500">
              {{ item.health_plan_description }}
            </p>
            <div class="flex items-center justify-between border-t pt-2">
              <span class="text-sm text-gray-500">Cobertura</span>
              <span class="text-sm font-medium text-gray-900">{{ item.coverage_percentage }}%</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-500">Mensalidade</span>
              <span class="text-sm font-semibold text-gray-900">
                R$ {{ formatCurrency(item.monthly_price) }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-500">Inicio</span>
              <span class="text-sm text-gray-700">{{ formatDate(item.start_date) }}</span>
            </div>
            <div v-if="item.end_date" class="flex items-center justify-between">
              <span class="text-sm text-gray-500">Fim</span>
              <span class="text-sm text-gray-700">{{ formatDate(item.end_date) }}</span>
            </div>
          </div>
        </AppCard>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import AppCard from '@/components/common/AppCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

interface PlanRow {
  id: string
  start_date: string
  end_date: string | null
  health_plan_name: string
  health_plan_description: string | null
  coverage_percentage: number
  monthly_price: number
}

const authStore = useAuthStore()
const loading = ref(true)
const plans = ref<PlanRow[]>([])

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

onMounted(async () => {
  try {
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('profile_id', authStore.user!.id)
      .single()

    if (!patient) return

    const { data } = await supabase
      .from('patient_health_plans')
      .select('id, start_date, end_date, health_plan:health_plans(name, description, coverage_percentage, monthly_price)')
      .eq('patient_id', (patient as any).id)
      .order('start_date', { ascending: false })

    plans.value = ((data ?? []) as any[]).map((item) => ({
      id: item.id as string,
      start_date: item.start_date as string,
      end_date: (item.end_date as string) ?? null,
      health_plan_name: (item.health_plan?.name as string) ?? '',
      health_plan_description: (item.health_plan?.description as string) ?? null,
      coverage_percentage: (item.health_plan?.coverage_percentage as number) ?? 0,
      monthly_price: (item.health_plan?.monthly_price as number) ?? 0,
    }))
  } finally {
    loading.value = false
  }
})
</script>
