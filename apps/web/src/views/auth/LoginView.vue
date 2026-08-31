<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-gray-900">Clinica Medica</h1>
        <p class="mt-1 text-sm text-gray-500">Entre na sua conta</p>
      </div>

      <div class="rounded-xl border bg-white p-8 shadow-sm">
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div v-if="error" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {{ error }}
          </div>

          <AppInput
            v-model="form.email"
            label="Email"
            type="email"
            placeholder="seu@email.com"
            :error="errors.email"
            required
          />

          <AppInput
            v-model="form.password"
            label="Senha"
            type="password"
            placeholder="Sua senha"
            :error="errors.password"
            required
          />

          <div class="flex items-center justify-end">
            <router-link
              to="/forgot-password"
              class="text-sm text-blue-600 hover:text-blue-700"
            >
              Esqueceu a senha?
            </router-link>
          </div>

          <AppButton
            type="submit"
            :loading="authStore.loading"
            class="w-full"
          >
            Entrar
          </AppButton>
        </form>

        <div class="mt-6 text-center text-sm text-gray-500">
          Ainda nao tem conta?
          <router-link to="/register" class="font-medium text-blue-600 hover:text-blue-700">
            Cadastre-se
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { getDashboardRoute } from '@/router/guards/getDashboardRoute'
import AppInput from '@/components/common/AppInput.vue'
import AppButton from '@/components/common/AppButton.vue'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({ email: '', password: '' })
const errors = reactive({ email: '', password: '' })
const error = ref('')

function validate(): boolean {
  let valid = true
  errors.email = ''
  errors.password = ''

  if (!form.email) {
    errors.email = 'Email e obrigatorio.'
    valid = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Email invalido.'
    valid = false
  }

  if (!form.password) {
    errors.password = 'Senha e obrigatoria.'
    valid = false
  }

  return valid
}

async function handleLogin() {
  error.value = ''
  if (!validate()) return

  try {
    await authStore.login(form.email, form.password)
    const route = getDashboardRoute(authStore.user?.role)
    router.push(route)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Erro ao fazer login.'
  }
}
</script>
