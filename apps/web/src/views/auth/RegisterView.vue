<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-gray-900">Clinica Medica</h1>
        <p class="mt-1 text-sm text-gray-500">Crie sua conta de paciente</p>
      </div>

      <div class="rounded-xl border bg-white p-8 shadow-sm">
        <div v-if="success" class="text-center">
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-lg font-medium text-gray-900">Conta criada com sucesso!</h2>
          <p class="mt-2 text-sm text-gray-500">
            Verifique seu email para confirmar sua conta. Depois, faca login.
          </p>
          <router-link
            to="/login"
            class="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Ir para o login
          </router-link>
        </div>

        <form v-else @submit.prevent="handleRegister" class="space-y-4">
          <div v-if="error" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {{ error }}
          </div>

          <AppInput
            v-model="form.name"
            label="Nome completo"
            placeholder="Joao da Silva"
            :error="errors.name"
            required
          />

          <AppInput
            v-model="form.cpf"
            label="CPF"
            placeholder="000.000.000-00"
            :error="errors.cpf"
            required
          />

          <AppInput
            v-model="form.email"
            label="Email"
            type="email"
            placeholder="seu@email.com"
            :error="errors.email"
            required
          />

          <AppInput
            v-model="form.phone"
            label="Telefone"
            type="tel"
            placeholder="(11) 99999-0000"
            :error="errors.phone"
          />

          <AppInput
            v-model="form.password"
            label="Senha"
            type="password"
            placeholder="Minimo 8 caracteres"
            :error="errors.password"
            required
          />

          <AppInput
            v-model="form.confirmPassword"
            label="Confirmar senha"
            type="password"
            placeholder="Repita a senha"
            :error="errors.confirmPassword"
            required
          />

          <AppButton
            type="submit"
            :loading="authStore.loading"
            class="w-full"
          >
            Criar conta
          </AppButton>
        </form>

        <div class="mt-6 text-center text-sm text-gray-500">
          Ja tem conta?
          <router-link to="/login" class="font-medium text-blue-600 hover:text-blue-700">
            Faca login
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import AppInput from '@/components/common/AppInput.vue'
import AppButton from '@/components/common/AppButton.vue'

const authStore = useAuthStore()

const form = reactive({
  name: '',
  cpf: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

const errors = reactive({
  name: '',
  cpf: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

const error = ref('')
const success = ref(false)

function validateCpf(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let remainder = sum % 11
  const d1 = remainder < 2 ? 0 : 11 - remainder
  if (parseInt(digits[9]) !== d1) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  remainder = sum % 11
  const d2 = remainder < 2 ? 0 : 11 - remainder
  return parseInt(digits[10]) === d2
}

function validate(): boolean {
  let valid = true
  const e = { name: '', cpf: '', email: '', phone: '', password: '', confirmPassword: '' }

  if (!form.name || form.name.length < 2 || form.name.length > 200) {
    e.name = 'Nome deve ter entre 2 e 200 caracteres.'
    valid = false
  }

  if (!validateCpf(form.cpf)) {
    e.cpf = 'CPF invalido.'
    valid = false
  }

  if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    e.email = 'Email invalido.'
    valid = false
  }

  if (form.phone) {
    const phoneDigits = form.phone.replace(/\D/g, '')
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      e.phone = 'Telefone invalido.'
      valid = false
    }
  }

  if (!form.password || form.password.length < 8) {
    e.password = 'Senha deve ter pelo menos 8 caracteres.'
    valid = false
  }

  if (form.password !== form.confirmPassword) {
    e.confirmPassword = 'As senhas nao conferem.'
    valid = false
  }

  Object.assign(errors, e)
  return valid
}

async function handleRegister() {
  error.value = ''
  if (!validate()) return

  try {
    await authStore.register({
      name: form.name,
      cpf: form.cpf.replace(/\D/g, ''),
      email: form.email,
      password: form.password,
      phone: form.phone || undefined,
    })
    success.value = true
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Erro ao criar conta.'
  }
}
</script>
