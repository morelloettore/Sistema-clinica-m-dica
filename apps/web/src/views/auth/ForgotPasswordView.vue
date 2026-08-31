<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-gray-900">Clinica Medica</h1>
        <p class="mt-1 text-sm text-gray-500">Recuperar senha</p>
      </div>

      <div class="rounded-xl border bg-white p-8 shadow-sm">
        <div v-if="success" class="text-center">
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-lg font-medium text-gray-900">Email enviado!</h2>
          <p class="mt-2 text-sm text-gray-500">
            Se existir uma conta com este email, voce recebera um link para redefinir sua senha.
          </p>
          <router-link
            to="/login"
            class="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Voltar ao login
          </router-link>
        </div>

        <form v-else @submit.prevent="handleReset" class="space-y-4">
          <div v-if="error" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {{ error }}
          </div>

          <p class="text-sm text-gray-500">
            Informe seu email e enviaremos um link para redefinir sua senha.
          </p>

          <AppInput
            v-model="email"
            label="Email"
            type="email"
            placeholder="seu@email.com"
            :error="fieldError"
            required
          />

          <AppButton type="submit" :loading="loading" class="w-full">
            Enviar link de recuperacao
          </AppButton>
        </form>

        <div class="mt-6 text-center text-sm text-gray-500">
          Lembrou a senha?
          <router-link to="/login" class="font-medium text-blue-600 hover:text-blue-700">
            Faca login
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import AppInput from '@/components/common/AppInput.vue'
import AppButton from '@/components/common/AppButton.vue'

const email = ref('')
const fieldError = ref('')
const error = ref('')
const loading = ref(false)
const success = ref(false)

async function handleReset() {
  fieldError.value = ''
  error.value = ''

  if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    fieldError.value = 'Email invalido.'
    return
  }

  loading.value = true
  try {
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) throw err
    success.value = true
  } catch {
    success.value = true
  } finally {
    loading.value = false
  }
}
</script>
