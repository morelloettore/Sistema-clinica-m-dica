<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

async function handleLogout() {
  await auth.logout()
  toast.info('Sessão encerrada')
  router.push('/login')
}
</script>

<template>
  <header class="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
    <div class="flex items-center gap-4">
      <slot name="left" />
    </div>

    <div class="flex items-center gap-4">
      <button
        class="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        title="Notificações"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      </button>

      <div class="h-6 w-px bg-gray-200" />

      <div class="flex items-center gap-3">
        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
          {{ auth.user?.name?.charAt(0)?.toUpperCase() || '?' }}
        </div>
        <span class="hidden text-sm font-medium text-gray-700 md:block">{{ auth.user?.name }}</span>
      </div>

      <button
        class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        @click="handleLogout"
      >
        Sair
      </button>
    </div>
  </header>
</template>
