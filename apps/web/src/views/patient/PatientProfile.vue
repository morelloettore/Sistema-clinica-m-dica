<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Meu Perfil</h1>

    <LoadingSpinner v-if="loading" />

    <AppCard v-else>
      <form @submit.prevent="handleSave" class="space-y-4">
        <div v-if="error" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
        <div v-if="success" class="rounded-lg bg-green-50 p-3 text-sm text-green-700">Perfil atualizado com sucesso!</div>

        <AppInput
          v-model="form.name"
          label="Nome"
          :error="errors.name"
          required
        />

        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            :value="profile?.email"
            disabled
            class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
          <p class="text-xs text-gray-400">Email nao pode ser alterado.</p>
        </div>

        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-700">CPF</label>
          <input
            type="text"
            :value="profile?.cpf"
            disabled
            class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
          <p class="text-xs text-gray-400">CPF nao pode ser alterado.</p>
        </div>

        <AppInput
          v-model="form.phone"
          label="Telefone"
          type="tel"
          placeholder="(11) 99999-0000"
          :error="errors.phone"
        />

        <div class="flex justify-end gap-3 pt-2">
          <AppButton type="submit" :loading="saving">Salvar</AppButton>
        </div>
      </form>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import AppCard from '@/components/common/AppCard.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppButton from '@/components/common/AppButton.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { Profile } from '@clinica/shared'

const authStore = useAuthStore()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref(false)
const profile = ref<Profile | null>(null)

const form = reactive({ name: '', phone: '' })
const errors = reactive({ name: '', phone: '' })

onMounted(async () => {
  try {
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authStore.user!.id)
      .single()
    if (err) throw err
    const row = data as Profile
    profile.value = row
    form.name = row.name ?? ''
    form.phone = row.phone ?? ''
  } catch {
    error.value = 'Erro ao carregar perfil.'
  } finally {
    loading.value = false
  }
})

async function handleSave() {
  error.value = ''
  success.value = false
  errors.name = ''
  errors.phone = ''

  if (!form.name || form.name.length < 2) {
    errors.name = 'Nome deve ter pelo menos 2 caracteres.'
    return
  }
  if (form.phone) {
    const digits = form.phone.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 11) {
      errors.phone = 'Telefone invalido.'
      return
    }
  }

  saving.value = true
  try {
    const { error: err } = await supabase
      .from('profiles')
      .update({ name: form.name, phone: form.phone || null } as never)
      .eq('id', authStore.user!.id)
    if (err) throw err
    success.value = true
    authStore.user!.name = form.name
  } catch {
    error.value = 'Erro ao salvar perfil.'
  } finally {
    saving.value = false
  }
}
</script>
